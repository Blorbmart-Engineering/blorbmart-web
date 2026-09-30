/* ═══════════════════════════════════════════════════════════════════════
   /treat/<token> — the page a friend opens when somebody sends them food.

   They may have no account and no idea an order was coming, so the page
   answers three things in order: who sent this, where it is now, and what
   the rider will ask for at the door. It keeps itself up to date while it
   is open.

   Public, and outside the shell.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bike, Check, ChefHat, CircleAlert, Gift, House, Phone, ShieldCheck } from 'lucide-react'
import { ApiError, warmUp } from '../lib/api'
import { MARK_PATH, MARK_VIEWBOX } from '../ui/mark'
import { viewTreat, type TreatPage, type TreatStage } from '../data/treats'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, Skeleton } from '../ui/kit'
import { FadeSlideIn, LivePulse, Sheen } from '../ui/motion'
import { ScreenBody } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

const POLL_MS = 15_000

type Loaded = { kind: 'loading' } | { kind: 'missing' } | { kind: 'offline' } | { kind: 'ready'; treat: TreatPage }

/** Where each stage sits on the four-stop road below. */
const STOP_OF: Record<TreatStage, number> = {
  scheduled: 0,
  placed: 0,
  confirmed: 1,
  preparing: 1,
  ready: 1,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: 0,
}

const STOPS = [
  { label: 'Ordered', icon: Check },
  { label: 'Cooking', icon: ChefHat },
  { label: 'On the way', icon: Bike },
  { label: 'Delivered', icon: House },
]

