/* ═══════════════════════════════════════════════════════════════════════
   Payment confirmed — a port of lib/features/orders/order_placed_screen.dart.

   The moment somebody has just paid is the best moment in the whole app, and
   it used to look like a form that had been submitted. Now it celebrates:

     * a sunburst of the brand blue with the success mark drawing itself in
       the middle, rings rippling out of it and a burst of confetti;
     * the amount paid counting up, and the customer's name on the headline;
     * the order's journey right there — paid, the store accepting, on the
       way, delivered — so "what happens now" is answered without a tap. It
       is live: when the store accepts while the screen is open, the step
       lights up and the order-accepted sound plays, the same one the push
       carries.

   Full screen, outside the tab bar, the way the phone app pushes it.
   Everything but the confetti and the ripples still happens for somebody
   who has asked their device for less motion.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bike, Check, ChefHat, ChevronRight, Copy, Gift, House, MessageCircle, ReceiptText, ShieldCheck } from 'lucide-react'
import { watchOrder } from '../data/orders'
import { treatForOrder, treatShareText, type Treat } from '../data/treats'
import { money } from '../lib/format'
import { copyText, openWhatsApp } from '../lib/share'
import { playAlert, primeAlertSound } from '../lib/alertSound'
import { estimatedArrival, shortOrderId, stageSpec, type BlorbOrder } from '../models/order'
import { firstName, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { FadeSlideIn, PressScale, useAnimatedNumber } from '../ui/motion'
import { Confetti } from '../components/gifts/Confetti'
import { showToast } from '../ui/Screen'

export default function OrderPlaced() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const name = useSessionStore(firstName)
  const [order, setOrder] = useState<BlorbOrder | null>(null)
  const [burst, setBurst] = useState(0)
  const lastStep = useRef<number | null>(null)

  // Live, so the journey below moves on its own.
  useEffect(() => watchOrder(orderId, setOrder), [orderId])

  // An order sent to a friend: their link is worth nothing until it reaches
  // them, and this is the moment the sender is looking at the screen.
  const [treat, setTreat] = useState<Treat | null>(null)
  useEffect(() => {
    let cancelled = false
    void treatForOrder(orderId).then((found) => {
      if (!cancelled && found?.link) setTreat(found)
    })
    return () => {
      cancelled = true
    }
  }, [orderId])
  useEffect(() => primeAlertSound(), [])

  // The celebration: confetti once the mark has drawn, and a tap of haptics.
  useEffect(() => {
    const id = window.setTimeout(() => setBurst(Date.now()), 520)
    try {
      navigator.vibrate?.([24, 70, 36])
    } catch {
      /* no vibration motor */
    }
    return () => window.clearTimeout(id)
  }, [])

  // The store accepting while the customer watches: its sound, its step.
  const step = order ? stageSpec(order).step : null
  useEffect(() => {
    if (step === null || !order) return
    const before = lastStep.current
    lastStep.current = step
    if (before === 0 && step >= 1 && order.stage !== 'cancelled') {
      playAlert({ sound: 'orderAccepted' })
      showToast(`${order.storeName || 'The store'} accepted your order.`, 'success')
    }
  }, [step, order])

  const paid = useAnimatedNumber(order?.total ?? 0, 900)
  const eta = order ? estimatedArrival(order) : null
  const store = order?.storeName || 'The store'
  const cancelled = order?.stage === 'cancelled'

  return (
    <div className="placed">
      <Confetti burst={burst} origin={{ x: 0.5, y: 0.26 }} />

      {/* ── The hero ───────────────────────────────────────────────── */}
      <header className="placed-hero">
        <span className="placed-rays" aria-hidden />
        <span className="placed-glow" aria-hidden />

        <div className="placed-badge" aria-hidden>
          <span className="placed-ring" style={{ animationDelay: '380ms' }} />
          <span className="placed-ring" style={{ animationDelay: '620ms' }} />
          <span className="placed-ring" style={{ animationDelay: '860ms' }} />
          <svg viewBox="0 0 96 96" width={96} height={96}>
            <circle className="placed-badge-circle" cx="48" cy="48" r="44" pathLength={1} />
            <path className="placed-badge-check" d="M29 49.5 L42 62 L68 35" pathLength={1} />
          </svg>
        </div>

        <FadeSlideIn delay={260}>
          <div className="placed-paid">
            <ShieldCheck size={14} aria-hidden />
            Payment successful
          </div>
        </FadeSlideIn>

        <FadeSlideIn delay={340}>
          <h1 className="placed-title">
            {name && name !== 'there' ? `You’re all set, ${name}!` : 'You’re all set!'}
          </h1>
        </FadeSlideIn>

        <FadeSlideIn delay={420}>
          <div className="placed-amount" aria-label={order ? `${money(order.total)} paid` : undefined}>
            {order ? money(Math.round(paid)) : ' '}
          </div>
          <p className="placed-sub">
            {cancelled
              ? `${store} could not take this order. Your money is back in your wallet.`
              : order?.waitingForSlot && order.scheduledLabel
                ? `Booked for ${order.scheduledLabel}. ${store} gets it shortly before, and we’ll tell you when they accept.`
                : `${store} has your order. We’ll tell you the moment they accept it.`}
          </p>
        </FadeSlideIn>
      </header>

      {/* ── What happens now ───────────────────────────────────────── */}
      <main className="placed-body">
        <FadeSlideIn delay={520}>
          <section className="placed-card" aria-label="Your order">
            <div className="placed-meta">
              <Meta label="Order" value={order ? `#${shortOrderId(order)}` : '…'} />
              <Meta
                label="Items"
                value={order ? `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}` : '…'}
              />
              <Meta
                label={order?.scheduledLabel ? 'Booked for' : 'Arriving'}
                value={
                  order?.scheduledLabel
                    ? order.scheduledLabel
                    : eta
                      ? eta.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
                      : '…'
                }
              />
            </div>

            {!cancelled && <Journey step={step ?? 0} store={store} />}

            <PressScale
              scale={0.985}
              onClick={() => navigate(`/receipt/order/${orderId}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-md)',
                width: '100%',
                marginTop: 'var(--gap-lg)',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-sunken)',
                textAlign: 'left',
              }}
            >
              <ReceiptText size={19} aria-hidden style={{ color: 'var(--color-brand)' }} />
              <span className="t-label" style={{ flex: 1 }}>
                View your receipt
              </span>
              <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
            </PressScale>
          </section>
        </FadeSlideIn>

        {treat && !cancelled && (
          <FadeSlideIn delay={580}>
            <section
              className="placed-card"
              aria-label="Send the treat link"
              style={{ marginTop: 'var(--gap-md)', background: 'var(--color-appetite-soft)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                <Gift size={22} aria-hidden style={{ flexShrink: 0, color: 'var(--color-appetite-deep)' }} />
                <span style={{ minWidth: 0 }}>
                  <span className="t-h4" style={{ display: 'block' }}>
                    Tell {treat.recipientName.split(' ')[0]} it’s coming
                  </span>
                  <span className="t-caption" style={{ display: 'block' }}>
                    Their link tracks the order and shows the PIN the rider will ask them for.
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
                <Button
                  label="Send on WhatsApp"
                  kind="appetite"
                  size="md"
                  icon={<MessageCircle size={17} aria-hidden />}
                  onClick={() => openWhatsApp(treatShareText(treat, name), treat.recipientPhone)}
                />
                <Button
                  label="Copy"
                  kind="outline"
                  size="md"
                  expand={false}
                  icon={<Copy size={16} aria-hidden />}
                  onClick={() =>
                    void copyText(treatShareText(treat, name)).then((ok) =>
                      showToast(ok ? 'Message copied.' : 'Could not copy the link.', ok ? 'success' : 'danger'),
                    )
                  }
                />
              </div>
            </section>
          </FadeSlideIn>
        )}

        <FadeSlideIn delay={620}>
          <p className="t-caption" style={{ textAlign: 'center', margin: 'var(--gap-lg) var(--gap-lg) 0' }}>
            {treat
              ? `The 4-digit delivery PIN is on ${treat.recipientName.split(' ')[0]}’s link, and on your tracking screen too.`
              : 'Your 4-digit delivery PIN is on the tracking screen. Give it to the rider only when the order is in your hands.'}
          </p>
        </FadeSlideIn>
      </main>

      <footer className="placed-actions">
        <Button
          label="Track my order"
          glow
          icon={<Bike size={19} aria-hidden />}
          onClick={() => navigate(`/track/${orderId}`, { replace: true })}
        />
        <Button
          label="Back to home"
          kind="ghost"
          icon={<House size={18} aria-hidden />}
          onClick={() => navigate('/home', { replace: true })}
        />
      </footer>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="t-caption-sm">{label}</div>
      <div className="t-h4 clamp-1">{value}</div>
    </div>
  )
}

/**
 * The order's road from here, with what is happening now pulsing. `step` is
 * the ORDER_STAGES step: 0 placed, 1 accepted or cooking, 2 ready or on the
 * way, 3 rider at the door, 4 delivered.
 */
function Journey({ step, store }: { step: number; store: string }) {
  const stops = [
    { label: 'Paid', detail: 'Your money is safe with us', icon: Check },
    { label: step >= 1 ? `${store} accepted` : `${store} is accepting`, detail: step >= 1 ? 'They are making it now' : 'Usually within a few minutes', icon: ChefHat },
    { label: 'On the way', detail: 'A rider brings it to you', icon: Bike },
    { label: 'Delivered', detail: step === 3 ? 'Your rider is at the door' : 'Enjoy!', icon: House },
  ]
  // Paid is always done; everything else follows the order. Cooking has
  // nothing pulsing: the next stop is the rider's, and it has not started.
  const s = Math.min(4, Math.max(0, step))
  const reached = [1, 2, 2, 3, 4][s]
  const current = [1, -1, 2, 3, -1][s]
  return (
    <ol className="journey">
      {stops.map((stop, i) => {
        const done = i < reached
        const now = i === current
        const Icon = stop.icon
        return (
          <li key={i} className={`journey-stop${done ? ' is-done' : ''}${now ? ' is-now' : ''}`}>
            <span className="journey-dot" aria-hidden>
              {done ? <Check size={13} strokeWidth={3.2} /> : <Icon size={13} strokeWidth={2.4} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="t-label" style={{ display: 'block' }}>
                {stop.label}
              </span>
              <span className="t-caption" style={{ display: 'block' }}>
                {stop.detail}
              </span>
            </span>
            {done && <span className="sr-only">(done)</span>}
            {now && <span className="sr-only">(happening now)</span>}
          </li>
        )
      })}
    </ol>
  )
}
