/* ═══════════════════════════════════════════════════════════════════════
   One item for sale.

   Photos, price, the seller's first name, and one button. Buying asks for
   the wallet PIN and holds the money — the seller is paid at the handover,
   not now — so the screen says that right above the button, where the
   decision is made.

   The seller sees their own listing here too, with Edit and Take down
   instead of Buy.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Flag, PackageOpen, PenLine, Trash2 } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../lib/api'
import { money, timeAgo, asDate } from '../lib/format'
import {
  REPORT_REASONS,
  buyListing,
  getListing,
  listingStatusLabel,
  listingStatusTone,
  removeListing,
  reportListing,
  type Listing,
} from '../data/marketplace'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { ConfirmDialog, Sheet } from '../ui/Sheet'
import { Card, EmptyState, Pill, Skeleton } from '../ui/kit'
import { useWalletPin } from '../components/WalletPinSheet'
import { ListingPhoto, SafetyNote } from '../components/marketplace/MarketParts'

export default function ListingScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const walletPin = useWalletPin()

  const [listing, setListing] = useState<Listing | null | undefined>(undefined)
  const [photo, setPhoto] = useState(0)
  const [buying, setBuying] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getListing(id)
      .then((l) => !cancelled && setListing(l))
      .catch(() => !cancelled && setListing(null))
    return () => {
      cancelled = true
    }
  }, [id])

  const buy = async () => {
    if (!listing) return
    if (!signedIn) {
      navigate('/login', { state: { from: `/marketplace/item/${id}` } })
      return
    }
    const pin = await walletPin.ask(money(listing.price))
    if (!pin) return
    setBuying(true)
    try {
      const order = await buyListing(listing.id, pin)
      navigate(`/marketplace/orders/${order.id}`, { replace: true, state: { justBought: true } })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INSUFFICIENT_FUNDS') {
        showToast(`You need ${money(listing.price)} in your wallet. Top up, then come back.`, 'danger')
        navigate('/wallet')
      } else {
        showToast(apiErrorMessage(e, 'Could not buy that item.'), 'danger')
      }
    } finally {
      setBuying(false)
    }
  }

  const takeDown = async () => {
    setRemoving(true)
    try {
      await removeListing(id)
      showToast('Taken down.', 'success')
      navigate('/marketplace/mine', { replace: true })
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not take that down.'), 'danger')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  if (listing === undefined) {
    return (
      <>
        <AppBar title="Item" />
        <Skeleton height={360} radius="0" />
        <ScreenBody padded>
          <Skeleton height={28} width="40%" style={{ marginTop: 'var(--gap-xl)' }} />
          <Skeleton height={20} style={{ marginTop: 'var(--gap-md)' }} />
        </ScreenBody>
      </>
    )
  }

  if (listing === null) {
    return (
      <>
        <AppBar title="Item" />
        <EmptyState
          icon={<PackageOpen size={30} aria-hidden />}
          title="That item is gone"
          message="It may have sold, or the seller took it down."
          actionLabel="Back to the marketplace"
          onAction={() => navigate('/marketplace')}
        />
      </>
    )
  }

  const forSale = listing.status === 'active'

  return (
    <>
      <AppBar
        title={listing.title}
        trailing={
          !listing.mine && signedIn ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              aria-label="Report this listing"
              style={{ background: 'none', border: 'none', color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 8 }}
            >
              <Flag size={19} aria-hidden />
            </button>
          ) : undefined
        }
      />

      <div
        className="mkt-gallery"
        onScroll={(e) => {
          const el = e.currentTarget
          setPhoto(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
      >
        {listing.photos.map((src, i) => (
          <div key={src}>
            <ListingPhoto src={src} alt={`${listing.title}, photo ${i + 1}`} width={900} />
          </div>
        ))}
      </div>
      {listing.photos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 'var(--gap-sm)' }}>
          {listing.photos.map((src, i) => (
            <span
              key={src}
              style={{
                width: i === photo ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === photo ? 'var(--color-ink)' : 'var(--color-line-strong)',
                transition: 'width var(--dur-fast)',
              }}
            />
          ))}
        </div>
      )}

      <ScreenBody padded bottomGap="var(--gap-xxl)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)', flexWrap: 'wrap' }}>
          <span className="t-price-lg">{money(listing.price)}</span>
          {!forSale && <Pill tone={listingStatusTone(listing.status)} label={listingStatusLabel(listing.status)} />}
        </div>
        <h1 className="t-h2" style={{ margin: 'var(--gap-xs) 0 0' }}>
          {listing.title}
        </h1>
        <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)', flexWrap: 'wrap' }}>
          <Pill label={listing.conditionLabel} tone="brand" />
          <Pill label={listing.categoryLabel} />
        </div>

        {listing.description && (
          <p className="t-body" style={{ margin: 'var(--gap-lg) 0 0', whiteSpace: 'pre-line' }}>
            {listing.description}
          </p>
        )}

        <Card style={{ marginTop: 'var(--gap-xl)' }} shadow="none" border="var(--color-line)">
          <div className="t-overline">Sold by</div>
          <div className="t-label-lg" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {listing.mine ? 'You' : listing.seller.name}
            {listing.seller.verified && (
              <span className="t-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-brand)' }}>
                <BadgeCheck size={15} aria-hidden /> Verified student
              </span>
            )}
          </div>
          <div className="t-caption" style={{ marginTop: 2 }}>
            Listed {timeAgo(asDate(listing.createdAt))} · checked by the Blorbmart team
          </div>
        </Card>

        {listing.mine && listing.status === 'hidden' && (
          <Card style={{ marginTop: 'var(--gap-md)' }} color="var(--color-danger-soft)" shadow="none">
            <p className="t-body-sm" style={{ margin: 0, color: 'var(--color-danger)' }}>
              {listing.hiddenReason || 'This listing was taken down by the campus team.'}
            </p>
          </Card>
        )}

        {!listing.mine && forSale && (
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <SafetyNote />
          </div>
        )}
      </ScreenBody>

      {listing.mine ? (
        forSale && (
          <StickyFooter>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
              <Button
                label="Edit"
                kind="outline"
                icon={<PenLine size={18} aria-hidden />}
                onClick={() => navigate(`/marketplace/sell?edit=${listing.id}`)}
              />
              <Button label="Take down" kind="danger" icon={<Trash2 size={18} aria-hidden />} onClick={() => setConfirmRemove(true)} />
            </div>
          </StickyFooter>
        )
      ) : (
        <StickyFooter>
          <Button
            label={forSale ? `Buy for ${money(listing.price)}` : listingStatusLabel(listing.status)}
            glow={forSale}
            disabled={!forSale}
            busy={buying}
            onClick={() => void buy()}
          />
        </StickyFooter>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Take this down?"
        message="It will stop showing in the marketplace. You can list it again any time."
        confirmLabel="Take down"
        destructive
        busy={removing}
        onConfirm={() => void takeDown()}
        onCancel={() => setConfirmRemove(false)}
      />

      <ReportSheet open={reportOpen} listingId={listing.id} onClose={() => setReportOpen(false)} />
      {walletPin.sheet}
    </>
  )
}

function ReportSheet({ open, listingId, onClose }: { open: boolean; listingId: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      await reportListing(listingId, reason, note)
      showToast('Thanks — the campus team will look at it.', 'success')
      onClose()
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not send your report.'), 'danger')
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Report this listing">
      <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.id}
            className="t-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-md)',
              padding: 'var(--gap-md)',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${reason === r.id ? 'var(--color-brand)' : 'var(--color-line)'}`,
              cursor: 'pointer',
            }}
          >
            <input type="radio" name="report-reason" checked={reason === r.id} onChange={() => setReason(r.id)} style={{ accentColor: 'var(--color-brand)' }} />
            {r.label}
          </label>
        ))}
        <textarea
          className="mkt-input"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything the campus team should know (optional)"
          style={{ minHeight: 80 }}
        />
        <Button label="Send report" disabled={!reason} busy={sending} onClick={() => void send()} />
      </div>
    </Sheet>
  )
}
