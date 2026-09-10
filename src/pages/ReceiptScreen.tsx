/* ═══════════════════════════════════════════════════════════════════════
   A Blorbmart receipt — a port of lib/features/receipts/receipt_screen.dart.

   One shape for every kind of money that moves through the app. The document
   is fetched already signed; nothing here assembles one, because a receipt
   without a signature is a screenshot.

   Drawn as paper on purpose. This is the same document the backend prints,
   down to the torn edge and the dotted leaders, so a customer showing this
   screen and a caterer holding the printout are looking at one receipt in two
   places rather than two designs that happen to share a number.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Copy, Download, ReceiptText, Share2 } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { dayAndTime, moneyExact } from '../lib/format'
import { fetchReceipt, receiptPdfUrl } from '../data/receipts'
import {
  receiptIssuedTo,
  type BlorbReceipt,
  type ReceiptItem,
  type ReceiptKind,
  type ReceiptRow,
} from '../models/receipt'
import { Button } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'

const KINDS: ReceiptKind[] = ['wallet', 'bill', 'order', 'ticket']

/** The ink stamp across the middle — the first thing anybody reads. */
const STAMPS: Record<string, { text: string; color: string }> = {
  completed: { text: 'Paid', color: '#12855C' },
  pending: { text: 'Pending', color: '#A86A12' },
  failed: { text: 'Failed', color: '#C0392B' },
  refunded: { text: 'Refunded', color: '#A86A12' },
}

/** label ......... value. The row a paper receipt is built from. */
function Line({
  label,
  value,
  strong = false,
}: {
  label: string
  value: ReactNode
  strong?: boolean
}) {
  return (
    <div className={strong ? 'rcpt-ln strong' : 'rcpt-ln'}>
      <span className="rcpt-k">{label}</span>
      <span className="rcpt-dots" aria-hidden />
      <span className="rcpt-v">{value}</span>
    </div>
  )
}

/**
 * Totals, with one line carrying the weight.
 *
 * Not simply the last row: a wallet receipt ends on "Wallet balance after",
 * which is context rather than what was transacted. The emphasised line is
 * the last one naming a total or an amount, and only where no row does either
 * does the bottom line take it. Mirrors totalsHtml in receiptService.js —
 * the printed copy must not emphasise a different figure.
 */
const GRAND_LABEL = /^(total|amount)\b/i

function grandIndex(totals: ReceiptRow[]): number {
  let grand = totals.length - 1
  totals.forEach((row, index) => {
    if (GRAND_LABEL.test(row.label)) grand = index
  })
  return grand
}

