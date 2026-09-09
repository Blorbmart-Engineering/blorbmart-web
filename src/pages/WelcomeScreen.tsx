/* ═══════════════════════════════════════════════════════════════════════
   Welcome — a port of lib/features/auth/welcome_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useNavigate } from 'react-router-dom'
import { HUB_ORDER, VERTICALS } from '../models/catalog'
import { Button } from '../ui/Button'
import { FadeSlideIn, staggerFor } from '../ui/motion'

export default function WelcomeScreen() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding:
          'calc(var(--safe-top) + var(--gap-xxxl)) var(--gap-page) calc(var(--safe-bottom) + var(--gap-xxl))',
        background: 'var(--color-canvas)',
      }}
    >
      <FadeSlideIn>
        <img
          src="/assets/icon.png"
          alt="Blorbmart"
          width={64}
          height={64}
          style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
        />
      </FadeSlideIn>

      <FadeSlideIn delay={80}>
        <h1 className="t-display-md" style={{ margin: 'var(--gap-xxxl) 0 0' }}>
          Everything you
          <br />
          are hungry for.
        </h1>
        <p className="t-body-lg" style={{ margin: 'var(--gap-md) 0 0', maxWidth: 340 }}>
          Restaurants, pharmacies, event caterers and your monthly bills. One app, one
          basket, one rider.
        </p>
      </FadeSlideIn>

      {/* The four hubs, as a promise of range rather than a navigation control —
          nothing here is tappable until there is an account to tap it with. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--gap-md)',
          margin: 'var(--gap-xxxl) 0',
        }}
      >
        {HUB_ORDER.map((id, i) => {
          const spec = VERTICALS[id]
          return (
            <FadeSlideIn key={id} delay={140 + staggerFor(i)}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  padding: 'var(--gap-md)',
                  borderRadius: 'var(--radius-md)',
                  background: spec.softColor,
                  border: `1px solid color-mix(in srgb, ${spec.color} 12%, transparent)`,
                }}
              >
                <img src={spec.asset} alt="" width={34} height={34} style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span className="t-label-sm clamp-1" style={{ display: 'block' }}>
                    {spec.label}
                  </span>
                  <span className="t-caption-sm clamp-1" style={{ display: 'block' }}>
                    {spec.tagline}
                  </span>
                </span>
              </div>
            </FadeSlideIn>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <FadeSlideIn delay={320}>
        <Button label="Create an account" glow onClick={() => navigate('/signup')} />
        <div style={{ height: 'var(--gap-md)' }} />
        <Button
          label="I already have an account"
          kind="outline"
          onClick={() => navigate('/login')}
        />
        <div style={{ height: 'var(--gap-sm)' }} />
        <Button
          label="Have a look around first"
          kind="ghost"
          size="md"
          onClick={() => navigate('/home')}
        />
      </FadeSlideIn>
    </div>
  )
}
