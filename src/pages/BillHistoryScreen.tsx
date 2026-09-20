/* ═══════════════════════════════════════════════════════════════════════
   Bill payment history.

   A failure here is the whole point of the screen, so unlike the strip on the
   bills screen it surfaces the error rather than degrading to empty.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Receipt, WifiOff } from 'lucide-react'
import { history } from '../data/bills'
import { money, timeAgo } from '../lib/format'
import {
  BILL_STATUS_COLORS,
  BILL_STATUS_LABELS,
  billTitle,
  type BillPayment,
} from '../models/bills'
import { EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'

export default function BillHistoryScreen() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState<BillPayment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setPayments(await history({ limit: 50 }))
    } catch {
      setError('Something went wrong fetching your bill payments.')
      setPayments([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <AppBar title="Bill history" subtitle="Airtime, data, power and TV" />
      <ScreenBody bottomGap="150px" padded>
        {error ? (
          <EmptyState
            title="Could not load your history"
            message={error}
            icon={<WifiOff size={30} aria-hidden />}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : payments === null ? (
          [0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              height={64}
              radius="var(--radius-md)"
              style={{ marginBottom: 'var(--gap-sm)' }}
            />
          ))
        ) : payments.length === 0 ? (
          <EmptyState
            title="No bill payments yet"
            message="Airtime, data and power purchases will appear here."
            icon={<Receipt size={30} aria-hidden />}
            actionLabel="Pay a bill"
            onAction={() => navigate('/bills')}
          />
        ) : (
          payments.map((payment, i) => (
            <FadeSlideIn key={payment.id} delay={staggerFor(i, 6)}>
              <PressScale
                scale={0.99}
                onClick={() => navigate(`/bills/receipt/${payment.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  width: '100%',
                  padding: 'var(--gap-md) 0',
                  borderBottom: '1px solid var(--color-line)',
                  textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                    {billTitle(payment)}
                  </span>
                  <span className="t-caption clamp-1" style={{ display: 'block' }}>
                    {payment.target} · {timeAgo(payment.createdAt)}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className="t-price" style={{ display: 'block' }}>
                    {money(payment.total)}
                  </span>
                  <span
                    className="t-caption-sm"
                    style={{ color: BILL_STATUS_COLORS[payment.status] }}
                  >
                    {BILL_STATUS_LABELS[payment.status]}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
              </PressScale>
            </FadeSlideIn>
          ))
        )}
      </ScreenBody>
    </>
  )
}
