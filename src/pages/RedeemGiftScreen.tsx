/* ═══════════════════════════════════════════════════════════════════════
   Redeeming a gift card — the other half of the gift.

   Reached by typing a code, or by scanning the QR on a card, which opens
   /gift#<code>. The code rides in the fragment so it never reaches a server
   log, and it is wiped from the address bar the moment it is read.

   Signed out is fine: a friend can see their card — wrapped, with their name
   on it — before being asked to make an account. The unwrap is the moment
   the whole feature exists for, so it gets a flip and some confetti.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheckBig, Gift, ScanLine, ShoppingBag, Wallet } from 'lucide-react'
import GiftCardArt from '../lib/giftCardArt'
import { ApiError, apiErrorMessage, warmUp } from '../lib/api'
import { money } from '../lib/format'
import { invalidateBalance } from '../data/wallet'
import { checkGiftCode, formatCodeInput, redeemGiftCode, type GiftPreview } from '../data/giftCards'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { Card } from '../ui/kit'
import { FadeSlideIn, useAnimatedNumber } from '../ui/motion'
import { GiftCardBack, GiftCardView } from '../components/gifts/GiftCardView'
import { Confetti } from '../components/gifts/Confetti'

/** Holds a code across a sign-in, for this tab only. */
const PENDING_KEY = 'blorb_gift_code_v1'

type Stage =
  | { kind: 'enter' }
  | { kind: 'preview'; code: string; gift: GiftPreview; open: boolean }
  | { kind: 'done'; amount: number; balance: number; gift: GiftPreview }

const statusLine: Record<string, string> = {
  redeemed: 'This gift card has already been redeemed.',
  expired: 'This gift card has expired.',
  revoked: 'This gift card has been cancelled.',
  pending_payment: 'This gift card is not ready yet — its payment has not gone through.',
}

