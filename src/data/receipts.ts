/* ═══════════════════════════════════════════════════════════════════════
   The one place receipts come from — a port of lib/data/repos/receipt_repo.dart.

   Every kind of transaction is fetched through the same endpoint and comes
   back in the same shape, already signed. Nothing here builds a receipt
   locally: a receipt the client assembled would carry no signature, and a
   receipt without a signature is a screenshot.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api, ApiError } from '../lib/api'
import { receiptFromEnvelope, type BlorbReceipt, type ReceiptKind } from '../models/receipt'

interface Cached {
  receipt: BlorbReceipt
  at: number
}

/**
 * Small and short-lived: a receipt is usually opened, shared, and closed. Long
 * enough that tapping Share right after opening does not refetch, short enough
 * that a pending payment settling is picked up.
 */
const cache = new Map<string, Cached>()
const TTL_MS = 2 * 60_000

export async function fetchReceipt(
  kind: ReceiptKind,
  id: string,
  refresh = false,
): Promise<BlorbReceipt> {
  if (!id.trim()) throw new ApiError('That transaction has no receipt yet.')

  const key = `${kind}:${id}`
  const cached = cache.get(key)
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) return cached.receipt

  const data = await Api.get(`/api/receipts/${kind}/${encodeURIComponent(id)}`, {
    query: { format: 'json' },
  })
  const receipt = receiptFromEnvelope(data)
  cache.set(key, { receipt, at: Date.now() })
  return receipt
}

/**
 * The printable PDF, as an object URL.
 *
 * Fetched as an authenticated blob rather than opened with `?token=` — a live
 * credential in a URL lands in browser history, the Referer header and any
 * proxy log. Caller must revokeObjectURL when done.
 */
export function receiptPdfUrl(kind: ReceiptKind, id: string): Promise<string> {
  return Api.blob(`/api/receipts/${kind}/${encodeURIComponent(id)}?format=pdf`)
}

export function clearReceiptCache(): void {
  cache.clear()
}
