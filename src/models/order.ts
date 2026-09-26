/* ═══════════════════════════════════════════════════════════════════════
   Orders — a port of lib/data/models/order.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { asBool, asDate, asDouble, asInt, asString, money } from '../lib/format'
import { cartLineFromMap, type CartLine } from './cart'
import { verticalFromId, type Vertical } from './catalog'

/**
 * The stages an order moves through, in order. Anything the backend sends
 * that is not recognised lands on `placed` rather than breaking the tracker.
 */
export type OrderStage =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'arrived'
  | 'delivered'
  | 'cancelled'

export interface StageSpec {
  /** Customer-facing title, written as a statement of what is happening now. */
  title: string
  blurb: string
  icon: string
  color: string
  /**
   * Position on the four-step progress bar the customer sees. Ready and
   * dispatched share a step because the difference is invisible to them.
   */
  step: number
}

export const ORDER_STAGES: Record<OrderStage, StageSpec> = {
  placed: {
    title: 'Order placed',
    blurb: 'We have sent your order to the vendor.',
    icon: 'receipt',
    color: 'var(--color-brand)',
    step: 0,
  },
  confirmed: {
    title: 'Order accepted',
    blurb: 'The vendor accepted and is starting soon.',
    icon: 'verified',
    color: 'var(--color-brand)',
    step: 1,
  },
  preparing: {
    title: 'Being prepared',
    blurb: 'Your order is being made fresh.',
    icon: 'cooking',
    color: 'var(--color-brand)',
    step: 1,
  },
  ready: {
    title: 'Ready for pickup',
    blurb: 'Packed and waiting for a rider.',
    icon: 'bag',
    color: 'var(--color-brand)',
    step: 2,
  },
  dispatched: {
    title: 'On the way',
    blurb: 'Your rider is heading to you now.',
    icon: 'moped',
    color: 'var(--color-brand)',
    step: 2,
  },
  arrived: {
    title: 'Rider has arrived',
    blurb: 'Share your PIN with the rider to collect.',
    icon: 'pin',
    color: 'var(--color-appetite)',
    step: 3,
  },
  delivered: {
    title: 'Delivered',
    blurb: 'Enjoy. Thanks for ordering with Blorbmart.',
    icon: 'check',
    color: 'var(--color-success)',
    step: 4,
  },
  cancelled: {
    title: 'Cancelled',
    blurb: 'This order was cancelled.',
    icon: 'cancel',
    color: 'var(--color-danger)',
    step: 0,
  },
}

export function stageFromId(raw: unknown): OrderStage {
  switch (asString(raw).toLowerCase()) {
    case 'confirmed':
    case 'accepted':
    case 'processing':
      return 'confirmed'
    case 'preparing':
    case 'in_progress':
    case 'cooking':
      return 'preparing'
    case 'ready':
    case 'ready_for_pickup':
    case 'packed':
      return 'ready'
    case 'dispatched':
    case 'out_for_delivery':
    case 'shipped':
    case 'in_transit':
      return 'dispatched'
    case 'arrived':
    case 'at_door':
      return 'arrived'
    case 'delivered':
    case 'completed':
    case 'fulfilled':
      return 'delivered'
    case 'cancelled':
    case 'canceled':
    case 'refunded':
    case 'failed':
      return 'cancelled'
    default:
      return 'placed'
  }
}

export function isTerminal(stage: OrderStage): boolean {
  return stage === 'delivered' || stage === 'cancelled'
}

export function isLiveStage(stage: OrderStage): boolean {
  return !isTerminal(stage)
}

export type PaymentState = 'pending' | 'paid' | 'failed' | 'refunded'

