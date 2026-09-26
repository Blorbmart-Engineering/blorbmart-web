/* ═══════════════════════════════════════════════════════════════════════
   The cards the whole catalogue is built from — a port of
   lib/features/catalog/catalog_cards.dart.

   One definition each for a vendor and a dish, used by home, search, hub and
   vendor screens. Changing how a restaurant is presented is a single edit,
   and every surface agrees.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bike,
  Clock,
  Flame,
  ShoppingBasket,
  Sparkles,
  Star,
} from 'lucide-react'
import { compactCount, money } from '../lib/format'
import {
  discountPercent,
  effectivePrice,
  etaLabel,
  hasDiscount,
  hasFreeDelivery,
  isOpenNow,
  isSoldOut,
  itemImage,
  ratingLabel,
  vendorSubtitle,
  type MenuItem,
  type Vendor,
} from '../models/catalog'
import { Pill, Skeleton } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { SmartImage } from '../ui/SmartImage'

/* ── Vendor card ───────────────────────────────────────────────────────── */

/**
 * Full-width vendor card. The primary browse unit.
 *
 * The hierarchy is deliberate: photograph, then name, then the two numbers
 * people actually choose on — time and delivery fee. Rating sits third because
 * in food delivery, "when" and "how much" beat "how good" for a hungry person
 * at 8pm.
 */
export function VendorCard({ vendor, height = 158 }: { vendor: Vendor; height?: number }) {
  const navigate = useNavigate()
  const closed = !isOpenNow(vendor)

  return (
    <PressScale
      scale={0.985}
      onClick={() => navigate(`/r/${vendor.id}`)}
      // textAlign, because this renders a <button> and a button centres its
      // text. Without it the vendor name and cuisine line float in the middle
      // of the card while the meta row below them — a flex row, so immune —
      // stays left. The rail cards already set it for the same reason.
      style={{
        display: 'block',
        width: '100%',
        marginBottom: 'var(--gap-lg)',
        textAlign: 'left',
      }}
    >
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={vendor.bannerUrl || vendor.logoUrl}
          alt={vendor.name}
          height={height}
          renderWidth={520}
          radius="var(--radius-lg)"
          // A closed kitchen is desaturated rather than hidden — people still
          // want to know it exists and browse its menu for later.
          style={closed ? { filter: 'grayscale(1)' } : undefined}
          fallback={
            <span className="t-label-sm" style={{ color: 'var(--color-ink-faint)' }}>
              {vendor.name}
            </span>
          }
        />

        {vendor.isFeatured && !closed && (
          <div style={{ position: 'absolute', top: 'var(--gap-md)', left: 'var(--gap-md)' }}>
            <Pill label="Featured" tone="appetite" solid dense icon={<Sparkles size={11} />} />
          </div>
        )}
        {hasFreeDelivery(vendor) && !closed && (
          <div style={{ position: 'absolute', top: 'var(--gap-md)', right: 'var(--gap-md)' }}>
            <Pill label="Free delivery" tone="success" solid dense icon={<Bike size={11} />} />
          </div>
        )}
        {closed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span
              className="t-label-sm"
              style={{
                padding: 'var(--gap-sm) var(--gap-lg)',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(11, 18, 32, 0.82)',
                color: '#fff',
              }}
            >
              {vendor.acceptsPreorder ? 'Closed · preorder available' : 'Closed right now'}
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--gap-md)',
          marginTop: 'var(--gap-md)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h3 clamp-1">{vendor.name}</div>
          <div className="t-body-sm clamp-1" style={{ marginTop: 4 }}>
            {vendorSubtitle(vendor)}
          </div>
        </div>
        <RatingChip vendor={vendor} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-lg)',
          marginTop: 10,
          flexWrap: 'wrap',
        }}
      >
        <Meta icon={<Clock size={15} />} label={etaLabel(vendor)} emphasise />
        <Meta
          icon={<Bike size={15} />}
          label={hasFreeDelivery(vendor) ? 'Free' : money(vendor.deliveryFee)}
          emphasise={hasFreeDelivery(vendor)}
          color={hasFreeDelivery(vendor) ? 'var(--color-success)' : undefined}
        />
        {vendor.minOrder > 0 && (
          <Meta icon={<ShoppingBasket size={15} />} label={`Min ${money(vendor.minOrder)}`} />
        )}
      </div>
    </PressScale>
  )
}