export default function RedeemGiftScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const ready = useSessionStore((s) => s.ready)
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<Stage>({ kind: 'enter' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [burst, setBurst] = useState(0)
  const [shake, setShake] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const check = useCallback(async (raw: string) => {
    const value = formatCodeInput(raw)
    if (value.length < 19) {
      setError('Gift codes are 16 letters and numbers.')
      setShake((n) => n + 1)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const gift = await checkGiftCode(value)
      setStage({ kind: 'preview', code: value, gift, open: false })
    } catch (e) {
      setError(apiErrorMessage(e, 'We could not check that code.'))
      setShake((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }, [])

  // A code from the QR (the fragment) or from before a sign-in.
  useEffect(() => {
    warmUp()
    let found = ''
    const hash = window.location.hash.slice(1)
    if (hash) {
      try {
        found = decodeURIComponent(hash)
      } catch {
        found = hash
      }
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    if (!found) {
      try {
        found = sessionStorage.getItem(PENDING_KEY) ?? ''
        sessionStorage.removeItem(PENDING_KEY)
      } catch {
        /* storage blocked: they can type it */
      }
    }
    if (found) {
      const formatted = formatCodeInput(found)
      setCode(formatted)
      if (formatted.length === 19) void check(formatted)
    } else {
      input.current?.focus()
    }
  }, [check])

  const unwrap = () => {
    if (stage.kind !== 'preview' || stage.open) return
    setStage({ ...stage, open: true })
    if (stage.gift.redeemable) setTimeout(() => setBurst(Date.now()), 450)
  }

  const redeem = async () => {
    if (stage.kind !== 'preview') return
    if (!signedIn) {
      try {
        sessionStorage.setItem(PENDING_KEY, stage.code)
      } catch {
        /* they will have to type it again */
      }
      navigate('/login', { state: { from: '/gift' } })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await redeemGiftCode(stage.code)
      invalidateBalance()
      setStage({ kind: 'done', amount: result.amount, balance: result.balanceAfter, gift: stage.gift })
      setBurst(Date.now())
    } catch (e) {
      setError(apiErrorMessage(e, 'That did not go through. Nothing was added or taken.'))
      if (e instanceof ApiError && e.code === 'GIFT_CARD_USED') {
        setStage({ ...stage, gift: { ...stage.gift, status: 'redeemed', redeemable: false } })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Confetti burst={burst} />
      <AppBar title="Redeem a gift card" onBack={() => navigate(signedIn ? '/wallet' : '/home')} />

      <ScreenBody padded bottomGap="var(--gap-giant)">
        {stage.kind === 'enter' && (
          <FadeSlideIn>
            <div style={{ textAlign: 'center', margin: 'var(--gap-xxl) 0 var(--gap-xl)' }}>
              <span
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, #FF4FB8, #7C5CFF 55%, #22D3EE)',
                  color: '#fff',
                  boxShadow: '0 16px 32px -14px rgba(124, 92, 255, 0.7)',
                }}
              >
                <Gift size={34} aria-hidden />
              </span>
              <h2 style={{ margin: 'var(--gap-lg) 0 var(--gap-xs)', font: '600 28px/1.15 Fraunces, Georgia, serif' }}>
                Someone sent you a gift?
              </h2>
              <p className="t-body-sm" style={{ margin: '0 auto', maxWidth: 320 }}>
                Enter the code from your card and its value goes straight into your Blorbmart wallet.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void check(code)
              }}
            >
              <label htmlFor="gift-code" className="t-label-sm" style={{ display: 'block', marginBottom: 8 }}>
                Gift code
              </label>
              <input
                id="gift-code"
                key={shake}
                ref={input}
                className="gift-code-input"
                value={code}
                onChange={(e) => {
                  setCode(formatCodeInput(e.target.value))
                  if (error) setError(null)
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-invalid={Boolean(error)}
                aria-describedby="gift-code-help"
              />
              <p
                id="gift-code-help"
                role={error ? 'alert' : undefined}
                className="t-caption"
                style={{ margin: '8px 0 var(--gap-xl)', color: error ? 'var(--color-danger)' : undefined, fontWeight: error ? 600 : undefined }}
              >
                {error ?? 'Letters and numbers, as printed on the card. Dashes are added for you.'}
              </p>
              <Button label="Check my gift" type="submit" busy={busy} disabled={code.length < 19} glow />
            </form>

            <Card style={{ marginTop: 'var(--gap-xxl)' }} color="var(--color-brand-softer)" shadow="none" border="var(--color-brand-soft)">
              <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
                <ScanLine size={22} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                <p className="t-body-sm" style={{ margin: 0 }}>
                  Got the card as an image? Point your phone’s camera at the QR code on it and it opens right here with the code filled in.
                </p>
              </div>
            </Card>
          </FadeSlideIn>
        )}

        {stage.kind === 'preview' && (
          <FadeSlideIn>
            <div style={{ textAlign: 'center', margin: 'var(--gap-xl) 0 var(--gap-lg)' }}>
              <div className="t-overline" style={{ color: 'var(--color-brand)' }}>
                {stage.gift.from ? `From ${stage.gift.from}` : 'A gift for you'}
              </div>
              <h2 style={{ margin: '6px 0 0', font: '600 26px/1.15 Fraunces, Georgia, serif' }}>
                {stage.open ? `${money(stage.gift.amount)} to spend` : stage.gift.to ? `${stage.gift.to}, this is for you` : 'This is for you'}
              </h2>
            </div>

            <div
              className="gift-flip"
              data-open={stage.open}
              style={{ maxWidth: 520, margin: '0 auto' }}
              onClick={unwrap}
              role={stage.open ? undefined : 'button'}
              aria-label={stage.open ? undefined : 'Unwrap your gift'}
              tabIndex={stage.open ? undefined : 0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && unwrap()}
            >
              <div className="gift-flip__inner">
                <div className="gift-flip__face gift-flip__face--back">
                  <GiftCardBack input={{ design: stage.gift.design, amount: stage.gift.amount, to: stage.gift.to }} />
                </div>
                <div className="gift-flip__face gift-flip__face--front">
                  <GiftCardView
                    tilt={stage.open}
                    input={{
                      design: stage.gift.design,
                      amount: stage.gift.amount,
                      to: stage.gift.to,
                      from: stage.gift.from,
                      message: stage.gift.message,
                      expiresAt: stage.gift.expiresAt?.toISOString(),
                      maskedCode: `••••-••••-••••-${stage.code.slice(-4)}`,
                      note: stage.gift.redeemable ? 'Yours to redeem' : 'No longer valid',
                      status: stage.gift.redeemable ? undefined : stage.gift.status,
                    }}
                  />
                </div>
              </div>
            </div>

            {!stage.open ? (
              <div style={{ marginTop: 'var(--gap-xl)' }}>
                <Button label="Unwrap it" glow icon={<Gift size={18} aria-hidden />} onClick={unwrap} />
              </div>
            ) : (
              <FadeSlideIn delay={500}>
                {stage.gift.message && (
                  <Card style={{ marginTop: 'var(--gap-xl)' }} color="var(--color-surface-sunken)" shadow="none">
                    <p style={{ margin: 0, font: '600 23px/1.3 Caveat, cursive', color: 'var(--color-ink)' }}>“{stage.gift.message}”</p>
                    {stage.gift.from && (
                      <p style={{ margin: '4px 0 0', font: '600 20px/1.2 Caveat, cursive', color: 'var(--color-ink-muted)' }}>— {stage.gift.from}</p>
                    )}
                  </Card>
                )}

                {stage.gift.redeemable ? (
                  <div style={{ marginTop: 'var(--gap-xl)' }}>
                    <Button
                      label={signedIn ? `Add ${money(stage.gift.amount)} to my wallet` : `Sign in to add ${money(stage.gift.amount)}`}
                      glow
                      busy={busy || !ready}
                      icon={<Wallet size={18} aria-hidden />}
                      onClick={() => void redeem()}
                    />
                    {!signedIn && (
                      <p className="t-caption" style={{ textAlign: 'center', margin: 'var(--gap-sm) 0 0' }}>
                        New to Blorbmart? Making an account takes a minute, and your gift waits for you.
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    role="alert"
                    className="t-body-sm"
                    style={{ marginTop: 'var(--gap-xl)', padding: 'var(--gap-md) var(--gap-lg)', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontWeight: 600 }}
                  >
                    {statusLine[stage.gift.status] ?? 'This gift card cannot be redeemed.'}
                  </p>
                )}
                {error && (
                  <p role="alert" className="t-caption" style={{ margin: 'var(--gap-md) 0 0', color: 'var(--color-danger)', fontWeight: 600, textAlign: 'center' }}>
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStage({ kind: 'enter' })
                    setCode('')
                    setError(null)
                  }}
                  className="t-label"
                  style={{ display: 'block', margin: 'var(--gap-lg) auto 0', background: 'none', border: 'none', color: 'var(--color-ink-muted)', cursor: 'pointer' }}
                >
                  Use a different code
                </button>
              </FadeSlideIn>
            )}
          </FadeSlideIn>
        )}

        {stage.kind === 'done' && <Done amount={stage.amount} balance={stage.balance} gift={stage.gift} />}
      </ScreenBody>
    </>
  )
}

function Done({ amount, balance, gift }: { amount: number; balance: number; gift: GiftPreview }) {
  const navigate = useNavigate()
  const shown = useAnimatedNumber(amount, 900)
  const theme = GiftCardArt.THEMES.find((t) => t.id === gift.design.theme)
  return (
    <FadeSlideIn>
      <div style={{ textAlign: 'center', marginTop: 'var(--gap-xxl)' }}>
        <span
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: 'var(--color-success-soft)',
            color: 'var(--color-success)',
            boxShadow: '0 0 0 10px rgba(15,169,104,0.08)',
          }}
        >
          <CircleCheckBig size={44} aria-hidden />
        </span>
        <div className="t-overline" style={{ marginTop: 'var(--gap-xl)', color: 'var(--color-success)' }}>
          Added to your wallet
        </div>
        <div style={{ font: '700 clamp(44px, 13vw, 56px)/1.05 Fraunces, Georgia, serif', margin: '6px 0' }}>{money(shown)}</div>
        <p className="t-body-sm" style={{ margin: 0 }}>
          {gift.from ? `${gift.from}’s ${theme?.name.toLowerCase() ?? 'gift'} card` : 'Your gift card'} is now in your wallet. New balance {money(balance)}.
        </p>
      </div>
      <div style={{ width: '62%', maxWidth: 300, margin: 'var(--gap-xxl) auto 0' }}>
        <GiftCardView
          input={{ design: gift.design, amount: gift.amount, to: gift.to, from: gift.from, maskedCode: '••••-••••-••••-••••', note: 'In your wallet' }}
        />
      </div>
      <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xxl)' }}>
        <Button label="Start shopping" glow icon={<ShoppingBag size={18} aria-hidden />} onClick={() => navigate('/home')} />
        <Button label="See my wallet" kind="outline" icon={<Wallet size={18} aria-hidden />} onClick={() => navigate('/wallet')} />
      </div>
    </FadeSlideIn>
  )
}
