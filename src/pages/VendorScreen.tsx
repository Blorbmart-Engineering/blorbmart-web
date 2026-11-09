/* ═══════════════════════════════════════════════════════════════════════
   A storefront — a port of lib/features/vendor/vendor_screen.dart.

   The menu is a live subscription, so a dish going out of stock while the
   customer is deciding removes itself from the screen.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bike, CalendarCheck, ClipboardList, Clock, Search, Share2, ShoppingBasket, Star, Tag, Users, UtensilsCrossed } from 'lucide-react'
import { menuStream, vendor as fetchVendor } from '../data/catalog'
import { preorderOptions, type PreorderOptions } from '../data/orders'
import { useStoreDeals } from '../data/storeDeals'
import { money, titleCase } from '../lib/format'
import { applySeo, SITE, storeSeo } from '../lib/seo'
import { shareOrCopy } from '../lib/share'
import {
  DELIVERY_FEE_LABEL,
  etaLabel,
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
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { Button } from '../ui/Button'
import { groupApi, ratingApi, type PublicReview } from '../data/social'
import { apiErrorMessage } from '../lib/api'
import { addressToFirestore } from '../models/address'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { SmartImage } from '../ui/SmartImage'
import { DishRow } from '../components/CatalogCards'
import { ItemSheet } from '../components/ItemSheet'
import { MarketListSheet } from '../components/MarketListSheet'
import { track } from '../lib/engagement'

export default function VendorScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [store, setStore] = useState<Vendor | null>(null)
  const deals = useStoreDeals(store?.id)
  // The store's pre-order window, asked only of a store that takes pre-orders.
  const [preorder, setPreorder] = useState<PreorderOptions | null>(null)
  useEffect(() => {
    if (!store?.id || !store.acceptsPreorder) return
    let live = true
    preorderOptions(store.id)
      .then((p) => live && setPreorder(p))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [store?.id, store?.acceptsPreorder])
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [section, setSection] = useState('All')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<MenuItem | null>(null)
  useEffect(() => {
    if (open) track({ type: 'product_view', storeId: id })
  }, [open, id])
  const [listOpen, setListOpen] = useState(false)
  const [missing, setMissing] = useState(false)

  const lines = useCartStore((s) => s.lines)
  const decrementItem = useCartStore((s) => s.decrementItem)
  const session = useSessionStore()
  const [params] = useSearchParams()
  // Arrived from a group order to pick food: the way back is kept on screen.
  const groupCode = params.get('group')
  const [starting, setStarting] = useState(false)

  const startGroup = async () => {
    if (!store) return
    if (!isSignedIn(session)) {
      navigate('/login', { state: { from: `/r/${id}` } })
      return
    }
    if (!session.address) {
      showToast('Add a delivery address first — the whole group’s food goes there.', 'danger')
      navigate('/addresses')
      return
    }
    setStarting(true)
    try {
      const group = await groupApi.create({
        storeId: store.id,
        storeName: store.name,
        vertical: store.vertical,
        address: addressToFirestore(session.address),
      })
      navigate(`/group/${group.code}`)
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setStarting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchVendor(id).then((v) => {
      if (cancelled) return
      if (!v) setMissing(true)
      else {
        setStore(v)
        track({ type: 'store_view', storeId: v.id, storeName: v.name })
      }
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
          <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
            {store && (
              <IconButton label="Share this store" onImage onClick={() => void shareStore(store)}>
                <Share2 size={19} aria-hidden />
              </IconButton>
            )}
            <IconButton label="Search this menu" onImage onClick={() => navigate('/search')}>
              <Search size={20} aria-hidden />
            </IconButton>
          </div>
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
                  <Meta icon={<Bike size={15} />} label={DELIVERY_FEE_LABEL} />
                  {store.minOrder > 0 && (
                    <Meta
                      icon={<ShoppingBasket size={15} />}
                      label={`Min ${money(store.minOrder)}`}
                    />
                  )}
                </div>

                {!closed && !groupCode && (
                  <div style={{ marginTop: 'var(--gap-md)' }}>
                    <Button
                      label="Start a group order"
                      kind="soft"
                      size="sm"
                      expand={false}
                      busy={starting}
                      icon={<Users size={16} aria-hidden />}
                      onClick={() => void startGroup()}
                    />
                  </div>
                )}

                {deals.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap', marginTop: 'var(--gap-md)' }}>
                    {deals.map((d) => (
                      <Pill key={`${d.kind}-${d.label}`} label={d.label} tone="success" icon={<Tag size={13} aria-hidden />} />
                    ))}
                  </div>
                )}

                {preorder?.enabled && preorder.days[0] ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-sm)',
                      marginTop: 'var(--gap-md)',
                      padding: 'var(--gap-sm) var(--gap-md)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-brand-softer)',
                    }}
                  >
                    <CalendarCheck size={18} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                    <span className="t-body-sm" style={{ flex: 1 }}>
                      {closed || !preorder.allowAsap ? '' : 'Or '}
                      Pre-order for <b>{preorder.days[0].label}</b> · order by {preorder.days[0].cutoffLabel}
                      {preorder.days.length > 1 ? `, or pick another day at checkout` : ''}
                    </span>
                  </div>
                ) : (
                  closed && (
                    <div style={{ marginTop: 'var(--gap-md)' }}>
                      <Pill
                        label={preorder?.enabled ? preorder.statusMessage || 'Pre-orders closed for now' : 'Closed right now'}
                        tone="warning"
                      />
                    </div>
                  )
                )}
              </div>
            </FadeSlideIn>
          ) : (
            <Skeleton height={132} radius="var(--radius-lg)" />
          )}
        </div>

        {groupCode && (
          <div style={{ padding: 'var(--gap-lg) var(--gap-page) 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-md)',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-brand-softer)',
                border: '1px solid var(--color-brand-soft)',
              }}
            >
              <Users size={20} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
              <span className="t-body-sm" style={{ flex: 1 }}>
                Picking for group <b>{groupCode}</b>. Add to your basket, then put it in the group.
              </span>
              <Button label="Back" size="sm" expand={false} onClick={() => navigate(`/group/${groupCode}`)} />
            </div>
          </div>
        )}

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

        {/* ── Not listed? ─────────────────────────────────────────────── */}
        {store?.vertical === 'market' && (
          <div style={{ padding: '0 var(--gap-page) var(--gap-md)' }}>
            <button
              type="button"
              className="press"
              onClick={() => setListOpen(true)}
              style={{
                ['--press-scale' as string]: '0.99',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-md)',
                width: '100%',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-market-soft)',
                border: '1px solid var(--color-market)',
                textAlign: 'left',
              }}
            >
              <ClipboardList size={22} aria-hidden style={{ flexShrink: 0, color: 'var(--color-market)' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-h4" style={{ display: 'block' }}>
                  What you want is not listed?
                </span>
                <span className="t-caption" style={{ display: 'block' }}>
                  Send your list and place your order
                </span>
              </span>
              <span className="t-label" style={{ color: 'var(--color-market)', flexShrink: 0 }}>
                Send list
              </span>
            </button>
          </div>
        )}

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
              title={query ? 'Nothing matches that' : store?.vertical === 'market' ? 'Nothing listed yet' : 'No dishes yet'}
              message={
                query
                  ? 'Try a different word, or clear the search to see the whole menu.'
                  : store?.vertical === 'market'
                    ? 'The market list is being put together. Check back shortly.'
                    : 'This kitchen has not published its menu yet. Check back shortly.'
              }
              icon={<UtensilsCrossed size={28} aria-hidden />}
              compact
              actionLabel={
                store?.vertical === 'market' ? 'Send it as a list' : query ? 'Clear search' : undefined
              }
              onAction={
                store?.vertical === 'market' ? () => setListOpen(true) : query ? () => setQuery('') : undefined
              }
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

        {store && <StoreReviews storeId={store.id} />}
      </ScreenBody>

      <ItemSheet item={open} open={open !== null} onClose={() => setOpen(null)} />
      {store?.vertical === 'market' && (
        <MarketListSheet
          open={listOpen}
          onClose={() => setListOpen(false)}
          storeId={store.id}
          storeName={store.name}
          initialList={query.trim()}
        />
      )}
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