/** Compact vendor card for horizontal rails. */
export function VendorRailCard({ vendor, width = 182 }: { vendor: Vendor; width?: number }) {
  const navigate = useNavigate()
  const closed = !isOpenNow(vendor)

  return (
    <PressScale
      scale={0.97}
      onClick={() => navigate(`/r/${vendor.id}`)}
      style={{ display: 'block', width, textAlign: 'left' }}
    >
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={vendor.bannerUrl || vendor.logoUrl}
          alt={vendor.name}
          width={width}
          height={116}
          renderWidth={width}
          radius="var(--radius-md)"
          style={closed ? { opacity: 0.55 } : undefined}
          fallback={
            <span className="t-caption-sm" style={{ padding: 4, textAlign: 'center' }}>
              {vendor.name}
            </span>
          }
        />
        <span
          className="t-caption-sm"
          style={{
            position: 'absolute',
            bottom: 'var(--gap-sm)',
            left: 'var(--gap-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(255,255,255,0.94)',
            color: 'var(--color-ink)',
          }}
        >
          <Clock size={12} aria-hidden />
          {etaLabel(vendor)}
        </span>
      </div>

      <div className="t-h4 clamp-1" style={{ marginTop: 10 }}>
        {vendor.name}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          marginTop: 4,
          minWidth: 0,
        }}
      >
        <Star size={14} fill="var(--color-amber)" stroke="var(--color-amber)" aria-hidden />
        <span className="t-caption-sm" style={{ color: 'var(--color-ink-body)' }}>
          {ratingLabel(vendor)}
        </span>
        <span className="t-caption-sm">&nbsp;•&nbsp;</span>
        <span
          className="t-caption-sm clamp-1"
          style={{
            color: hasFreeDelivery(vendor) ? 'var(--color-success)' : 'var(--color-ink-muted)',
          }}
        >
          {hasFreeDelivery(vendor) ? 'Free delivery' : money(vendor.deliveryFee)}
        </span>
      </div>
    </PressScale>
  )
}

/* ── Dish cards ────────────────────────────────────────────────────────── */

/** A dish in a horizontal rail — "Trending now", "Save today". */
export function DishRailCard({
  item,
  width = 158,
  onClick,
}: {
  item: MenuItem
  width?: number
  onClick?: () => void
}) {
  const navigate = useNavigate()
  const soldOut = isSoldOut(item)

  return (
    <PressScale
      scale={0.96}
      onClick={onClick ?? (() => navigate(`/r/${item.storeId}`))}
      style={{ display: 'block', width, textAlign: 'left' }}
    >
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={itemImage(item)}
          alt={item.name}
          width={width}
          height={120}
          renderWidth={width}
          radius="var(--radius-md)"
          fallback={
            <span className="t-caption-sm" style={{ padding: 4, textAlign: 'center' }}>
              {item.name}
            </span>
          }
        />
        {hasDiscount(item) && (
          <div style={{ position: 'absolute', top: 'var(--gap-sm)', left: 'var(--gap-sm)' }}>
            <Pill label={`-${discountPercent(item)}%`} tone="appetite" solid dense />
          </div>
        )}
        {soldOut && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.7)',
            }}
          >
            <span className="t-label-sm" style={{ color: 'var(--color-ink-muted)' }}>
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="t-h4 clamp-1" style={{ marginTop: 10 }}>
        {item.name}
      </div>
      <div className="t-caption-sm clamp-1" style={{ marginTop: 2 }}>
        {item.storeName}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <span className="t-price-sm">{money(effectivePrice(item))}</span>
        {hasDiscount(item) && <span className="t-price-struck">{money(item.price)}</span>}
        {item.unit && <span className="t-caption-sm">/ {item.unit}</span>}
      </div>
    </PressScale>
  )
}

