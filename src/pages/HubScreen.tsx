/* ═══════════════════════════════════════════════════════════════════════
   One hub's storefronts — a port of lib/features/hub/hub_screen.dart.

   Restaurants and Pharmacy only. Bills is a biller catalogue and Events is a
   ticketing listing, so neither has vendors for this screen to show.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Store, WifiOff } from 'lucide-react'
import { sortForBrowsing, vendors } from '../data/catalog'
import { titleCase } from '../lib/format'
import {
  isOpenNow,
  VERTICALS,
  verticalFromId,
  type Vendor,
  type Vertical,
} from '../models/catalog'
import { IconButton } from '../ui/Button'
import { ChipRail, EmptyState, SectionHeader } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { VendorCard, VendorCardSkeleton } from '../components/CatalogCards'

type SortKey = 'Recommended' | 'Fastest' | 'Top rated' | 'Cheapest delivery'

const SORTS: SortKey[] = ['Recommended', 'Fastest', 'Top rated', 'Cheapest delivery']

export default function HubScreen() {
  const { vertical: raw = 'restaurants' } = useParams()
  const navigate = useNavigate()
  const vertical: Vertical = verticalFromId(raw)
  const spec = VERTICALS[vertical]

  const [all, setAll] = useState<Vendor[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cuisine, setCuisine] = useState('All')
  const [sort, setSort] = useState<SortKey>('Recommended')
  const [openOnly, setOpenOnly] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      setError(null)
      try {
        const list = await vendors(refresh)
        setAll(list.filter((v) => v.vertical === vertical))
      } catch {
        setError('We could not load this list. Check your connection and try again.')
        setAll([])
      }
    },
    [vertical],
  )

  useEffect(() => {
    setAll(null)
    void load()
  }, [load])

  const cuisines = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of all ?? []) {
      for (const c of v.cuisines) {
        const key = titleCase(c)
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return ['All', ...sorted.slice(0, 12).map(([k]) => k)]
  }, [all])

  const visible = useMemo(() => {
    let list = [...(all ?? [])]

    if (cuisine !== 'All') {
      list = list.filter((v) =>
        v.cuisines.some((c) => titleCase(c).toLowerCase() === cuisine.toLowerCase()),
      )
    }
    if (openOnly) list = list.filter(isOpenNow)

    switch (sort) {
      case 'Fastest':
        return list.sort((a, b) => a.prepMinutes - b.prepMinutes)
      case 'Top rated':
        return list.sort((a, b) => b.rating - a.rating)
      case 'Cheapest delivery':
        return list.sort((a, b) => a.deliveryFee - b.deliveryFee)
      default:
        return sortForBrowsing(list)
    }
  }, [all, cuisine, openOnly, sort])

  const openCount = (all ?? []).filter(isOpenNow).length

  return (
    <>
      <AppBar
        title={spec.label}
        subtitle={spec.tagline}
        trailing={
          <IconButton label="Search" onClick={() => navigate(`/search?hub=${vertical}`)}>
            <Search size={20} aria-hidden />
          </IconButton>
        }
      />

      <ScreenBody bottomGap="150px">
        <SectionHeader
          title={all == null ? 'Loading' : `${visible.length} ${spec.label.toLowerCase()}`}
          subtitle={all == null ? 'Finding what is near you' : `${openCount} open right now`}
        />

        {cuisines.length > 2 && (
          <div style={{ paddingBottom: 'var(--gap-md)' }}>
            <ChipRail options={cuisines} selected={cuisine} onSelect={setCuisine} />
          </div>
        )}

        <div style={{ paddingBottom: 'var(--gap-lg)' }}>
          <ChipRail
            options={[...SORTS, openOnly ? 'Open now ✓' : 'Open now']}
            selected={openOnly ? 'Open now ✓' : sort}
            onSelect={(value) => {
              if (value.startsWith('Open now')) setOpenOnly((v) => !v)
              else {
                setOpenOnly(false)
                setSort(value as SortKey)
              }
            }}
          />
        </div>

        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {error ? (
            <EmptyState
              title="Nothing loaded"
              message={error}
              icon={<WifiOff size={28} aria-hidden />}
              compact
              actionLabel="Try again"
              onAction={() => void load(true)}
            />
          ) : all == null ? (
            <>
              <VendorCardSkeleton />
              <VendorCardSkeleton />
              <VendorCardSkeleton />
            </>
          ) : visible.length === 0 ? (
            <EmptyState
              title={`No ${spec.label.toLowerCase()} yet`}
              message={
                cuisine === 'All' && !openOnly
                  ? `We have not signed up any ${spec.label.toLowerCase()} on your campus yet. They are coming.`
                  : 'Nothing matches those filters right now. Try widening them.'
              }
              icon={<Store size={28} aria-hidden />}
              tone={spec.color}
              compact
              actionLabel={cuisine !== 'All' || openOnly ? 'Clear filters' : undefined}
              onAction={
                cuisine !== 'All' || openOnly
                  ? () => {
                      setCuisine('All')
                      setOpenOnly(false)
                    }
                  : undefined
              }
            />
          ) : (
            visible.map((v, i) => (
              <FadeSlideIn key={v.id} delay={staggerFor(i, 4)}>
                <VendorCard vendor={v} />
              </FadeSlideIn>
            ))
          )}
        </div>
      </ScreenBody>
    </>
  )
}
