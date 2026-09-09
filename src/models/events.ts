/* ═══════════════════════════════════════════════════════════════════════
   Events and tickets — a port of lib/data/models/events.dart.

   An event is something an organizer sells entry to. A ticket tier can be
   free, and free is a real case rather than a discount: the whole point of
   letting an organizer list a free event is that people can take a ticket
   without a payment step in the way.
   ═══════════════════════════════════════════════════════════════════════ */

import { asBool, asDate, asDouble, asInt, asString, money } from '../lib/format'

/** One purchasable tier: "Early bird", "VIP table", "Free entry". */
export interface TicketType {
  id: string
  name: string
  description: string
  price: number
  /**
   * 0 means uncapped, which is the sensible default for a free event with no
   * seating.
   */
  quantity: number
  sold: number
  /** Null when the tier is uncapped. */
  remaining: number | null
  soldOut: boolean
  maxPerOrder: number
  salesEndAt: Date | null
}

export function ticketTypeFromMap(m: Record<string, unknown>): TicketType {
  return {
    id: asString(m.id),
    name: asString(m.name, 'Ticket'),
    description: asString(m.description),
    price: asDouble(m.price),
    quantity: asInt(m.quantity),
    sold: asInt(m.sold),
    remaining: m.remaining == null ? null : asInt(m.remaining),
    soldOut: asBool(m.soldOut),
    maxPerOrder: asInt(m.maxPerOrder),
    salesEndAt: asDate(m.salesEndAt),
  }
}

export const ticketIsFree = (t: TicketType) => t.price <= 0

export function salesClosed(t: TicketType): boolean {
  return t.salesEndAt != null && t.salesEndAt.getTime() < Date.now()
}

export function ticketAvailable(t: TicketType): boolean {
  return !t.soldOut && !salesClosed(t)
}

/**
 * The most anyone can take in one go. Uncapped tiers still get a ceiling,
 * because a stepper that runs to infinity is a way to fat-finger ten tickets
 * you did not want.
 */
export function orderCeiling(t: TicketType): number {
  const caps: number[] = [10]
  if (t.maxPerOrder > 0) caps.push(t.maxPerOrder)
  if (t.remaining != null) caps.push(t.remaining)
  return Math.min(...caps)
}

export function ticketPriceLabel(t: TicketType): string {
  return ticketIsFree(t) ? 'Free' : money(t.price)
}

export interface BlorbEvent {
  id: string
  title: string
  organizerId: string
  organizerName: string
  description: string
  category: string
  coverUrl: string
  venueName: string
  venueAddress: string
  city: string
  startsAt: Date | null
  endsAt: Date | null
  status: string
  ticketTypes: TicketType[]
  totalCapacity: number
  totalSold: number
  lowestPrice: number
  isFree: boolean
  soldOut: boolean
}

export function eventFromMap(m: Record<string, unknown>): BlorbEvent {
  const raw = m.ticketTypes
  return {
    id: asString(m.id),
    title: asString(m.title, 'Event'),
    organizerId: asString(m.organizerId),
    organizerName: asString(m.organizerName),
    description: asString(m.description),
    category: asString(m.category, 'general'),
    coverUrl: asString(m.coverUrl),
    venueName: asString(m.venueName),
    venueAddress: asString(m.venueAddress),
    city: asString(m.city),
    startsAt: asDate(m.startsAt),
    endsAt: asDate(m.endsAt),
    status: asString(m.status, 'draft'),
    ticketTypes: Array.isArray(raw)
      ? raw
          .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
          .map(ticketTypeFromMap)
      : [],
    totalCapacity: asInt(m.totalCapacity),
    totalSold: asInt(m.totalSold),
    lowestPrice: asDouble(m.lowestPrice),
    isFree: asBool(m.isFree),
    soldOut: asBool(m.soldOut),
  }
}

export const eventIsPublished = (e: BlorbEvent) => e.status === 'published'

export function eventHasStarted(e: BlorbEvent): boolean {
  return e.startsAt != null && e.startsAt.getTime() < Date.now()
}

export function eventHasEnded(e: BlorbEvent): boolean {
  const ends = e.endsAt ?? e.startsAt
  return ends != null && ends.getTime() < Date.now()
}