/**
 * Shares a store's own address. The same link opens the store in the Android
 * app when it is installed (an App Link on /r/) and on the web everywhere
 * else, and shows the store's photo and name when pasted into WhatsApp.
 */
async function shareStore(store: Vendor) {
  const url = `${SITE}/r/${encodeURIComponent(store.id)}`
  const outcome = await shareOrCopy({
    title: store.name,
    text: `Order from ${store.name} on Blorbmart: ${url}`,
  })
  if (outcome === 'copied') showToast('Link copied')
  else if (outcome === 'failed') showToast(url)
}

/**
 * What customers chose to say in public, newest first. Only reviews the
 * customer marked public and moderation let through; nothing renders while
 * there are none, so a new store is not shown an empty "Reviews" heading.
 */
function StoreReviews({ storeId }: { storeId: string }) {
  const [reviews, setReviews] = useState<PublicReview[]>([])

  useEffect(() => {
    let cancelled = false
    ratingApi.storeReviews(storeId).then((r) => !cancelled && setReviews(r)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [storeId])

  if (!reviews.length) return null

  return (
    <section style={{ padding: 'var(--gap-xl) var(--gap-page) 0' }}>
      <h2 className="t-h3" style={{ margin: '0 0 var(--gap-md)' }}>What customers say</h2>
      {reviews.slice(0, 10).map((r, i) => (
        <div key={i} style={{ padding: 'var(--gap-md) 0', borderTop: i ? '1px solid var(--color-line)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="t-label-sm">{r.name}</span>
            <span aria-label={`${r.stars} out of 5 stars`} style={{ color: 'var(--color-amber)', fontSize: 13 }}>
              {'★'.repeat(r.stars)}
              <span style={{ color: 'var(--color-line)' }}>{'★'.repeat(5 - r.stars)}</span>
            </span>
          </div>
          {r.comment && <p className="t-body-sm" style={{ margin: '4px 0 0' }}>{r.comment}</p>}
          {r.tags.length > 0 && (
            <p className="t-caption" style={{ margin: '4px 0 0' }}>{r.tags.join(' · ')}</p>
          )}
        </div>
      ))}
    </section>
  )
}
