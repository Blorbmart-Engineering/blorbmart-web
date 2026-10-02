/* ═══════════════════════════════════════════════════════════════════════
   The student marketplace — what students on this campus are selling.

   Only this campus: a fan in UNILAG is no use to somebody in OAU, and a
   handover needs both people to be able to walk to it. Search runs on the
   server against the listing's words, so it finds "textbook" in a
   description as well as a title.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackageOpen, Plus, Search, ShoppingBag, Store } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { CATEGORIES, marketFeed, type Listing } from '../data/marketplace'
import { hasRealCampus, isSignedIn, universityName, useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { ChipRail, EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { ListingCard } from '../components/marketplace/MarketParts'

const ALL = 'All'

export default function MarketplaceScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const signedIn = isSignedIn(session)
  const onCampus = hasRealCampus(session)

  const [category, setCategory] = useState(ALL)
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  // Search as they type, once they pause.
  useEffect(() => {
    const t = setTimeout(() => setQ(typed), 350)
    return () => clearTimeout(t)
  }, [typed])

  useEffect(() => {
    if (!signedIn || !onCampus) return
    let cancelled = false
    const id = CATEGORIES.find((c) => c.label === category)?.id
    marketFeed({ category: id, q })
      .then((l) => {
        if (cancelled) return
        setListings(l)
        setError('')
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, 'Could not load the marketplace.')))
    return () => {
      cancelled = true
    }
  }, [signedIn, onCampus, category, q, attempt])

  const sell = () => navigate(signedIn ? '/marketplace/sell' : '/login', { state: { from: '/marketplace/sell' } })

  if (!signedIn || !onCampus) {
    return (
      <>
        <AppBar title="Marketplace" />
        <EmptyState
          icon={<ShoppingBag size={34} aria-hidden />}
          title={signedIn ? 'Choose your campus first' : 'Buy and sell on campus'}
          message={
            signedIn
              ? 'The marketplace shows what students on your campus are selling. Pick your campus in your account.'
              : 'Textbooks, phones, hostel things — from students on your campus, with your money held until you have the item.'
          }
          actionLabel={signedIn ? 'Go to account' : 'Sign in'}
          onAction={() => navigate(signedIn ? '/account' : '/login', { state: { from: '/marketplace' } })}
        />
      </>
    )
  }

  return (
    <>
      <AppBar
        title="Marketplace"
        subtitle={universityName(session) || undefined}
        trailing={
          <IconButton label="My marketplace" onClick={() => navigate('/marketplace/mine')}>
            <Store size={20} aria-hidden />
          </IconButton>
        }
      />

      <ScreenBody bottomGap="150px">
        <div style={{ padding: 'var(--gap-lg) var(--gap-page) 0' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              aria-hidden
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-faint)' }}
            />
            <input
              className="mkt-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Search textbooks, phones, fans…"
              aria-label="Search the marketplace"
              enterKeyHint="search"
              style={{ paddingLeft: 42 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
            <Button label="Sell something" icon={<Plus size={18} aria-hidden />} size="md" onClick={sell} />
            <Button label="My orders" kind="outline" size="md" onClick={() => navigate('/marketplace/mine')} />
          </div>
        </div>

        <div style={{ padding: 'var(--gap-lg) var(--gap-page) 0' }}>
          <ChipRail options={[ALL, ...CATEGORIES.map((c) => c.label)]} selected={category} onSelect={setCategory} />
        </div>

        <div style={{ padding: 'var(--gap-lg) var(--gap-page) 0' }}>
          {error && !listings ? (
            <EmptyState compact title="Could not load the marketplace" message={error} actionLabel="Try again" onAction={() => setAttempt((n) => n + 1)} />
          ) : listings === null ? (
            <div className="mkt-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height={230} radius="var(--radius-lg)" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              compact
              icon={<PackageOpen size={28} aria-hidden />}
              title={q || category !== ALL ? 'Nothing matches yet' : 'Nothing for sale yet'}
              message={
                q || category !== ALL
                  ? 'Try another word or category — or be the first to sell one.'
                  : 'Be the first on your campus. Old textbooks, a fan, a phone you upgraded from — list it in a minute.'
              }
              actionLabel="Sell something"
              onAction={sell}
            />
          ) : (
            <div className="mkt-grid">
              {listings.map((l, i) => (
                <FadeSlideIn key={l.id} delay={staggerFor(i)}>
                  <ListingCard listing={l} onOpen={() => navigate(`/marketplace/item/${l.id}`)} />
                </FadeSlideIn>
              ))}
            </div>
          )}
        </div>
      </ScreenBody>
    </>
  )
}
