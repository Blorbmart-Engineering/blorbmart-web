/* ═══════════════════════════════════════════════════════════════════════
   A storefront — a port of lib/features/vendor/vendor_screen.dart.

   The menu is a live subscription, so a dish going out of stock while the
   customer is deciding removes itself from the screen.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bike, Clock, Search, ShoppingBasket, Star, UtensilsCrossed } from 'lucide-react'
import { menuStream, vendor as fetchVendor } from '../data/catalog'
import { money, titleCase } from '../lib/format'
import { applySeo, storeSeo } from '../lib/seo'
import {
  etaLabel,
  hasFreeDelivery,
  isOpenNow,
  isSoldOut,
  ratingLabel,
  vendorSubtitle,
  type MenuItem,
  type Vendor,
} from '../models/catalog'
import { cartQuantityOf, useCartStore } from '../store/cartStore'
import { IconButton } from '../ui/Button'
import { ChipRail, EmptyState, Pill, Skeleton, Stepper } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'
import { DishRow } from '../components/CatalogCards'
import { ItemSheet } from '../components/ItemSheet'

export default function VendorScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [store, setStore] = useState<Vendor | null>(null)
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [section, setSection] = useState('All')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<MenuItem | null>(null)
  const [missing, setMissing] = useState(false)

  const lines = useCartStore((s) => s.lines)
  const decrementItem = useCartStore((s) => s.decrementItem)

  useEffect(() => {
    let cancelled = false
    void fetchVendor(id).then((v) => {
      if (cancelled) return
      if (!v) setMissing(true)
      else setStore(v)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    return menuStream(id, setItems, () => setItems([]))
  }, [id])

  /** Menu groupings, derived from the dishes rather than a fixed list. */
  const sections = useMemo(() => {
    if (!items) return ['All']
    const seen = new Set<string>()
    for (const i of items) {
      const label = titleCase(i.section || i.categoryName)
      if (label) seen.add(label)
    }
    return ['All', ...[...seen].sort()]
  }, [items])

  const visible = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    return items
      .filter((i) => {
        if (section !== 'All') {
          const label = titleCase(i.section || i.categoryName)
          if (label !== section) return false
        }
        if (q && !i.name.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) {
          return false
        }
        return true
      })
      // Available dishes lead; a sold-out one stays visible but never above
      // something the customer can actually order.
      .sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)))
  }, [items, section, query])

  // What search engines and shared links show for this storefront: its
  // name, city and banner, and its menu as structured data.
  useEffect(() => {
    if (missing) applySeo({ title: 'Store not found | Blorbmart', noindex: true })
    else if (store) applySeo(storeSeo(store, items))
  }, [store, items, missing])

  if (missing) {
    return (
      <>
        <AppBar title="Not found" />
        <EmptyState
          title="That store is gone"
          message="It may have closed or been removed. Browse what is open near you instead."
          icon={<UtensilsCrossed size={30} aria-hidden />}
          actionLabel="Back to home"
          onAction={() => navigate('/home')}
        />
      </>
    )
  }

  const closed = store ? !isOpenNow(store) : false

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={store ? store.bannerUrl || store.logoUrl : ''}
          alt=""
          height={200}
          renderWidth={520}
          eager
          style={closed ? { filter: 'grayscale(1)' } : undefined}
        />
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, background: 'var(--gradient-image-scrim)' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--safe-top) + var(--gap-md))',
            left: 'var(--gap-lg)',
            right: 'var(--gap-lg)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <IconButton label="Go back" onImage onClick={() => navigate(-1)}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
          </IconButton>
          <IconButton label="Search this menu" onImage onClick={() => navigate('/search')}>
            <Search size={20} aria-hidden />
          </IconButton>
        </div>
      </div>

      <ScreenBody bottomGap="150px">
        {/* ── Identity ────────────────────────────────────────────────── */}
        <div
          style={{
            padding: 'var(--gap-lg) var(--gap-page) 0',
            marginTop: -34,
            position: 'relative',
          }}
        >
          {store ? (
            <FadeSlideIn>
              <div
                style={{
                  padding: 'var(--gap-lg)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <h1 className="t-h1" style={{ margin: 0 }}>
                  {store.name}
                </h1>
                <p className="t-body-sm" style={{ margin: '4px 0 var(--gap-md)' }}>
                  {vendorSubtitle(store)}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-lg)',
                    flexWrap: 'wrap',
                  }}
                >
                  <Meta
                    icon={<Star size={15} fill="var(--color-amber)" stroke="var(--color-amber)" />}
                    label={ratingLabel(store)}
                  />
                  <Meta icon={<Clock size={15} />} label={etaLabel(store)} />
                  <Meta
                    icon={<Bike size={15} />}
                    label={hasFreeDelivery(store) ? 'Free delivery' : money(store.deliveryFee)}
                    color={hasFreeDelivery(store) ? 'var(--color-success)' : undefined}
                  />
                  {store.minOrder > 0 && (
                    <Meta
                      icon={<ShoppingBasket size={15} />}
                      label={`Min ${money(store.minOrder)}`}
                    />
                  )}
                </div>

                {closed && (
                  <div style={{ marginTop: 'var(--gap-md)' }}>
                    <Pill
                      label={
                        store.acceptsPreorder
                          ? 'Closed — you can still preorder'
                          : 'Closed right now'
                      }
                      tone="warning"
                    />
                  </div>
                )}
              </div>
            </FadeSlideIn>
          ) : (
            <Skeleton height={132} radius="var(--radius-lg)" />
          )}
        </div>

        {/* ── Menu search ─────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--gap-xl) var(--gap-page) var(--gap-md)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              height: 46,
              paddingInline: 'var(--gap-md)',
              background: 'var(--color-surface-sunken)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Search size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${store?.name ?? 'this menu'}`}
              aria-label="Search this menu"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
              }}
            />
          </div>
        </div>

        {sections.length > 2 && (
          <div style={{ paddingBottom: 'var(--gap-md)' }}>
            <ChipRail options={sections} selected={section} onSelect={setSection} />
          </div>
        )}

        {/* ── Menu ────────────────────────────────────────────────────── */}
        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {items === null ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 'var(--gap-lg)', padding: '12px 0' }}>
                <div style={{ flex: 1 }}>
                  <Skeleton width="70%" height={15} />
                  <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
                  <Skeleton width="35%" height={14} style={{ marginTop: 12 }} />
                </div>
                <Skeleton width={92} height={92} radius="var(--radius-md)" />
              </div>
            ))
          ) : visible.length === 0 ? (
            <EmptyState
              title={query ? 'Nothing matches that' : 'No dishes yet'}
              message={
                query
                  ? 'Try a different word, or clear the search to see the whole menu.'
                  : 'This kitchen has not published its menu yet. Check back shortly.'
              }
              icon={<UtensilsCrossed size={28} aria-hidden />}
              compact
              actionLabel={query ? 'Clear search' : undefined}
              onAction={query ? () => setQuery('') : undefined}
            />
          ) : (
            visible.map((item, i) => {
              const quantity = cartQuantityOf(lines, item.id)
              return (
                <div key={item.id}>
                  <FadeSlideIn delay={staggerFor(i, 6)}>
                    <DishRow
                      item={item}
                      onClick={() => setOpen(item)}
                      trailing={
                        quantity > 0 ? (
                          <Stepper
                            quantity={quantity}
                            compact
                            label={item.name}
                            onIncrement={() => setOpen(item)}
                            onDecrement={() => decrementItem(item.id)}
                          />
                        ) : (
                          <IconButton
                            label={`Add ${item.name}`}
                            size={34}
                            background="var(--color-brand)"
                            color="#fff"
                            onClick={() => setOpen(item)}
                          >
                            <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>+</span>
                          </IconButton>
                        )
                      }
                    />
                  </FadeSlideIn>
                  {i < visible.length - 1 && (
                    <div aria-hidden style={{ height: 1, background: 'var(--color-line)' }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScreenBody>

      <ItemSheet item={open} open={open !== null} onClose={() => setOpen(null)} />
    </>
  )
}

function Meta({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode
  label: string
  color?: string
}) {
  const tone = color ?? 'var(--color-ink-body)'
  return (
    <span
      className="t-caption"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: tone, fontWeight: 700 }}
    >
      <span style={{ display: 'inline-flex', color: tone }}>{icon}</span>
      {label}
    </span>
  )
}
