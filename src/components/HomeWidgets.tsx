/* ═══════════════════════════════════════════════════════════════════════
   Home furniture — a port of lib/features/home/home_widgets.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where, limit as fbLimit } from 'firebase/firestore'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Lock,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { auth, db } from '../lib/firebase'
import { addressLabel } from '../models/address'
import {
  HUB_ORDER,
  VERTICALS,
  type Vertical,
} from '../models/catalog'
import {
  ORDER_STAGES,
  orderSummaryLine,
  showsPin,
  type BlorbOrder,
} from '../models/order'
import {
  firstName,
  greeting,
  isSignedIn,
  useSessionStore,
} from '../store/sessionStore'
import { IconButton } from '../ui/Button'
import { Skeleton } from '../ui/kit'
import { FadeSlideIn, LivePulse, PressScale, staggerFor, SwapIn } from '../ui/motion'
import { RailCardSkeleton, VendorCardSkeleton } from './CatalogCards'
import { StageIcon } from './StageIcon'

/* ── Header ────────────────────────────────────────────────────────────── */

/**
 * The home header.
 *
 * A brand-blue field that carries the address, the greeting and the search
 * bar. As the page scrolls, the greeting fades out and the header collapses
 * onto a pinned search bar, so search is reachable from anywhere in the feed
 * without a second control.
 */
export function HomeHeader({
  onSearch,
  onAddress,
  onNotifications,
}: {
  onSearch: () => void
  onAddress: () => void
  onNotifications: () => void
}) {
  const [t, setT] = useState(0)
  const session = useSessionStore()

  useEffect(() => {
    const onScroll = () => {
      // 120px of travel between fully expanded and fully collapsed, matching
      // the Flutter delegate's shrink range.
      setT(Math.min(Math.max(window.scrollY, 0) / 120, 1))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fade = (multiplier: number) => Math.max(0, Math.min(1, 1 - t * multiplier))

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        background: 'var(--gradient-brand)',
        borderRadius: `0 0 ${28 * (1 - t)}px ${28 * (1 - t)}px`,
        paddingTop: 'var(--safe-top)',
        overflow: 'hidden',
      }}
    >
      {/* A faint radial highlight keeps the large flat blue from reading as a
          solid slab. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Top row: address + bell ─────────────────────────────────── */}
      <div
        style={{
          height: Math.max(0, 64 * (1 - t)),
          opacity: fade(1.6),
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          padding: '0 var(--gap-md) 0 var(--gap-page)',
        }}
      >
        <PressScale
          scale={0.97}
          onClick={onAddress}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
            }}
          >
            <MapPin size={17} aria-hidden />
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.7px',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              DELIVER TO
            </span>
            <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <span className="t-label clamp-1" style={{ color: '#fff' }}>
                {addressLabel(session.address)}
              </span>
              <ChevronDown size={18} aria-hidden style={{ color: '#fff', flexShrink: 0 }} />
            </span>
          </span>
        </PressScale>

        <NotificationBell onClick={onNotifications} />
      </div>

      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div
        style={{
          height: Math.max(0, 52 * (1 - t * 1.2)),
          opacity: fade(2.2),
          overflow: 'hidden',
          padding: '0 var(--gap-page)',
        }}
      >
        <div className="t-h1" style={{ color: '#fff' }}>
          {isSignedIn(session) ? `${greeting()}, ${firstName(session)}` : greeting()}
        </div>
        <div className="t-body-sm" style={{ marginTop: 2, color: 'rgba(255,255,255,0.82)' }}>
          What are you eating today?
        </div>
      </div>

      {/* ── Search, pinned ───────────────────────────────────────────── */}
      <div style={{ padding: `0 var(--gap-page) ${16 - 4 * t}px` }}>
        <SearchBar onClick={onSearch} collapsed={t > 0.6} />
      </div>
    </div>
  )
}

/**
 * Bell with a live unread count straight off Firestore.
 *
 * The count query is capped at 30 documents: nobody needs an exact number past
 * "99+", and an uncapped count on a chatty collection is a real cost.
 */
