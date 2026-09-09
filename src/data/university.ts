/* ═══════════════════════════════════════════════════════════════════════
   The campus registry — a port of lib/data/repos/university_repo.dart.

   The list lives on the backend so a new campus reaches every platform on a
   deploy rather than an app-store release. It changes at most a few times a
   year, so a session-long cache is generous and still never stale in practice.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import { asString } from '../lib/format'

/** One campus, as served by the backend registry. */
export interface University {
  id: string
  name: string
  shortName: string
  state: string
  city: string
  /**
   * The "my school is not listed" option. Choosing it opens the app on bill
   * payments instead of the marketplace.
   */
  billsOnly: boolean
  description: string
}

/** Must match `BILLS_ONLY_ID` in the backend registry. */
export const BILLS_ONLY_ID = 'bills-only'

export function universityFromMap(m: Record<string, unknown>): University {
  return {
    id: asString(m.id),
    name: asString(m.name),
    shortName: asString(m.shortName),
    state: asString(m.state),
    city: asString(m.city),
    billsOnly: m.billsOnly === true,
    description: asString(m.description),
  }
}

/**
 * "Osun State University (UNIOSUN)" — the short name is what students actually
 * say, and the long name is what they scan the list for, so a picker that
 * shows only one of the two is harder to use than it looks.
 */
export function universityLabel(u: University): string {
  if (u.billsOnly || !u.shortName || u.shortName === u.name) return u.name
  return `${u.name} (${u.shortName})`
}

let cached: University[] | null = null

/**
 * Real campuses plus the bills-only option, in the order the backend defines
 * — bills-only last, so it never sits above a real school where it could be
 * mis-tapped.
 */
export async function universityOptions(refresh = false): Promise<University[]> {
  if (!refresh && cached) return cached

  const data = await Api.get('/api/universities', { auth: false })
  const raw = data.options
  const list = Array.isArray(raw)
    ? raw
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map(universityFromMap)
    : []

  cached = list
  return list
}

/**
 * Campuses only, for pickers that must not offer the bills-only escape hatch
 * — a rider or a vendor has to belong somewhere real.
 */
export async function campuses(refresh = false): Promise<University[]> {
  return (await universityOptions(refresh)).filter((u) => !u.billsOnly)
}

export function cachedUniversityById(id: string | null | undefined): University | null {
  if (!id) return null
  return (cached ?? []).find((u) => u.id === id) ?? null
}

export function clearUniversityCache(): void {
  cached = null
}

/**
 * Whether a store or product tagged `itemCampusId` should be shown to a buyer
 * on `buyerCampusId`.
 *
 * Untagged content passes, deliberately. The catalogue predates campus
 * tagging, so a strict match would empty the app the day this shipped and keep
 * it empty until every vendor had been chased into tagging their store. A tag
 * can therefore only ever narrow reach, never grant it, so there is no path
 * here that leaks one campus's menu onto another.
 */
export function visibleOnCampus(
  itemCampusId: unknown,
  buyerCampusId: string | null,
): boolean {
  const tag = asString(itemCampusId)
  if (!tag) return true
  if (!buyerCampusId) return true
  return tag === buyerCampusId
}
