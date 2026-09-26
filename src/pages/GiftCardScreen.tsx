/* ═══════════════════════════════════════════════════════════════════════
   One gift card.

   For the buyer: the card, its status, and — behind the wallet PIN — its
   code, with everything needed to send it on: share the image straight to
   WhatsApp, download it, or copy a ready-written message. Just after buying,
   the code is already unlocked (the PIN was entered to pay) and the screen
   opens with a little celebration.

   For whoever redeemed it: the card they were given, and when it landed.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Copy, Download, Eye, Gift, RefreshCw, Share2, ShieldCheck } from 'lucide-react'
import GiftCardArt from '../lib/giftCardArt'
import { ApiError, apiErrorMessage } from '../lib/api'
import { dayAndTime, money } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import {
  getGiftCard,
  giftCardImageUrl,
  giftStatusLabel,
  giftStatusTone,
  qrForCode,
  revealGiftCard,
  shareMessage,
  verifyGiftCard,
  type GiftCard,
} from '../data/giftCards'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { Card, EmptyState, Pill, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { useWalletPin } from '../components/WalletPinSheet'
import { GiftCardView } from '../components/gifts/GiftCardView'
import { Confetti } from '../components/gifts/Confetti'

type Unlocked = { code: string; downloadToken: string; at: number }

// Download links from the backend last ten minutes; ask again a little before.
const TOKEN_LIFE_MS = 9 * 60 * 1000

export default function GiftCardScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const walletPin = useWalletPin()
  const arrived = (location.state ?? {}) as { code?: string; downloadToken?: string; justBought?: boolean }

  const [card, setCard] = useState<GiftCard | null | undefined>(undefined)
  const [unlocked, setUnlocked] = useState<Unlocked | null>(() =>
    arrived.code && arrived.downloadToken ? { code: arrived.code, downloadToken: arrived.downloadToken, at: Date.now() } : null,
  )
  const [busy, setBusy] = useState<'reveal' | 'share' | 'download' | 'verify' | null>(null)
  const [burst, setBurst] = useState(0)

  const load = useCallback(async () => {
    try {
      setCard(await getGiftCard(id))
    } catch {
      setCard(null)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // The code rode in on navigation state; keep it out of history, so going
  // back and forward again does not show it to whoever holds the phone.
  useEffect(() => {
    if (arrived.code) {
      window.history.replaceState({ ...window.history.state, usr: { justBought: arrived.justBought } }, '')
    }
    if (arrived.justBought) setBurst(Date.now())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unlock = async (): Promise<Unlocked | null> => {
    if (unlocked && Date.now() - unlocked.at < TOKEN_LIFE_MS) return unlocked
    const pin = await walletPin.ask()
    if (!pin) return null
    setBusy('reveal')
    try {
      const result = await revealGiftCard(id, pin)
      const next = { ...result, at: Date.now() }
      setUnlocked(next)
      return next
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not unlock this card.'), 'danger')
      return null
    } finally {
      setBusy(null)
    }
  }

  const fetchPng = async (u: Unlocked): Promise<Blob> => {
    const res = await fetch(giftCardImageUrl(id, u.downloadToken))
    if (!res.ok) throw new ApiError(res.status === 403 ? 'That link expired. Unlock the card again.' : 'Could not fetch the card.', res.status)
    return res.blob()
  }

  const download = async () => {
    const u = await unlock()
    if (!u) return
    setBusy('download')
    try {
      const blob = await fetchPng(u)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `blorbmart-gift-card${card?.to ? `-${card.to.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      showToast('Card saved to your downloads.', 'success')
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 403) setUnlocked(null)
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!card) return
    const u = await unlock()
    if (!u) return
    const text = shareMessage(card, u.code, money)
    setBusy('share')
    try {
      const blob = await fetchPng(u)
      const file = new File([blob], 'blorbmart-gift-card.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'A Blorbmart gift card for you' })
      } else if (navigator.share) {
        await navigator.share({ text, title: 'A Blorbmart gift card for you' })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Message copied — paste it wherever you like, with the downloaded card.', 'success')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        if (e instanceof ApiError && e.statusCode === 403) setUnlocked(null)
        showToast(apiErrorMessage(e, 'Could not share the card.'), 'danger')
      }
    } finally {
      setBusy(null)
    }
  }

  const copy = async (what: 'code' | 'message') => {
    const u = await unlock()
    if (!u || !card) return
    await navigator.clipboard.writeText(what === 'code' ? u.code : shareMessage(card, u.code, money))
    showToast(what === 'code' ? 'Code copied.' : 'Message copied.', 'success')
  }

  const checkPayment = async () => {
    setBusy('verify')
    try {
      const result = await verifyGiftCard(id)
      setCard(result.card)
      if (result.code && result.downloadToken) {
        setUnlocked({ code: result.code, downloadToken: result.downloadToken, at: Date.now() })
        setBurst(Date.now())
      }
    } catch (e) {
      showToast(apiErrorMessage(e, 'That payment has not come through yet.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const artInput = useMemo(() => {
    if (!card) return null
    const code = unlocked?.code
    return {
      design: card.design,
      amount: card.amount,
      to: card.to,
      from: card.from,
      message: card.message,
      expiresAt: card.expiresAt?.toISOString(),
      status: card.role === 'sent' && card.status !== 'active' && card.status !== 'pending_payment' ? card.status : undefined,
      ...(code ? { code, ...qrForCode(code) } : { maskedCode: card.codeMasked ?? undefined }),
    }
  }, [card, unlocked?.code])

  if (card === undefined) {
    return (
      <>
        <AppBar title="Gift card" />
        <ScreenBody padded>
          <Skeleton height={230} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-xl)' }} />
        </ScreenBody>
      </>
    )
  }

  if (card === null || !artInput) {
    return (
      <>
        <AppBar title="Gift card" />
        <EmptyState
          title="We could not find that card"
          message="It may belong to another account."
          icon={<Gift size={30} aria-hidden />}
          actionLabel="Gift cards"
          onAction={() => navigate('/gifts')}
        />
      </>
    )
  }

  const theme = GiftCardArt.THEMES.find((t) => t.id === card.design.theme)
  const headline = card.design.headline || theme?.headline || 'Gift card'
  const isBuyer = card.role === 'sent'
  const live = card.status === 'active' || card.status === 'redeemed'

  return (
    <>
      <Confetti burst={burst} />
      <AppBar title={headline} subtitle={card.to ? `For ${card.to}` : undefined} />

      <ScreenBody padded bottomGap="var(--gap-giant)">
        {arrived.justBought && (
          <FadeSlideIn>
            <div style={{ textAlign: 'center', margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
              <h2 style={{ margin: 0, font: '600 26px/1.15 Fraunces, Georgia, serif' }}>Your gift card is ready</h2>
              <p className="t-body-sm" style={{ margin: 'var(--gap-xs) 0 0' }}>
                {card.to ? `Now send it to ${card.to} — ` : 'Now send it on — '}share it, download it, or copy the code.
              </p>
            </div>
          </FadeSlideIn>
        )}

        <div style={{ maxWidth: 520, margin: 'var(--gap-xl) auto 0' }}>
          <GiftCardView input={artInput} tilt />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)', flexWrap: 'wrap' }}>
          <Pill tone={giftStatusTone(card.status)} label={isBuyer ? giftStatusLabel(card.status) : 'Added to your wallet'} />
          {card.expiresAt && card.status === 'active' && <Pill tone="neutral" label={`Valid until ${GiftCardArt.formatDate(card.expiresAt.toISOString())}`} />}
        </div>

        {/* ── Awaiting payment ─────────────────────────────────────────── */}
        {isBuyer && card.status === 'pending_payment' && (
          <Card style={{ marginTop: 'var(--gap-xl)' }} color="var(--color-warning-soft)" shadow="none">
            <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
              We are waiting to hear from Paystack. If you paid, this card goes live on its own within a minute — the code
              only exists once the payment is confirmed.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
              <Button label="Check again" size="md" kind="soft" busy={busy === 'verify'} icon={<RefreshCw size={16} aria-hidden />} onClick={() => void checkPayment()} />
              {card.authorizationUrl && (
                <Button
                  label="Finish paying"
                  size="md"
                  onClick={() =>
                    goToPaystack(card.authorizationUrl!, { kind: 'gift', reference: card.reference, id: card.id, returnTo: `/gifts/${card.id}` })
                  }
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Send it ──────────────────────────────────────────────────── */}
        {isBuyer && live && (
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            {unlocked ? (
              <Card padding="var(--gap-lg)">
                <div className="t-overline">Gift code</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', marginTop: 6 }}>
                  <span
                    style={{
                      flex: 1,
                      font: "700 clamp(19px, 5.6vw, 24px)/1.2 'JetBrains Mono', var(--font-mono)",
                      letterSpacing: '0.06em',
                      color: card.status === 'active' ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                      textDecoration: card.status === 'active' ? undefined : 'line-through',
                      userSelect: 'all',
                    }}
                  >
                    {unlocked.code}
                  </span>
                  <Button label="Copy" size="sm" kind="soft" expand={false} icon={<Copy size={15} aria-hidden />} onClick={() => void copy('code')} />
                </div>
              </Card>
            ) : (
              <Button
                label="Show code"
                kind="soft"
                busy={busy === 'reveal'}
                icon={<Eye size={18} aria-hidden />}
                onClick={() => void unlock()}
              />
            )}

            {card.status === 'active' && (
              <>
                <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
                  <Button label="Share" glow busy={busy === 'share'} icon={<Share2 size={18} aria-hidden />} onClick={() => void share()} />
                  <Button label="Download" kind="outline" busy={busy === 'download'} icon={<Download size={18} aria-hidden />} onClick={() => void download()} />
                </div>
                <button
                  type="button"
                  onClick={() => void copy('message')}
                  className="t-label"
                  style={{ display: 'block', margin: 'var(--gap-md) auto 0', background: 'none', border: 'none', color: 'var(--color-brand)', cursor: 'pointer' }}
                >
                  Copy a message to send with it
                </button>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--gap-sm)',
                    alignItems: 'flex-start',
                    marginTop: 'var(--gap-lg)',
                    padding: 'var(--gap-md)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-sunken)',
                  }}
                >
                  <ShieldCheck size={18} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
                  <p className="t-caption" style={{ margin: 0 }}>
                    The code works like cash: whoever has it can redeem it, once. Send it only to the person it is for.
                    Blorbmart will never ask you for it.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Details ──────────────────────────────────────────────────── */}
        <Card style={{ marginTop: 'var(--gap-xl)' }}>
          <SummaryRow label="Value" value={money(card.amount)} emphasise />
          {card.to && <SummaryRow label="To" value={card.to} />}
          {card.from && <SummaryRow label="From" value={card.from} />}
          {isBuyer && card.createdAt && <SummaryRow label="Bought" value={dayAndTime(card.createdAt)} />}
          {card.redeemedAt && <SummaryRow label="Redeemed" value={dayAndTime(card.redeemedAt)} />}
          {isBuyer && <SummaryRow label="Paid with" value={card.paymentMethod === 'wallet' ? 'Wallet' : 'Card or transfer'} />}
          {isBuyer && card.recipientEmail && (
            <SummaryRow label="Emailed to" value={`${card.recipientEmail}${card.emailSentAt ? '' : ' (sending)'}`} />
          )}
          {isBuyer && card.reference && <SummaryRow label="Reference" value={card.reference} />}
        </Card>

        {card.message && (
          <Card style={{ marginTop: 'var(--gap-md)' }} color="var(--color-surface-sunken)" shadow="none">
            <p style={{ margin: 0, font: '600 22px/1.3 Caveat, cursive', color: 'var(--color-ink)' }}>“{card.message}”</p>
            {card.from && <p style={{ margin: '4px 0 0', font: '600 19px/1.2 Caveat, cursive', color: 'var(--color-ink-muted)' }}>— {card.from}</p>}
          </Card>
        )}

        <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xl)' }}>
          <Button label="Send another" kind="outline" size="md" onClick={() => navigate('/gifts/new')} />
          <Button label="All gift cards" kind="ghost" size="md" onClick={() => navigate('/gifts')} />
        </div>
      </ScreenBody>

      {walletPin.sheet}
    </>
  )
}
