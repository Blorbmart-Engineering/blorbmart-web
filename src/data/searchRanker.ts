/* ═══════════════════════════════════════════════════════════════════════
   Ranking — a port of lib/data/search/search_ranker.dart.

   Firestore returns candidates; this decides the order the human sees. The
   weights below were tuned around one principle: a person searching a food
   app is almost always naming a dish or a brand they already have in mind, so
   exactness beats popularity, and popularity only breaks ties.

   Score bands, roughly:
     1000+  exact name
     600+   name begins with the query
     300+   every query word appears in the name
     150+   a query word appears in the name
     60+    fuzzy / typo match on the name
     20+    matched on description, category or store name only
   ═══════════════════════════════════════════════════════════════════════ */

import {
  hasDiscount,
  isOpenNow,
  isSoldOut,
  vendorSubtitle,
  type MenuItem,
  type Vendor,
} from '../models/catalog'
import { clamp } from '../lib/format'
import { isFuzzyMatch, tokenize } from './searchIndex'

/**
 * A scored search hit. `score` is only meaningful relative to other hits in
 * the same result set.
 */
export interface Scored<T> {
  value: T
  score: number
  /** Why it matched — surfaces as the "in Chicken Republic" subtitle. */
  reason: string
}

// Match strength
const EXACT_NAME = 1000
const NAME_PREFIX = 620
const ALL_TOKENS_IN_NAME = 330
const TOKEN_IN_NAME = 150
const TOKEN_PREFIX_IN_NAME = 95
const FUZZY_NAME = 62
const TOKEN_IN_SECTION = 34
const TOKEN_IN_STORE = 28
const TOKEN_IN_DESCRIPTION = 18

// Tie-breakers, all deliberately small next to match strength.
const MAX_POPULARITY = 45
const MAX_RATING = 30
const AVAILABILITY_PENALTY = -260
const CLOSED_PENALTY = -140
const MAX_PROXIMITY = 55
const FEATURED_BONUS = 18

/** Fast concave curve — sqrt without the call. */
const curve = (t: number) => t * (2 - t)

/**
 * Diminishing returns: the difference between 10 and 60 orders matters, the
 * difference between 4,000 and 8,000 does not.
 */
function popularityBoost(count: number): number {
  if (count <= 0) return 0
  return MAX_POPULARITY * curve(clamp(count / 200, 0, 1))
}

/**
 * A 5.0 from two people is not a 4.6 from four hundred, so the boost is
 * damped by review volume.
 */
function ratingBoost(rating: number, reviews: number): number {
  if (rating <= 0 || reviews <= 0) return 0
  return MAX_RATING * (rating / 5) * clamp(reviews / 40, 0, 1)
}

function proximityBoost(km: number | null): number {
  if (km == null) return 0
  if (km <= 1) return MAX_PROXIMITY
  if (km >= 12) return 0
  return MAX_PROXIMITY * (1 - (km - 1) / 11)
}

/**
 * Scores one menu item against a tokenized query.
 *
 * `queryTokens` must already be normalised through `tokenize` so synonyms
 * have been folded — otherwise "jelof" never reaches "jollof".
 */
