/* ═══════════════════════════════════════════════════════════════════════
   Everything the app does with an order after the basket.
   A port of lib/data/repos/order_repo.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  collection,
  doc,
  getDoc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query as fbQuery,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { Api, ApiError } from '../lib/api'
import { asString } from '../lib/format'
import { cartLineToMap, type CartLine } from '../models/cart'
import type { Vertical } from '../models/catalog'
import {
  isCheckoutDraft,
  isLiveStage,
  orderFromMap,
  type BlorbOrder,
} from '../models/order'
/**
 * Starts the order: the backend writes the unpaid draft and answers with its
 * id. Payment happens separately, so an order exists in `pending` until money
 * clears — which is what lets a customer abandon Paystack and come back to the
 * same order rather than a new one.
 *
 * This used to be a Firestore write from here, and any account the security
 * rules refused got a bare "permission-denied" at the last step of checkout.
 * The server checks the account instead, repairs what sign-up should have
 * written, and refuses the rest with an ApiError carrying a `code` and a
 * sentence meant for the customer.
 */
export async function createOrder({
  lines,
  address,
  note,
  vertical = 'restaurants',
}: {
  lines: CartLine[]
  address: Record<string, unknown>
  note?: string
  vertical?: Vertical
}): Promise<string> {
  if (!auth.currentUser) throw new ApiError('Please sign in to order.')
  if (!lines.length) throw new ApiError('Your basket is empty.')

  const data = await Api.post('/api/orders/draft', {
    body: { lines: lines.map(cartLineToMap), address, vertical, ...(note ? { note } : {}) },
  })
  const orderId = asString(data.orderId)
  if (!orderId) throw new ApiError('We could not start your order. Try again.')
  return orderId
}

/**
 * Puts the customer's note on the unpaid order, or takes it off with an empty
 * one. The draft is written before anything has been typed, so the note is
 * sent on its own at the moment of paying.
 */
export async function saveOrderNote(orderId: string, note: string): Promise<void> {
  await Api.post(`/api/orders/${encodeURIComponent(orderId)}/note`, { body: { note } })
}

/**
 * Recalculates an order's totals. The client never decides what an order
 * costs — it only displays what the backend returns.
 *
 * `promoCode` is always sent, including as null. Omitting the key tells the
 * server "I have no opinion about the promo", and it answers by re-reading the
 * code it stored on the order last time — so a checkout that dropped the key
 * when the customer removed a code got the discount handed straight back to
 * it. Sending an explicit null is what clears it.
 */
export function calculatePricing(orderId: string, promoCode?: string) {
  return Api.post(`/api/orders/${encodeURIComponent(orderId)}/calculate`, {
    body: { promoCode: promoCode?.trim() ? promoCode.trim() : null },
  })
}

/**
 * `returnPath` is where Paystack should drop the customer once they have paid.
 *
 * Without it the backend fell back to PAYSTACK_CALLBACK_URL, a page on the API
 * itself — so a browser paid, landed on the API's "Payment Received" screen,
 * and never came back into the app. PaymentReturn never ran, the order was
 * never settled client-side, and /order-placed was never reached.
 *
 * A path, not a URL: the server joins it to the request's own Origin, so this
 * cannot be used to redirect somebody off-site.
 */
export function startPaystack(orderId: string, promoCode?: string) {
  return Api.post('/api/orders/checkout/paystack', {
    body: {
      orderId,
      returnPath: `/order-placed/${orderId}`,
      ...(promoCode ? { promoCode } : {}),
    },
  })
}

export function verifyPaystack(reference: string, orderId: string) {
  return Api.post('/api/orders/checkout/paystack/verify', {
    body: { reference, orderId },
  })
}

/** `pin` is the wallet PIN, which the backend checks before debiting. */
export function payWithWallet(orderId: string, promoCode?: string, pin?: string) {
  return Api.post('/api/orders/checkout/wallet', {
    body: { orderId, ...(promoCode ? { promoCode } : {}), ...(pin ? { pin } : {}) },
  })
}

/**
 * Tells the backend to alert the vendor. Best effort — the vendor still sees
 * the order in their dashboard if this call never lands.
 */
export async function notifyVendor(orderId: string): Promise<void> {
  try {
    await Api.post(`/api/orders/${encodeURIComponent(orderId)}/notify-new`)
  } catch (e) {
    console.warn('[orders] notifyVendor failed', e)
  }
}

/**
 * The customer's four-digit delivery PIN. Issued by the backend once payment
 * clears; readable only by the buyer who owns the order.
 */
export async function deliveryPin(orderId: string): Promise<string | null> {
  try {
    const data = await Api.get(`/api/orders/${encodeURIComponent(orderId)}/delivery-pin`)
    const pin = asString(data.pin)
    return pin.length === 4 ? pin : null
  } catch (e) {
    console.warn(`[orders] deliveryPin(${orderId}) failed`, e)
    return null
  }
}

/**
 * Live view of one order. The tracking screen subscribes to this, so a status
 * change in the vendor app appears without a refresh.
 */
export function watchOrder(
  orderId: string,
  onData: (order: BlorbOrder | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => onData(snap.exists() ? orderFromMap(snap.id, snap.data()) : null),
    (e) => console.warn(`[orders] watch(${orderId}) failed`, e),
  )
}

/** Orders in flight right now. Drives the home screen's live tracker card. */
export function watchActiveOrders(onData: (orders: BlorbOrder[]) => void): () => void {
  const uid = auth.currentUser?.uid
  if (!uid) {
    onData([])
    return () => {}
  }
  return onSnapshot(
    fbQuery(
      collection(db, 'orders'),
      where('userId', '==', uid),
      where('paymentStatus', '==', 'completed'),
      orderBy('createdAt', 'desc'),
      fbLimit(10),
    ),
    (snap) =>
      onData(
        snap.docs
          .map((d) => orderFromMap(d.id, d.data()))
          .filter((o) => isLiveStage(o.stage)),
      ),
    (e) => console.warn('[orders] activeOrders failed', e),
  )
}

