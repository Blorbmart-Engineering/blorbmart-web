/* ═══════════════════════════════════════════════════════════════════════
   Catalogue models — a port of lib/data/models/catalog.dart.

   Reads defensively: the `stores` collection has documents written by three
   generations of the vendor app, so every field has a fallback and nothing
   here can throw on a malformed document.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  asBool,
  asDouble,
  asInt,
  asString,
  asStringList,
  clamp,
  etaWindow,
  money,
  titleCase,
} from '../lib/format'

/**
 * The four hubs the app sells. Everything in the catalogue belongs to exactly
 * one of them, and each carries its own identity colour, icon asset and copy
 * so screens never hard-code a vertical.
 */
export type Vertical = 'restaurants' | 'pharmacy' | 'events' | 'bills'

export interface VerticalSpec {
  id: Vertical
  label: string
  /** Singular, for a vendor page: "Restaurant". */
  singular: string
  tagline: string
  asset: string
  /** CSS custom-property name for the identity colour. */
  color: string
  softColor: string
  /** What a vendor in this hub sells, for empty states and section headers. */
  itemNoun: string
}

export const VERTICALS: Record<Vertical, VerticalSpec> = {
  restaurants: {
    id: 'restaurants',
    label: 'Restaurants',
    singular: 'Restaurant',
    tagline: 'Hot meals, fast',
    asset: '/assets/restaurant.png',
    color: 'var(--color-restaurants)',
    softColor: 'var(--color-restaurants-soft)',
    itemNoun: 'dish',
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacy',
    singular: 'Pharmacy',
    tagline: 'Meds in minutes',
    asset: '/assets/pharmacy.png',
    color: 'var(--color-pharmacy)',
    softColor: 'var(--color-pharmacy-soft)',
    itemNoun: 'product',
  },
  events: {
    id: 'events',
    label: 'Events',
    singular: 'Event',
    tagline: 'Tickets to what is on',
    asset: '/assets/event.png',
    color: 'var(--color-events)',
    softColor: 'var(--color-events-soft)',
    itemNoun: 'ticket',
  },
  bills: {
    id: 'bills',
    label: 'Bills',
    singular: 'Bill',
    tagline: 'Airtime, data, power',
    asset: '/assets/bills.png',
    color: 'var(--color-bills)',
    softColor: 'var(--color-bills-soft)',
    itemNoun: 'bill',
  },
}

/** The order the hub grid renders in. */
export const HUB_ORDER: Vertical[] = ['restaurants', 'pharmacy', 'events', 'bills']

