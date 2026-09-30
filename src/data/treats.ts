/* ═══════════════════════════════════════════════════════════════════════
   Send a treat — /api/treats on the backend.

   An order paid for by one person and delivered to another. The sender
   checks out as usual and names the friend; once it is paid the friend gets
   a link to /treat/<token>, which needs no account and holds the delivery
   PIN the rider asks for at the door.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import { asDate, asInt, asString } from '../lib/format'

/** What the sender entered, and the link once the server has made one. */
export interface Treat {
  recipientName: string
  recipientPhone: string
  message: string
  link: string
}

export interface TreatDraft {
  recipientName: string
  recipientPhone: string
  message: string
}

const treatFromMap = (m: unknown): Treat | null => {
  if (!m || typeof m !== 'object') return null
  const t = m as Record<string, unknown>
  const recipientName = asString(t.recipientName)
  if (!recipientName) return null
  return {
    recipientName,
    recipientPhone: asString(t.recipientPhone),
    message: asString(t.message),
    link: asString(t.link),
  }
}

const orderPath = (orderId: string) => `/api/treats/order/${encodeURIComponent(orderId)}`

/** Why these details cannot be sent yet, or null. Mirrors the server's check. */
export function treatProblem(draft: TreatDraft): string | null {
  if (draft.recipientName.trim().length < 2) return 'Add the name of the person this is for.'
  const digits = draft.recipientPhone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return 'Add a phone number the rider can reach them on.'
  return null
}

/** Marks an unpaid order as a treat. */
export async function saveTreat(orderId: string, draft: TreatDraft): Promise<Treat | null> {
  const data = await Api.post(orderPath(orderId), {
    body: {
      recipientName: draft.recipientName.trim(),
      recipientPhone: draft.recipientPhone.trim(),
      message: draft.message.trim(),
    },
  })
  return treatFromMap(data.treat)
}

/** Turns an unpaid order back into an ordinary one. */
export async function clearTreat(orderId: string): Promise<void> {
  await Api.post(orderPath(orderId), { body: { clear: true } })
}

/** The treat on one of this customer's orders, link included, or null. */
export async function treatForOrder(orderId: string): Promise<Treat | null> {
  try {
    const data = await Api.get(orderPath(orderId))
    return treatFromMap(data.treat)
  } catch (e) {
    console.warn(`[treats] forOrder(${orderId}) failed`, e)
    return null
  }
}

/* ── The friend's page ────────────────────────────────────────────────── */

export type TreatStage =
  | 'scheduled'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface TreatPage {
  senderName: string
  recipientName: string
  message: string
  storeName: string
  items: { name: string; quantity: number }[]
  stage: TreatStage
  stageLabel: string
  etaMinutes: number | null
  /** The delivery PIN. Null once delivered or cancelled. */
  pin: string | null
  rider: { name: string; phone: string; photoUrl: string } | null
  deliveredAt: Date | null
}

export async function viewTreat(token: string): Promise<TreatPage> {
  const m = await Api.get(`/api/treats/${encodeURIComponent(token)}`, { auth: false })
  const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : []
  const rider = m.rider && typeof m.rider === 'object' ? (m.rider as Record<string, unknown>) : null
  const pin = asString(m.pin)
  return {
    senderName: asString(m.senderName, 'A friend'),
    recipientName: asString(m.recipientName),
    message: asString(m.message),
    storeName: asString(m.storeName),
    items: items.map((i) => ({ name: asString(i.name, 'Item'), quantity: asInt(i.quantity, 1) })),
    stage: asString(m.stage, 'placed') as TreatStage,
    stageLabel: asString(m.stageLabel),
    etaMinutes: m.etaMinutes == null ? null : asInt(m.etaMinutes),
    pin: pin.length === 4 ? pin : null,
    rider: rider
      ? { name: asString(rider.name, 'Your rider'), phone: asString(rider.phone), photoUrl: asString(rider.photoUrl) }
      : null,
    deliveredAt: asDate(m.deliveredAt),
  }
}

/** The message a sender passes on with the link. */
export function treatShareText(treat: Treat, senderName: string): string {
  const from = senderName && senderName !== 'there' ? `${senderName} sent` : 'I sent'
  return `${from} you a treat on Blorbmart. Track it here and get the PIN the rider will ask for: ${treat.link}`
}
