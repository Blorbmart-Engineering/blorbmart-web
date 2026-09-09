/* ═══════════════════════════════════════════════════════════════════════
   Delivery address — a port of lib/models/delivery_address.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { asBool, asDouble, asString } from '../lib/format'

export interface DeliveryAddress {
  docId: string
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  phone: string
  isDefault: boolean
  lat: number | null
  lng: number | null
  /** 'campus' | 'off_campus' — used by the backend to calculate delivery fee. */
  deliveryZone: string
}

export function addressFromJson(data: Record<string, unknown>): DeliveryAddress {
  const lat = data.lat ?? data.latitude
  const lng = data.lng ?? data.longitude
  return {
    docId: asString(data.docId, asString(data.id)),
    name: asString(data.name),
    // Accept both legacy keys and backend keys.
    addressLine1: asString(data.addressLine1, asString(data.street)),
    addressLine2: asString(data.addressLine2, asString(data.landmark)),
    city: asString(data.city),
    state: asString(data.state),
    phone: asString(data.phone),
    isDefault: asBool(data.isDefault),
    lat: lat == null ? null : asDouble(lat),
    lng: lng == null ? null : asDouble(lng),
    deliveryZone: asString(data.deliveryZone, 'off_campus'),
  }
}

export function addressToJson(a: DeliveryAddress): Record<string, unknown> {
  return {
    name: a.name,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    state: a.state,
    phone: a.phone,
    isDefault: a.isDefault,
    deliveryZone: a.deliveryZone,
    ...(a.lat != null ? { lat: a.lat } : {}),
    ...(a.lng != null ? { lng: a.lng } : {}),
  }
}

/**
 * Both legacy keys and backend-expected keys, so Firestore order documents
 * satisfy the backend's address schema:
 *   { street, city, state, landmark, deliveryZone }
 */
export function addressToFirestore(a: DeliveryAddress): Record<string, unknown> {
  return {
    ...addressToJson(a),
    street: a.addressLine1,
    landmark: a.addressLine2,
  }
}

/** Short label for the home header: "Zone 4, Osogbo". */
export function addressLabel(a: DeliveryAddress | null): string {
  if (!a) return 'Set your delivery address'
  const parts = [a.addressLine1, a.city].filter((e) => e.trim().length > 0)
  return parts.length === 0 ? a.name : parts.join(', ')
}
