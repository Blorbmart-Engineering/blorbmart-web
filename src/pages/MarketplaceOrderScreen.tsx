/* ═══════════════════════════════════════════════════════════════════════
   One marketplace sale, from whichever side you are on.

   Buyer: the money is held. Once the seller accepts, you can call them and
   meet; check the item; then read them your handover PIN (or tap "I have
   it"). That is what pays them.

   Seller: accept and say where to meet, then type the buyer's PIN at the
   handover. The money lands in your marketplace earnings, which you can
   send to your bank.

   Either side can report a problem once the sale is accepted; the money then
   stays held until the campus team decides.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CircleAlert, MessageCircle, PackageCheck, Phone, Wallet } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { asDate, dayAndTime, money } from '../lib/format'
import { whatsAppUrl } from '../lib/share'
import {
  acceptMarketOrder,
  cancelMarketOrder,
  confirmReceived,
  disputeMarketOrder,
  getMarketOrder,
  handOver,
  orderStatusLabel,
  orderStatusTone,
  type MarketOrder,
} from '../data/marketplace'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { ConfirmDialog, Sheet } from '../ui/Sheet'
import { Card, EmptyState, Pill, Skeleton, SummaryRow } from '../ui/kit'
import { ListingPhoto, PinDigits, SafetyNote } from '../components/marketplace/MarketParts'
import { Confetti } from '../components/gifts/Confetti'
import { PushPrompt } from '../components/PushPrompt'

type Busy = 'accept' | 'cancel' | 'handover' | 'received' | 'dispute' | null

export default function MarketplaceOrderScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const justBought = Boolean((location.state as { justBought?: boolean } | null)?.justBought)

  const [order, setOrder] = useState<MarketOrder | null | undefined>(undefined)
  const [busy, setBusy] = useState<Busy>(null)
  const [sheet, setSheet] = useState<'accept' | 'cancel' | 'dispute' | null>(null)
  const [confirmGot, setConfirmGot] = useState(false)
  const [text, setText] = useState('')
  const [pin, setPin] = useState('')
  // Straight after buying, the screen opens with a little celebration.
  const [burst, setBurst] = useState(() => (justBought ? Date.now() : 0))

  const load = useCallback(async () => {
    try {
      setOrder(await getMarketOrder(id))
    } catch {
      setOrder(null)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (kind: Exclude<Busy, null>, run: () => Promise<MarketOrder>, done?: string) => {
    setBusy(kind)
    try {
      const next = await run()
      setOrder(next)
      setSheet(null)
      setText('')
      if (done) showToast(done, 'success')
      if (next.status === 'completed') setBurst(Date.now())
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  if (order === undefined) {
    return (
      <>
        <AppBar title="Order" />
        <ScreenBody padded>
          <Skeleton height={96} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-xl)' }} />
          <Skeleton height={180} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
        </ScreenBody>
      </>
    )
  }

  if (order === null) {
    return (
      <>
        <AppBar title="Order" />
        <EmptyState title="We could not find that order" message="It may belong to another account." actionLabel="My marketplace" onAction={() => navigate('/marketplace/mine')} />
      </>
    )
  }

  const buyer = order.role === 'buyer'
  const other = buyer ? order.seller : order.buyer
  const live = order.status === 'accepted' || order.status === 'disputed'

  return (
    <>
      <Confetti burst={burst} />
      {/* Both sides wait on the other here, so this is when alerts matter. */}
      <PushPrompt moment="marketplace" />
      <AppBar title={order.listing.title} subtitle={buyer ? `From ${order.seller.name}` : `To ${order.buyer.name}`} />

      <ScreenBody padded bottomGap="var(--gap-giant)">
        {/* ── The item ──────────────────────────────────────────────────── */}
        <Card style={{ marginTop: 'var(--gap-xl)' }} onClick={() => navigate(`/marketplace/item/${order.listing.id}`)}>
          <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-sunken)' }}>
              <ListingPhoto src={order.listing.photo} alt="" width={140} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="t-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {order.listing.title}
              </div>
              <div className="t-price" style={{ marginTop: 4 }}>
                {money(order.amount)}
              </div>
            </div>
            <Pill tone={orderStatusTone(order.status)} label={orderStatusLabel(order)} dense />
          </div>
        </Card>

        {/* ── What happens now ──────────────────────────────────────────── */}
        <Card style={{ marginTop: 'var(--gap-lg)' }} padding="var(--gap-xl)">
          <NextStep order={order} />

          {buyer && order.handoverPin && (
            <div style={{ marginTop: 'var(--gap-xl)' }}>
              <div className="t-overline" style={{ textAlign: 'center', marginBottom: 'var(--gap-sm)' }}>
                Your handover PIN
              </div>
              <PinDigits pin={order.handoverPin} />
              <p className="t-caption" style={{ textAlign: 'center', margin: 'var(--gap-md) 0 0' }}>
                Only give it to the seller once the item is in your hands and works.
              </p>
            </div>
          )}

          {!buyer && order.status === 'accepted' && (
            <div style={{ marginTop: 'var(--gap-xl)' }}>
              <label className="t-label" htmlFor="handover-pin" style={{ display: 'block', marginBottom: 'var(--gap-sm)' }}>
                Buyer’s handover PIN
              </label>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
                <input
                  id="handover-pin"
                  className="mkt-input"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="4 digits"
                  disabled={order.pinLocked}
                  style={{ letterSpacing: '0.4em', font: '800 22px/1 var(--font-mono, monospace)', textAlign: 'center' }}
                />
                <Button
                  label="Confirm"
                  expand={false}
                  disabled={pin.length !== 4 || order.pinLocked}
                  busy={busy === 'handover'}
                  onClick={() => void act('handover', () => handOver(order.id, pin), 'Sold! The money is in your earnings.').then(() => setPin(''))}
                />
              </div>
              {order.pinLocked && (
                <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0', color: 'var(--color-danger)' }}>
                  Too many wrong PINs. Ask the buyer to tap “I have it” in their app.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── The other person ──────────────────────────────────────────── */}
        {live && other.phone && (
          <Card style={{ marginTop: 'var(--gap-lg)' }}>
            <div className="t-overline">{buyer ? 'Seller' : 'Buyer'}</div>
            <div className="t-label-lg" style={{ marginTop: 4 }}>
              {other.name}
            </div>
            {order.meetupNote && (
              <p className="t-body-sm" style={{ margin: 'var(--gap-sm) 0 0' }}>
                <strong>Meet-up:</strong> {order.meetupNote}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
              <Button label="Call" kind="soft" size="md" icon={<Phone size={16} aria-hidden />} onClick={() => (window.location.href = `tel:${other.phone}`)} />
              <Button
                label="WhatsApp"
                kind="soft"
                size="md"
                icon={<MessageCircle size={16} aria-hidden />}
                onClick={() => window.open(whatsAppUrl(`Hi, it's about "${order.listing.title}" on Blorbmart.`, other.phone ?? ''), '_blank', 'noopener')}
              />
            </div>
          </Card>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xl)' }}>
          {!buyer && order.status === 'awaiting_seller' && (
            <>
              <Button label="Accept" glow onClick={() => setSheet('accept')} />
              <Button label="Decline" kind="outline" onClick={() => setSheet('cancel')} />
            </>
          )}
          {buyer && order.status === 'awaiting_seller' && <Button label="Cancel and get my money back" kind="outline" onClick={() => setSheet('cancel')} />}
          {buyer && live && <Button label="I have it — pay the seller" glow icon={<PackageCheck size={18} aria-hidden />} onClick={() => setConfirmGot(true)} />}
          {!buyer && order.status === 'accepted' && <Button label="Cancel this sale" kind="ghost" onClick={() => setSheet('cancel')} />}
          {order.status === 'accepted' && (
            <Button label="Report a problem" kind="ghost" icon={<CircleAlert size={17} aria-hidden />} onClick={() => setSheet('dispute')} />
          )}
          {!buyer && order.status === 'completed' && (
            <Button label="See my earnings" kind="soft" icon={<Wallet size={17} aria-hidden />} onClick={() => navigate('/marketplace/earnings')} />
          )}
        </div>

        {(order.status === 'awaiting_seller' || order.status === 'accepted') && buyer && (
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <SafetyNote />
          </div>
        )}

        {/* ── Details ───────────────────────────────────────────────────── */}
        <Card style={{ marginTop: 'var(--gap-xl)' }}>
          <SummaryRow label="Price" value={money(order.amount)} emphasise />
          {!buyer && order.fee > 0 && <SummaryRow label="Blorbmart fee" value={`− ${money(order.fee)}`} />}
          {!buyer && <SummaryRow label="You receive" value={money(order.sellerAmount)} />}
          {order.createdAt && <SummaryRow label="Bought" value={dayAndTime(asDate(order.createdAt))} />}
          {order.completedAt && <SummaryRow label="Completed" value={dayAndTime(asDate(order.completedAt))} />}
          {order.cancelledAt && <SummaryRow label="Cancelled" value={dayAndTime(asDate(order.cancelledAt))} />}
          <SummaryRow label="Order" value={order.id} />
        </Card>
      </ScreenBody>

      {/* ── Sheets ──────────────────────────────────────────────────────── */}
      <Sheet open={sheet === 'accept'} onClose={() => setSheet(null)} title="Accept and arrange the handover">
        <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
          Say where and when you can meet. The buyer sees it with your phone number.
        </p>
        <textarea
          className="mkt-input"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Faculty of Science gate, today 4–6pm"
          style={{ minHeight: 90 }}
        />
        <Button
          label="Accept"
          style={{ marginTop: 'var(--gap-md)' }}
          busy={busy === 'accept'}
          onClick={() => void act('accept', () => acceptMarketOrder(order.id, text), 'Accepted — the buyer can reach you now.')}
        />
      </Sheet>

      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={buyer ? 'Cancel your order?' : order.status === 'awaiting_seller' ? 'Decline this order?' : 'Cancel this sale?'}>
        <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
          {buyer
            ? `${money(order.amount)} goes straight back to your wallet.`
            : `The buyer gets ${money(order.amount)} back and your item goes back up for sale.`}
        </p>
        <textarea
          className="mkt-input"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reason (optional)"
          style={{ minHeight: 70 }}
        />
        <Button
          label={buyer ? 'Cancel order' : order.status === 'awaiting_seller' ? 'Decline' : 'Cancel sale'}
          kind="danger"
          style={{ marginTop: 'var(--gap-md)' }}
          busy={busy === 'cancel'}
          onClick={() => void act('cancel', () => cancelMarketOrder(order.id, text), buyer ? 'Cancelled — your money is back.' : 'Done — the buyer was refunded.')}
        />
      </Sheet>

      <Sheet open={sheet === 'dispute'} onClose={() => setSheet(null)} title="Report a problem">
        <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
          The money stays held while the campus team looks into it. They may call you both.
        </p>
        <textarea
          className="mkt-input"
          value={text}
          maxLength={600}
          onChange={(e) => setText(e.target.value)}
          placeholder={buyer ? 'e.g. The phone does not charge, and the seller will not take it back' : 'e.g. The buyer took the item but will not give the PIN'}
          style={{ minHeight: 100 }}
        />
        <Button
          label="Send to the campus team"
          kind="danger"
          style={{ marginTop: 'var(--gap-md)' }}
          disabled={text.trim().length < 5}
          busy={busy === 'dispute'}
          onClick={() => void act('dispute', () => disputeMarketOrder(order.id, text), 'Sent — the campus team has it.')}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmGot}
        title="You have the item?"
        message={`This pays ${order.seller.name} ${money(order.amount)}. Only confirm once it is in your hands and works — it cannot be undone.`}
        confirmLabel="Yes, pay them"
        busy={busy === 'received'}
        onConfirm={() => void act('received', () => confirmReceived(order.id), 'Done — enjoy it!').then(() => setConfirmGot(false))}
        onCancel={() => setConfirmGot(false)}
      />
    </>
  )
}

/** One sentence on where the sale is and what the person looking should do. */
function NextStep({ order }: { order: MarketOrder }) {
  const buyer = order.role === 'buyer'
  const answerBy = order.answerBy ? dayAndTime(asDate(order.answerBy)) : null
  const lines: Record<MarketOrder['status'], [string, string]> = {
    awaiting_seller: buyer
      ? ['Waiting for the seller', `Your ${money(order.amount)} is held. ${order.seller.name} has until ${answerBy ?? 'two days from now'} to accept, or it comes back to you.`]
      : ['Someone wants this', `${order.buyer.name} paid ${money(order.amount)}. It is held until the handover. Accept by ${answerBy ?? 'within 48 hours'}, or it goes back to them.`],
    accepted: buyer
      ? ['Meet up and check it', 'Call or message the seller to meet. When you have the item and it works, give them your PIN.']
      : ['Meet up and hand it over', 'At the handover, the buyer reads you their 4-digit PIN. Type it below and the money is yours.'],
    disputed: ['With the campus team', `Reported by the ${order.dispute?.by ?? 'buyer'}: “${order.dispute?.reason ?? ''}”. The money stays held until they decide.`],
    completed: buyer
      ? ['All done', 'The seller has been paid. Enjoy it!']
      : ['Sold', `${money(order.sellerAmount)} is in your marketplace earnings. Send it to your bank whenever you like.`],
    cancelled: [
      'Cancelled',
      order.dispute?.resolution
        ? `The campus team refunded the buyer${order.dispute.resolution.note ? `: ${order.dispute.resolution.note}` : '.'}`
        : order.cancelledBy === 'system'
          ? 'The seller did not answer in time, so the buyer was refunded.'
          : `${order.cancelledBy === 'buyer' ? 'The buyer' : 'The seller'} cancelled${order.cancelReason ? `: “${order.cancelReason}”` : '.'} The buyer was refunded.`,
    ],
  }
  const [title, body] = lines[order.status]
  return (
    <>
      <h2 className="t-h3" style={{ margin: 0 }}>
        {title}
      </h2>
      <p className="t-body-sm" style={{ margin: 'var(--gap-xs) 0 0' }}>
        {body}
      </p>
    </>
  )
}