export function paymentStateFromId(raw: unknown): PaymentState {
  switch (asString(raw).toLowerCase()) {
    case 'completed':
    case 'paid':
    case 'success':
    case 'successful':
      return 'paid'
    case 'failed':
    case 'cancelled':
      return 'failed'
    case 'refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

export const PAYMENT_LABELS: Record<PaymentState, string> = {
  paid: 'Paid',
  pending: 'Awaiting payment',
  failed: 'Payment failed',
  refunded: 'Refunded',
}

/** A rider's live progress toward the customer. */
export interface DeliveryTracking {
  /**
   * False once the trip is over — the backend retires tracking rather than
   * deleting it, so the panel can settle instead of vanishing mid-glance.
   */
  active: boolean
  status: string
  etaMinutes: number | null
  distanceKm: number | null
  /** Where the rider was at their last heartbeat (every ~20s on a trip). */
  riderLocation: LatLng | null
  /** The customer's drop-off pin, resolved by the backend. */
  destination: LatLng | null
  updatedAt: Date | null
}

export interface LatLng {
  lat: number
  lng: number
}

function latLngFromMap(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const lat = Number(m.latitude ?? m.lat)
  const lng = Number(m.longitude ?? m.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export function trackingFromMap(raw: unknown): DeliveryTracking | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const eta = m.etaMinutes
  const distance = m.distanceKm
  return {
    active: asBool(m.active),
    status: asString(m.status),
    etaMinutes: typeof eta === 'number' ? Math.round(eta) : null,
    distanceKm: typeof distance === 'number' ? distance : null,
    riderLocation: latLngFromMap(m.riderLocation),
    destination: latLngFromMap(m.destination),
    updatedAt: asDate(m.updatedAt),
  }
}

/** Whether there is a live rider position worth putting on a map. */
export function trackingHasRider(t: DeliveryTracking | null): boolean {
  return !!t && t.active && t.riderLocation != null
}

/** Whether there is something worth showing a waiting customer. */
export function trackingHasEta(t: DeliveryTracking | null): boolean {
  return !!t && t.active && t.etaMinutes != null && t.etaMinutes > 0
}

/**
 * How the remaining distance reads on the screen. Metres below a kilometre,
 * because "0.4 km away" is a worse thing to read than "400 m".
 */
export function trackingDistanceLabel(t: DeliveryTracking | null): string {
  const km = t?.distanceKm
  if (km == null || km <= 0) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export interface BlorbOrder {
  id: string
  stage: OrderStage
  total: number
  lines: CartLine[]
  storeId: string
  storeName: string
  vertical: Vertical
  subtotal: number
  deliveryFee: number
  serviceFee: number
  discount: number
  paymentState: PaymentState
  paymentMethod: string
  /**
   * Whether a delivery PIN has been issued for this order.
   *
   * The PIN itself is deliberately NOT on this document. It lives in a
   * subcollection no client can read, because Firestore rules cannot hide a
   * single field and vendors can read order documents. The buyer fetches the
   * digits over the authenticated API instead.
   */
  hasDeliveryPin: boolean
  createdAt: Date | null
  updatedAt: Date | null
  etaMinutes: number
  addressLabel: string
  riderName: string
  riderPhone: string
  cancelReason: string
  itemCount: number
  tracking: DeliveryTracking | null
}

export function orderFromMap(id: string, m: Record<string, unknown>): BlorbOrder {
  const rawLines = m.lines ?? m.items
  const lines: CartLine[] = Array.isArray(rawLines)
    ? rawLines
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map(cartLineFromMap)
    : []

  const address = m.address
  let addressLabel = ''
  if (address && typeof address === 'object') {
    const a = address as Record<string, unknown>
    addressLabel = [asString(a.addressLine1), asString(a.city)]
      .filter(Boolean)
      .join(', ')
  } else {
    addressLabel = asString(address)
  }

  return {
    id: asString(m.orderId, id),
    stage: stageFromId(m.orderStatus ?? m.status),
    total: asDouble(m.totalAmount ?? m.total),
    lines,
    storeId: asString(m.storeId),
    storeName: asString(m.storeName ?? m.businessName),
    vertical: verticalFromId(m.vertical),
    subtotal: asDouble(m.subtotal),
    deliveryFee: asDouble(m.deliveryFee),
    serviceFee: asDouble(m.serviceFee),
    discount: asDouble(m.discountAmount ?? m.discount),
    paymentState: paymentStateFromId(m.paymentStatus),
    paymentMethod: asString(m.paymentMethod),
    hasDeliveryPin: asBool(m.hasDeliveryPin),
    createdAt: asDate(m.createdAt),
    updatedAt: asDate(m.updatedAt),
    etaMinutes: asInt(m.etaMinutes, 35),
    addressLabel,
    riderName: asString(m.riderName),
    riderPhone: asString(m.riderPhone),
    cancelReason: asString(m.cancelReason),
    itemCount: asInt(
      m.totalItems,
      lines.reduce((n, l) => n + l.quantity, 0),
    ),
    tracking: trackingFromMap(m.tracking),
  }
}

export function orderIsLive(o: BlorbOrder): boolean {
  return isLiveStage(o.stage) && o.paymentState === 'paid'
}

/**
 * Whether this is a real order or just the document checkout writes before
 * anyone has paid.
 *
 * `createOrder` creates an order the moment the checkout screen opens — the
 * backend needs something to price against — so every abandoned checkout
 * leaves an unpaid document behind. Nobody was charged and no vendor was ever
 * told, so these are drafts, not orders, and showing them alongside real ones
 * reads as "you were billed for this".
 *
 * Refunded orders are deliberately NOT drafts: money moved, so they stay in
 * history. Neither is anything a vendor has already acted on.
 */
export function isCheckoutDraft(o: BlorbOrder): boolean {
  return (
    o.stage === 'placed' &&
    (o.paymentState === 'pending' || o.paymentState === 'failed')
  )
}

/**
 * Whether this order is at a point where its PIN should be shown. The digits
 * themselves are fetched separately over the API.
 */
export function showsPin(o: BlorbOrder): boolean {
  return (
    o.hasDeliveryPin &&
    o.paymentState === 'paid' &&
    o.stage !== 'cancelled' &&
    o.stage !== 'delivered'
  )
}

/** Rough arrival clock for the tracker. */
export function estimatedArrival(o: BlorbOrder): Date | null {
  if (!o.createdAt) return null
  return new Date(o.createdAt.getTime() + o.etaMinutes * 60_000)
}

export function shortOrderId(o: BlorbOrder): string {
  const trimmed = o.id.replace(/^ORD/, '')
  return trimmed.length <= 6 ? trimmed : trimmed.slice(-6)
}

export function orderSummaryLine(o: BlorbOrder): string {
  if (!o.lines.length) return `${o.itemCount} item${o.itemCount === 1 ? '' : 's'}`
  if (o.lines.length === 1) return `${o.lines[0].quantity}x ${o.lines[0].name}`
  return `${o.lines[0].name} +${o.lines.length - 1} more`
}

export function orderTotalLabel(o: BlorbOrder): string {
  return money(o.total)
}
