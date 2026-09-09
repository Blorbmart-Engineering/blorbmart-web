/* ═══════════════════════════════════════════════════════════════════════
   Order placed — a port of lib/features/orders/order_placed_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleCheckBig } from 'lucide-react'
import { getOrder } from '../data/orders'
import { money } from '../lib/format'
import { estimatedArrival, shortOrderId, type BlorbOrder } from '../models/order'
import { Button } from '../ui/Button'
import { Card, SummaryRow } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { ScreenBody } from '../ui/Screen'

export default function OrderPlaced() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<BlorbOrder | null>(null)

  useEffect(() => {
    void getOrder(orderId).then(setOrder)
  }, [orderId])

  const eta = order ? estimatedArrival(order) : null

  return (
    <ScreenBody bottomGap="150px" padded>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          paddingTop: 'calc(var(--safe-top) + var(--gap-giant))',
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'var(--color-success-soft)',
            color: 'var(--color-success)',
            animation: 'blorb-pop var(--dur-hero) var(--ease-springy) both',
          }}
        >
          <CircleCheckBig size={46} aria-hidden />
        </div>

        <FadeSlideIn delay={140}>
          <h1 className="t-display-sm" style={{ margin: 'var(--gap-xxl) 0 var(--gap-sm)' }}>
            Order placed
          </h1>
          <p className="t-body-lg" style={{ margin: 0, maxWidth: 320 }}>
            {order?.storeName
              ? `${order.storeName} has your order and is starting on it.`
              : 'The kitchen has your order and is starting on it.'}
          </p>
        </FadeSlideIn>
      </div>

      <FadeSlideIn delay={220}>
        <Card style={{ marginTop: 'var(--gap-xxxl)' }}>
          <SummaryRow label="Order number" value={order ? `#${shortOrderId(order)}` : '…'} />
          {order && order.itemCount > 0 && (
            <SummaryRow
              label="Items"
              value={`${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`}
            />
          )}
          <SummaryRow
            label="Estimated arrival"
            value={
              eta
                ? eta.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
                : '…'
            }
          />
          <SummaryRow label="Total paid" value={order ? money(order.total) : '…'} emphasise />
        </Card>
      </FadeSlideIn>

      <FadeSlideIn delay={300}>
        <div style={{ marginTop: 'var(--gap-xxl)' }}>
          <Button
            label="Track this order"
            glow
            onClick={() => navigate(`/track/${orderId}`, { replace: true })}
          />
          <div style={{ height: 'var(--gap-md)' }} />
          <Button
            label="Back to home"
            kind="outline"
            onClick={() => navigate('/home', { replace: true })}
          />
        </div>
      </FadeSlideIn>
    </ScreenBody>
  )
}
