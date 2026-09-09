/* ═══════════════════════════════════════════════════════════════════════
   Home — a port of lib/features/home/home_screen.dart.

   The order of this screen is an argument about what a hungry person needs,
   in sequence:

     1. Where is it going          — address, one tap to change
     2. What am I looking for      — search, always reachable
     3. Which of the four hubs     — restaurants, pharmacy, events, bills
     4. Where is my food           — live order, if one is in flight
     5. What is good right now     — fast nearby, trending, deals
     6. Everything else            — the full list

   Anything that cannot answer one of those questions does not belong here.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Soup, WifiOff } from 'lucide-react'
import { deals, trending, vendors, sortForBrowsing } from '../data/catalog'
import { watchActiveOrders } from '../data/orders'
import { titleCase } from '../lib/format'
import {
  isOpenNow,
  type MenuItem,
  type Vendor,
  type Vertical,
} from '../models/catalog'
import type { BlorbOrder } from '../models/order'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { ChipRail, EmptyState, Rail, SectionHeader } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { ScreenBody } from '../ui/Screen'
import { DishRailCard, VendorCard, VendorRailCard } from '../components/CatalogCards'
import {
  HomeHeader,
  HomeSkeleton,
  LiveOrderCard,
  VerticalGrid,
} from '../components/HomeWidgets'
import { AddressSheet } from '../components/AddressSheet'

export default function HomeScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()

  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [trendingItems, setTrendingItems] = useState<MenuItem[]>([])
  const [dealItems, setDealItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cuisine, setCuisine] = useState('All')
  const [addressOpen, setAddressOpen] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setError(null)
    else setLoading(true)

    try {
      // Fired together — three independent reads, one wait.
      const [v, t, d] = await Promise.all([
        vendors(refresh),
        trending(10),
        deals(10),
      ])
      setAllVendors(v)
      setTrendingItems(t)
      setDealItems(d)
      setError(null)
    } catch {
      setError('We could not load restaurants. Pull down to try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // The catalogue is re-filtered when the campus arrives with the profile,
  // which can land after the first paint.
  const campusId = session.profile.universityId
  useEffect(() => {
    if (campusId) void load(true)
  }, [campusId, load])

  const restaurants = useMemo(
    () => sortForBrowsing(allVendors.filter((v) => v.vertical === 'restaurants')),
    [allVendors],
  )

  /**
   * Cuisine filter values, derived from what vendors actually offer rather
   * than a hard-coded list that goes stale.
   */
  const cuisines = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of restaurants) {
      for (const c of v.cuisines) {
        const key = titleCase(c)
        if (!key) continue
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return ['All', ...sorted.slice(0, 10).map(([k]) => k)]
  }, [restaurants])

  const filtered = useMemo(() => {
    if (cuisine === 'All') return restaurants
    return restaurants.filter((v) =>
      v.cuisines.some((c) => titleCase(c).toLowerCase() === cuisine.toLowerCase()),
    )
  }, [restaurants, cuisine])

  const fastNearby = useMemo(
    () =>
      restaurants
        .filter(isOpenNow)
        .sort((a, b) => {
          const byDistance = (a.distanceKm ?? 99) - (b.distanceKm ?? 99)
          if (byDistance !== 0) return byDistance
          return a.prepMinutes - b.prepMinutes
        })
        .slice(0, 10),
    [restaurants],
  )

  /**
   * Bills and Events are not storefronts. Bills is a biller catalogue and
   * Events is a ticketing listing, so neither has vendors for the hub screen
   * to show.
   */
  const openHub = (vertical: Vertical) => {
    if (vertical === 'bills') navigate('/bills')
    else if (vertical === 'events') navigate('/events')
    else navigate(`/hub/${vertical}`)
  }

  const cityLabel = session.address?.city || 'you'

  return (
    <>
      <HomeHeader
        onSearch={() => navigate('/search')}
        onAddress={() => setAddressOpen(true)}
        onNotifications={() => navigate('/notifications')}
      />

      <ScreenBody bottomGap="150px">
        {/* ── The four hubs ─────────────────────────────────────────── */}
        <div style={{ padding: 'var(--gap-xxl) var(--gap-page) 0' }}>
          <VerticalGrid onSelect={openHub} />
        </div>

        {/* ── Live order ────────────────────────────────────────────── */}
        <LiveOrderStrip />

        {error ? (
          <div style={{ padding: 'var(--gap-page)' }}>
            <EmptyState
              title="Nothing loaded"
              message={error}
              icon={<WifiOff size={28} aria-hidden />}
              compact
              actionLabel="Try again"
              onAction={() => void load(true)}
            />
          </div>
        ) : loading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* ── Fast near you ─────────────────────────────────────── */}
            {fastNearby.length > 0 && (
              <>
                <SectionHeader
                  title="Fastest near you"
                  subtitle="Open now, closest kitchens first"
                  actionLabel="See all"
                  onAction={() => openHub('restaurants')}
                />
                <Rail>
                  {fastNearby.map((v, i) => (
                    <FadeSlideIn key={v.id} delay={staggerFor(i, 5)} offsetX={14} offsetY={0}>
                      <VendorRailCard vendor={v} />
                    </FadeSlideIn>
                  ))}
                </Rail>
              </>
            )}

            {/* ── Deals ─────────────────────────────────────────────── */}
            {dealItems.length > 0 && (
              <>
                <SectionHeader title="Save today" subtitle="Discounts ending soon" />
                <Rail>
                  {dealItems.map((item, i) => (
                    <FadeSlideIn key={item.id} delay={staggerFor(i, 5)} offsetX={14} offsetY={0}>
                      <DishRailCard item={item} />
                    </FadeSlideIn>
                  ))}
                </Rail>
              </>
            )}

            {/* ── Trending ──────────────────────────────────────────── */}
            {trendingItems.length > 0 && (
              <>
                <SectionHeader
                  title="Ordered most this week"
                  subtitle="What everyone around you is eating"
                />
                <Rail>
                  {trendingItems.map((item, i) => (
                    <FadeSlideIn key={item.id} delay={staggerFor(i, 5)} offsetX={14} offsetY={0}>
                      <DishRailCard item={item} />
                    </FadeSlideIn>
                  ))}
                </Rail>
              </>
            )}

            {/* ── Everything ────────────────────────────────────────── */}
            <SectionHeader
              title="All restaurants"
              subtitle={`${filtered.length} near ${cityLabel}`}
            />

            {cuisines.length > 2 && (
              <div style={{ paddingBottom: 'var(--gap-lg)' }}>
                <ChipRail options={cuisines} selected={cuisine} onSelect={setCuisine} />
              </div>
            )}

            {filtered.length === 0 ? (
              <EmptyState
                title={`Nothing in ${cuisine} yet`}
                message="No kitchen near you is serving that right now. Try another cuisine, or browse everything."
                icon={<Soup size={28} aria-hidden />}
                compact
                actionLabel="Show all"
                onAction={() => setCuisine('All')}
              />
            ) : (
              <div style={{ paddingInline: 'var(--gap-page)' }}>
                {filtered.map((v, i) => (
                  <FadeSlideIn key={v.id} delay={staggerFor(i, 4)}>
                    <VendorCard vendor={v} />
                  </FadeSlideIn>
                ))}
              </div>
            )}
          </>
        )}
      </ScreenBody>

      <AddressSheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        onChanged={() => void load(true)}
      />
    </>
  )
}

/**
 * Subscribes to the buyer's in-flight orders and shows the most recent one,
 * with its PIN, right under the hubs — the place people look first when they
 * are waiting on food.
 */
function LiveOrderStrip() {
  const signedIn = useSessionStore(isSignedIn)
  const [orders, setOrders] = useState<BlorbOrder[]>([])

  useEffect(() => {
    if (!signedIn) {
      setOrders([])
      return
    }
    return watchActiveOrders(setOrders)
  }, [signedIn])

  if (!signedIn || orders.length === 0) return null

  return (
    <div style={{ padding: 'var(--gap-xxl) var(--gap-page) 0' }}>
      <FadeSlideIn>
        <LiveOrderCard order={orders[0]} />
      </FadeSlideIn>
    </div>
  )
}