export function NotificationBell({
  onClick,
  onBrand = true,
}: {
  onClick: () => void
  onBrand?: boolean
}) {
  const [count, setCount] = useState(0)
  const uid = auth.currentUser?.uid

  useEffect(() => {
    if (!uid) {
      setCount(0)
      return
    }
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        where('status', '==', 'unread'),
        fbLimit(30),
      ),
      (snap) => setCount(snap.docs.length),
      () => setCount(0),
    )
  }, [uid])

  return (
    <IconButton
      label="Notifications"
      onClick={onClick}
      badgeCount={count}
      background={onBrand ? 'rgba(255,255,255,0.2)' : undefined}
      color={onBrand ? '#fff' : 'var(--color-ink)'}
    >
      <Bell size={20} aria-hidden />
    </IconButton>
  )
}

/**
 * The search hint cycles through real things people search for. It teaches the
 * breadth of the catalogue without a banner, and it is the cheapest discovery
 * mechanism in the app.
 */
const HINTS = [
  'Search jollof rice',
  'Search shawarma',
  'Search paracetamol',
  'Search small chops',
  'Search pounded yam',
  'Search MTN data',
  'Search pepper soup',
]

function SearchBar({ onClick, collapsed }: { onClick: () => void; collapsed: boolean }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (collapsed) return
    const id = setInterval(() => setIndex((i) => (i + 1) % HINTS.length), 3000)
    return () => clearInterval(id)
  }, [collapsed])

  return (
    <PressScale
      scale={0.98}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 'var(--size-search-bar)',
        paddingInline: 'var(--gap-lg)',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'left',
      }}
    >
      <Search size={21} aria-hidden style={{ color: 'var(--color-ink-faint)', flexShrink: 0 }} />
      <span
        className="t-body clamp-1"
        style={{ flex: 1, minWidth: 0, marginLeft: 10, color: 'var(--color-ink-faint)' }}
      >
        {collapsed ? (
          'Search Blorbmart'
        ) : (
          <SwapIn swapKey={index}>{HINTS[index]}</SwapIn>
        )}
      </span>
      <span
        aria-hidden
        style={{
          width: 1,
          height: 30,
          background: 'var(--color-line)',
          marginInline: 'var(--gap-md)',
        }}
      />
      <SlidersHorizontal size={19} aria-hidden style={{ color: 'var(--color-brand)' }} />
    </PressScale>
  )
}

/* ── The four hubs ─────────────────────────────────────────────────────── */

/**
 * This is the navigational spine of the app, so it gets real estate: large tap
 * targets, the actual artwork from the assets folder, and a tinted ground per
 * hub so they are told apart by colour before they are read.
 */
export function VerticalGrid({ onSelect }: { onSelect: (v: Vertical) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {HUB_ORDER.map((id, i) => {
        const spec = VERTICALS[id]
        return (
          <FadeSlideIn key={id} delay={staggerFor(i)} style={{ flex: 1, minWidth: 0 }}>
            <PressScale
              scale={0.93}
              onClick={() => onSelect(id)}
              style={{ display: 'block', width: '100%' }}
            >
              <div
                style={{
                  aspectRatio: '1',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 'var(--gap-lg)',
                  borderRadius: 'var(--radius-lg)',
                  background: spec.softColor,
                  border: `1px solid color-mix(in srgb, ${spec.color} 12%, transparent)`,
                }}
              >
                <img
                  src={spec.asset}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div
                className="t-label-sm clamp-1"
                style={{ marginTop: 'var(--gap-sm)', color: 'var(--color-ink-strong)' }}
              >
                {spec.label}
              </div>
            </PressScale>
          </FadeSlideIn>
        )
      })}
    </div>
  )
}

/* ── Live order ────────────────────────────────────────────────────────── */

/**
 * Shown on home whenever something is on its way. It carries the stage, a
 * four-step progress bar, and — once the rider is close — a note that the
 * delivery PIN is ready.
 */
