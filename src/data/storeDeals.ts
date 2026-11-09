/* ═══════════════════════════════════════════════════════════════════════
   Store deals: money off at one store that an admin set, applied at checkout
   with no code (backend storeDiscountService, added 2026-11-09).

   The list is small and public, fetched once and shared by every store card
   on screen; checkout prices the deal itself, so a stale badge can never
   change what anybody pays.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Api } from '../lib/api'
import { asString } from '../lib/format'

export interface StoreDeal {
  storeId: string
  kind: 'percent' | 'fixed' | 'delivery'
  label: string
}

const FRESH_MS = 2 * 60 * 1000
let cache: { at: number; deals: Promise<StoreDeal[]> } | null = null

function allDeals(): Promise<StoreDeal[]> {
  if (!cache || Date.now() - cache.at > FRESH_MS) {
    const deals = Api.get('/api/store-discounts/active', { auth: false })
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
        return list
          .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
          .map((d) => ({
            storeId: asString(d.storeId),
            kind: (['percent', 'fixed', 'delivery'].includes(asString(d.kind)) ? asString(d.kind) : 'percent') as StoreDeal['kind'],
            label: asString(d.label),
          }))
          .filter((d) => d.storeId && d.label)
      })
      .catch(() => {
        cache = null
        return [] as StoreDeal[]
      })
    cache = { at: Date.now(), deals }
  }
  return cache.deals
}

/** The deals running at one store now, food deals first. */
export function useStoreDeals(storeId: string | null | undefined): StoreDeal[] {
  const [deals, setDeals] = useState<StoreDeal[]>([])
  useEffect(() => {
    if (!storeId) return
    let live = true
    void allDeals().then((all) => {
      if (!live) return
      setDeals(
        all
          .filter((d) => d.storeId === storeId)
          .sort((a, b) => Number(a.kind === 'delivery') - Number(b.kind === 'delivery')),
      )
    })
    return () => {
      live = false
    }
  }, [storeId])
  return deals
}