export function scoreItem(
  item: MenuItem,
  rawQuery: string,
  queryTokens: string[],
  vendorOpen = true,
): Scored<MenuItem> | null {
  if (!queryTokens.length) return null

  const name = item.name.toLowerCase().trim()
  const nameTokens = tokenize(item.name)
  const descTokens = tokenize(item.description)
  const sectionTokens = tokenize(`${item.section} ${item.categoryName}`)
  const storeTokens = tokenize(item.storeName)
  const query = rawQuery.toLowerCase().trim()

  let score = 0
  let matchedAny = false
  let matchedInName = 0
  let reason = ''

  if (name === query) {
    score += EXACT_NAME
    matchedAny = true
  } else if (name.startsWith(query) && query.length >= 2) {
    score += NAME_PREFIX
    matchedAny = true
  } else if (name.includes(query) && query.length >= 3) {
    // Whole-query substring, e.g. "fried rice" inside "special fried rice".
    score += ALL_TOKENS_IN_NAME * 0.9
    matchedAny = true
  }

  for (const token of queryTokens) {
    let hit = false

    if (nameTokens.includes(token)) {
      score += TOKEN_IN_NAME
      matchedInName++
      hit = true
    } else if (nameTokens.some((t) => t.startsWith(token))) {
      score += TOKEN_PREFIX_IN_NAME
      matchedInName++
      hit = true
    } else if (nameTokens.some((t) => isFuzzyMatch(token, t))) {
      score += FUZZY_NAME
      matchedInName++
      hit = true
      reason = 'Did you mean this?'
    }

    if (!hit) {
      if (sectionTokens.includes(token)) {
        score += TOKEN_IN_SECTION
        hit = true
      } else if (storeTokens.some((t) => t.startsWith(token))) {
        score += TOKEN_IN_STORE
        hit = true
        if (!reason && item.storeName) reason = `From ${item.storeName}`
      } else if (descTokens.some((t) => t.startsWith(token))) {
        score += TOKEN_IN_DESCRIPTION
        hit = true
      } else if (item.searchKeywords.includes(token)) {
        score += TOKEN_IN_DESCRIPTION
        hit = true
      }
    }

    matchedAny = matchedAny || hit
  }

  if (!matchedAny) return null

  // Every query word landing in the name is a strong signal that this is the
  // exact thing the person typed.
  if (matchedInName === queryTokens.length && queryTokens.length > 1) {
    score += ALL_TOKENS_IN_NAME
  }

  score += popularityBoost(item.totalSold)
  score += ratingBoost(item.rating, item.totalReviews)
  if (item.isPopular) score += FEATURED_BONUS
  if (hasDiscount(item)) score += 10
  if (isSoldOut(item)) score += AVAILABILITY_PENALTY
  if (!vendorOpen) score += CLOSED_PENALTY

  if (!reason && item.storeName) reason = item.storeName
  return { value: item, score, reason }
}

/**
 * Scores a vendor. Vendors are matched on name, cuisine and city, and
 * weighted towards ones that are open and close by, because a shut restaurant
 * three towns away is a bad first result however well it matches.
 */
export function scoreVendor(
  vendor: Vendor,
  rawQuery: string,
  queryTokens: string[],
): Scored<Vendor> | null {
  if (!queryTokens.length) return null

  const name = vendor.name.toLowerCase().trim()
  const nameTokens = tokenize(vendor.name)
  const cuisineTokens = tokenize(vendor.cuisines.join(' '))
  const placeTokens = tokenize(`${vendor.city} ${vendor.address}`)
  const query = rawQuery.toLowerCase().trim()

  let score = 0
  let matched = false
  let reason = vendorSubtitle(vendor)

  if (name === query) {
    score += EXACT_NAME
    matched = true
  } else if (name.startsWith(query) && query.length >= 2) {
    score += NAME_PREFIX
    matched = true
  } else if (name.includes(query) && query.length >= 3) {
    score += ALL_TOKENS_IN_NAME * 0.85
    matched = true
  }

  for (const token of queryTokens) {
    if (nameTokens.includes(token)) {
      score += TOKEN_IN_NAME
      matched = true
    } else if (nameTokens.some((t) => t.startsWith(token))) {
      score += TOKEN_PREFIX_IN_NAME
      matched = true
    } else if (cuisineTokens.some((t) => t.startsWith(token))) {
      score += TOKEN_IN_SECTION * 2
      matched = true
      reason = vendor.cuisines.slice(0, 2).join(', ')
    } else if (placeTokens.some((t) => t.startsWith(token))) {
      score += TOKEN_IN_STORE
      matched = true
    } else if (nameTokens.some((t) => isFuzzyMatch(token, t))) {
      score += FUZZY_NAME
      matched = true
    }
  }

  if (!matched) return null

  score += popularityBoost(vendor.totalOrders)
  score += ratingBoost(vendor.rating, vendor.ratingCount)
  score += proximityBoost(vendor.distanceKm)
  if (vendor.isFeatured) score += FEATURED_BONUS
  if (!isOpenNow(vendor)) score += CLOSED_PENALTY

  return { value: vendor, score, reason }
}

/**
 * Sorts scored hits, highest first, with a stable secondary sort so two equal
 * scores do not shuffle between rebuilds.
 */
export function rank<T>(hits: Scored<T>[]): T[] {
  return [...hits].sort((a, b) => b.score - a.score).map((h) => h.value)
}
