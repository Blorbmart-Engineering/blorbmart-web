/* ═══════════════════════════════════════════════════════════════════════
   Search — a port of lib/data/repos/search_repo.dart.

   Two sources, merged:

    1. VENDORS come from the in-memory catalogue index. There are few enough
       of them to match every one on every keystroke, which is why store
       search feels instant and works offline.

    2. DISHES come from Firestore, via a single `array-contains` on the most
       selective token of the query against the `searchKeywords` prefix index
       written by the vendor app. That returns a bounded candidate set which
       is then scored locally.

   Every query is deduplicated, cached for the session, and cancellable — a
   fast typist generates a request per keystroke and only the last one may be
   allowed to render.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  collection,
  endAt,
  getDocs,
  limit as fbLimit,
  orderBy,
  query as fbQuery,
  startAt,
  where,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { menuItemFromMap, isOpenNow, type MenuItem, type Vendor, type Vertical } from '../models/catalog'
import { cachedVendor, getCampusId, vendors as allVendorsAsync } from './catalog'
import { visibleOnCampus } from './university'
import { MAX_PREFIX, MIN_PREFIX, primaryQueryToken, tokenize } from './searchIndex'
import { rank, scoreItem, scoreVendor, type Scored } from './searchRanker'

/**
 * What a search returned: vendors and dishes, already ranked, plus the
 * suggestion to show when nothing matched.
 */
export interface SearchResults {
  vendors: Vendor[]
  items: MenuItem[]
  query: string
  /** Set when the best hits were fuzzy — shown as "Showing results for …". */
  didYouMean: string | null
}

export const EMPTY_RESULTS: SearchResults = {
  vendors: [],
  items: [],
  query: '',
  didYouMean: null,
}

export const resultsAreEmpty = (r: SearchResults) =>
  r.vendors.length === 0 && r.items.length === 0

export const resultsTotal = (r: SearchResults) => r.vendors.length + r.items.length

const CANDIDATE_LIMIT = 120
const MAX_RECENT = 8
const RECENT_KEY = 'blorb_recent_searches_v2'

/**
 * Session cache. Cleared on refresh; small enough to never need eviction
 * logic beyond a hard cap.
 */
const cache = new Map<string, SearchResults>()
let generation = 0

/**
 * Pulls candidate dishes out of Firestore.
 *
 * Strategy: query the prefix index with the most selective token. If that
 * yields little (an unusual word, or a catalogue whose keywords were never
 * backfilled), widen with the next token and finally fall back to a plain
 * name-range query so search still works on un-indexed documents.
 */
async function candidateItems(query: string, tokens: string[]): Promise<MenuItem[]> {
  const results: MenuItem[] = []
  const primary = primaryQueryToken(query)
  if (!primary) return results

  const campusId = getCampusId()

  async function byKeyword(token: string, limit: number) {
    const snap = await getDocs(
      fbQuery(
        collection(db, 'products'),
        where('searchKeywords', 'array-contains', token),
        where('status', '==', 'active'),
        fbLimit(limit),
      ),
    )
    for (const d of snap.docs) {
      if (visibleOnCampus(d.data().universityId, campusId)) {
        results.push(menuItemFromMap(d.id, d.data()))
      }
    }
  }

  try {
    await byKeyword(primary, CANDIDATE_LIMIT)
  } catch (e) {
    console.warn(`[search] keyword query failed for "${primary}"`, e)
  }

  // A second token widens recall on multi-word queries ("chicken burger"
  // where only one of the two was indexed).
  if (results.length < 12 && tokens.length > 1) {
    const second = tokens.find((t) => t !== primary && t.length >= MIN_PREFIX)
    if (second) {
      try {
        await byKeyword(second.length > MAX_PREFIX ? second.slice(0, MAX_PREFIX) : second, 60)
      } catch {
        /* recall widening is best-effort */
      }
    }
  }

  // Last resort for catalogues written before the index existed.
  if (!results.length) {
    try {
      const lower = query.toLowerCase()
      const snap = await getDocs(
        fbQuery(
          collection(db, 'products'),
          orderBy('name'),
          startAt(lower),
          endAt(`${lower}`),
          fbLimit(40),
        ),
      )
      for (const d of snap.docs) {
        if (visibleOnCampus(d.data().universityId, campusId)) {
          results.push(menuItemFromMap(d.id, d.data()))
        }
      }
    } catch (e) {
      console.warn('[search] name-range fallback failed', e)
    }
  }

  return results
}

function itemInVertical(item: MenuItem, vertical: Vertical): boolean {
  if (item.vertical === vertical) return true
  // Older product documents have no `vertical`; resolve it through the store.
  return cachedVendor(item.storeId)?.vertical === vertical
}

