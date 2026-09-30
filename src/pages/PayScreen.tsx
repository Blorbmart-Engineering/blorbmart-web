/* ═══════════════════════════════════════════════════════════════════════
   /pay/<token> — the page a pay-for-me link opens.

   Whoever lands here was sent the link by somebody they know, and may never
   have heard of Blorbmart. So the page asks for nothing but an email for the
   receipt: no account, no app. It says who is asking, what for and how much,
   and sends them to Paystack. Paystack sends them back here with the
   reference in the address, and that is what confirms the payment.

   A payer who does have an account can use their wallet instead.

   Public, and outside the shell.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleAlert, CircleCheckBig, Clock, ShieldCheck, Store, Wallet } from 'lucide-react'
import { ApiError, apiErrorMessage, warmUp } from '../lib/api'
import { money } from '../lib/format'
import { referenceFromUrl } from '../lib/payment'
import { MARK_PATH, MARK_VIEWBOX } from '../ui/mark'
import {
  payRequestFromWallet,
  startPayRequestCard,
  verifyPayRequest,
  viewPayRequest,
  type PayOutcome,
  type PayRequest,
} from '../data/payRequests'
import { balance, invalidateBalance } from '../data/wallet'
import { isSignedIn, sessionEmail, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, DashedDivider, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn } from '../ui/motion'
import { PageLoader } from '../ui/Loader'
import { ScreenBody, StickyFooter } from '../ui/Screen'
import { useWalletPin } from '../components/WalletPinSheet'

const POLL_MS = 10_000
/** How long to keep asking about a payment Paystack has not confirmed yet. */
const CONFIRM_TRIES = 12
const CONFIRM_EVERY_MS = 3000

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'offline' }
  | { kind: 'ready'; request: PayRequest }

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export default function PayScreen() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const session = useSessionStore()
  const signedIn = isSignedIn(session)

  const [state, setState] = useState<Loaded>({ kind: 'loading' })
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'card' | 'wallet' | null>(null)
  const [confirming, setConfirming] = useState(false)
  /** Set when this visitor's own payment has just been settled. */
  const [outcome, setOutcome] = useState<PayOutcome | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const walletPin = useWalletPin()
  // Read once, before the address is tidied below.
  const [reference] = useState(() => referenceFromUrl())

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', request: await viewPayRequest(token) })
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) {
        setState({ kind: 'missing' })
        return
      }
      // A blip while the page is open leaves what is on screen alone; only a
      // first load with nothing to show says so.
      console.warn('[pay] load failed', e)
      setState((current) => (current.kind === 'ready' ? current : { kind: 'offline' }))
    }
  }, [token])

  // Back from Paystack: the reference in the address is what gets confirmed.
  // Paystack can take a few seconds to call a charge successful, so a
  // "not yet" is asked again rather than shown as a failure. Confirming is
  // safe to repeat, so nothing here guards against running twice.
  useEffect(() => {
    warmUp()
    if (!reference) {
      void load()
      return
    }
    // The reference has done its job; a refresh must not carry it along.
    window.history.replaceState(window.history.state, '', window.location.pathname)

    let cancelled = false
    const run = async () => {
      setConfirming(true)
      try {
        for (let attempt = 0; attempt < CONFIRM_TRIES && !cancelled; attempt += 1) {
          const result = await verifyPayRequest(token, reference)
          if (cancelled) return
          setState({ kind: 'ready', request: result.request })
          if (result.outcome !== 'pending') {
            setOutcome(result.outcome)
            if (result.outcome === 'failed') setError('That payment did not go through. Nothing was charged.')
            return
          }
          await sleep(CONFIRM_EVERY_MS)
        }
        if (!cancelled) {
          setError('We have not been able to confirm that payment yet. If you were charged, it will be applied shortly. There is no need to pay again.')
        }
      } catch (e) {
        if (cancelled) return
        setError(apiErrorMessage(e, 'We could not confirm that payment. If you were charged, it will be applied shortly.'))
        void load()
      } finally {
        if (!cancelled) setConfirming(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, reference, load])

  // Someone else may pay the same link while this page is open.
  const open = state.kind === 'ready' && state.request.status === 'open'
  useEffect(() => {
    if (!open || confirming) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [open, confirming, load])

  // A signed-in payer: their email is known, and their wallet is an option.
  const knownEmail = signedIn ? sessionEmail(session) : ''
  useEffect(() => {
    if (!signedIn) return
    void balance().then(setWalletBalance)
  }, [signedIn])

  const request = state.kind === 'ready' ? state.request : null

  const refused = (e: unknown, fallback: string) => {
    setError(apiErrorMessage(e, fallback))
    // Each of these means the page is out of date; draw it again.
    if (e instanceof ApiError && ['PRICE_CHANGED', 'ALREADY_PAID', 'EXPIRED', 'CANCELLED', 'STORE_UNAVAILABLE'].includes(e.code ?? '')) {
      void load()
    }
  }

  const payByCard = async () => {
    if (!request || busy) return
    const address = (email || knownEmail).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      setError('Enter your email address. Your receipt is sent there.')
      return
    }
    setBusy('card')
    setError(null)
    try {
      const started = await startPayRequestCard(token, { email: address, name: name.trim(), expectedAmount: request.total })
      if (!started.authorizationUrl) throw new ApiError('Could not open the payment page.')
      // A full-page redirect, as everywhere else on the web build. Paystack
      // brings the payer back to this same address.
      window.location.assign(started.authorizationUrl)
    } catch (e) {
      setBusy(null)
      refused(e, 'We could not open the payment page. Nothing was charged.')
    }
  }

  const payFromWallet = async () => {
    if (!request || busy) return
    const pin = await walletPin.ask(money(request.total))
    if (!pin) return
    setBusy('wallet')
    setError(null)
    try {
      const paid = await payRequestFromWallet(token, { pin, expectedAmount: request.total })
      invalidateBalance()
      setState({ kind: 'ready', request: paid })
      setOutcome('applied')
    } catch (e) {
      refused(e, 'That payment did not go through. Nothing was charged.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Masthead />

      {state.kind === 'loading' && (
        <ScreenBody padded>
          <Skeleton width="70%" height={28} style={{ marginTop: 'var(--gap-xl)' }} />
          <Skeleton height={190} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
          <Skeleton height={56} radius="var(--radius-md)" style={{ marginTop: 'var(--gap-lg)' }} />
        </ScreenBody>
      )}

      {state.kind === 'missing' && (
        <Notice
          icon={<CircleAlert size={38} aria-hidden />}
          tone="var(--color-ink-muted)"
          title="This payment link is not valid"
          message="Check that the whole link was copied, or ask for it to be sent again."
          action={<Button label="Go to Blorbmart" kind="outline" onClick={() => navigate('/home')} />}
        />
      )}

      {state.kind === 'offline' && (
        <Notice
          icon={<CircleAlert size={38} aria-hidden />}
          tone="var(--color-ink-muted)"
          title="We could not load this link"
          message="Check your connection and try again. Nothing has been charged."
          action={
            <Button
              label="Try again"
              onClick={() => {
                setState({ kind: 'loading' })
                void load()
              }}
            />
          }
        />
      )}

      {request && request.status === 'paid' && (
        <Notice
          icon={<CircleCheckBig size={44} aria-hidden />}
          tone="var(--color-success)"
          title={outcome === 'extra' ? 'This order was already paid for' : outcome ? 'Paid. Thank you!' : 'This order has been paid for'}
          message={
            outcome === 'extra'
              ? `Someone else paid just before you, so your ${money(request.total)} has gone into ${request.requesterName}’s Blorbmart wallet instead. They have been told.`
              : outcome
                ? `${request.requesterName}’s order${request.storeName ? ` from ${request.storeName}` : ''} is on its way to the kitchen, and they have been told you paid. Your receipt is in your email.`
                : `${request.paidByName || 'Someone'} has already taken care of ${request.requesterName}’s order. There is nothing left to pay.`
          }
          action={<JoinCard onGo={() => navigate(signedIn ? '/home' : '/welcome')} signedIn={signedIn} />}
        />
      )}

      {request && request.status === 'expired' && (
        <Notice
          icon={<Clock size={38} aria-hidden />}
          tone="var(--color-ink-muted)"
          title="This payment link has expired"
          message={`Links work for a few hours. Ask ${request.requesterName} to send a new one.`}
        />
      )}

      {request && request.status === 'cancelled' && (
        <Notice
          icon={<CircleAlert size={38} aria-hidden />}
          tone="var(--color-ink-muted)"
          title="This request was cancelled"
          message={`${request.requesterName} cancelled it, so there is nothing to pay.`}
        />
      )}

      {request && request.status === 'open' && (
        <>
          <ScreenBody padded bottomGap="var(--gap-xxl)">
            <FadeSlideIn>
              <h1 className="t-display-sm" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
                {request.requesterName} is asking you to pay for their order
              </h1>
              {request.message && (
                <p
                  className="t-body-lg"
                  style={{
                    margin: '0 0 var(--gap-md)',
                    padding: 'var(--gap-md) var(--gap-lg)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-brand-softer)',
                    color: 'var(--color-brand-ink)',
                  }}
                >
                  “{request.message}”
                </p>
              )}
            </FadeSlideIn>

            <FadeSlideIn delay={70}>
              <Card style={{ marginTop: 'var(--gap-md)' }}>
                {request.storeName && (
                  <div
                    className="t-h4"
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)', marginBottom: 'var(--gap-sm)' }}
                  >
                    <Store size={17} aria-hidden style={{ color: 'var(--color-brand)' }} />
                    {request.storeName}
                  </div>
                )}
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
                <SummaryRow label="Delivery" value={request.deliveryFee <= 0 ? 'Free' : money(request.deliveryFee)} />
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
            </FadeSlideIn>

            <FadeSlideIn delay={130}>
              <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
                Your details
              </div>
              <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  placeholder={`Your name, so ${request.requesterName.split(' ')[0]} knows who paid`}
                  aria-label="Your name"
                  autoComplete="name"
                  style={fieldStyle}
                />
                <input
                  value={email || knownEmail}
                  onChange={(e) => {
                    setEmail(e.target.value.slice(0, 160))
                    if (error) setError(null)
                  }}
                  type="email"
                  inputMode="email"
                  placeholder="Email for your receipt"
                  aria-label="Email for your receipt"
                  autoComplete="email"
                  style={fieldStyle}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="t-body-sm"
                  style={{
                    margin: 'var(--gap-md) 0 0',
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

              <p
                className="t-caption"
                style={{ display: 'flex', gap: 'var(--gap-sm)', margin: 'var(--gap-lg) 0 0' }}
              >
                <ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, color: 'var(--color-success)' }} />
                <span>
                  You pay by card, bank transfer or USSD on Paystack. The order is placed the
                  moment you pay and delivered to {request.requesterName.split(' ')[0]}. If the store cannot
                  take it, the money goes to their Blorbmart wallet.
                </span>
              </p>
            </FadeSlideIn>
          </ScreenBody>

          <StickyFooter>
            <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
              <Button label={`Pay ${money(request.total)}`} glow busy={busy === 'card'} disabled={busy === 'wallet'} onClick={() => void payByCard()} />
              {signedIn && walletBalance >= request.total && (
                <Button
                  label={`Pay from my wallet · ${money(walletBalance)}`}
                  kind="outline"
                  busy={busy === 'wallet'}
                  disabled={busy === 'card'}
                  icon={<Wallet size={18} aria-hidden />}
                  onClick={() => void payFromWallet()}
                />
              )}
            </div>
          </StickyFooter>
        </>
      )}

      {confirming && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(246, 248, 252, 0.96)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div>
            <PageLoader label="Confirming your payment" fill={false} />
            <p className="t-body-sm" style={{ margin: '-8px auto 0', maxWidth: 280, textAlign: 'center' }}>
              Keep this page open. It usually takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {walletPin.sheet}
    </>
  )
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 'var(--size-button-md)',
  paddingInline: 'var(--gap-lg)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line-strong)',
}

/** The brand, for someone who arrived with no idea what this site is. */
function Masthead() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-sm)',
        padding: 'calc(var(--safe-top) + var(--gap-md)) var(--gap-page) var(--gap-md)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <svg viewBox={MARK_VIEWBOX} width={22} height={23} aria-hidden>
        <path d={MARK_PATH} fill="var(--color-brand)" />
      </svg>
      <span className="t-h3" style={{ color: 'var(--color-brand)' }}>
        Blorbmart
      </span>
      <span className="t-caption" style={{ marginLeft: 'auto' }}>
        Secure payment
      </span>
    </header>
  )
}

/** A whole-page state: paid, expired, cancelled, not found. */
function Notice({
  icon,
  tone,
  title,
  message,
  action,
}: {
  icon: ReactNode
  tone: string
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <ScreenBody padded>
      <FadeSlideIn>
        <div style={{ textAlign: 'center', marginTop: 'var(--gap-giant)' }}>
          <span
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: `color-mix(in srgb, ${tone} 12%, transparent)`,
              color: tone,
            }}
          >
            {icon}
          </span>
          <h1 className="t-h1" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
            {title}
          </h1>
          <p className="t-body" style={{ margin: '0 auto', maxWidth: 360 }}>
            {message}
          </p>
        </div>
        {action && <div style={{ marginTop: 'var(--gap-xxl)' }}>{action}</div>}
      </FadeSlideIn>
    </ScreenBody>
  )
}

/** The one thing to offer someone who has just paid for a friend. */
function JoinCard({ onGo, signedIn }: { onGo: () => void; signedIn: boolean }) {
  return (
    <Card color="var(--color-brand-softer)" shadow="none" border="var(--color-brand-soft)">
      <div className="t-h4">{signedIn ? 'Hungry yourself?' : 'New to Blorbmart?'}</div>
      <p className="t-body-sm" style={{ margin: '4px 0 var(--gap-md)' }}>
        Food from campus kitchens, airtime and data, and event tickets, delivered and tracked
        live.
      </p>
      <Button label={signedIn ? 'Order something' : 'See what is on Blorbmart'} onClick={onGo} />
    </Card>
  )
}
