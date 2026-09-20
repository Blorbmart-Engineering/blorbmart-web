/* ═══════════════════════════════════════════════════════════════════════
   The result of a bill purchase — a port of
   lib/features/bills/bill_receipt_screen.dart.

   Polls while the aggregator makes up its mind, then settles into a receipt.
   The token, when there is one, is the whole point of the page.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  CircleCheckBig,
  CircleAlert,
  Copy,
  Hourglass,
  ReceiptText,
  RotateCw,
} from 'lucide-react'
import { getBill, pollUntilSettled } from '../data/bills'
import { dayAndTime, money } from '../lib/format'
import {
  BILL_STATUS_COLORS,
  BILL_STATUS_LABELS,
  billIsPending,
  billTitle,
  type BillPayment,
} from '../models/bills'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'

export default function BillReceiptScreen() {
  const { billId = '' } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<BillPayment | null | undefined>(undefined)
  const polling = useRef(false)

  useEffect(() => {
    if (!billId) return
    let cancelled = false

    const run = async () => {
      const first = await getBill(billId)
      if (cancelled) return
      setPayment(first)

      // Only poll while the result is genuinely unknown. An aggregator that
      // has not answered in ten seconds will not answer faster for being
      // asked more often, so the repo backs off as it goes.
      if (first && billIsPending(first) && !polling.current) {
        polling.current = true
        const settled = await pollUntilSettled(billId, {
          onUpdate: (update) => {
            if (!cancelled) setPayment(update)
          },
        })
        if (!cancelled && settled) setPayment(settled)
        polling.current = false
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [billId])

  if (payment === undefined) {
    return (
      <>
        <AppBar title="Receipt" />
        <ScreenBody padded>
          <Skeleton height={160} radius="var(--radius-lg)" />
          <Skeleton height={200} radius="var(--radius-lg)" style={{ marginTop: 16 }} />
        </ScreenBody>
      </>
    )
  }

  if (payment === null) {
    return (
      <>
        <AppBar title="Not found" />
        <EmptyState
          title="Receipt not found"
          message="We could not find that payment. Check your bill history."
          icon={<ReceiptText size={30} aria-hidden />}
          actionLabel="Bill history"
          onAction={() => navigate('/bills/history')}
        />
      </>
    )
  }

  const tone = BILL_STATUS_COLORS[payment.status]
  const pending = billIsPending(payment)

  const Glyph =
    payment.status === 'delivered'
      ? CircleCheckBig
      : payment.status === 'failed'
        ? CircleAlert
        : payment.status === 'refunded'
          ? RotateCw
          : payment.status === 'abandoned'
            ? Ban
            : Hourglass

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(payment.token)
      showToast('Token copied.', 'success')
    } catch {
      showToast('Copy it by hand — your browser blocked the clipboard.', 'neutral')
    }
  }

  return (
    <>
      <AppBar title="Receipt" subtitle={billTitle(payment)} />

      <ScreenBody bottomGap="150px" padded>
        <FadeSlideIn>
          <div style={{ textAlign: 'center', padding: 'var(--gap-xl) 0' }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 84,
                height: 84,
                margin: '0 auto',
                borderRadius: '50%',
                background: `color-mix(in srgb, ${tone} 12%, transparent)`,
                color: tone,
                animation: 'blorb-pop var(--dur-hero) var(--ease-springy) both',
              }}
            >
              <Glyph
                size={40}
                aria-hidden
                style={pending ? { animation: 'blorb-spin 2s linear infinite' } : undefined}
              />
            </div>

            <h1 className="t-h1" style={{ margin: 'var(--gap-lg) 0 var(--gap-xs)' }}>
              {BILL_STATUS_LABELS[payment.status]}
            </h1>
            <p className="t-price-lg" style={{ margin: 0 }}>
              {money(payment.total)}
            </p>
            {pending && (
              <p className="t-body-sm" style={{ margin: 'var(--gap-sm) 0 0' }}>
                Confirming with the provider. Your money is safe either way — a failure
                refunds automatically.
              </p>
            )}
            {payment.status === 'failed' && payment.failureReason && (
              <p className="t-body-sm" style={{ margin: 'var(--gap-sm) 0 0' }}>
                {payment.failureReason}
              </p>
            )}
          </div>
        </FadeSlideIn>

        {/* ── The token ──────────────────────────────────────────────── */}
        {payment.token && (
          <FadeSlideIn delay={100}>
            <Card
              color="var(--color-brand-softer)"
              border="var(--color-brand-soft)"
              shadow="none"
              style={{ marginBottom: 'var(--gap-lg)' }}
            >
              <div className="t-overline">Your token</div>
              <div
                className="t-price-lg"
                style={{ margin: 'var(--gap-sm) 0', wordBreak: 'break-all', letterSpacing: 1 }}
              >
                {payment.token}
              </div>
              {payment.units && (
                <div className="t-caption" style={{ marginBottom: 'var(--gap-md)' }}>
                  {payment.units} units
                </div>
              )}
              <Button
                label="Copy token"
                kind="soft"
                size="md"
                icon={<Copy size={17} aria-hidden />}
                onClick={() => void copyToken()}
              />
            </Card>
          </FadeSlideIn>
        )}

        {/* ── Detail ─────────────────────────────────────────────────── */}
        <FadeSlideIn delay={160}>
          <Card>
            <SummaryRow label="Service" value={payment.serviceName} />
            {payment.variationName && (
              <SummaryRow label="Bundle" value={payment.variationName} />
            )}
            {payment.target && <SummaryRow label="Paid for" value={payment.target} />}
            {payment.paymentMethod && (
              <SummaryRow
                label="Paid with"
                value={payment.paymentMethod === 'wallet' ? 'Blorbmart wallet' : 'Card or transfer'}
              />
            )}
            {payment.createdAt && (
              <SummaryRow label="Date" value={dayAndTime(payment.createdAt)} />
            )}
            {payment.reference && (
              <SummaryRow label="Reference" value={payment.reference} />
            )}
            <div style={{ margin: 'var(--gap-sm) 0' }}>
              <DashedDivider />
            </div>
            {/* The fee is itemised rather than folded into the total: a
                receipt that quotes a round ₦500 for a ₦510 charge is the
                first thing a customer queries. */}
            {payment.fee > 0 && (
              <>
                <SummaryRow label={payment.serviceName} value={money(payment.amount)} />
                <SummaryRow label="Transaction fee" value={money(payment.fee)} />
              </>
            )}
            <SummaryRow label="Total" value={money(payment.total)} emphasise />
          </Card>
        </FadeSlideIn>

        {payment.simulated && (
          <p
            className="t-caption"
            style={{
              marginTop: 'var(--gap-lg)',
              padding: 'var(--gap-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-warning-soft)',
              color: '#9A5B00',
              textAlign: 'center',
            }}
          >
            Test mode. No real airtime or token was delivered.
          </p>
        )}

        <div style={{ marginTop: 'var(--gap-xl)' }}>
          <Button
            label="View full receipt"
            kind="outline"
            icon={<ReceiptText size={18} aria-hidden />}
            onClick={() => navigate(`/receipt/bill/${payment.id}`)}
          />
          <div style={{ height: 'var(--gap-md)' }} />
          <Button label="Done" onClick={() => navigate('/bills', { replace: true })} />
        </div>
      </ScreenBody>
    </>
  )
}