/**
 * Runs a search. `vertical` narrows to one hub; null searches everything.
 *
 * Returns null when a newer query has started since this one — the caller
 * should simply drop the result rather than render a stale set.
 */
export async function search(
  rawQuery: string,
  {
    vertical = null,
    includeVendors = true,
    includeItems = true,
  }: {
    vertical?: Vertical | null
    includeVendors?: boolean
    includeItems?: boolean
  } = {},
): Promise<SearchResults | null> {
  const query = rawQuery.trim()
  if (query.length < 2) return EMPTY_RESULTS

  const cacheKey = `${vertical ?? 'all'}::${query.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const mine = ++generation
  const tokens = tokenize(query)
  if (!tokens.length) return EMPTY_RESULTS

  const vendorHits: Scored<Vendor>[] = []
  const itemHits: Scored<MenuItem>[] = []

  // ── Vendors: match the whole warm index locally ──────────────────────
  let allVendors: Vendor[] = []
  try {
    allVendors = await allVendorsAsync()
  } catch (e) {
    console.warn('[search] vendor index unavailable', e)
  }
  if (mine !== generation) return null

  const openById = new Map<string, boolean>()
  for (const v of allVendors) {
    openById.set(v.id, isOpenNow(v))
    if (!includeVendors) continue
    if (vertical != null && v.vertical !== vertical) continue
    const hit = scoreVendor(v, query, tokens)
    if (hit) vendorHits.push(hit)
  }

  // ── Dishes: one indexed Firestore lookup, then local ranking ─────────
  if (includeItems) {
    const candidates = await candidateItems(query, tokens)
    if (mine !== generation) return null

    const seen = new Set<string>()
    for (const item of candidates) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      if (vertical != null && !itemInVertical(item, vertical)) continue
      const hit = scoreItem(item, query, tokens, openById.get(item.storeId) ?? true)
      if (hit) itemHits.push(hit)
    }
  }

  if (mine !== generation) return null

  // "Did you mean" fires only when nothing matched cleanly — otherwise it is
  // noise on top of good results.
  let didYouMean: string | null = null
  const bestItem = [...itemHits].sort((a, b) => b.score - a.score)[0]
  if (!vendorHits.length && bestItem && bestItem.reason === 'Did you mean this?') {
    didYouMean = bestItem.value.name
  }

  const results: SearchResults = {
    query,
    vendors: rank(vendorHits).slice(0, 12),
    items: rank(itemHits).slice(0, 40),
    didYouMean,
  }

  if (cache.size > 60) cache.clear()
  cache.set(cacheKey, results)
  return results
}

/**
 * Instant suggestions while the field is being typed into. Vendor names and
 * dish names only, capped short — a suggestion list longer than the keyboard
 * is a worse experience than none.
 */
export async function suggest(
  partial: string,
  vertical: Vertical | null = null,
): Promise<string[]> {
  const q = partial.trim().toLowerCase()
  if (q.length < 2) return []

  const out = new Set<string>()
  try {
    const list = await allVendorsAsync()
    for (const v of list) {
      if (vertical != null && v.vertical !== vertical) continue
      if (v.name.toLowerCase().includes(q)) out.add(v.name)
      for (const c of v.cuisines) {
        if (c.toLowerCase().startsWith(q)) out.add(c)
      }
      if (out.size >= 6) break
    }
  } catch {
    /* suggestions are a nicety; never surface a failure */
  }

  if (out.size < 6) {
    for (const r of cache.values()) {
      if (!r.query.toLowerCase().startsWith(q)) continue
      for (const i of r.items) {
        if (out.size >= 6) break
        out.add(i.name)
      }
    }
  }
  return [...out].slice(0, 6)
}

/* ── Recent searches ───────────────────────────────────────────────────
   Stored on the device, not in Firestore: it is a convenience, it changes on
   every committed search, and writing it server-side would mean a document
   write per search for zero product benefit. */

/**
 * Recent searches are per-account so a shared device does not leak one
 * person's history to the next.
 */
function recentKey(): string {
  return `${RECENT_KEY}_${auth.currentUser?.uid ?? 'guest'}`
}

export function recentSearches(): string[] {
  try {
    const raw = localStorage.getItem(recentKey())
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : []
  } catch {
    return []
  }
}

export function rememberSearch(query: string): void {
  const q = query.trim()
  if (q.length < 2) return
  try {
    const list = recentSearches().filter((e) => e.toLowerCase() !== q.toLowerCase())
    list.unshift(q)
    localStorage.setItem(recentKey(), JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch (e) {
    console.warn('[search] rememberSearch failed', e)
  }
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(recentKey())
  } catch {
    /* nothing to clear */
  }
}

export function clearSearchCache(): void {
  cache.clear()
}