const HISTORY_OVERFETCH = 3

/**
 * Every payment status a real order can carry. Drafts are `pending`,
 * `abandoned` or `failed`; a store that rejected an order leaves it
 * `refunded`, and that one belongs in the history.
 */
const PLACED_PAYMENT_STATES = ['completed', 'paid', 'success', 'successful', 'refunded']

/** The last history drawn, per account, so a return to the tab is instant. */
let historyMemo: { uid: string; orders: BlorbOrder[] } | null = null

/** The history this session has already drawn, without waiting. */
export function peekHistory(): BlorbOrder[] | null {
  const uid = auth.currentUser?.uid
  return uid && historyMemo?.uid === uid ? historyMemo.orders : null
}

/**
 * Order history, newest first — real orders only.
 *
 * The server does the filtering. This used to pull three times the page —
 * 120 whole order documents, items and addresses and all — and throw the
 * unpaid drafts away on the phone, which on a campus connection was most of
 * why the orders tab took so long to fill. Asking for placed orders only
 * uses the (userId, paymentStatus, createdAt) index the live-order card
 * already relies on.
 *
 * If that index is ever missing, the query fails with failed-precondition;
 * the old over-fetch takes over rather than leaving the screen on skeletons.
 * Unpaid checkout drafts are still dropped here, not in the screen, so
 * nothing downstream has to remember the rule.
 */
export function watchHistory(
  onData: (orders: BlorbOrder[]) => void,
  limit = 40,
  onError?: (error: unknown) => void,
): () => void {
  const uid = auth.currentUser?.uid
  if (!uid) {
    onData([])
    return () => {}
  }

  const deliver = (docs: { id: string; data: () => Record<string, unknown> }[]) => {
    const orders = docs
      .map((d) => orderFromMap(d.id, d.data()))
      .filter((o) => !isCheckoutDraft(o))
      .slice(0, limit)
    historyMemo = { uid, orders }
    onData(orders)
  }

  // The last resort, and the one that cannot be refused by an index or a
  // rule: the backend's own read (GET /api/orders/mine). Not live, so it
  // re-asks every 30 seconds while the screen is open.
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let stopped = false
  const fromApi = (cause: unknown) => {
    console.warn('[orders] history query refused, reading through the API', cause)
    const load = async () => {
      try {
        const data = await Api.get('/api/orders/mine', { query: { limit: String(limit) } })
        const list = Array.isArray(data.orders) ? (data.orders as Record<string, unknown>[]) : []
        if (!stopped) deliver(list.map((o) => ({ id: String(o.id), data: () => o })))
      } catch (err) {
        console.warn('[orders] history failed', err)
        if (!stopped) onError?.(err)
      }
    }
    void load()
    pollTimer = setInterval(() => void load(), 30_000)
  }

  let stop = onSnapshot(
    fbQuery(
      collection(db, 'orders'),
      where('userId', '==', uid),
      where('paymentStatus', 'in', PLACED_PAYMENT_STATES),
      orderBy('createdAt', 'desc'),
      fbLimit(limit),
    ),
    (snap) => deliver(snap.docs),
    (e) => {
      if ((e as { code?: string }).code !== 'failed-precondition') {
        fromApi(e)
        return
      }
      console.warn('[orders] history index missing, over-fetching instead', e)
      stop = onSnapshot(
        fbQuery(
          collection(db, 'orders'),
          where('userId', '==', uid),
          orderBy('createdAt', 'desc'),
          fbLimit(Math.min(limit * HISTORY_OVERFETCH, 200)),
        ),
        (snap) => deliver(snap.docs),
        (err) => fromApi(err),
      )
    },
  )
  return () => {
    stopped = true
    stop()
    if (pollTimer) clearInterval(pollTimer)
  }
}

/**
 * Marks a checkout draft as abandoned when the customer leaves without paying,
 * so unpaid documents stop accumulating in the collection — and in the admin
 * dashboard, which counts them.
 *
 * Two guards, both inside the transaction, because this races a payment that
 * may already be settling:
 *
 *   * the order must still be `pending`, so a webhook that landed while the
 *     screen was closing is never overwritten;
 *   * no payment attempt may have been started. `startPaystack` stamps a
 *     `paymentReference` on the order, and a reference that exists is a
 *     transaction the backend still owns — it may yet be verified.
 *
 * `orderStatus` is deliberately untouched. Writing 'cancelled' would move the
 * document out of draft territory and put "Cancelled" in the customer's
 * history for an order they never placed.
 */
export async function abandonDraft(orderId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  const ref = doc(db, 'orders', orderId)
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.data()
      if (!data) return
      if (data.userId !== uid) return
      if (asString(data.paymentStatus, 'pending') !== 'pending') return
      if (asString(data.paymentReference).length > 0) return

      tx.update(ref, {
        paymentStatus: 'abandoned',
        abandonedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
  } catch (e) {
    // Best effort. A draft that survives is hidden by history anyway.
    console.warn(`[orders] abandonDraft(${orderId}) failed`, e)
  }
}

export async function getOrder(orderId: string): Promise<BlorbOrder | null> {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId))
    return snap.exists() ? orderFromMap(snap.id, snap.data()) : null
  } catch (e) {
    console.warn(`[orders] get(${orderId}) failed`, e)
    return null
  }
}

/** Promo validation, used by the checkout screen before it re-prices. */
export function validatePromo(code: string, subtotal: number) {
  return Api.post('/api/promo/validate', { body: { code: code.trim().toUpperCase(), subtotal } })
}
