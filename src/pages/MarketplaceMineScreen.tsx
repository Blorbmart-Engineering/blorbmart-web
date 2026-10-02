/* ═══════════════════════════════════════════════════════════════════════
   My marketplace: what I am buying, what I am selling, and what I earned.

   Opens on whichever tab needs the person: a sale waiting for them to
   accept beats everything, because the buyer's money is held and the clock
   on it is running.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, PackageOpen, Plus, Wallet } from 'lucide-react'
import { asDate, money, timeAgo } from '../lib/format'
import {
  getEarnings,
  myListings,
  myMarketOrders,
  orderStatusLabel,
  orderStatusTone,
  type Earnings,
  type Listing,
  type MarketOrder,
} from '../data/marketplace'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { Card, EmptyState, Pill, Skeleton } from '../ui/kit'
import { ListingCard, ListingPhoto } from '../components/marketplace/MarketParts'

type Tab = 'buying' | 'selling' | 'items'

export default function MarketplaceMineScreen() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab | null>(null)
  const [buying, setBuying] = useState<MarketOrder[] | null>(null)
  const [selling, setSelling] = useState<MarketOrder[] | null>(null)
  const [items, setItems] = useState<Listing[] | null>(null)
  const [earnings, setEarnings] = useState<Earnings | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      myMarketOrders('buyer').catch(() => []),
      myMarketOrders('seller').catch(() => []),
      myListings().catch(() => []),
      getEarnings().catch(() => null),
    ]).then(([b, s, l, e]) => {
      if (cancelled) return
      setBuying(b)
      setSelling(s)
      setItems(l)
      setEarnings(e)
      setTab((current) => current ?? (s.some((o) => o.status === 'awaiting_seller') ? 'selling' : b.length ? 'buying' : s.length ? 'selling' : 'items'))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const waiting = selling?.filter((o) => o.status === 'awaiting_seller').length ?? 0
  const loading = tab === null

  return (
    <>
      <AppBar title="My marketplace" />
      <ScreenBody padded bottomGap="150px">
        <Card
          style={{ marginTop: 'var(--gap-xl)' }}
          color="var(--color-ink)"
          shadow="var(--shadow-md)"
          onClick={() => navigate('/marketplace/earnings')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', color: '#fff' }}>
            <Wallet size={22} aria-hidden />
            <div style={{ flex: 1 }}>
              <div className="t-caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Marketplace earnings
              </div>
              <div className="t-price-lg" style={{ color: '#fff' }}>
                {earnings ? money(earnings.balance) : '—'}
              </div>
            </div>
            <span className="t-label" style={{ color: '#fff', display: 'inline-flex', alignItems: 'center' }}>
              Withdraw <ChevronRight size={16} aria-hidden />
            </span>
          </div>
        </Card>

        <div className="mkt-tabs" role="tablist" style={{ marginTop: 'var(--gap-xl)' }}>
          {(
            [
              ['buying', 'Buying'],
              ['selling', waiting ? `Selling · ${waiting}` : 'Selling'],
              ['items', 'My items'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'var(--gap-lg)' }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 'var(--gap-md)' }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={84} radius="var(--radius-lg)" />
              ))}
            </div>
          ) : tab === 'items' ? (
            items && items.length ? (
              <>
                <Button label="Sell something" icon={<Plus size={18} aria-hidden />} size="md" onClick={() => navigate('/marketplace/sell')} />
                <div className="mkt-grid" style={{ marginTop: 'var(--gap-lg)' }}>
                  {items.map((l) => (
                    <ListingCard key={l.id} listing={l} showStatus onOpen={() => navigate(`/marketplace/item/${l.id}`)} />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={<PackageOpen size={28} aria-hidden />}
                title="Nothing listed yet"
                message="Things you no longer use are worth money to someone on your campus."
                actionLabel="Sell something"
                onAction={() => navigate('/marketplace/sell')}
              />
            )
          ) : (
            <OrderList
              orders={(tab === 'buying' ? buying : selling) ?? []}
              empty={tab === 'buying' ? 'Things you buy show up here.' : 'When someone buys from you, it shows up here.'}
              onOpen={(o) => navigate(`/marketplace/orders/${o.id}`)}
              onBrowse={() => navigate('/marketplace')}
            />
          )}
        </div>
      </ScreenBody>
    </>
  )
}

function OrderList({ orders, empty, onOpen, onBrowse }: { orders: MarketOrder[]; empty: string; onOpen: (o: MarketOrder) => void; onBrowse: () => void }) {
  if (!orders.length) {
    return <EmptyState compact icon={<PackageOpen size={28} aria-hidden />} title="Nothing here yet" message={empty} actionLabel="Browse the marketplace" onAction={onBrowse} />
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--gap-md)' }}>
      {orders.map((o) => (
        <Card key={o.id} onClick={() => onOpen(o)} padding="var(--gap-md)">
          <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-sunken)' }}>
              <ListingPhoto src={o.listing.photo} alt="" width={120} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.listing.title}
              </div>
              <div className="t-caption" style={{ marginTop: 2 }}>
                {money(o.amount)} · {o.role === 'buyer' ? o.seller.name : o.buyer.name} · {timeAgo(asDate(o.createdAt))}
              </div>
              <Pill tone={orderStatusTone(o.status)} label={orderStatusLabel(o)} dense style={{ marginTop: 6 }} />
            </div>
            <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
          </div>
        </Card>
      ))}
    </div>
  )
}
