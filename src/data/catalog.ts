/* ═══════════════════════════════════════════════════════════════════════
   Catalogue reads — a port of lib/data/repos/catalog_repo.dart.

   One module for the whole app. It keeps a warm in-memory index of vendors
   because:
     * there are hundreds of them, not millions;
     * nearly every screen needs to resolve a storeId to a name and an
       open/closed state;
     * re-reading the collection per screen is the single most expensive thing
       a Firestore-backed app can do to its bill and its latency.

   The index refreshes on a TTL and can be forced by pull-to-refresh.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { haversineKm } from '../lib/format'
import {
  discountPercent,
  hasDiscount,
  isOpenNow,
  isSoldOut,
  menuItemFromMap,
  vendorFromMap,
  type MenuItem,
  type Vendor,
  type Vertical,
} from '../models/catalog'
import { visibleOnCampus } from './university'

const TTL_MS = 5 * 60_000

/**
 * Firestore charges per document read, and a home screen that pulls the
 * entire catalogue on every cold start is how apps get expensive. 400 is well
 * past what any city needs on one screen.
 */
const VENDOR_FETCH_LIMIT = 400

const vendorsById = new Map<string, Vendor>()
let vendorList: Vendor[] = []
let vendorsLoadedAt = 0
let inFlight: Promise<Vendor[]> | null = null

/** Coordinates of the customer, when known. */
let userLat: number | null = null
let userLng: number | null = null

/**
 * The buyer's campus. Null means "do not narrow the catalogue" — which is
 * what an account predating campuses, or a bills-only account, gets.
 */
let campusId: string | null = null

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function subscribeCatalog(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function withDistance(v: Vendor): Vendor {
  if (userLat == null || userLng == null || v.latitude == null || v.longitude == null) {
    return v.distanceKm == null ? v : { ...v, distanceKm: null }
  }
  return { ...v, distanceKm: haversineKm(userLat, userLng, v.latitude, v.longitude) }
}

function reindex(list: Vendor[]) {
  vendorsById.clear()
  for (const v of list) vendorsById.set(v.id, v)
}

export function getCampusId(): string | null {
  return campusId
}

/**
 * Called by the session whenever the signed-in buyer's campus changes.
 *
 * Everything cached was filtered against the previous campus, so the index is
 * dropped rather than re-filtered: what is held in memory is already missing
 * the other campus's stores and cannot be widened back out.
 */
export function setCampus(next: string | null): void {
  if (next === campusId) return
  campusId = next
  invalidateCatalog()
  vendorList = []
  vendorsById.clear()
  emit()
}

export function setUserLocation(lat: number | null, lng: number | null): void {
  if (lat === userLat && lng === userLng) return
  userLat = lat
  userLng = lng
  // Distances are stored on the cached objects, so they have to be redone.
  if (vendorList.length) {
    vendorList = vendorList.map(withDistance)
    reindex(vendorList)
    emit()
  }
}

function isFresh(): boolean {
  return vendorsLoadedAt > 0 && Date.now() - vendorsLoadedAt < TTL_MS
}

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'stores'),
        where('isActive', '==', true),
        fbLimit(VENDOR_FETCH_LIMIT),
      ),
    )

    let list = snap.docs
      .filter((d) => visibleOnCampus(d.data().universityId, campusId))
      .map((d) => vendorFromMap(d.id, d.data()))
      .filter((v) => v.name.trim().length > 0)
      .map(withDistance)

    // Legacy documents predate `isActive`, so a filtered query can come back
    // empty on an older project. Fall back to an unfiltered read once rather
    // than showing an empty app.
    if (!list.length) {
      const all = await getDocs(
        query(collection(db, 'stores'), fbLimit(VENDOR_FETCH_LIMIT)),
      )
      list = all.docs
        .filter((d) => visibleOnCampus(d.data().universityId, campusId))
        .map((d) => vendorFromMap(d.id, d.data()))
        .filter((v) => v.name.trim().length > 0)
        .map(withDistance)
    }

    reindex(list)
    vendorList = list
    vendorsLoadedAt = Date.now()
    emit()
    return list
  } catch (e) {
    console.warn('[catalog] vendors failed', e)
    // Serve stale data rather than an error screen — a five-minute-old
    // restaurant list is far better than nothing.
    if (vendorList.length) return vendorList
    throw e
  }
}

