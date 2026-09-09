/* ═══════════════════════════════════════════════════════════════════════
   Order history — a port of lib/features/orders/orders_screen.dart.

   Unpaid checkout drafts never reach this screen; the repo drops them, so
   nothing here has to remember the rule.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ReceiptText } from 'lucide-react'
import { watchHistory } from '../data/orders'
import { money, timeAgo } from '../lib/format'
import {
  isTerminal,
  ORDER_STAGES,
  orderSummaryLine,
  shortOrderId,
  type BlorbOrder,
} from '../models/order'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { EmptyState, Pill, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, LivePulse, PressScale, staggerFor } from '../ui/motion'
import { ScreenBody } from '../ui/Screen'
import { StageIcon } from '../components/StageIcon'
import { StageBar } from '../components/HomeWidgets'

export default function OrdersScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const [orders, setOrders] = useState<BlorbOrder[] | null>(null)

  useEffect(() => {
    if (!signedIn) {
      setOrders([])
      return
    }
    return watchHistory(setOrders)
  }, [signedIn])

  const live = (orders ?? []).filter((o) => !isTerminal(o.stage))
  const past = (orders ?? []).filter((o) => isTerminal(o.stage))

  if (!signedIn) {
    return (
      <ScreenBody bottomGap="150px">
        <div style={{ paddingTop: 'calc(var(--safe-top) + var(--gap-xl))' }}>
          <EmptyState
            title="Sign in to see your orders"
            message="Your order history and live tracking live with your account."
            icon={<ReceiptText size={30} aria-hidden />}
            actionLabel="Sign in"
            onAction={() => navigate('/login', { state: { from: '/orders' } })}
          />
        </div>
      </ScreenBody>
    )
  }

  return (
    <ScreenBody bottomGap="150px">
      <div style={{ paddingTop: 'var(--safe-top)' }}>
        <SectionHeader title="Your orders" subtitle="Everything you have ordered, newest first" />
      </div>

      {orders === null ? (
        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              height={104}
              radius="var(--radius-lg)"
              style={{ marginBottom: 'var(--gap-md)' }}
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="When you order something, it shows up here with live tracking and your receipt."
          icon={<ReceiptText size={30} aria-hidden />}
          actionLabel="Find something to eat"
          onAction={() => navigate('/home')}
        />
      ) : (
        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {live.length > 0 && (
            <>
              <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
                On the way
              </div>
              {live.map((order, i) => (
                <FadeSlideIn key={order.id} delay={staggerFor(i, 4)}>
                  <OrderRow order={order} onClick={() => navigate(`/track/${order.id}`)} />
                </FadeSlideIn>
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <div
                className="t-overline"
                style={{ margin: `${live.length ? 'var(--gap-xl)' : '0'} 0 var(--gap-sm)` }}
              >
                Past orders
              </div>
              {past.map((order, i) => (
                <FadeSlideIn key={order.id} delay={staggerFor(i, 4)}>
                  <OrderRow order={order} onClick={() => navigate(`/track/${order.id}`)} />
                </FadeSlideIn>
              ))}
            </>
          )}
        </div>
      )}
    </ScreenBody>
  )
}

function OrderRow({ order, onClick }: { order: BlorbOrder; onClick: () => void }) {
  const stage = ORDER_STAGES[order.stage]
  const terminal = isTerminal(order.stage)

  return (
    <PressScale
      scale={0.985}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        marginBottom: 'var(--gap-md)',
        padding: 'var(--gap-lg)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        border: `1px solid ${terminal ? 'var(--color-line)' : `color-mix(in srgb, ${stage.color} 22%, transparent)`}`,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${stage.color} 10%, transparent)`,
            color: stage.color,
          }}
        >
          <StageIcon icon={stage.icon} size={20} />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="t-h4 clamp-1" style={{ display: 'block' }}>
            {order.storeName || `Order #${shortOrderId(order)}`}
          </span>
          <span className="t-caption clamp-1" style={{ display: 'block' }}>
            {orderSummaryLine(order)} · {timeAgo(order.createdAt)}
          </span>
        </span>

        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span className="t-price" style={{ display: 'block' }}>
            {money(order.total)}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          marginTop: 'var(--gap-md)',
        }}
      >
        {!terminal && <LivePulse color={stage.color} size={7} />}
        <Pill
          label={stage.title}
          tone={
            order.stage === 'cancelled'
              ? 'danger'
              : order.stage === 'delivered'
                ? 'success'
                : 'brand'
          }
          dense
        />
        <span style={{ flex: 1 }} />
      </div>

      {!terminal && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <StageBar step={stage.step} color={stage.color} />
        </div>
      )}
    </PressScale>
  )
}
