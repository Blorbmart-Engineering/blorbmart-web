/* ═══════════════════════════════════════════════════════════════════════
   The customer's wallet: balance, ledger and top-ups.
   A port of lib/data/repos/wallet_repo.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { Api, ApiError } from '../lib/api'
import { asDate, asDouble, asString } from '../lib/format'

/**
 * The balance, live.
 *
 * `balance()` below is a one-off read, cached for a minute. Screens that used
 * only that showed whatever the balance was when they opened, so money that
 * landed — a top-up finishing, a refund — did not appear until the customer
 * reloaded (QA-BM-WEB-002, item 5). This follows the wallet document itself,
 * which the backend rewrites on every movement, and keeps the cache in step
 * so the next `balance()` agrees with what is on screen.
 *
 * Returns the unsubscribe function, so an effect can return it directly.
 */
export function watchLiveBalance(onValue: (value: number) => void): () => void {
  const uid = auth.currentUser?.uid
  if (!uid) return () => undefined
  return onSnapshot(
    doc(db, 'wallets', uid),
    (snap) => {
      // An account from before wallets had their own document has none;
      // `balance()` covers it through the API's fallback.
      if (!snap.exists()) return
      const value = asDouble(snap.data().balance)
      cachedBalance = value
      cachedAt = Date.now()
      onValue(value)
    },
    (error) => console.warn('[wallet] live balance stopped', error.code),
  )
}

/** One line in the wallet ledger. */
export interface WalletEntry {
  id: string
  amount: number
  type: string
  description: string
  status: string
  reference: string
  balanceAfter: number
  at: Date | null
  /**
   * The Paystack page this top-up was started on.
   *
   * Present only while the payment is unfinished, and the whole reason an
   * "awaiting" row is now something you can act on rather than a dead end.
   */
  authorizationUrl: string
  /** `bank_transfer` for money sent to the customer's own account number. */
  paymentMethod: string
}

export function walletEntryFromMap(m: Record<string, unknown>): WalletEntry {
  const metadata = (m.metadata ?? {}) as Record<string, unknown>
  return {
    id: asString(m.id, asString(m.docId)),
    amount: asDouble(m.amount),
    type: asString(m.type, 'transaction'),
    description: asString(m.description, 'Wallet transaction'),
    status: asString(m.status, 'completed'),
    reference: asString(m.reference),
    balanceAfter: asDouble(m.newBalance),
    at: asDate(m.timestamp ?? m.createdAt),
    authorizationUrl: asString(m.authorizationUrl, asString(metadata.authorizationUrl)),
    paymentMethod: asString(m.paymentMethod),
  }
}

export const entryIsCredit = (e: WalletEntry) => e.amount >= 0
export const entryIsPending = (e: WalletEntry) => e.status === 'pending'

/**
 * Started, never paid for, and old enough that the backend has checked with
 * Paystack and confirmed no money moved.
 */
export const entryIsAbandoned = (e: WalletEntry) => e.status === 'abandoned'

/** Whether tapping this row can still finish the payment. */
export const entryCanComplete = (e: WalletEntry) =>
  entryIsPending(e) && e.authorizationUrl.length > 0

/** Whether this row is unfinished business of any kind. */
export const entryIsUnsettled = (e: WalletEntry) =>
  entryIsPending(e) || entryIsAbandoned(e)

export function entryStatusLabel(e: WalletEntry): string {
  switch (e.status) {
    case 'pending':
      return 'Awaiting payment'
    case 'abandoned':
      return 'Not completed'
    case 'failed':
      return 'Failed'
    case 'refunded':
      return 'Refunded'
    default:
      return ''
  }
}

export function entryTitle(e: WalletEntry): string {
  switch (e.type) {
    case 'deposit':
      return e.paymentMethod === 'bank_transfer' ? 'Bank transfer' : 'Wallet top-up'
    case 'refund':
      return 'Refund'
    case 'debit':
      return e.description
    case 'withdrawal':
      return 'Withdrawal'
    default:
      return e.description
  }
}

let cachedBalance: number | null = null
let cachedAt = 0

/**
 * Cached for a minute so checkout, the wallet tab and the bills screen asking
 * at once cost one request rather than three.
 */
