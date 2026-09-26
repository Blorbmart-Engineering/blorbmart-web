/* ═══════════════════════════════════════════════════════════════════════
   Making a gift card.

   The card sits pinned at the top and redraws on every keystroke — the
   occasion, the amount, their name, your note, the colours. It shrinks as
   the form scrolls under it, so it stays in view without crowding the
   fields on a phone.

   Paying from the wallet asks for the PIN first, and comes back with the
   card already live. Paying by card goes through Paystack, and the code is
   minted only once Paystack confirms the charge.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Mail, Wallet } from 'lucide-react'
import GiftCardArt, { type GiftDesign } from '../lib/giftCardArt'
import { apiErrorMessage, warmUp } from '../lib/api'
import { money } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import { balance, invalidateBalance, watchLiveBalance } from '../data/wallet'
import { GIFT_AMOUNTS, newGiftIdempotencyKey, purchaseGiftCard } from '../data/giftCards'
import { fullName, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, StickyFooter } from '../ui/Screen'
import { Card, DashedDivider, SummaryRow } from '../ui/kit'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'
import { useWalletPin } from '../components/WalletPinSheet'
import { GiftCardView } from '../components/gifts/GiftCardView'

const { LIMITS, THEMES, PALETTES, MOTIFS, TYPES } = GiftCardArt

function designFor(themeId: string): GiftDesign {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  return { theme: theme.id, palette: theme.palette, motif: theme.motif, type: theme.type, headline: theme.headline }
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

export default function GiftComposeScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSessionStore()
  const walletPin = useWalletPin()

  const [design, setDesign] = useState<GiftDesign>(() => designFor(params.get('theme') ?? 'birthday'))
  const [amount, setAmount] = useState(5000)
  const [otherAmount, setOtherAmount] = useState('')
  const [to, setTo] = useState('')
  // The first name only — and nothing at all rather than the "there" that
  // firstName() falls back to for a greeting.
  const [from, setFrom] = useState(() => fullName(session).split(' ')[0] ?? '')
  const [message, setMessage] = useState('')
  const [styleOpen, setStyleOpen] = useState(() => params.get('theme') === 'custom')
  const [emailIt, setEmailIt] = useState(false)
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState<PayMethod>('wallet')
  const [walletBalance, setWalletBalance] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const idempotencyKey = useRef(newGiftIdempotencyKey())
  useBackFromPaystack(() => setBusy(false))

  useEffect(() => {
    warmUp()
    void balance().then(setWalletBalance)
    return watchLiveBalance(setWalletBalance)
  }, [])

  // The preview shrinks once the form has scrolled under it.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A new idempotency key whenever what is being bought changes, so a retry
  // of the same card replays and a different card is a different purchase.
  useEffect(() => {
    idempotencyKey.current = newGiftIdempotencyKey()
  }, [design, amount, to, from, message, email, emailIt, method])

  const theme = THEMES.find((t) => t.id === design.theme) ?? THEMES[0]
  const cleanMessage = GiftCardArt.cleanText(message, LIMITS.message)
  const droppedSomething = message.trim().length > 0 && cleanMessage.length < Array.from(message.trim().replace(/\s+/g, ' ')).length

  const amountError =
    amount < GIFT_AMOUNTS.min
      ? `Gift cards start at ${money(GIFT_AMOUNTS.min)}.`
      : amount > GIFT_AMOUNTS.max
        ? `A card can hold up to ${money(GIFT_AMOUNTS.max)}.`
        : amount % GIFT_AMOUNTS.step !== 0
          ? 'Choose an amount in steps of ₦100.'
          : null
  const emailError = emailIt && email.trim() && !EMAIL.test(email.trim()) ? 'That email address does not look right.' : null
  const short = method === 'wallet' && walletBalance < amount
  const canPay = !amountError && !emailError && !(emailIt && !email.trim()) && !short

  const preview = useMemo(
    () => ({ design, amount, to, from, message }),
    [design, amount, to, from, message],
  )

  const pickTheme = (id: string) => {
    setDesign(designFor(id))
    if (id === 'custom') setStyleOpen(true)
  }

  const submit = async () => {
    if (!canPay || busy) return
    let pin: string | undefined
    if (method === 'wallet') {
      pin = (await walletPin.ask(money(amount))) ?? undefined
      if (!pin) return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await purchaseGiftCard({
        amount,
        design,
        to,
        from,
        message,
        recipientEmail: emailIt ? email.trim() : undefined,
        paymentMethod: method,
        pin,
        idempotencyKey: idempotencyKey.current,
      })
      if (result.authorizationUrl && result.reference) {
        goToPaystack(result.authorizationUrl, {
          kind: 'gift',
          reference: result.reference,
          id: result.card.id,
          returnTo: `/gifts/${result.card.id}`,
        })
        return
      }
      invalidateBalance()
      navigate(`/gifts/${result.card.id}`, {
        replace: true,
        state: { code: result.code, downloadToken: result.downloadToken, justBought: true },
      })
    } catch (e) {
      setBusy(false)
      setError(apiErrorMessage(e, 'That did not go through. You have not been charged.'))
    }
  }

  return (
    <>
      <AppBar title="New gift card" subtitle={theme.name} />

      {/* ── The card, pinned ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 'calc(var(--safe-top) + 64px)',
          zIndex: 10,
          padding: compact ? 'var(--gap-sm) var(--gap-page)' : 'var(--gap-lg) var(--gap-page) var(--gap-md)',
          background: 'var(--color-canvas)',
          borderBottom: compact ? '1px solid var(--color-line)' : '1px solid transparent',
          boxShadow: compact ? 'var(--shadow-sm)' : 'none',
          transition: 'padding var(--dur-normal) var(--ease-emphasized), box-shadow var(--dur-normal)',
        }}
      >
        <div
          style={{
            width: compact ? '58%' : '100%',
            maxWidth: 460,
            margin: '0 auto',
            transition: 'width var(--dur-normal) var(--ease-emphasized)',
          }}
        >
          <GiftCardView input={preview} tilt />
        </div>
      </div>

      <ScreenBody bottomGap="var(--gap-xxl)">
        {/* ── Occasion ───────────────────────────────────────────────── */}
        <Label>Occasion</Label>
        <div className="no-scrollbar" style={{ display: 'flex', gap: 'var(--gap-md)', overflowX: 'auto', padding: '6px var(--gap-page) var(--gap-sm)' }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="gift-occasion"
              aria-pressed={design.theme === t.id}
              onClick={() => pickTheme(t.id)}
            >
              <GiftCardView glow input={{ design: { theme: t.id }, amount }} />
              <span className="t-label-sm clamp-1" style={{ display: 'block', marginTop: 8 }}>
                {t.name}
              </span>
            </button>
          ))}
        </div>

        {/* ── Amount ─────────────────────────────────────────────────── */}
        <Label>Amount</Label>
        <div style={{ padding: '0 var(--gap-page)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
            {GIFT_AMOUNTS.presets.map((value) => (
              <button
                key={value}
                type="button"
                className="gift-chip"
                aria-pressed={!otherAmount && amount === value}
                onClick={() => {
                  setOtherAmount('')
                  setAmount(value)
                }}
              >
                {money(value)}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', marginTop: 'var(--gap-md)' }}>
            <span className="t-price" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)' }}>
              ₦
            </span>
            <input
              className="gift-input"
              inputMode="numeric"
              placeholder="Another amount"
              aria-label="Another amount"
              value={otherAmount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 7)
                setOtherAmount(digits)
                setAmount(Number(digits) || 0)
              }}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <p className="t-caption" style={{ margin: '6px 0 0', color: amountError && otherAmount ? 'var(--color-danger)' : undefined }}>
            {amountError && otherAmount ? amountError : `From ${money(GIFT_AMOUNTS.min)} to ${money(GIFT_AMOUNTS.max)}, in steps of ₦100.`}
          </p>
        </div>

        {/* ── Words ──────────────────────────────────────────────────── */}
        <Label>Your words</Label>
        <div style={{ padding: '0 var(--gap-page)', display: 'grid', gap: 'var(--gap-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            <TextField label="To" value={to} onChange={setTo} max={LIMITS.name} placeholder="Their name" />
            <TextField label="From" value={from} onChange={setFrom} max={LIMITS.name} placeholder="Your name" />
          </div>
          <label style={{ display: 'block' }}>
            <span className="t-label-sm" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>A note for them</span>
              <span style={{ color: 'var(--color-ink-faint)' }}>
                {Array.from(message).length}/{LIMITS.message}
              </span>
            </span>
            <textarea
              className="gift-input gift-input--hand"
              rows={3}
              maxLength={LIMITS.message}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Have the best day ever — dinner is on me!"
            />
            {droppedSomething && (
              <span className="t-caption" style={{ display: 'block', marginTop: 4 }}>
                Emoji and some symbols do not print on the card, so we have left them off.
              </span>
            )}
          </label>
          <TextField
            label="Headline"
            value={design.headline}
            onChange={(v) => setDesign((d) => ({ ...d, headline: v }))}
            max={LIMITS.headline}
            placeholder={theme.headline}
          />
        </div>

        {/* ── Style ──────────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--gap-xl) var(--gap-page) 0' }}>
          <button
            type="button"
            onClick={() => setStyleOpen((o) => !o)}
            aria-expanded={styleOpen}
            className="press"
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-line-strong)',
              background: 'var(--color-surface)',
              cursor: 'pointer',
            }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span className="t-h4" style={{ display: 'block' }}>Make it yours</span>
              <span className="t-caption">Colours, artwork and lettering</span>
            </span>
            <ChevronDown size={20} aria-hidden style={{ transform: styleOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--dur-fast)' }} />
          </button>
        </div>
        {styleOpen && (
          <div style={{ padding: 'var(--gap-md) var(--gap-page) 0' }}>
            <div className="t-label-sm" style={{ margin: 'var(--gap-sm) 0' }}>Colours</div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 'var(--gap-md)', overflowX: 'auto', padding: '4px 2px 8px' }}>
              {Object.entries(PALETTES).map(([id, p]) => (
                <button
                  key={id}
                  type="button"
                  className="gift-swatch"
                  aria-pressed={design.palette === id}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => setDesign((d) => ({ ...d, palette: id }))}
                  style={{ background: `conic-gradient(from 200deg, ${p.bg[0]}, ${p.bg[2]}, ${p.foil[1]}, ${p.bg[0]})` }}
                />
              ))}
            </div>

            <div className="t-label-sm" style={{ margin: 'var(--gap-md) 0 var(--gap-sm)' }}>Artwork</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
              {Object.entries(MOTIFS).map(([id, name]) => (
                <button key={id} type="button" className="gift-chip" aria-pressed={design.motif === id} onClick={() => setDesign((d) => ({ ...d, motif: id }))}>
                  {name}
                </button>
              ))}
            </div>

            <div className="t-label-sm" style={{ margin: 'var(--gap-lg) 0 var(--gap-sm)' }}>Lettering</div>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
              {Object.entries(TYPES).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className="gift-chip"
                  aria-pressed={design.type === id}
                  onClick={() => setDesign((d) => ({ ...d, type: id }))}
                  style={{
                    fontFamily: id === 'serif' ? 'Fraunces, serif' : id === 'script' ? "'Great Vibes', cursive" : undefined,
                    fontSize: id === 'script' ? 21 : undefined,
                    fontStyle: id === 'serif' ? 'italic' : undefined,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Delivery ───────────────────────────────────────────────── */}
        <Label>Delivery</Label>
        <div style={{ padding: '0 var(--gap-page)' }}>
          <Card padding="var(--gap-lg)" shadow="none" border="var(--color-line)">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', cursor: 'pointer' }}>
              <Mail size={20} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span className="t-h4" style={{ display: 'block' }}>Email it to them too</span>
                <span className="t-caption">Sent the moment it is paid for. You can always share it yourself.</span>
              </span>
              <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--color-brand)' }} />
            </label>
            {emailIt && (
              <div style={{ marginTop: 'var(--gap-md)' }}>
                <input
                  className="gift-input"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="their@email.com"
                  aria-label="Their email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {emailError && (
                  <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>{emailError}</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Payment ────────────────────────────────────────────────── */}
        <Label>Pay with</Label>
        <div style={{ padding: '0 var(--gap-page)' }}>
          <PaymentMethodTile
            method="wallet"
            selected={method === 'wallet'}
            onSelect={() => setMethod('wallet')}
            title="Blorbmart wallet"
            subtitle={`Balance ${money(walletBalance)}`}
            disabled={walletBalance < amount}
            disabledReason={walletBalance < amount ? `Short by ${money(amount - walletBalance)}` : undefined}
            icon={<Wallet size={20} aria-hidden />}
          />
          <div style={{ height: 'var(--gap-sm)' }} />
          <PaymentMethodTile
            method="paystack"
            selected={method === 'paystack'}
            onSelect={() => setMethod('paystack')}
            title="Card or transfer"
            subtitle="Secured by Paystack"
          />

          <Card style={{ marginTop: 'var(--gap-xl)' }}>
            <SummaryRow label={`${theme.name} gift card`} value={money(amount || 0)} />
            <SummaryRow label="Fees" value="None" />
            <div style={{ margin: 'var(--gap-sm) 0' }}>
              <DashedDivider />
            </div>
            <SummaryRow label="You pay" value={money(amount || 0)} emphasise />
          </Card>
          <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0' }}>
            They get the full {money(amount || 0)}. Cards are valid for 12 months and can be redeemed once, into any Blorbmart wallet.
          </p>

          {error && (
            <p
              role="alert"
              className="t-body-sm"
              style={{
                margin: 'var(--gap-lg) 0 0',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          )}
        </div>
      </ScreenBody>

      <StickyFooter>
        <Button
          label={amountError ? 'Choose an amount' : `Pay ${money(amount)}`}
          busy={busy}
          disabled={!canPay}
          glow
          onClick={() => void submit()}
        />
      </StickyFooter>

      {walletPin.sheet}
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-overline" style={{ margin: 'var(--gap-xl) var(--gap-page) var(--gap-sm)' }}>
      {children}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
}) {
  return (
    <label style={{ display: 'block', flex: 1, minWidth: 0 }}>
      <span className="t-label-sm" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      <input className="gift-input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
