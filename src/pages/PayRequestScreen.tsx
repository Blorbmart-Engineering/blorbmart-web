/* ═══════════════════════════════════════════════════════════════════════
   Waiting for someone to pay — the requester's side of a pay-for-me link.

   Reached from checkout, and from the orders tab while a link is out. It is
   a waiting room with one job: get the link in front of whoever is paying.
   It checks the link every few seconds, and the moment it is paid this
   screen becomes the same celebration a normal payment ends on.

   Outside the shell: it has its own sticky action.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, HandCoins, MessageCircle, Share2, Wallet } from 'lucide-react'
import { apiErrorMessage, ApiError } from '../lib/api'
import { money } from '../lib/format'
import { copyText, openWhatsApp, shareOrCopy } from '../lib/share'
import {
  askSomeoneToPay,
  cancelPayRequest,
  payRequestForOrder,
  payRequestFromWallet,
  payRequestShareText,
  type PayRequest,
} from '../data/payRequests'
import { balance, invalidateBalance } from '../data/wallet'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn, LivePulse } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { useWalletPin } from '../components/WalletPinSheet'

const POLL_MS = 6000

export default function PayRequestScreen() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const handed = (location.state as { request?: PayRequest } | null)?.request ?? null

  // undefined: loading. null: this order has no link.
  const [request, setRequest] = useState<PayRequest | null | undefined>(handed ?? undefined)
  const [failed, setFailed] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [busy, setBusy] = useState<'wallet' | 'cancel' | 'renew' | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [copied, setCopied] = useState(false)
  const walletPin = useWalletPin()
  const leaving = useRef(false)

  const onPaid = useCallback(
    (paid: PayRequest) => {
      if (leaving.current) return
      leaving.current = true
      invalidateBalance()
      showToast(paid.paidByName ? `${paid.paidByName} paid for your order.` : 'Your order is paid.', 'success')
      navigate(`/order-placed/${orderId}`, { replace: true })
    },
    [navigate, orderId],
  )

  const refresh = useCallback(async () => {
    try {
      const next = await payRequestForOrder(orderId)
      setFailed(false)
      setRequest(next)
      if (next?.status === 'paid') onPaid(next)
    } catch (e) {
      // A blip while waiting is not worth tearing the screen down for; only a
      // first load with nothing to show is.
      console.warn('[payRequest] refresh failed', e)
      setFailed(true)
    }
  }, [orderId, onPaid])

  useEffect(() => {
    void refresh()
    void balance().then(setWalletBalance)
  }, [refresh])

  // Keep asking while the link is out and the tab is being looked at.
  const waiting = request?.status === 'open'
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [waiting, refresh])

  const copy = async () => {
    if (!request) return
    if (await copyText(request.link)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } else {
      showToast('Could not copy. Press and hold the link to copy it.', 'danger')
    }
  }

  const share = async () => {
    if (!request) return
    const outcome = await shareOrCopy({ title: 'Pay for my Blorbmart order', text: payRequestShareText(request) })
    if (outcome === 'copied') showToast('Message copied. Paste it to whoever is paying.', 'success')
    if (outcome === 'failed') showToast('Could not share. Copy the link instead.', 'danger')
  }

  const payMyself = async () => {
    if (!request || busy) return
    const pin = await walletPin.ask(money(request.total))
    if (!pin) return
    setBusy('wallet')
    try {
      onPaid(await payRequestFromWallet(request.token, { pin, expectedAmount: request.total }))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PRICE_CHANGED') void refresh()
      showToast(apiErrorMessage(e, 'That payment did not go through. Nothing was charged.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    if (busy) return
    setBusy('cancel')
    try {
      setRequest(await cancelPayRequest(orderId))
      setConfirmCancel(false)
    } catch (e) {
      // "Someone has already paid" is the one refusal, and it is good news.
      showToast(apiErrorMessage(e, 'Could not cancel the link.'), e instanceof ApiError && e.code === 'ALREADY_PAID' ? 'success' : 'danger')
      void refresh()
    } finally {
      setBusy(null)
    }
  }

  const renew = async () => {
    if (busy) return
    setBusy('renew')
    try {
      setRequest(await askSomeoneToPay(orderId))
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not make a new link.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  if (request === undefined) {
    return (
      <>
        <AppBar title="Ask someone to pay" onBack={() => navigate('/orders')} />
        {failed ? (
          <EmptyState
            title="Could not load your link"
            message="Check your connection. Your order is safe."
            actionLabel="Try again"
            onAction={() => void refresh()}
          />
        ) : (
          <ScreenBody padded>
            <Skeleton height={150} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
            <Skeleton height={64} radius="var(--radius-md)" style={{ marginTop: 'var(--gap-lg)' }} />
          </ScreenBody>
        )}
      </>
    )
  }

  if (request === null) {
    return (
      <>
        <AppBar title="Ask someone to pay" onBack={() => navigate('/orders')} />
        <EmptyState
          title="No payment link here"
          message="This order has no link waiting. Start again from your basket."
          icon={<HandCoins size={30} aria-hidden />}
          actionLabel="Back to home"
          onAction={() => navigate('/home', { replace: true })}
        />
      </>
    )
  }

  const open = request.status === 'open'
  const itemCount = request.items.reduce((sum, item) => sum + item.quantity, 0)
  const until = request.expiresAt?.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <AppBar title="Ask someone to pay" onBack={() => navigate('/orders')} />

      <ScreenBody padded bottomGap="var(--gap-xxl)">
        {/* ── Where it stands ────────────────────────────────────────── */}
        <FadeSlideIn>
          <Card style={{ marginTop: 'var(--gap-lg)', textAlign: 'center' }} padding="var(--gap-xl)">
            <div
              className="t-label-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: open ? 'var(--color-brand)' : 'var(--color-ink-muted)',
              }}
            >
              {open && <LivePulse color="var(--color-brand)" size={7} />}
              {open
                ? 'Waiting for someone to pay'
                : request.status === 'expired'
                  ? 'This link has expired'
                  : 'You cancelled this link'}
            </div>
            <div className="t-display-sm" style={{ margin: 'var(--gap-sm) 0 2px' }}>
              {money(request.total)}
            </div>
            <p className="t-body-sm" style={{ margin: 0 }}>
              {request.storeName || 'Your order'} · {itemCount} item{itemCount === 1 ? '' : 's'}
            </p>
            {open && until && (
              <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
                The link works until {until}. Your order is placed the moment it is paid.
              </p>
            )}
          </Card>
        </FadeSlideIn>

        {open && (
          <FadeSlideIn delay={80}>
            {/* ── The link ─────────────────────────────────────────────── */}
            <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
              Your payment link
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-sm)',
                padding: 'var(--gap-sm) var(--gap-sm) var(--gap-sm) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line-strong)',
              }}
            >
              <span
                className="t-body-sm clamp-1"
                style={{ flex: 1, minWidth: 0, color: 'var(--color-ink-strong)', userSelect: 'all', wordBreak: 'break-all' }}
              >
                {request.link.replace(/^https?:\/\//, '')}
              </span>
              <Button
                label={copied ? 'Copied' : 'Copy'}
                kind="soft"
                size="sm"
                expand={false}
                icon={copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                onClick={() => void copy()}
              />
            </div>

            <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
              <Button
                label="More ways to share"
                kind="outline"
                icon={<Share2 size={18} aria-hidden />}
                onClick={() => void share()}
              />
              {walletBalance >= request.total && (
                <Button
                  label={`Pay it myself · wallet ${money(walletBalance)}`}
                  kind="ghost"
                  busy={busy === 'wallet'}
                  icon={<Wallet size={18} aria-hidden />}
                  onClick={() => void payMyself()}
                />
              )}
            </div>
          </FadeSlideIn>
        )}

        {/* ── What they will see ─────────────────────────────────────── */}
        <FadeSlideIn delay={140}>
          <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
            {open ? 'What they will see' : 'The order'}
          </div>
          <Card>
            {request.items.map((item, i) => (
              <SummaryRow
                key={`${item.name}-${i}`}
                label={`${item.quantity} × ${item.name}`}
                hint={item.addons.join(', ') || undefined}
                value={money(item.lineTotal)}
              />
            ))}
            <div style={{ margin: 'var(--gap-sm) 0' }}>
              <DashedDivider />
            </div>
            <SummaryRow
              label="Delivery"
              value={request.deliveryFee <= 0 ? 'Free' : money(request.deliveryFee)}
            />
            {request.serviceFee > 0 && <SummaryRow label="Service fee" value={money(request.serviceFee)} />}
            {request.discount + request.deliveryDiscount > 0 && (
              <SummaryRow
                label="Discount"
                value={`−${money(request.discount + request.deliveryDiscount)}`}
                valueColor="var(--color-success)"
              />
            )}
            <SummaryRow label="Total" value={money(request.total)} emphasise />
          </Card>
          {request.message && (
            <p className="t-body-sm" style={{ margin: 'var(--gap-md) 0 0' }}>
              Your note: “{request.message}”
            </p>
          )}
        </FadeSlideIn>

        {open && (
          <div style={{ marginTop: 'var(--gap-xl)', textAlign: 'center' }}>
            {confirmCancel ? (
              <Card color="var(--color-danger-soft)" shadow="none">
                <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)', color: 'var(--color-danger)', fontWeight: 600 }}>
                  Cancel this link? Nobody will be able to pay it, and the order will not be placed.
                </p>
                <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
                  <Button label="Keep it" kind="outline" size="md" onClick={() => setConfirmCancel(false)} />
                  <Button label="Cancel link" kind="danger" size="md" busy={busy === 'cancel'} onClick={() => void cancel()} />
                </div>
              </Card>
            ) : (
              <button
                type="button"
                className="t-label"
                onClick={() => setConfirmCancel(true)}
                style={{ background: 'none', border: 'none', color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 'var(--gap-sm)' }}
              >
                Cancel this link
              </button>
            )}
          </div>
        )}
      </ScreenBody>

      <StickyFooter>
        {open ? (
          <Button
            label="Send on WhatsApp"
            glow
            icon={<MessageCircle size={19} aria-hidden />}
            onClick={() => openWhatsApp(payRequestShareText(request))}
          />
        ) : (
          <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
            <Button label="Get a new link" glow busy={busy === 'renew'} onClick={() => void renew()} />
            <Button label="Back to home" kind="ghost" onClick={() => navigate('/home', { replace: true })} />
          </div>
        )}
      </StickyFooter>

      {walletPin.sheet}
    </>
  )
}
