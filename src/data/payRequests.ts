/* ═══════════════════════════════════════════════════════════════════════
   "Pay for me" links — /api/pay-requests on the backend.

   A customer builds a basket and, instead of paying, sends a link to
   somebody who will. The link opens /pay/<token> here, which needs no
   account. The order stays the requester's: they get the tracking, the PIN
   and any refund; the payer only pays.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import { asDate, asDouble, asInt, asString, asStringList } from '../lib/format'

export type PayRequestStatus = 'open' | 'paid' | 'cancelled' | 'expired'

export interface PayRequestItem {
  name: string
  quantity: number
  lineTotal: number
  addons: string[]
}

export interface PayRequest {
  token: string
  status: PayRequestStatus
  requesterName: string
  message: string
  storeName: string
  items: PayRequestItem[]
  subtotal: number
  deliveryFee: number
  serviceFee: number
  discount: number
  deliveryDiscount: number
  total: number
  paidByName: string
  expiresAt: Date | null
  /** Only on the requester's own view. */
  orderId: string
  link: string
}

const STATUSES: PayRequestStatus[] = ['open', 'paid', 'cancelled', 'expired']

export function payRequestFromMap(m: Record<string, unknown>): PayRequest {
  const status = asString(m.status) as PayRequestStatus
  const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : []
  return {
    token: asString(m.token),
    status: STATUSES.includes(status) ? status : 'open',
    requesterName: asString(m.requesterName, 'A Blorbmart customer'),
    message: asString(m.message),
    storeName: asString(m.storeName),
    items: items.map((i) => ({
      name: asString(i.name, 'Item'),
      quantity: asInt(i.quantity, 1),
      lineTotal: asDouble(i.lineTotal),
      addons: asStringList(i.addons),
    })),
    subtotal: asDouble(m.subtotal),
    deliveryFee: asDouble(m.deliveryFee),
    serviceFee: asDouble(m.serviceFee),
    discount: asDouble(m.discountAmount),
    deliveryDiscount: asDouble(m.deliveryDiscount),
    total: asDouble(m.totalAmount),
    paidByName: asString(m.paidByName),
    expiresAt: asDate(m.expiresAt),
    orderId: asString(m.orderId),
    link: asString(m.link),
  }
}

const tokenPath = (token: string) => `/api/pay-requests/${encodeURIComponent(token)}`
const orderPath = (orderId: string) => `/api/pay-requests/order/${encodeURIComponent(orderId)}`

/* ── The person asking ────────────────────────────────────────────────── */

/** Turns an unpaid checkout draft into a link. Asking twice gives the same one. */
export async function askSomeoneToPay(
  orderId: string,
  { promoCode, message }: { promoCode?: string; message?: string } = {},
): Promise<PayRequest> {
  const data = await Api.post('/api/pay-requests', {
    body: { orderId, ...(promoCode ? { promoCode } : {}), ...(message ? { message } : {}) },
  })
  return payRequestFromMap(data)
}

/** The link on one of this customer's orders, or null if it has none. */
export async function payRequestForOrder(orderId: string): Promise<PayRequest | null> {
  const data = await Api.get(orderPath(orderId))
  const request = data.request
  return request && typeof request === 'object' ? payRequestFromMap(request as Record<string, unknown>) : null
}

/** Links still waiting on somebody. Never worth failing a screen for. */
export async function myOpenPayRequests(): Promise<PayRequest[]> {
  try {
    const data = await Api.get('/api/pay-requests/mine')
    const list = Array.isArray(data.requests) ? (data.requests as Record<string, unknown>[]) : []
    return list.map(payRequestFromMap)
  } catch (e) {
    console.warn('[payRequests] mine failed', e)
    return []
  }
}

export async function cancelPayRequest(orderId: string): Promise<PayRequest> {
  return payRequestFromMap(await Api.post(`${orderPath(orderId)}/cancel`))
}

/* ── The person paying ────────────────────────────────────────────────── */

/** The public page. No account needed, so no token is sent. */
export async function viewPayRequest(token: string): Promise<PayRequest> {
  return payRequestFromMap(await Api.get(tokenPath(token), { auth: false }))
}

/**
 * Starts a card payment for a guest and answers with Paystack's page.
 *
 * `expectedAmount` is the total this page drew. The server refuses with
 * PRICE_CHANGED if the order now costs something else, so nobody is charged
 * a figure they were not shown.
 */
export async function startPayRequestCard(
  token: string,
  { email, name, expectedAmount }: { email: string; name?: string; expectedAmount: number },
): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await Api.post(`${tokenPath(token)}/pay`, {
    auth: false,
    body: { email, expectedAmount, ...(name ? { name } : {}) },
  })
  return { authorizationUrl: asString(data.authorizationUrl), reference: asString(data.reference) }
}

export type PayOutcome = 'applied' | 'extra' | 'pending' | 'failed' | 'already_paid'

/** Back from Paystack: settles the charge and answers with the request as it now is. */
export async function verifyPayRequest(
  token: string,
  reference: string,
): Promise<{ outcome: PayOutcome; request: PayRequest }> {
  const data = await Api.post(`${tokenPath(token)}/verify`, { auth: false, body: { reference } })
  return {
    outcome: asString(data.outcome, 'pending') as PayOutcome,
    request: payRequestFromMap((data.request ?? {}) as Record<string, unknown>),
  }
}

/** A signed-in payer's own wallet. `pin` is their wallet PIN. */
export async function payRequestFromWallet(
  token: string,
  { pin, expectedAmount }: { pin?: string; expectedAmount: number },
): Promise<PayRequest> {
  const data = await Api.post(`${tokenPath(token)}/pay/wallet`, {
    body: { expectedAmount, ...(pin ? { pin } : {}) },
  })
  return payRequestFromMap((data.request ?? {}) as Record<string, unknown>)
}

/** The message a requester sends with their link. */
export function payRequestShareText(request: PayRequest): string {
  const what = request.storeName ? `my order from ${request.storeName}` : 'my order'
  return `Please help me pay for ${what} on Blorbmart. It takes a minute, by card or transfer: ${request.link}`
}