/** A dish as a full-width row — used in search results and on the vendor menu. */
export function DishRow({
  item,
  onClick,
  trailing,
  showStore = false,
  reason,
}: {
  item: MenuItem
  onClick?: () => void
  trailing?: ReactNode
  showStore?: boolean
  /** Why this appeared in a search — "From Chicken Republic". */
  reason?: string
}) {
  const soldOut = isSoldOut(item)

  return (
    <PressScale
      scale={0.985}
      onClick={soldOut ? undefined : onClick}
      disabled={soldOut}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--gap-lg)',
        width: '100%',
        padding: 'var(--gap-md) 0',
        opacity: soldOut ? 0.55 : 1,
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {item.isPopular && !soldOut && (
            <Flame size={15} aria-hidden style={{ color: 'var(--color-appetite)', flexShrink: 0 }} />
          )}
          <span className="t-h4 clamp-1">{item.name}</span>
        </div>

        {showStore && item.storeName && (
          <div
            className="t-caption-sm clamp-1"
            style={{ marginTop: 4, color: 'var(--color-brand)', fontWeight: 700 }}
          >
            {reason ?? item.storeName}
          </div>
        )}

        {item.description && (
          <p className="t-body-sm clamp-2" style={{ margin: '6px 0 0' }}>
            {item.description}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <span className="t-price">{money(effectivePrice(item))}</span>
          {hasDiscount(item) && <span className="t-price-struck">{money(item.price)}</span>}
          {item.unit && <span className="t-caption-sm">/ {item.unit}</span>}
          {soldOut && <Pill label="Sold out" tone="neutral" dense />}
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <SmartImage
          src={itemImage(item)}
          alt={item.name}
          width="var(--size-dish-thumb)"
          height="var(--size-dish-thumb)"
          renderWidth={92}
          radius="var(--radius-md)"
          fallback={
            <span className="t-caption-sm" style={{ padding: 4, textAlign: 'center' }}>
              {item.name.slice(0, 12)}
            </span>
          }
        />
        {trailing && (
          <div style={{ position: 'absolute', bottom: -10, right: -6 }}>{trailing}</div>
        )}
      </div>
    </PressScale>
  )
}

/* ── Bits ──────────────────────────────────────────────────────────────── */

function RatingChip({ vendor }: { vendor: Vendor }) {
  const isNew = vendor.rating <= 0
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 8px',
        flexShrink: 0,
        borderRadius: 'var(--radius-xs)',
        background: isNew ? 'var(--color-brand-soft)' : 'var(--color-amber-soft)',
      }}
    >
      {isNew ? (
        <Sparkles size={14} aria-hidden style={{ color: 'var(--color-brand)' }} />
      ) : (
        <Star size={14} aria-hidden fill="var(--color-amber)" stroke="var(--color-amber)" />
      )}
      <span
        className="t-label-sm"
        style={{ color: isNew ? 'var(--color-brand-ink)' : '#8A5D00' }}
      >
        {ratingLabel(vendor)}
      </span>
      {!isNew && vendor.ratingCount > 0 && (
        <span className="t-caption-sm" style={{ fontSize: 10 }}>
          ({compactCount(vendor.ratingCount)})
        </span>
      )}
    </span>
  )
}

function Meta({
  icon,
  label,
  emphasise = false,
  color,
}: {
  icon: ReactNode
  label: string
  emphasise?: boolean
  color?: string
}) {
  const tone = color ?? (emphasise ? 'var(--color-ink-strong)' : 'var(--color-ink-muted)')
  return (
    <span
      className="t-caption"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color: tone,
        fontWeight: emphasise ? 700 : 600,
      }}
    >
      <span style={{ display: 'inline-flex', color: tone }}>{icon}</span>
      {label}
    </span>
  )
}

/* ── Skeletons ─────────────────────────────────────────────────────────── */

export function VendorCardSkeleton() {
  return (
    <div style={{ marginBottom: 'var(--gap-lg)' }}>
      <Skeleton height={158} radius="var(--radius-lg)" />
      <Skeleton width="60%" height={17} style={{ marginTop: 'var(--gap-md)' }} />
      <Skeleton width="40%" height={13} style={{ marginTop: 8 }} />
      <Skeleton width="72%" height={13} style={{ marginTop: 10 }} />
    </div>
  )
}

export function RailCardSkeleton({ width = 182 }: { width?: number }) {
  return (
    <div style={{ width, flexShrink: 0 }}>
      <Skeleton height={116} radius="var(--radius-md)" />
      <Skeleton width="80%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="55%" height={12} style={{ marginTop: 6 }} />
    </div>
  )
}