export function verticalFromId(raw: unknown): Vertical {
  switch (asString(raw).toLowerCase()) {
    case 'pharmacy':
    case 'pharmacies':
    case 'health':
      return 'pharmacy'
    case 'events':
    case 'event':
    case 'event_planning':
      return 'events'
    case 'bills':
    case 'bill':
      return 'bills'
    default:
      return 'restaurants'
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Vendor — a restaurant, pharmacy or event business. Backed by `stores`.
   ───────────────────────────────────────────────────────────────────────── */

export interface Vendor {
  id: string
  name: string
  vertical: Vertical
  vendorId: string
  tagline: string
  logoUrl: string
  bannerUrl: string
  cuisines: string[]
  rating: number
  ratingCount: number
  prepMinutes: number
  deliveryFee: number
  minOrder: number
  isOpen: boolean
  isActive: boolean
  isFeatured: boolean
  acceptsPreorder: boolean
  address: string
  city: string
  latitude: number | null
  longitude: number | null
  /** 1 = budget, 2 = mid, 3 = premium. Drives the ₦/₦₦/₦₦₦ badge. */
  priceLevel: number
  totalOrders: number
  openingHour: number
  closingHour: number
  /** Filled in at query time when the user's coordinates are known. */
  distanceKm: number | null
}

type GeoLike = { lat?: unknown; latitude?: unknown; lng?: unknown; longitude?: unknown }

export function vendorFromMap(id: string, m: Record<string, unknown>): Vendor {
  let latitude: number | null = null
  let longitude: number | null = null
  const geo = m.location as GeoLike | null | undefined
  if (geo && typeof geo === 'object') {
    const rawLat = asDouble(geo.lat ?? geo.latitude, Number.NaN)
    const rawLng = asDouble(geo.lng ?? geo.longitude, Number.NaN)
    if (Number.isFinite(rawLat)) latitude = rawLat
    if (Number.isFinite(rawLng)) longitude = rawLng
  }

  return {
    id: asString(m.storeId, id),
    name: asString(m.storeName ?? m.businessName ?? m.name, 'Unnamed store'),
    vertical: verticalFromId(m.vertical ?? m.storeType ?? m.categoryId),
    vendorId: asString(m.vendorId ?? m.userId),
    tagline: asString(m.tagline ?? m.description),
    logoUrl: asString(m.logoUrl ?? m.logoImageUrl),
    bannerUrl: asString(m.bannerUrl ?? m.bannerImageUrl),
    cuisines: asStringList(m.cuisines ?? m.tags ?? m.categoryIds),
    rating: clamp(asDouble(m.rating), 0, 5),
    ratingCount: asInt(m.ratingCount ?? m.totalReviews),
    prepMinutes: asInt(m.prepTimeMins ?? m.prepMinutes, 25),
    deliveryFee: asDouble(m.deliveryFee),
    minOrder: asDouble(m.minOrder ?? m.minimumOrder),
    isOpen: asBool(m.isOpen, true),
    isActive: asBool(m.isActive, true),
    isFeatured: asBool(m.isFeatured),
    acceptsPreorder: asBool(m.acceptsPreorder),
    address: asString(m.address),
    city: asString(m.city),
    latitude,
    longitude,
    priceLevel: clamp(asInt(m.priceLevel, 2), 1, 3),
    totalOrders: asInt(m.totalOrders ?? m.totalSales),
    openingHour: clamp(asInt(m.openingHour, 8), 0, 23),
    closingHour: clamp(asInt(m.closingHour, 22), 1, 24),
    distanceKm: null,
  }
}

/**
 * True when the store is both flagged open and inside its trading hours.
 * The flag alone is not enough — vendors forget to flip it.
 */
export function isOpenNow(v: Vendor): boolean {
  if (!v.isActive || !v.isOpen) return false
  const hour = new Date().getHours()
  if (v.closingHour > v.openingHour) {
    return hour >= v.openingHour && hour < v.closingHour
  }
  // Crosses midnight, e.g. 18:00 to 02:00.
  return hour >= v.openingHour || hour < v.closingHour
}

export function priceBadge(v: Vendor): string {
  return '₦'.repeat(v.priceLevel)
}

export function ratingLabel(v: Vendor): string {
  return v.rating <= 0 ? 'New' : v.rating.toFixed(1)
}

/** The subtitle under a vendor name: "Rice, Grills • 2.4 km". */
export function vendorSubtitle(v: Vendor): string {
  const parts: string[] = []
  if (v.cuisines.length) parts.push(v.cuisines.slice(0, 2).map(titleCase).join(', '))
  if (v.distanceKm != null) parts.push(`${v.distanceKm.toFixed(1)} km`)
  if (!parts.length && v.tagline) return v.tagline
  return parts.join('  •  ')
}

export function etaLabel(v: Vendor): string {
  return etaWindow(v.prepMinutes)
}

/**
 * Free delivery is the single strongest conversion lever in food delivery, so
 * it gets its own helper rather than being inferred at each call site.
 */
export function hasFreeDelivery(v: Vendor): boolean {
  return v.deliveryFee <= 0
}

/* ─────────────────────────────────────────────────────────────────────────
   MenuItem — a dish, a medicine, an event package. Backed by `products`.
   ───────────────────────────────────────────────────────────────────────── */

export interface AddonOption {
  name: string
  price: number
  isDefault: boolean
  available: boolean
}

export interface AddonGroup {
  id: string
  name: string
  options: AddonOption[]
  min: number
  max: number
}

export interface MenuItem {
  id: string
  name: string
  price: number
  storeId: string
  storeName: string
  vendorId: string
  vertical: Vertical
  description: string
  images: string[]
  /** When greater than zero and below `price`, this is what the customer pays. */
  discountPrice: number
  /** Menu grouping, e.g. "Rice dishes", "Pain relief". */
  section: string
  categoryName: string
  rating: number
  totalReviews: number
  totalSold: number
  stockQuantity: number
  /** Restaurants generally do not track stock; pharmacies must. */
  tracksStock: boolean
  isAvailable: boolean
  prepMinutes: number
  dietaryTags: string[]
  addonGroups: AddonGroup[]
  packagingFee: number
  isPopular: boolean
  requiresPrescription: boolean
  searchKeywords: string[]
}

export function addonOptionFromMap(m: Record<string, unknown>): AddonOption {
  return {
    name: asString(m.name),
    price: asDouble(m.price),
    isDefault: asBool(m.isDefault),
    available: asBool(m.available, true),
  }
}

export function addonOptionLabel(o: AddonOption): string {
  return o.price > 0 ? `${o.name}  +${money(o.price)}` : o.name
}

export function addonGroupFromMap(m: Record<string, unknown>): AddonGroup {
  const raw = m.options ?? m.items
  const options: AddonOption[] = Array.isArray(raw)
    ? raw
        .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
        .map(addonOptionFromMap)
        .filter((o) => o.name.length > 0)
    : []

  const max = asInt(m.max, 1)
  return {
    id: asString(m.id, asString(m.name)),
    name: asString(m.name, 'Options'),
    options,
    min: clamp(asInt(m.min), 0, options.length),
    max: max <= 0 ? options.length : max,
  }
}

export function isGroupRequired(g: AddonGroup): boolean {
  return g.min > 0
}

export function isMultiSelect(g: AddonGroup): boolean {
  return g.max > 1
}

export function groupRule(g: AddonGroup): string {
  if (isGroupRequired(g) && g.min === g.max) return `Choose ${g.min}`
  if (isGroupRequired(g)) return `Choose at least ${g.min}`
  if (g.max > 1) return `Up to ${g.max}, optional`
  return 'Optional'
}

export function menuItemFromMap(id: string, m: Record<string, unknown>): MenuItem {
  const addonGroups: AddonGroup[] = []
  const rawAddons = m.addonGroups ?? m.addons
  if (Array.isArray(rawAddons)) {
    for (const g of rawAddons) {
      if (g && typeof g === 'object') {
        const group = addonGroupFromMap(g as Record<string, unknown>)
        if (group.options.length) addonGroups.push(group)
      }
    }
  }

  const price = asDouble(m.price)
  const discount = asDouble(m.discountPrice)

  return {
    id,
    name: asString(m.name, 'Item'),
    price,
    // A discount above the base price is a vendor typo — ignore it rather
    // than showing a negative saving.
    discountPrice: discount > 0 && discount < price ? discount : 0,
    storeId: asString(m.storeId),
    storeName: asString(m.storeName ?? m.businessName),
    vendorId: asString(m.vendorId),
    vertical: verticalFromId(m.vertical),
    description: asString(m.description),
    images: asStringList(m.images),
    section: asString(m.section ?? m.subCategoryName),
    categoryName: asString(m.categoryName),
    rating: clamp(asDouble(m.rating), 0, 5),
    totalReviews: asInt(m.totalReviews),
    totalSold: asInt(m.totalSold),
    stockQuantity: asInt(m.stockQuantity),
    tracksStock: asBool(m.tracksStock),
    isAvailable: asBool(m.isAvailable, true) && asString(m.status, 'active') === 'active',
    prepMinutes: asInt(m.prepTimeMins ?? m.prepMinutes, 15),
    dietaryTags: asStringList(m.dietaryTags),
    addonGroups,
    packagingFee: asDouble(m.packagingFee),
    isPopular: asBool(m.isPopular) || asInt(m.totalSold) >= 25,
    requiresPrescription: asBool(m.requiresPrescription),
    searchKeywords: asStringList(m.searchKeywords),
  }
}

export function itemImage(item: MenuItem): string {
  return item.images.length ? item.images[0] : ''
}

/** What the customer actually pays before add-ons. */
export function effectivePrice(item: MenuItem): number {
  return item.discountPrice > 0 ? item.discountPrice : item.price
}

export function hasDiscount(item: MenuItem): boolean {
  return item.discountPrice > 0
}

export function discountPercent(item: MenuItem): number {
  return hasDiscount(item) && item.price > 0
    ? Math.round(((item.price - item.discountPrice) / item.price) * 100)
    : 0
}

/**
 * Out of stock only counts when the vendor opted into stock tracking,
 * otherwise every restaurant dish would read as unavailable.
 */
export function isSoldOut(item: MenuItem): boolean {
  return !item.isAvailable || (item.tracksStock && item.stockQuantity <= 0)
}

export function hasRequiredAddons(item: MenuItem): boolean {
  return item.addonGroups.some(isGroupRequired)
}