export default function TreatScreen() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const [state, setState] = useState<Loaded>({ kind: 'loading' })

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', treat: await viewTreat(token) })
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) {
        setState({ kind: 'missing' })
        return
      }
      console.warn('[treat] load failed', e)
      setState((current) => (current.kind === 'ready' ? current : { kind: 'offline' }))
    }
  }, [token])

  useEffect(() => {
    warmUp()
    void load()
  }, [load])

  const treat = state.kind === 'ready' ? state.treat : null
  const finished = treat ? treat.stage === 'delivered' || treat.stage === 'cancelled' : false

  // Live until it arrives. A tab in the background does not need to ask.
  useEffect(() => {
    if (!treat || finished) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [treat, finished, load])

  if (state.kind === 'loading') {
    return (
      <ScreenBody>
        <Skeleton height={230} radius="0" />
        <div style={{ padding: 'var(--gap-lg) var(--gap-page)' }}>
          <Skeleton height={120} radius="var(--radius-lg)" />
          <Skeleton height={90} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-md)' }} />
        </div>
      </ScreenBody>
    )
  }

  if (!treat) {
    const offline = state.kind === 'offline'
    return (
      <ScreenBody padded>
        <div style={{ textAlign: 'center', marginTop: 'var(--gap-giant)' }}>
          <CircleAlert size={44} aria-hidden style={{ color: 'var(--color-ink-muted)' }} />
          <h1 className="t-h1" style={{ margin: 'var(--gap-lg) 0 var(--gap-sm)' }}>
            {offline ? 'We could not load this' : 'This link is not ready'}
          </h1>
          <p className="t-body" style={{ margin: '0 auto var(--gap-xxl)', maxWidth: 340 }}>
            {offline
              ? 'Check your connection and try again.'
              : 'It may not have been paid for yet, or the link was not copied in full. Ask whoever sent it to check.'}
          </p>
          <Button
            label={offline ? 'Try again' : 'Go to Blorbmart'}
            kind={offline ? 'brand' : 'outline'}
            onClick={() => {
              if (!offline) return navigate('/home')
              setState({ kind: 'loading' })
              void load()
            }}
          />
        </div>
      </ScreenBody>
    )
  }

  const cancelled = treat.stage === 'cancelled'
  const stop = STOP_OF[treat.stage] ?? 0
  const forName = treat.recipientName.split(' ')[0]

  return (
    <ScreenBody bottomGap="var(--gap-xxl)">
      {/* ── Who sent it ──────────────────────────────────────────────── */}
      <header
        style={{
          padding: 'calc(var(--safe-top) + var(--gap-lg)) var(--gap-page) var(--gap-xxl)',
          background: 'var(--gradient-appetite)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.92 }}>
          <svg viewBox={MARK_VIEWBOX} width={16} height={17} aria-hidden>
            <path d={MARK_PATH} fill="currentColor" />
          </svg>
          <span className="t-label-sm" style={{ color: 'inherit' }}>
            Blorbmart
          </span>
        </div>
        <FadeSlideIn>
          <span
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 68,
              height: 68,
              margin: 'var(--gap-xl) 0 var(--gap-md)',
              borderRadius: 22,
              background: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Gift size={34} aria-hidden />
          </span>
          <h1 className="t-display-sm" style={{ margin: 0, color: 'inherit' }}>
            {treat.senderName} sent you a treat
          </h1>
          <p className="t-body" style={{ margin: '6px 0 0', color: 'inherit', opacity: 0.92 }}>
            {forName}, {treat.storeName ? `something from ${treat.storeName} is` : 'something is'}{' '}
            {treat.stage === 'delivered' ? 'with you now' : cancelled ? 'no longer coming' : 'coming to you'}.
          </p>
        </FadeSlideIn>
      </header>

      <div style={{ padding: '0 var(--gap-page)', marginTop: 'calc(var(--gap-lg) * -1)' }}>
        {treat.message && (
          <FadeSlideIn delay={60}>
            <Card>
              <p className="t-body-lg" style={{ margin: 0, color: 'var(--color-ink)' }}>
                “{treat.message}”
              </p>
              <p className="t-caption" style={{ margin: '6px 0 0' }}>
                — {treat.senderName}
              </p>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── Where it is ────────────────────────────────────────────── */}
        <FadeSlideIn delay={120}>
          <Card style={{ marginTop: 'var(--gap-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
              {!finished && <LivePulse color="var(--color-appetite)" size={8} />}
              <span className="t-h3" style={{ color: cancelled ? 'var(--color-danger)' : undefined }}>
                {treat.stageLabel}
              </span>
            </div>
            {cancelled ? (
              <p className="t-body-sm" style={{ margin: 'var(--gap-sm) 0 0' }}>
                The store could not take this order, and {treat.senderName} has been refunded.
              </p>
            ) : (
              <>
                {!finished && treat.etaMinutes != null && treat.etaMinutes > 0 && (
                  <p className="t-body-sm" style={{ margin: '4px 0 0' }}>
                    Usually about {treat.etaMinutes} minutes from when it was ordered.
                  </p>
                )}
                <ol
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${STOPS.length}, 1fr)`,
                    gap: 'var(--gap-xs)',
                    margin: 'var(--gap-lg) 0 0',
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {STOPS.map(({ label, icon: Icon }, i) => {
                    const done = i <= stop
                    return (
                      <li key={label} style={{ textAlign: 'center' }} aria-current={i === stop ? 'step' : undefined}>
                        <span
                          aria-hidden
                          style={{
                            display: 'block',
                            height: 4,
                            borderRadius: 'var(--radius-pill)',
                            background: done ? 'var(--color-appetite)' : 'var(--color-line-strong)',
                          }}
                        />
                        <Icon
                          size={17}
                          aria-hidden
                          style={{
                            marginTop: 'var(--gap-sm)',
                            color: done ? 'var(--color-appetite-deep)' : 'var(--color-ink-faint)',
                          }}
                        />
                        <span
                          className="t-caption-sm"
                          style={{
                            display: 'block',
                            color: done ? 'var(--color-ink-strong)' : undefined,
                            fontWeight: i === stop ? 700 : undefined,
                          }}
                        >
                          {label}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
          </Card>
        </FadeSlideIn>

        {/* ── The PIN ────────────────────────────────────────────────── */}
        {treat.pin && (
          <FadeSlideIn delay={180}>
            <Card style={{ marginTop: 'var(--gap-md)' }} color="var(--color-brand-softer)" shadow="none" border="var(--color-brand-soft)">
              <div
                className="t-overline"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-brand)' }}
              >
                <ShieldCheck size={15} aria-hidden />
                Your delivery PIN
              </div>
              <Sheen>
                <div
                  className="t-pin"
                  aria-label={`Delivery PIN ${treat.pin.split('').join(' ')}`}
                  style={{ margin: '6px 0', fontSize: 44, letterSpacing: 10, color: 'var(--color-brand-ink)' }}
                >
                  {treat.pin}
                </div>
              </Sheen>
              <p className="t-body-sm" style={{ margin: 0, color: 'var(--color-brand-ink)' }}>
                The rider will ask for these four digits. Give them only when the food is in your
                hands.
              </p>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── The rider ──────────────────────────────────────────────── */}
        {treat.rider && (
          <FadeSlideIn delay={220}>
            <Card style={{ marginTop: 'var(--gap-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 46,
                    height: 46,
                    flexShrink: 0,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'var(--color-surface-sunken)',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {treat.rider.photoUrl ? (
                    <SmartImage src={treat.rider.photoUrl} alt="" width={46} height={46} renderWidth={96} />
                  ) : (
                    <Bike size={21} aria-hidden />
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                    {treat.rider.name}
                  </span>
                  <span className="t-caption" style={{ display: 'block' }}>
                    Your rider
                  </span>
                </span>
                {treat.rider.phone && (
                  <a
                    href={`tel:${treat.rider.phone}`}
                    className="press t-label"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-brand-soft)',
                      color: 'var(--color-brand-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    <Phone size={16} aria-hidden />
                    Call
                  </a>
                )}
              </div>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── What is in it ──────────────────────────────────────────── */}
        {treat.items.length > 0 && (
          <FadeSlideIn delay={260}>
            <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
              What’s coming
            </div>
            <Card>
              {treat.items.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="t-body"
                  style={{ display: 'flex', gap: 'var(--gap-md)', padding: '5px 0', color: 'var(--color-ink-strong)' }}
                >
                  <span className="t-price-sm" style={{ minWidth: 22 }}>
                    {item.quantity}×
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{item.name}</span>
                </div>
              ))}
            </Card>
          </FadeSlideIn>
        )}

        {/* ── Pass it on ─────────────────────────────────────────────── */}
        <FadeSlideIn delay={300}>
          <Card style={{ marginTop: 'var(--gap-xl)' }} color="var(--color-surface-sunken)" shadow="none">
            <div className="t-h4">Send one back</div>
            <p className="t-body-sm" style={{ margin: '4px 0 var(--gap-md)' }}>
              Blorbmart delivers from kitchens on campus. Order for yourself, or send a friend
              something the way {treat.senderName} just did.
            </p>
            <Button
              label={signedIn ? 'Order something' : 'See what is on Blorbmart'}
              kind="appetite"
              onClick={() => navigate(signedIn ? '/home' : '/welcome')}
            />
          </Card>
        </FadeSlideIn>
      </div>
    </ScreenBody>
  )
}