export async function balance(refresh = false): Promise<number> {
  const uid = auth.currentUser?.uid
  if (!uid) return 0

  const fresh = cachedAt > 0 && Date.now() - cachedAt < 60_000
  if (!refresh && fresh && cachedBalance != null) return cachedBalance

  try {
    const data = await Api.get(`/api/wallet/${encodeURIComponent(uid)}`)
    const value = asDouble(data.balance)
    cachedBalance = value
    cachedAt = Date.now()
    return value
  } catch (e) {
    console.warn('[wallet] balance failed', e)
    return cachedBalance ?? 0
  }
}

export function invalidateBalance(): void {
  cachedBalance = null
  cachedAt = 0
}

export async function transactions(limit = 40): Promise<WalletEntry[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const data = await Api.get(`/api/wallet/${encodeURIComponent(uid)}/transactions`, {
      query: { limit: String(limit) },
    })
    const raw = data.transactions ?? data.data ?? []
    if (!Array.isArray(raw)) return []
    return raw
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map(walletEntryFromMap)
  } catch (e) {
    console.warn('[wallet] transactions failed', e)
    return []
  }
}

/* ── Bank transfer account ───────────────────────────────────────────── */

/**
 * The customer's own account number (a Paystack dedicated account at Titan).
 * Money sent to it from any bank app lands in the wallet on its own.
 */
export interface TransferAccount {
  accountNumber: string
  accountName: string
  bankName: string
}

const transferAccountFrom = (data: Record<string, unknown>): TransferAccount | null => {
  const raw = data.account as Record<string, unknown> | null | undefined
  if (!raw || !asString(raw.accountNumber)) return null
  return {
    accountNumber: asString(raw.accountNumber),
    accountName: asString(raw.accountName),
    bankName: asString(raw.bankName, 'Paystack-Titan'),
  }
}

/** Keyed by uid, so signing into another account never shows the last one's number. */
let cachedAccount: { uid: string; account: TransferAccount } | null = null

/** The account if the customer already has one; null if not yet opened. */
export async function transferAccount(): Promise<TransferAccount | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  if (cachedAccount?.uid === uid) return cachedAccount.account
  const data = await Api.get('/api/wallet/virtual-account')
  const account = transferAccountFrom(data)
  if (account) cachedAccount = { uid, account }
  return account
}

/**
 * Opens the account, or returns the one already open. Name and phone are
 * only needed when the backend answers PROFILE_INCOMPLETE.
 */
export async function openTransferAccount(details?: {
  firstName?: string
  lastName?: string
  phone?: string
}): Promise<TransferAccount> {
  const data = await Api.post('/api/wallet/virtual-account', { body: details ?? {} })
  const account = transferAccountFrom(data)
  if (!account) throw new ApiError('We could not open your account number. Try again.')
  const uid = auth.currentUser?.uid
  if (uid) cachedAccount = { uid, account }
  return account
}

/**
 * "I've sent it": asks the backend to check Paystack for transfers the
 * webhook has not delivered yet. Returns how much was credited just now.
 */
export async function checkForTransfer(): Promise<number> {
  const data = await Api.post('/api/wallet/virtual-account/sync')
  invalidateBalance()
  return asDouble(data.amount)
}

/** Starts a Paystack top-up. Returns the authorization URL to open. */
export async function startTopUp(amount: number) {
  const user = auth.currentUser
  if (!user) throw new ApiError('Please sign in first.')

  return Api.post('/api/wallet/fund', {
    body: {
      userId: user.uid,
      amount,
      // Come back to the wallet rather than to the API's own callback page.
      // See the note on startPaystack in data/orders.ts.
      returnPath: '/wallet',
      ...(user.email ? { email: user.email } : {}),
    },
  })
}

/**
 * Confirms a top-up with the backend, which confirms it with Paystack.
 *
 * The path matters: this used to post to `/api/wallet/verify`, which no route
 * ever answered. Every successful top-up therefore ended in "could not
 * complete that top-up" and a ledger row stuck on pending. The backend now
 * answers on both paths; the app asks on the one that was always real.
 */
export async function verifyTopUp(reference: string): Promise<void> {
  await Api.post('/api/wallet/paystack/verify', { body: { reference } })
  invalidateBalance()
}

/**
 * Gives up on an unfinished top-up.
 *
 * The backend checks with Paystack before writing anything, so a payment that
 * actually went through is credited instead of being cancelled. Returns the
 * transaction's settled status: `abandoned` when it really was never paid, or
 * `completed` when Paystack says it went through after all.
 */
export async function cancelTopUp(reference: string): Promise<string> {
  const data = await Api.post(
    `/api/wallet/transactions/${encodeURIComponent(reference)}/cancel`,
  )
  invalidateBalance()
  return asString(data.status, 'abandoned')
}
