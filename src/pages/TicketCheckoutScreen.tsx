/* ═══════════════════════════════════════════════════════════════════════
   Buying tickets — a port of
   lib/features/events/ticket_checkout_screen.dart.

   A free tier is a real case rather than a discount: claiming one skips the
   payment step entirely.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus, Ticket, Wallet } from 'lucide-react'
import { apiErrorMessage, warmUp } from '../lib/api'
import { money } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import { getEvent, newIdempotencyKey, purchaseTickets } from '../data/events'
import { balance } from '../data/wallet'
import {
  orderCeiling,
  ticketIsFree,
  type BlorbEvent,
  type TicketType,
} from '../models/events'
import { fullName, sessionPhone, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, Skeleton, SummaryRow } from '../ui/kit'
import { AppBar, ScreenBody, StickyFooter } from '../ui/Screen'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'
import { Field } from '../components/AddressSheet'

export default function TicketCheckoutScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSessionStore()

  const requestedTierId = (location.state as { ticketTypeId?: string } | null)?.ticketTypeId

  const [event, setEvent] = useState<BlorbEvent | null | undefined>(undefined)
  const [tier, setTier] = useState<TicketType | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [holderName, setHolderName] = useState(fullName(session))
  const [holderPhone, setHolderPhone] = useState(sessionPhone(session))
  const [method, setMethod] = useState<PayMethod>('wallet')
  const [walletBalance, setWalletBalance] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBackFromPaystack(() => setBusy(false))

  const idempotencyKey = useRef(newIdempotencyKey())

  useEffect(() => {
    warmUp()
    void balance().then(setWalletBalance)
  }, [])

  useEffect(() => {
    let cancelled = false
    getEvent(id)
      .then((e) => {
        if (cancelled) return
        setEvent(e)
        const found =
          e.ticketTypes.find((t) => t.id === requestedTierId) ??
          e.ticketTypes.find((t) => !t.soldOut) ??
          null
        setTier(found)
      })
      .catch(() => {
        if (!cancelled) setEvent(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, requestedTierId])

  const free = tier ? ticketIsFree(tier) : false
  const max = tier ? orderCeiling(tier) : 1
  const total = useMemo(() => (tier ? tier.price * quantity : 0), [tier, quantity])

  const submit = async () => {
    if (!tier || busy) return
    setBusy(true)
    setError(null)

    try {
      const order = await purchaseTickets({
        eventId: id,
        ticketTypeId: tier.id,
        quantity,
        paymentMethod: free ? 'free' : method,
        holderName: holderName.trim() || undefined,
        holderPhone: holderPhone.trim() || undefined,
        idempotencyKey: idempotencyKey.current,
      })

      if (order.authorizationUrl) {
        goToPaystack(order.authorizationUrl, {
          kind: 'ticket',
          reference: order.reference,
          id: order.id,
          returnTo: '/tickets',
        })
        return
      }

      navigate('/tickets', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(apiErrorMessage(e, 'We could not issue those tickets. Nothing was charged.'))
    }
  }

  if (event === undefined) {
    return (
      <>
        <AppBar title="Tickets" />
        <ScreenBody padded>
          <Skeleton height={120} radius="var(--radius-lg)" />
        </ScreenBody>
      </>
    )
  }

  if (event === null || !tier) {
    return (
      <>
        <AppBar title="Tickets" />
        <EmptyState
          title="Those tickets are gone"
          message="This tier is no longer available. Check what else the organizer has listed."
          icon={<Ticket size={30} aria-hidden />}
          actionLabel="Back to the event"
          onAction={() => navigate(`/events/${id}`)}
        />
      </>
    )
  }

  const short = !free && method === 'wallet' && walletBalance < total

  return (
    <>
      <AppBar title={event.title} subtitle={tier.name} />

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        {/* ── Quantity ───────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-md) 0 var(--gap-sm)' }}>
          How many
        </div>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h4 clamp-1">{tier.name}</div>
              <div className="t-caption">
                {free ? 'Free entry' : money(tier.price)} each · up to {max} per order
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--gap-sm)',
                padding: 4,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-events-soft)',
              }}
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="One fewer ticket"
                className="press"
                style={stepStyle(quantity <= 1)}
              >
                <Minus size={16} aria-hidden />
              </button>
              <span className="t-h4" style={{ minWidth: 22, textAlign: 'center' }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(max, q + 1))}
                disabled={quantity >= max}
                aria-label="One more ticket"
                className="press"
                style={stepStyle(quantity >= max)}
              >
                <Plus size={16} aria-hidden />
              </button>
            </div>
          </div>
        </Card>

        {/* ── Holder ─────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          Ticket holder
        </div>
        <Field label="Name on the ticket" value={holderName} onChange={setHolderName} />
        <Field
          label="Phone"
          value={holderPhone}
          onChange={setHolderPhone}
          inputMode="tel"
          placeholder="08012345678"
        />

        {/* ── Payment ────────────────────────────────────────────────── */}
        {!free && (
          <>
            <div className="t-overline" style={{ margin: 'var(--gap-lg) 0 var(--gap-sm)' }}>
              Pay with
            </div>
            <PaymentMethodTile
              method="wallet"
              selected={method === 'wallet'}
              onSelect={() => setMethod('wallet')}
              title="Blorbmart wallet"
              subtitle={`Balance ${money(walletBalance)}`}
              disabled={walletBalance < total}
              disabledReason={
                walletBalance < total ? `Short by ${money(total - walletBalance)}` : undefined
              }
              icon={<Wallet size={20} aria-hidden />}
            />
            <div style={{ height: 'var(--gap-sm)' }} />
            <PaymentMethodTile
              method="paystack"
              selected={method === 'paystack'}
              onSelect={() => setMethod('paystack')}
              title="Card or transfer"
              subtitle="Secured by Paystack"
            />
          </>
        )}

        <Card style={{ marginTop: 'var(--gap-xl)' }}>
          <SummaryRow
            label={`${quantity} × ${tier.name}`}
            value={free ? 'Free' : money(total)}
          />
          <div style={{ margin: 'var(--gap-sm) 0' }}>
            <DashedDivider />
          </div>
          <SummaryRow label="Total" value={free ? 'Free' : money(total)} emphasise />
        </Card>

        {error && (
          <p
            role="alert"
            className="t-body-sm"
            style={{
              margin: 'var(--gap-lg) 0 0',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}
      </ScreenBody>

      <StickyFooter>
        <Button
          label={free ? `Claim ${quantity} ticket${quantity === 1 ? '' : 's'}` : `Pay ${money(total)}`}
          busy={busy}
          disabled={short}
          glow
          onClick={() => void submit()}
        />
      </StickyFooter>
    </>
  )
}

function stepStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--color-surface)',
    color: disabled ? 'var(--color-ink-disabled)' : 'var(--color-events)',
    opacity: disabled ? 0.6 : 1,
  }
}
