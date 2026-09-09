/* ═══════════════════════════════════════════════════════════════════════
   A Blorbmart receipt — a port of lib/features/receipts/receipt_screen.dart.

   One shape for every kind of money that moves through the app. The document
   is fetched already signed; nothing here assembles one, because a receipt
   without a signature is a screenshot.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Copy, Download, ReceiptText, Share2 } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { dayAndTime, money } from '../lib/format'
import { fetchReceipt, receiptPdfUrl } from '../data/receipts'
import {
  receiptIsFailed,
  receiptIsRefunded,
  receiptIsSuccessful,
  receiptIssuedTo,
  type BlorbReceipt,
  type ReceiptKind,
} from '../models/receipt'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, Pill, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'

const KINDS: ReceiptKind[] = ['wallet', 'bill', 'order', 'ticket']

export default function ReceiptScreen() {
  const { kind = 'wallet', id = '' } = useParams()
  const navigate = useNavigate()

  const [receipt, setReceipt] = useState<BlorbReceipt | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const safeKind: ReceiptKind = KINDS.includes(kind as ReceiptKind)
    ? (kind as ReceiptKind)
    : 'wallet'

  useEffect(() => {
    let cancelled = false
    fetchReceipt(safeKind, id)
      .then((r) => {
        if (!cancelled) setReceipt(r)
      })
      .catch((e) => {
        if (cancelled) return
        setError(apiErrorMessage(e, 'We could not load that receipt.'))
        setReceipt(null)
      })
    return () => {
      cancelled = true
    }
  }, [safeKind, id])

  useEffect(() => {
    if (!receipt?.verifyUrl) return
    QRCode.toDataURL(receipt.verifyUrl, {
      width: 400,
      margin: 1,
      color: { dark: '#0B1220', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [receipt])

  const download = async () => {
    setDownloading(true)
    let url: string | null = null
    try {
      url = await receiptPdfUrl(safeKind, id)
      const link = document.createElement('a')
      link.href = url
      link.download = `blorbmart-receipt-${receipt?.receiptNo ?? id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      showToast(apiErrorMessage(e, 'We could not open that PDF.'), 'danger')
    } finally {
      // The object URL holds the whole file in memory until it is revoked.
      const created = url
      if (created) setTimeout(() => URL.revokeObjectURL(created), 10_000)
      setDownloading(false)
    }
  }

  const share = async () => {
    if (!receipt) return
    const text = `Blorbmart receipt ${receipt.receiptNo} · ${money(receipt.amount)}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Blorbmart receipt',
          text,
          url: receipt.verifyUrl || undefined,
        })
      } else {
        await navigator.clipboard.writeText(
          receipt.verifyUrl ? `${text}\n${receipt.verifyUrl}` : text,
        )
        showToast('Receipt details copied.', 'success')
      }
    } catch {
      /* the customer dismissed the share sheet */
    }
  }

  if (receipt === undefined) {
    return (
      <>
        <AppBar title="Receipt" />
        <ScreenBody padded>
          <Skeleton height={420} radius="var(--radius-lg)" />
        </ScreenBody>
      </>
    )
  }

  if (receipt === null) {
    return (
      <>
        <AppBar title="Receipt" />
        <EmptyState
          title="Receipt unavailable"
          message={error ?? 'We could not load that receipt.'}
          icon={<ReceiptText size={30} aria-hidden />}
          actionLabel="Go back"
          onAction={() => navigate(-1)}
        />
      </>
    )
  }

  const tone = receiptIsSuccessful(receipt)
    ? 'success'
    : receiptIsFailed(receipt)
      ? 'danger'
      : receiptIsRefunded(receipt)
        ? 'warning'
        : 'brand'

  return (
    <>
      <AppBar title={receipt.kindLabel} subtitle={receipt.receiptNo} />

      <ScreenBody bottomGap="150px" padded>
        <FadeSlideIn>
          <Card padding="0" clip>
            {/* ── Head ─────────────────────────────────────────────── */}
            <div style={{ padding: 'var(--gap-xl)', textAlign: 'center' }}>
              <img
                src="/assets/icon.png"
                alt=""
                width={40}
                height={40}
                style={{ margin: '0 auto', borderRadius: 'var(--radius-sm)' }}
              />
              <h1 className="t-h3" style={{ margin: 'var(--gap-md) 0 4px' }}>
                {receipt.title}
              </h1>
              {receipt.subtitle && (
                <p className="t-caption" style={{ margin: 0 }}>
                  {receipt.subtitle}
                </p>
              )}

              <div className="t-display-sm" style={{ margin: 'var(--gap-lg) 0 var(--gap-sm)' }}>
                {money(receipt.amount)}
              </div>
              <Pill label={receipt.statusLabel} tone={tone} />

              <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0' }}>
                {dayAndTime(receipt.issuedAt)}
              </p>
            </div>

            <div style={{ padding: '0 var(--gap-lg)' }}>
              <DashedDivider />
            </div>

            {/* ── The secret ───────────────────────────────────────── */}
            {receipt.secret && (
              <>
                <div style={{ padding: 'var(--gap-lg)' }}>
                  <div
                    style={{
                      padding: 'var(--gap-lg)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-brand-softer)',
                      border: '1px solid var(--color-brand-soft)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="t-overline">{receipt.secret.label}</div>
                    <div
                      className="t-price-lg"
                      style={{ margin: '8px 0', wordBreak: 'break-all', letterSpacing: 1 }}
                    >
                      {receipt.secret.value}
                    </div>
                    {receipt.secret.hint && (
                      <p className="t-caption" style={{ margin: '0 0 var(--gap-md)' }}>
                        {receipt.secret.hint}
                      </p>
                    )}
                    <Button
                      label="Copy"
                      kind="soft"
                      size="sm"
                      expand={false}
                      icon={<Copy size={15} aria-hidden />}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(receipt.secret!.value)
                          .then(() => showToast('Copied.', 'success'))
                          .catch(() => showToast('Your browser blocked the clipboard.', 'neutral'))
                      }}
                    />
                  </div>
                </div>
                <div style={{ padding: '0 var(--gap-lg)' }}>
                  <DashedDivider />
                </div>
              </>
            )}

            {/* ── Items ────────────────────────────────────────────── */}
            {receipt.items.length > 0 && (
              <div style={{ padding: 'var(--gap-lg)' }}>
                {receipt.items.map((item, i) => (
                  <div
                    key={`${item.name}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--gap-sm)',
                      padding: '5px 0',
                    }}
                  >
                    <span
                      className="t-label"
                      style={{ color: 'var(--color-brand)', flexShrink: 0 }}
                    >
                      {item.quantity}×
                    </span>
                    <span className="t-body clamp-1" style={{ flex: 1, minWidth: 0 }}>
                      {item.name}
                    </span>
                    <span className="t-price-sm">{money(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Rows ─────────────────────────────────────────────── */}
            {receipt.rows.length > 0 && (
              <div style={{ padding: '0 var(--gap-lg) var(--gap-lg)' }}>
                {receipt.rows.map((row, i) => (
                  <SummaryRow
                    key={`${row.label}-${i}`}
                    label={row.label}
                    value={
                      row.mono ? (
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                          {row.value}
                        </span>
                      ) : (
                        row.value
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* ── Totals ───────────────────────────────────────────── */}
            {receipt.totals.length > 0 && (
              <>
                <div style={{ padding: '0 var(--gap-lg)' }}>
                  <DashedDivider />
                </div>
                <div style={{ padding: 'var(--gap-lg)' }}>
                  {receipt.totals.map((row, i) => (
                    <SummaryRow
                      key={`${row.label}-${i}`}
                      label={row.label}
                      value={row.value}
                      emphasise={i === receipt.totals.length - 1}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Verification ─────────────────────────────────────── */}
            <div
              style={{
                padding: 'var(--gap-lg)',
                background: 'var(--color-surface-sunken)',
                textAlign: 'center',
              }}
            >
              {qr && (
                <img
                  src={qr}
                  alt="Scan to verify this receipt"
                  width={110}
                  height={110}
                  style={{ margin: '0 auto var(--gap-sm)' }}
                />
              )}
              {receipt.verificationCode && (
                <p className="t-caption-sm" style={{ margin: 0 }}>
                  Verification code {receipt.verificationCode}
                </p>
              )}
              {receiptIssuedTo(receipt) && (
                <p className="t-caption-sm" style={{ margin: '4px 0 0' }}>
                  Issued to {receiptIssuedTo(receipt)}
                </p>
              )}
              {receipt.note && (
                <p className="t-caption-sm" style={{ margin: '8px 0 0' }}>
                  {receipt.note}
                </p>
              )}
              {receipt.simulated && (
                <p
                  className="t-caption-sm"
                  style={{ margin: '8px 0 0', color: 'var(--color-warning)' }}
                >
                  Test mode — no real value was delivered.
                </p>
              )}
            </div>
          </Card>
        </FadeSlideIn>

        <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-xl)' }}>
          <Button
            label="Share"
            kind="outline"
            icon={<Share2 size={17} aria-hidden />}
            onClick={() => void share()}
          />
          <Button
            label="PDF"
            busy={downloading}
            icon={<Download size={17} aria-hidden />}
            onClick={() => void download()}
          />
        </div>
      </ScreenBody>
    </>
  )
}