/** Items in till order: name, then quantity at unit price against the line. */
function Item({ item }: { item: ReceiptItem }) {
  const quantity = item.quantity || 1
  return (
    <div className="rcpt-item">
      <div className="rcpt-item-name">{item.name}</div>
      <Line
        label={`${quantity} @ ${moneyExact(item.amount / quantity)}`}
        value={moneyExact(item.amount)}
      />
    </div>
  )
}

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
      margin: 0,
      color: { dark: '#161311', light: '#FFFDF6' },
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
    const text = `Blorbmart receipt ${receipt.receiptNo} · ${moneyExact(receipt.amount)}`
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
          <Skeleton height={480} radius="var(--radius-lg)" />
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

  const stamp = STAMPS[receipt.status] ?? { text: 'Unconfirmed', color: '#A86A12' }
  const issuedTo = receiptIssuedTo(receipt)
  const grand = grandIndex(receipt.totals)

  return (
    <>
      <AppBar title={receipt.kindLabel} subtitle={receipt.receiptNo} />

      <ScreenBody bottomGap="150px" padded>
        <FadeSlideIn>
          <div className="rcpt-sheet">
            <div className="rcpt">
              <div className="rcpt-body">
                {/* ── Who issued this ────────────────────────────────── */}
                <div className="rcpt-head">
                  <img
                    className="rcpt-mark"
                    src="/assets/wordmark.png"
                    alt="Blorbmart"
                    width={381}
                    height={104}
                  />
                  <div className="rcpt-tagline">Everything you are hungry for</div>
                  <div className="rcpt-doctype">{receipt.kindLabel}</div>
                </div>

                <div className="rcpt-rule" />

                {/* ── What it is ─────────────────────────────────────── */}
                <div className="rcpt-title">{receipt.title}</div>
                {receipt.subtitle && <div className="rcpt-sub">{receipt.subtitle}</div>}

                <div className="rcpt-rule" />

                {/* ── The figure ─────────────────────────────────────── */}
                <div className="rcpt-amount-cap">Amount</div>
                <div className="rcpt-amount">{moneyExact(receipt.amount)}</div>

                <div className="rcpt-stamp-wrap">
                  <div className="rcpt-stamp" style={{ color: stamp.color }}>
                    {stamp.text}
                  </div>
                </div>
                <div className="rcpt-stamp-note">{receipt.statusLabel}</div>

                {receipt.note && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-note">{receipt.note}</div>
                  </>
                )}

                {/* ── The one thing worth stealing ───────────────────── */}
                {receipt.secret && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-secret">
                      <div className="rcpt-cap" style={{ marginBottom: 0 }}>
                        {receipt.secret.label}
                      </div>
                      <div className="rcpt-secret-v">{receipt.secret.value}</div>
                      {receipt.secret.hint && (
                        <div className="rcpt-secret-hint">{receipt.secret.hint}</div>
                      )}
                      <div style={{ marginTop: 'var(--gap-md)' }}>
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
                              .catch(() =>
                                showToast('Your browser blocked the clipboard.', 'neutral'),
                              )
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Items ──────────────────────────────────────────── */}
                {receipt.items.length > 0 && (
                  <>
                    <div className="rcpt-rule" />
                    <div className="rcpt-cap">Items</div>
                    {receipt.items.map((item, i) => (
                      <Item key={`${item.name}-${i}`} item={item} />
                    ))}
                  </>
                )}

                {/* ── Totals ─────────────────────────────────────────── */}
                {receipt.totals.length > 0 && (
                  <>
                    <div className={receipt.items.length ? 'rcpt-rule solid' : 'rcpt-rule'} />
                    {receipt.totals.map((row, i) => (
                      <Line
                        key={`${row.label}-${i}`}
                        label={row.label}
                        value={row.value}
                        strong={i === grand}
                      />
                    ))}
                    <div className="rcpt-rule double" />
                  </>
                )}

                {/* ── Detail ─────────────────────────────────────────── */}
                {receipt.rows.length > 0 ? (
                  <>
                    <div className="rcpt-cap">Transaction details</div>
                    {receipt.rows.map((row, i) => (
                      <Line key={`${row.label}-${i}`} label={row.label} value={row.value} />
                    ))}
                    <div className="rcpt-rule" />
                  </>
                ) : (
                  <div className="rcpt-rule" />
                )}

                <div className="rcpt-cap">Reference</div>
                <Line label="Receipt no." value={receipt.receiptNo} />
                {receipt.reference && (
                  <Line label="Payment ref." value={receipt.reference} />
                )}
                <Line label="Issued" value={dayAndTime(receipt.issuedAt)} />
                {issuedTo && <Line label="Issued to" value={issuedTo} />}

                {/* ── The stub anybody can check ─────────────────────── */}
                <div className="rcpt-perf" />

                <div className="rcpt-cap" style={{ textAlign: 'center' }}>
                  Scan to verify this receipt
                </div>
                {qr && (
                  <img
                    className="rcpt-qr"
                    src={qr}
                    alt="Scan to verify this receipt"
                    width={124}
                    height={124}
                  />
                )}
                {receipt.verificationCode && (
                  <>
                    <div className="rcpt-amount-cap">Verification code</div>
                    <div className="rcpt-code">{receipt.verificationCode}</div>
                  </>
                )}
                {receipt.simulated && (
                  <div className="rcpt-stamp-note" style={{ color: '#A86A12' }}>
                    Test mode — no real value was delivered.
                  </div>
                )}

                <div className="rcpt-rule" />

                <div className="rcpt-thanks">*** Thank you ***</div>
                <div className="rcpt-fine" style={{ marginTop: 8 }}>
                  Issued by Blorbmart and signed on our servers. Scanning the code above
                  re-reads this transaction from our records — if what it shows differs
                  from what is printed here, this copy has been altered.
                </div>
              </div>
            </div>
          </div>
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
