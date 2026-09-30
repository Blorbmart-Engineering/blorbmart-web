/* ═══════════════════════════════════════════════════════════════════════
   Events and tickets — a port of lib/data/repos/events_repo.dart.

   Browsing is public and cached briefly — an events list changes on the scale
   of days, and re-fetching it on every tab switch buys nothing. Buying goes
   through the backend without exception: inventory has to be reserved in a
   transaction and a ticket has to be signed by something that holds the
   secret, neither of which a browser can do.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import {
  eventFromMap,
  eventTicketFromMap,
  goingListFromMap,
  ticketOrderFromMap,
  type BlorbEvent,
  type EventTicket,
  type GoingList,
  type TicketOrder,
} from '../models/events'

let cached: BlorbEvent[] | null = null
let cachedAt = 0
const byId = new Map<string, BlorbEvent>()

function listOf<T>(raw: unknown, parse: (m: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map(parse)
}

export async function listEvents({
  refresh = false,
  category,
}: { refresh?: boolean; category?: string } = {}): Promise<BlorbEvent[]> {
  const fresh = cachedAt > 0 && Date.now() - cachedAt < 5 * 60_000
  if (!refresh && fresh && cached && !category) return cached

  const data = await Api.get('/api/events', {
    auth: false,
    query: category ? { category } : undefined,
  })
  const events = listOf(data.events, eventFromMap)

  for (const event of events) byId.set(event.id, event)
  if (!category) {
    cached = events
    cachedAt = Date.now()
  }
  return events
}

/**
 * One event, always fetched fresh: ticket counts on a detail screen are what
 * someone is about to spend money against.
 */
export async function getEvent(eventId: string): Promise<BlorbEvent> {
  const data = await Api.get(`/api/events/${encodeURIComponent(eventId)}`, { auth: false })
  const event = eventFromMap(data)
  byId.set(eventId, event)
  return event
}

export function cachedEvent(eventId: string): BlorbEvent | null {
  return byId.get(eventId) ?? null
}

export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const suffix = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `evt_${Date.now()}_${suffix}`
}

/**
 * Buys or claims tickets.
 *
 * The idempotency key is minted once per checkout screen and reused across
 * retries, so someone tapping twice on a slow connection ends up with one set
 * of tickets rather than two.
 */
export async function purchaseTickets({
  eventId,
  ticketTypeId,
  quantity,
  paymentMethod,
  holderName,
  holderPhone,
  idempotencyKey,
  pin,
}: {
  eventId: string
  ticketTypeId: string
  quantity: number
  paymentMethod: string
  holderName?: string
  holderPhone?: string
  idempotencyKey?: string
  /** The wallet PIN, on a wallet payment. */
  pin?: string
}): Promise<TicketOrder> {
  const data = await Api.post(`/api/events/${encodeURIComponent(eventId)}/purchase`, {
    body: {
      ticketTypeId,
      quantity,
      paymentMethod,
      ...(holderName ? { holderName } : {}),
      ...(holderPhone ? { holderPhone } : {}),
      ...(pin ? { pin } : {}),
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    },
  })
  return ticketOrderFromMap(data)
}

export async function verifyTicketOrder(
  orderId: string,
  reference?: string,
): Promise<TicketOrder> {
  const data = await Api.post(
    `/api/events/orders/${encodeURIComponent(orderId)}/verify`,
    { body: { ...(reference ? { reference } : {}) } },
  )
  return ticketOrderFromMap(data)
}

export async function myTickets(limit = 60): Promise<EventTicket[]> {
  const data = await Api.get('/api/events/tickets/mine', {
    query: { limit: String(limit) },
  })
  return listOf(data.tickets, eventTicketFromMap)
}

/**
 * Tickets for the strip on the events screen. A failure here is never worth
 * taking the listing down for.
 */
export async function myTicketsSafe(limit = 5): Promise<EventTicket[]> {
  try {
    return await myTickets(limit)
  } catch (e) {
    console.warn('[events] myTickets failed', e)
    return []
  }
}

export async function getTicket(ticketId: string): Promise<EventTicket | null> {
  try {
    const data = await Api.get(`/api/events/tickets/${encodeURIComponent(ticketId)}`)
    return eventTicketFromMap(data)
  } catch (e) {
    console.warn('[events] ticket failed', e)
    return null
  }
}

/* ── Who's going ───────────────────────────────────────────────────────── */

const goingPath = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}/going`

/**
 * The guest list: people who tapped "I'm going". Public, so a guest gets it
 * too; the token is sent when there is one, which is how the server knows
 * whether the viewer is on the list.
 */
export async function eventGoing(eventId: string, signedIn: boolean): Promise<GoingList> {
  try {
    return goingListFromMap(await Api.get(goingPath(eventId), { auth: signedIn }))
  } catch (e) {
    // A session that has not finished restoring is no reason to hide the list.
    if (!signedIn) throw e
    return goingListFromMap(await Api.get(goingPath(eventId), { auth: false }))
  }
}

/** Puts the viewer on the list, or takes them off. Answers with the new list. */
export async function setEventGoing(eventId: string, going: boolean): Promise<GoingList> {
  return goingListFromMap(await Api.post(goingPath(eventId), { body: { going } }))
}

export function clearEventsCache(): void {
  cached = null
  cachedAt = 0
  byId.clear()
}
