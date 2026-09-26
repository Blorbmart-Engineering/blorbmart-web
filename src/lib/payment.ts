/* ═══════════════════════════════════════════════════════════════════════
   Paystack, on the web.

   The phone build opens the authorization URL in a WebView and watches for
   the callback (lib/features/payments/paystack_screen.dart). A browser has no
   equivalent: a payment page in an iframe is blocked by Paystack, and a popup
   is eaten by every mobile browser worth naming. So the web build does a
   full-page redirect and picks the transaction back up on return.

   What survives the redirect is one record in localStorage. It has to be
   storage rather than a URL parameter, because the customer may come back
   through the browser's back button, a bookmark, or the installed app icon —
   none of which carry our query string. Paystack does append `reference` /
   `trxref` when it redirects, and that is preferred when present; the stored
   copy is the fallback that makes the other paths work.
   ═══════════════════════════════════════════════════════════════════════ */

const PENDING_KEY = 'blorb_pending_payment_v1'

/** What was being paid for, so the return knows which endpoint to verify on. */
export type PaymentKind = 'order' | 'wallet' | 'bill' | 'ticket' | 'gift'

export interface PendingPayment {
  kind: PaymentKind
  reference: string
  /** Order id, bill id, ticket-order id or gift card id. Empty for a wallet top-up. */
  id: string
  /** Where to send the customer once it verifies. */
  returnTo: string
  startedAt: number
}

/**
 * A pending payment older than this is stale — the customer abandoned it days
 * ago, and silently verifying it on some future launch would be baffling.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

export function rememberPending(payment: Omit<PendingPayment, 'startedAt'>): void {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ ...payment, startedAt: Date.now() } satisfies PendingPayment),
    )
  } catch (e) {
    console.warn('[payment] could not record the pending payment', e)
  }
}

export function readPending(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPayment
    if (!parsed?.reference || !parsed?.kind) return null
    if (Date.now() - (parsed.startedAt ?? 0) > MAX_AGE_MS) {
      clearPending()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* nothing to clear */
  }
}

/**
 * The reference Paystack appended on the way back, if any. It uses `trxref`
 * and `reference` interchangeably depending on the integration, so both are
 * read.
 */
export function referenceFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('reference') ?? params.get('trxref')
  } catch {
    return null
  }
}

/**
 * Hands the browser to Paystack.
 *
 * Records the pending payment first — if this runs in the other order, a slow
 * write loses the reference and the customer comes back to an app that has no
 * idea what they just paid for.
 */
export function goToPaystack(url: string, pending: Omit<PendingPayment, 'startedAt'>): void {
  rememberPending(pending)
  window.location.assign(url)
}
