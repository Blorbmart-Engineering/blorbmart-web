/* Pieces shared by the marketplace screens. */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ImageOff, ShieldCheck, ShoppingBag } from 'lucide-react'
import { FadeSlideIn, PressScale } from '../../ui/motion'
import { money } from '../../lib/format'
import { listingStatusLabel, listingStatusTone, type Listing } from '../../data/marketplace'
import { SmartImage } from '../../ui/SmartImage'
import { Pill } from '../../ui/kit'
import './marketplace.css'

export function ListingPhoto({ src, alt, width = 400 }: { src?: string | null; alt: string; width?: number }) {
  return src ? (
    <SmartImage src={src} alt={alt} renderWidth={width} />
  ) : (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--color-ink-faint)' }}>
      <ImageOff size={26} aria-hidden />
    </div>
  )
}

/** A listing in a grid: photo first, because a used item sells on its photo. */
export function ListingCard({ listing, onOpen, showStatus = false }: { listing: Listing; onOpen: () => void; showStatus?: boolean }) {
  return (
    <button type="button" className="mkt-card press" onClick={onOpen}>
      <div className="mkt-card__photo">
        <ListingPhoto src={listing.photos[0]} alt={listing.title} />
        {(showStatus || listing.status !== 'active') && (
          <Pill
            tone={listingStatusTone(listing.status)}
            label={listingStatusLabel(listing.status)}
            dense
            solid={listing.status !== 'active'}
            style={{ position: 'absolute', left: 8, top: 8 }}
          />
        )}
      </div>
      <div className="mkt-card__body">
        <div className="t-price">{money(listing.price)}</div>
        <p className="t-body-sm mkt-card__title" style={{ color: 'var(--color-ink)' }}>
          {listing.title}
        </p>
        <div className="t-caption-sm" style={{ marginTop: 4 }}>
          {listing.conditionLabel}
        </div>
      </div>
    </button>
  )
}

/** How the held money protects both sides — shown wherever money is about to move. */
export function SafetyNote({ children }: { children?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--gap-sm)',
        alignItems: 'flex-start',
        padding: 'var(--gap-md)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface-sunken)',
      }}
    >
      <ShieldCheck size={18} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
      <p className="t-caption" style={{ margin: 0 }}>
        {children ?? (
          <>
            Your money is held by Blorbmart, not sent to the seller. Meet somewhere public on campus, check the item, and
            only then give them your handover PIN — that is what pays them.
          </>
        )}
      </p>
    </div>
  )
}

/** Big, spaced digits: read aloud at a handover, so it must be easy to read. */
export function PinDigits({ pin }: { pin: string }) {
  return (
    <div className="mkt-pin" aria-label={`Handover PIN ${pin.split('').join(' ')}`}>
      {pin.split('').map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </div>
  )
}

/** The way in from home, under the campus market card. */
export function MarketplaceHomeCard() {
  const navigate = useNavigate()
  return (
    <FadeSlideIn>
      <PressScale scale={0.985} onClick={() => navigate('/marketplace')} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-lg)',
            padding: 'var(--gap-lg)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-brand-soft)',
            border: '1px solid color-mix(in srgb, var(--color-brand) 18%, transparent)',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-brand)',
              color: '#fff',
            }}
          >
            <ShoppingBag size={25} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h4 clamp-1">Student marketplace</div>
            <div className="t-body-sm clamp-2" style={{ marginTop: 2 }}>
              Buy and sell with students on your campus. Your money is held until you have the item.
            </div>
          </div>
          <ChevronRight size={20} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
        </div>
      </PressScale>
    </FadeSlideIn>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="t-label mkt-label">{label}</span>
      {children}
      {hint && (
        <span className="t-caption" style={{ display: 'block', marginTop: 6 }}>
          {hint}
        </span>
      )}
    </label>
  )
}
