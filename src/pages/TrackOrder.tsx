/* ═══════════════════════════════════════════════════════════════════════
   Live tracking — a port of lib/features/orders/track_order_screen.dart
   and pin_card.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, CalendarX, Lock, MessageCircle, Package, Phone, ReceiptText, RotateCcw } from 'lucide-react'
import { SosCard } from '../components/SafetySheet'
import { supportUrl } from '../lib/support'
import { RatingCard } from '../components/Social'
import { cancelScheduledOrder, deliveryPin, watchOrder } from '../data/orders'
import { invalidateBalance } from '../data/wallet'
import { useReorder } from '../hooks/useReorder'
import { apiErrorMessage } from '../lib/api'
import { dayAndTime, money } from '../lib/format'
import { lineTotal } from '../models/cart'
import {
  estimatedArrival,
  isTerminal,
  stageSpec,
  shortOrderId,
  showsPin,
  trackingDistanceLabel,
  trackingHasEta,
  trackingHasRider,
  type BlorbOrder,
} from '../models/order'
import { Button, IconButton } from '../ui/Button'
import { Card, DashedDivider, EmptyState, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn, LivePulse, Sheen } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { ConfirmDialog } from '../ui/Sheet'
import { StageBar } from '../components/HomeWidgets'
import { StageIcon } from '../components/StageIcon'


// mapbox-gl is the heaviest thing on this screen and only matters once a
// rider is on the road, so it loads on demand rather than with the page.
const LiveRiderMap = lazy(() => import('../components/LiveRiderMap'))
const MAP_HEIGHT = 240

const VEHICLE_LABEL: Record<string, string> = {
  foot: 'On foot',
  bicycle: 'Bicycle',
  bike: 'Motorcycle',
  car: 'Car',
}

export default function TrackOrder() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<BlorbOrder | null | undefined>(undefined)

  /**
   * The clock, as state rather than a `Date.now()` read during render.
   *
   * Reading the time while rendering is impure — two renders in the same
   * commit can disagree — and it also freezes the countdown until something
   * else happens to re-render. Ticking it makes "12 min" actually count down
   * while somebody watches the screen, which is the whole point of a tracker.
   */
  const [now, setNow] = useState(() => Date.now())
  const again = useReorder()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const cancelBooking = async () => {
    setCancelling(true)
    try {
      const result = await cancelScheduledOrder(orderId)
      invalidateBalance()
      showToast(
        result.refunded && result.refundAmount > 0
          ? `Cancelled. ${money(result.refundAmount)} is back in your wallet.`
          : 'Cancelled. Your refund is on its way to your wallet.',
        'success',
      )
    } catch (e) {
      showToast(apiErrorMessage(e, 'We could not cancel this order.'), 'danger')
    } finally {
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  useEffect(() => {
    if (!orderId) return
    return watchOrder(orderId, setOrder)
  }, [orderId])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (order === undefined) {
    return (
      <>
        <AppBar title="Tracking" />
        <ScreenBody padded>
          <Skeleton height={140} radius="var(--radius-lg)" />
          <Skeleton height={110} radius="var(--radius-lg)" style={{ marginTop: 16 }} />
        </ScreenBody>
      </>
    )
  }

  if (order === null) {
    return (
      <>
        <AppBar title="Order not found" />
        <EmptyState
          title="Order not found"
          message="We could not find that order. It may have been removed."
          icon={<Package size={30} aria-hidden />}
          actionLabel="Back to orders"
          onAction={() => navigate('/orders')}
        />
      </>
    )
  }

  const stage = stageSpec(order)
  const arrival = estimatedArrival(order)
  const minutesLeft = arrival ? Math.round((arrival.getTime() - now) / 60_000) : null
  const canReorder = isTerminal(order.stage) && order.paymentState !== 'pending' && order.lines.length > 0

  return (
    <>
      <AppBar
        title={order.storeName || 'Your order'}
        subtitle={`#${shortOrderId(order)}  ·  ${dayAndTime(order.createdAt)}`}
        trailing={
          <IconButton label="Receipt" onClick={() => navigate(`/receipt/order/${order.id}`)}>
            <ReceiptText size={19} aria-hidden />
          </IconButton>
        }
      />

      <ScreenBody bottomGap="150px" padded>
        {/* ── Stage hero ─────────────────────────────────────────────── */}
        <FadeSlideIn>
          <div
            style={{
              padding: 'var(--gap-xl)',
              borderRadius: 'var(--radius-xl)',
              background:
                order.stage === 'cancelled'
                  ? 'var(--color-danger-soft)'
                  : 'var(--gradient-brand)',
              color: order.stage === 'cancelled' ? 'var(--color-danger)' : '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background:
                    order.stage === 'cancelled'
                      ? 'rgba(229,72,77,0.12)'
                      : 'rgba(255,255,255,0.2)',
                }}
              >
                <StageIcon icon={stage.icon} size={24} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!isTerminal(order.stage) && <LivePulse color="#fff" size={7} />}
                  <span className="t-h2" style={{ color: 'inherit' }}>
                    {stage.title}
                  </span>
                </div>
                <p
                  className="t-body-sm"
                  style={{ margin: '2px 0 0', color: 'inherit', opacity: 0.88 }}
                >
                  {order.stage === 'cancelled' && order.cancelReason
                    ? order.cancelReason
                    : order.vertical === 'market' && order.stage === 'placed'
                      ? 'A rider buys your items at the market, then brings them to you.'
                      : stage.blurb}
                </p>
              </div>
            </div>

            {!isTerminal(order.stage) && (
              <>
                <div style={{ marginTop: 'var(--gap-lg)' }}>
                  <StageBar step={stage.step} color="#fff" />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--gap-sm)',
                    marginTop: 'var(--gap-lg)',
                  }}
                >
                  <span className="t-price-lg" style={{ color: '#fff' }}>
                    {order.waitingForSlot && order.scheduledLabel
                      ? order.scheduledLabel
                      : trackingHasEta(order.tracking)
                      ? `${order.tracking?.etaMinutes} min`
                      : minutesLeft != null && minutesLeft > 0
                        ? `${minutesLeft} min`
                        : 'Any moment'}
                  </span>
                  <span className="t-caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {order.waitingForSlot
                      ? ''
                      : trackingDistanceLabel(order.tracking)
                      ? `${trackingDistanceLabel(order.tracking)} away`
                      : minutesLeft != null && minutesLeft > 0
                        ? 'estimated arrival'
                        : 'arriving any moment'}
                  </span>
                </div>
              </>
            )}
          </div>
        </FadeSlideIn>

        {/* ── Booked, not yet with the kitchen ──────────────────────────── */}
        {order.waitingForSlot && order.paymentState === 'paid' && (
          <FadeSlideIn delay={40}>
            <Card style={{ marginTop: 'var(--gap-lg)' }}>
              <p className="t-body-sm" style={{ margin: 0 }}>
                Plans changed? Cancel before the kitchen starts and the full {money(order.total)} goes
                back to your Blorbmart wallet.
              </p>
              <div style={{ marginTop: 'var(--gap-md)' }}>
                <Button
                  label="Cancel this order"
                  kind="outline"
                  size="md"
                  icon={<CalendarX size={18} aria-hidden />}
                  onClick={() => setConfirmCancel(true)}
                />
              </div>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── Live map ───────────────────────────────────────────────── */}
        {!isTerminal(order.stage) &&
          trackingHasRider(order.tracking) &&
          order.tracking?.riderLocation && (
            <FadeSlideIn delay={40}>
              <div style={{ marginTop: 'var(--gap-lg)' }}>
                <Suspense fallback={<Skeleton height={MAP_HEIGHT} radius="var(--radius-lg)" />}>
                  <LiveRiderMap
                    rider={order.tracking.riderLocation}
                    destination={order.tracking.destination}
                    height={MAP_HEIGHT}
                  />
                </Suspense>
              </div>
            </FadeSlideIn>
          )}

        {/* ── PIN ────────────────────────────────────────────────────── */}
        {showsPin(order) && (
          <FadeSlideIn delay={80}>
            <PinCard orderId={order.id} urgent={order.stage === 'arrived'} />
          </FadeSlideIn>
        )}

        {/* ── Rider ──────────────────────────────────────────────────── */}
        {/* What to check at the door: the face, the plate, and whether campus
            ops has matched that face to an ID. The Call button exists only
            while the food is moving — the number is gone once it arrives. */}
        {order.riderName && (
          <FadeSlideIn delay={120}>
            <Card style={{ marginTop: 'var(--gap-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                {order.riderPhotoUrl ? (
                  <img
                    src={order.riderPhotoUrl}
                    alt={`${order.riderName}, your rider`}
                    width={52}
                    height={52}
                    style={{ width: 52, height: 52, flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    className="t-h3"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 46,
                      height: 46,
                      flexShrink: 0,
                      borderRadius: '50%',
                      background: 'var(--color-brand-soft)',
                      color: 'var(--color-brand-ink)',
                    }}
                  >
                    {order.riderName.trim()[0]?.toUpperCase() ?? 'R'}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="t-h4 clamp-1">{order.riderName}</span>
                    {order.riderVerified && (
                      <BadgeCheck
                        size={17}
                        aria-label="Verified rider"
                        style={{ color: 'var(--color-success)', flexShrink: 0 }}
                      />
                    )}
                  </div>
                  <div className="t-caption clamp-1">
                    {[
                      order.riderVerified ? 'Verified rider' : 'Your rider',
                      VEHICLE_LABEL[order.riderVehicle] ?? '',
                      order.riderPlate,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {order.riderPhone && !isTerminal(order.stage) && (
                  <IconButton
                    label={`Call ${order.riderName}`}
                    onClick={() => window.location.assign(`tel:${order.riderPhone}`)}
                    background="var(--color-success-soft)"
                    color="var(--color-success)"
                  >
                    <Phone size={19} aria-hidden />
                  </IconButton>
                )}
              </div>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── Safety ─────────────────────────────────────────────────── */}
        {!isTerminal(order.stage) && order.paymentState === 'paid' && (
          <FadeSlideIn delay={140}>
            <SosCard orderDocId={orderId} />
          </FadeSlideIn>
        )}

        {/* ── Rating ─────────────────────────────────────────────────── */}
        {order.stage === 'delivered' && (
          <FadeSlideIn delay={140}>
            <RatingCard orderDocId={orderId} hasRider={Boolean(order.riderName)} riderName={order.riderName} />
          </FadeSlideIn>
        )}

        {/* ── Items ──────────────────────────────────────────────────── */}
        <FadeSlideIn delay={160}>
          <Card style={{ marginTop: 'var(--gap-lg)' }}>
            <div className="t-overline" style={{ marginBottom: 'var(--gap-md)' }}>
              Your order
            </div>
            {order.lines.map((line, i) => (
              <div
                key={`${line.itemId}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--gap-sm)',
                  padding: '6px 0',
                }}
              >
                <span className="t-label" style={{ color: 'var(--color-brand)', flexShrink: 0 }}>
                  {line.quantity}×
                </span>
                <span className="t-body clamp-1" style={{ flex: 1, minWidth: 0 }}>
                  {line.name}
                </span>
                <span className="t-price-sm">{money(lineTotal(line))}</span>
              </div>
            ))}

            <div style={{ margin: 'var(--gap-md) 0' }}>
              <DashedDivider />
            </div>

            <SummaryRow label="Subtotal" value={money(order.subtotal)} />
            {order.deliveryFee > 0 && (
              <SummaryRow label="Delivery" value={money(order.deliveryFee)} />
            )}
            {order.serviceFee > 0 && (
              <SummaryRow label="Service fee" value={money(order.serviceFee)} />
            )}
            {order.discount > 0 && (
              <SummaryRow
                label="Discount"
                value={`− ${money(order.discount)}`}
                valueColor="var(--color-success)"
              />
            )}
            <SummaryRow label="Total" value={money(order.total)} emphasise />
          </Card>
        </FadeSlideIn>

        {/* ── Order again ────────────────────────────────────────────── */}
        {canReorder && (
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <Button
              label="Order this again"
              glow
              busy={again.busyId === order.id}
              icon={<RotateCcw size={18} aria-hidden />}
              onClick={() => void again.start(order.id)}
            />
          </div>
        )}

        {/* ── Help ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: canReorder ? 'var(--gap-md)' : 'var(--gap-xl)' }}>
          <Button
            label="Get help with this order"
            kind="outline"
            icon={<MessageCircle size={18} aria-hidden />}
            onClick={() =>
              window.open(
                supportUrl(`Hello Blorbmart, I need help with order ${order.id}`),
                '_blank',
                'noopener,noreferrer',
              )
            }
          />
        </div>
      </ScreenBody>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message={`${order.storeName || 'The store'} has not started it yet. ${money(order.total)} goes back to your Blorbmart wallet.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep it"
        destructive
        busy={cancelling}
        icon={<CalendarX size={26} aria-hidden />}
        onConfirm={() => void cancelBooking()}
        onCancel={() => setConfirmCancel(false)}
      />
      {again.ui}
    </>
  )
}

/**
 * The delivery PIN.
 *
 * The digits are not on the order document — a rider or vendor reading that
 * document must not be able to read the PIN — so they are fetched over the
 * authenticated API, here, where the customer has actually navigated to look
 * at them.
 */
function PinCard({ orderId, urgent }: { orderId: string; urgent: boolean }) {
  const [pin, setPin] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void deliveryPin(orderId).then((value) => {
      if (cancelled) return
      if (value) setPin(value)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [orderId])

  const body = (
    <div
      style={{
        marginTop: 'var(--gap-lg)',
        padding: 'var(--gap-xl)',
        borderRadius: 'var(--radius-lg)',
        background: urgent ? 'var(--color-appetite-soft)' : 'var(--color-surface)',
        border: `1px solid ${urgent ? 'var(--color-appetite)' : 'var(--color-line)'}`,
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'center',
      }}
    >
      <div
        className="t-overline"
        style={{ color: urgent ? 'var(--color-appetite-deep)' : 'var(--color-ink-muted)' }}
      >
        {urgent ? 'Give the rider this PIN' : 'Your delivery PIN'}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--gap-sm)',
          margin: 'var(--gap-lg) 0 var(--gap-md)',
        }}
      >
        {failed ? (
          <span className="t-body-sm">
            We could not load your PIN. Pull up your order again in a moment.
          </span>
        ) : pin ? (
          [...pin].map((digit, i) => (
            <span
              key={i}
              className="t-pin"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 58,
                height: 70,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: `1.5px solid ${urgent ? 'var(--color-appetite)' : 'var(--color-line-strong)'}`,
                animation: `blorb-pop var(--dur-normal) var(--ease-springy) ${i * 60}ms both`,
              }}
            >
              {digit}
            </span>
          ))
        ) : (
          <span className="t-body-sm">Generating your PIN…</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Lock size={14} aria-hidden style={{ color: 'var(--color-ink-muted)' }} />
        <span className="t-caption">
          {urgent
            ? 'Only share it when your food is in your hand.'
            : 'The delivery cannot be closed without it.'}
        </span>
      </div>
    </div>
  )

  return urgent && pin ? <Sheen>{body}</Sheen> : body
}