export function LiveOrderCard({ order }: { order: BlorbOrder }) {
  const navigate = useNavigate()
  const stage = ORDER_STAGES[order.stage]

  return (
    <PressScale
      scale={0.985}
      onClick={() => navigate(`/track/${order.id}`)}
      style={{
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        border: `1px solid color-mix(in srgb, ${stage.color} 18%, transparent)`,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 'var(--gap-lg)',
        }}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${stage.color} 10%, transparent)`,
            color: stage.color,
          }}
        >
          <StageIcon icon={stage.icon} size={22} />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LivePulse color={stage.color} size={7} />
            <span className="t-h4" style={{ color: stage.color }}>
              {stage.title}
            </span>
          </span>
          <span className="t-body-sm clamp-1" style={{ display: 'block', marginTop: 2 }}>
            {order.storeName
              ? `${order.storeName} · ${orderSummaryLine(order)}`
              : orderSummaryLine(order)}
          </span>
        </span>

        <ChevronRight size={20} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
      </div>

      <div style={{ padding: '0 var(--gap-lg) var(--gap-lg)' }}>
        <StageBar step={stage.step} color={stage.color} />
      </div>

      {showsPin(order) && <PinStrip stage={order.stage} />}
    </PressScale>
  )
}

/**
 * Four-segment progress. Filled segments animate their width so a status
 * change reads as motion rather than a jump.
 */
export function StageBar({ step, color }: { step: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2, 3].map((i) => {
        const fraction = i < step ? 1 : i === step ? 0.45 : 0
        return (
          <span
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-line)',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${fraction * 100}%`,
                height: '100%',
                borderRadius: 'var(--radius-pill)',
                background: color,
                transition: 'width var(--dur-slow) var(--ease-emphasized)',
              }}
            />
          </span>
        )
      })}
    </div>
  )
}

/**
 * Tells the customer their PIN is ready and points at the tracking screen.
 *
 * It deliberately does not print the digits. They are not on the order
 * document — a rider or vendor reading that document must not be able to read
 * the PIN, so it is fetched over the authenticated API on the tracking screen,
 * where the customer has actually navigated to look at it.
 */
function PinStrip({ stage }: { stage: BlorbOrder['stage'] }) {
  const urgent = stage === 'arrived' || stage === 'dispatched'
  const tone = urgent ? 'var(--color-appetite-deep)' : 'var(--color-ink-muted)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-sm)',
        padding: 'var(--gap-md) var(--gap-lg)',
        background: urgent ? 'var(--color-appetite-soft)' : 'var(--color-surface-sunken)',
      }}
    >
      <Lock size={16} aria-hidden style={{ color: tone, flexShrink: 0 }} />
      <span
        className="t-caption-sm"
        style={{ flex: 1, minWidth: 0, color: tone, fontWeight: 700 }}
      >
        {urgent ? 'Tap to show the rider your PIN' : 'Your delivery PIN is ready'}
      </span>
      <span style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="t-price-sm"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 30,
              fontSize: 15,
              color: 'var(--color-ink-faint)',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xs)',
              border: `1px solid ${urgent ? 'color-mix(in srgb, var(--color-appetite) 35%, transparent)' : 'var(--color-line)'}`,
            }}
          >
            •
          </span>
        ))}
      </span>
    </div>
  )
}

/* ── Loading ───────────────────────────────────────────────────────────── */

/**
 * The shape of the home screen while it loads. Matching the real layout is
 * what makes the wait feel short.
 */
export function HomeSkeleton() {
  return (
    <div style={{ paddingTop: 'var(--gap-xxl)' }}>
      <div style={{ padding: 'var(--gap-sm) var(--gap-page) var(--gap-lg)' }}>
        <Skeleton width={190} height={20} />
      </div>
      <div className="rail">
        {[0, 1, 2].map((i) => (
          <RailCardSkeleton key={i} width={182} />
        ))}
      </div>
      <div style={{ padding: 'var(--gap-xxl) var(--gap-page) var(--gap-lg)' }}>
        <Skeleton width={150} height={20} />
      </div>
      <div style={{ paddingInline: 'var(--gap-page)' }}>
        <VendorCardSkeleton />
        <VendorCardSkeleton />
      </div>
    </div>
  )
}