export function eventOnSale(e: BlorbEvent): TicketType[] {
  return e.ticketTypes.filter(ticketAvailable)
}

/**
 * What the button and the card badge say. Free reads as an invitation, "From
 * ₦2,000" reads as a price — both are more useful than a range.
 */
export function eventPriceLabel(e: BlorbEvent): string {
  if (!e.ticketTypes.length) return '—'
  if (e.isFree) return 'Free'
  if (e.ticketTypes.length === 1) return money(e.ticketTypes[0].price)
  return `From ${money(e.lowestPrice)}`
}

export function eventWhereLabel(e: BlorbEvent): string {
  if (e.venueName && e.city) return `${e.venueName} · ${e.city}`
  if (e.venueName) return e.venueName
  if (e.city) return e.city
  return e.venueAddress
}

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'refunded'

export interface EventTicket {
  id: string
  eventId: string
  /**
   * The exact string that goes into the QR. Produced and signed by the
   * backend — the app never builds one, because a ticket the client could
   * mint is not a ticket.
   */
  qr: string
  orderId: string
  eventTitle: string
  ticketTypeName: string
  holderName: string
  holderPhone: string
  price: number
  seat: string
  reference: string
  status: TicketStatus
  paymentMethod: string
  usedAt: Date | null
  createdAt: Date | null
  eventStartsAt: Date | null
  venueName: string
}

export function eventTicketFromMap(m: Record<string, unknown>): EventTicket {
  const status = asString(m.status)
  return {
    id: asString(m.id),
    eventId: asString(m.eventId),
    qr: asString(m.qr),
    orderId: asString(m.orderId),
    eventTitle: asString(m.eventTitle),
    ticketTypeName: asString(m.ticketTypeName),
    holderName: asString(m.holderName),
    holderPhone: asString(m.holderPhone),
    price: asDouble(m.price),
    seat: asString(m.seat),
    reference: asString(m.reference),
    status:
      status === 'used'
        ? 'used'
        : status === 'cancelled'
          ? 'cancelled'
          : status === 'refunded'
            ? 'refunded'
            : 'valid',
    paymentMethod: asString(m.paymentMethod),
    usedAt: asDate(m.usedAt),
    createdAt: asDate(m.createdAt),
    eventStartsAt: null,
    venueName: '',
  }
}

export function ticketWithEvent(t: EventTicket, event: BlorbEvent): EventTicket {
  return {
    ...t,
    eventTitle: t.eventTitle || event.title,
    eventStartsAt: event.startsAt,
    venueName: eventWhereLabel(event),
  }
}

export const ticketIsUsable = (t: EventTicket) => t.status === 'valid'

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  valid: 'Valid',
  used: 'Checked in',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  valid: 'var(--color-success)',
  used: 'var(--color-brand)',
  cancelled: 'var(--color-danger)',
  refunded: 'var(--color-danger)',
}

/** One purchase, which yields one or more tickets. */
export interface TicketOrder {
  id: string
  eventId: string
  eventTitle: string
  ticketTypeName: string
  quantity: number
  amount: number
  status: string
  paymentStatus: string
  paymentMethod: string
  reference: string
  authorizationUrl: string
  failureReason: string
  tickets: EventTicket[]
}

export function ticketOrderFromMap(m: Record<string, unknown>): TicketOrder {
  const raw = m.tickets
  return {
    id: asString(m.id),
    eventId: asString(m.eventId),
    eventTitle: asString(m.eventTitle),
    ticketTypeName: asString(m.ticketTypeName),
    quantity: asInt(m.quantity),
    amount: asDouble(m.amount),
    status: asString(m.status, 'pending'),
    paymentStatus: asString(m.paymentStatus, 'pending'),
    paymentMethod: asString(m.paymentMethod),
    reference: asString(m.reference),
    authorizationUrl: asString(m.authorizationUrl),
    failureReason: asString(m.failureReason),
    tickets: Array.isArray(raw)
      ? raw
          .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
          .map(eventTicketFromMap)
      : [],
  }
}

export const ticketOrderIsIssued = (o: TicketOrder) => o.status === 'issued'

export function ticketOrderNeedsPayment(o: TicketOrder): boolean {
  return o.authorizationUrl.length > 0 && !ticketOrderIsIssued(o)
}