/** All active vendors, from cache when warm. */
export function vendors(forceRefresh = false): Promise<Vendor[]> {
  if (!forceRefresh && isFresh() && vendorList.length) {
    return Promise.resolve(vendorList)
  }
  // Collapse concurrent callers (home + search often ask at once) into one
  // network round trip.
  if (!inFlight) {
    inFlight = fetchVendors().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/**
 * Synchronous lookup for anything already in the index — used by list rows
 * that must not trigger a read while scrolling.
 */
export function cachedVendor(storeId: string): Vendor | null {
  return vendorsById.get(storeId) ?? null
}

export async function vendor(storeId: string): Promise<Vendor | null> {
  const cached = vendorsById.get(storeId)
  if (cached) return cached
  try {
    const snap = await getDoc(doc(db, 'stores', storeId))
    if (!snap.exists()) return null
    const v = withDistance(vendorFromMap(snap.id, snap.data()))
    vendorsById.set(storeId, v)
    return v
  } catch (e) {
    console.warn(`[catalog] vendor(${storeId}) failed`, e)
    return null
  }
}

/**
 * The default browse order. Extracted so home, hub and search all agree:
 * open first, then nearest, then featured, then best rated.
 */
export function sortForBrowsing(list: Vendor[]): Vendor[] {
  return [...list].sort((a, b) => {
    const openCmp = (isOpenNow(b) ? 1 : 0) - (isOpenNow(a) ? 1 : 0)
    if (openCmp !== 0) return openCmp

    const ad = a.distanceKm
    const bd = b.distanceKm
    if (ad != null && bd != null && Math.abs(ad - bd) > 0.35) return ad - bd

    const featured = (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
    if (featured !== 0) return featured

    const rating = b.rating - a.rating
    if (rating !== 0) return rating
    return b.totalOrders - a.totalOrders
  })
}

/** Vendors in one hub, in browse order. */
export async function vendorsIn(
  vertical: Vertical,
  forceRefresh = false,
): Promise<Vendor[]> {
  const all = await vendors(forceRefresh)
  return sortForBrowsing(all.filter((v) => v.vertical === vertical))
}

/**
 * Live menu for a vendor. A subscription, so a dish going out of stock while
 * the customer is deciding removes itself from the screen.
 */
export function menuStream(
  storeId: string,
  onData: (items: MenuItem[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'products'),
      where('storeId', '==', storeId),
      where('status', '==', 'active'),
      fbLimit(300),
    ),
    (snap) => onData(snap.docs.map((d) => menuItemFromMap(d.id, d.data()))),
    (e) => {
      console.warn(`[catalog] menuStream(${storeId}) failed`, e)
      onError?.(e)
    },
  )
}

export async function menu(storeId: string): Promise<MenuItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'products'),
        where('storeId', '==', storeId),
        where('status', '==', 'active'),
        fbLimit(300),
      ),
    )
    return snap.docs.map((d) => menuItemFromMap(d.id, d.data()))
  } catch (e) {
    console.warn(`[catalog] menu(${storeId}) failed`, e)
    return []
  }
}

export async function item(productId: string): Promise<MenuItem | null> {
  try {
    const snap = await getDoc(doc(db, 'products', productId))
    return snap.exists() ? menuItemFromMap(snap.id, snap.data()) : null
  } catch (e) {
    console.warn(`[catalog] item(${productId}) failed`, e)
    return null
  }
}

/** Best-selling items across the whole catalogue — the "Trending now" rail. */
export async function trending(limit = 12): Promise<MenuItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'products'),
        where('status', '==', 'active'),
        orderBy('totalSold', 'desc'),
        // Over-fetched because the campus filter runs after the limit; asking
        // for exactly `limit` returns a short rail on any campus whose best
        // sellers are outsold globally by another campus's.
        fbLimit(campusId == null ? limit : limit * 4),
      ),
    )
    return snap.docs
      .filter((d) => visibleOnCampus(d.data().universityId, campusId))
      .map((d) => menuItemFromMap(d.id, d.data()))
      .slice(0, limit)
  } catch (e) {
    // Missing composite index is the usual cause; degrade to an unordered
    // read so the rail still shows something.
    console.warn('[catalog] trending failed, falling back', e)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'products'),
          where('status', '==', 'active'),
          fbLimit(campusId == null ? limit : limit * 4),
        ),
      )
      return snap.docs
        .filter((d) => visibleOnCampus(d.data().universityId, campusId))
        .map((d) => menuItemFromMap(d.id, d.data()))
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, limit)
    } catch {
      return []
    }
  }
}

/**
 * Discounted items — the "Save today" rail. Sorted by depth of discount so
 * the most persuasive offer leads.
 */
export async function deals(limit = 12): Promise<MenuItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'products'),
        where('status', '==', 'active'),
        where('discountPrice', '>', 0),
        fbLimit(limit * 2),
      ),
    )
    return snap.docs
      .filter((d) => visibleOnCampus(d.data().universityId, campusId))
      .map((d) => menuItemFromMap(d.id, d.data()))
      .filter((i) => hasDiscount(i) && !isSoldOut(i))
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, limit)
  } catch (e) {
    console.warn('[catalog] deals failed', e)
    return []
  }
}

export function invalidateCatalog(): void {
  vendorsLoadedAt = 0
}
