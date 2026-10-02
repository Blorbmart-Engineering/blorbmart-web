/* ═══════════════════════════════════════════════════════════════════════
   Where tapping a notification goes.

   The backend stores a link only on some notifications (`actionUrl`), and the
   payment ones mostly carry ids instead: a wallet reference, a bill id, an
   order number. This turns either into a screen, so a payment notice always
   opens the receipt or details it is about.

   Kept in step with notifications_screen.dart in the phone app.
   ═══════════════════════════════════════════════════════════════════════ */

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The screen for one notification, or null when it only informs. */
export function notificationRoute(data: Record<string, unknown>): string | null {
  const meta = (data.metadata && typeof data.metadata === 'object' ? data.metadata : {}) as Record<string, unknown>
  const type = String(data.type ?? meta.type ?? '').toLowerCase()

  // A link written by the backend wins — but never a staff console path.
  const explicit = str(data.route) ?? str(data.link) ?? str(data.actionUrl)
  if (explicit?.startsWith('/') && !explicit.startsWith('/campus')) return explicit

  const reference = str(meta.reference)
  const billId = str(meta.billId)
  const orderId = str(meta.orderId)
  const giftCardId = str(meta.giftCardId)
  const groupCode = str(meta.groupCode)

  if (billId || type.startsWith('bill')) return billId ? `/bills/receipt/${encodeURIComponent(billId)}` : '/bills/history'
  if (type === 'event_ticket') return '/tickets'
  if (type.startsWith('gift_card')) {
    return type === 'gift_card_redeemed' ? '/wallet' : giftCardId ? `/gifts/${encodeURIComponent(giftCardId)}` : '/gifts'
  }
  if (type === 'group_order' && groupCode) return `/group/${encodeURIComponent(groupCode)}`
  if (reference && /^(wallet|deposit|payment|refund|credit|debit|reversal|withdrawal)/.test(type)) {
    return `/receipt/wallet/${encodeURIComponent(reference)}`
  }
  if (orderId && (type === 'order' || type === 'rate_order' || type === 'treat')) {
    // The payment itself opens its receipt; every later update opens tracking.
    const status = String(meta.status ?? '').toLowerCase()
    return ['placed', 'paid', 'payment_confirmed'].includes(status)
      ? `/receipt/order/${encodeURIComponent(orderId)}`
      : `/track/${encodeURIComponent(orderId)}`
  }
  if (/^(wallet|deposit|refund|credit|debit|reversal)/.test(type)) return '/transactions'
  if (type === 'marketplace') return '/marketplace/mine'
  return null
}
