/* ═══════════════════════════════════════════════════════════════════════
   Onboarding — a port of lib/features/onboarding/onboarding_screen.dart.

   Three slides, shown once. The key is the same one the app uses so a person
   who has seen it on their phone is not shown it again on the web.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { FadeSlideIn } from '../ui/motion'

export const ONBOARDED_KEY = 'blorb_onboarded_v2'

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true'
  } catch {
    // A browser with storage blocked sees onboarding every launch, which is a
    // far smaller problem than a crash on boot.
    return false
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true')
  } catch {
    /* nothing to do */
  }
}

const SLIDES = [
  {
    image: '/assets/onboarding1',
    eyebrow: 'REAL FOOD, REALLY FAST',
    title: 'Hot food, at your door in 30 minutes',
    body:
      'Every restaurant near you in one place. Real prices, live kitchens, and a rider ' +
      'already moving before your food is boxed.',
  },
  {
    image: '/assets/onboarding2',
    eyebrow: 'MORE THAN MEALS',
    title: 'Medicine, small chops and your bills',
    body:
      'Pharmacies for the days you cannot leave bed. Event caterers for the days everyone ' +
      'is coming over. Airtime, data and power in two taps.',
  },
  {
    image: '/assets/onboarding3',
    eyebrow: 'DELIVERED RIGHT',
    title: 'Your 4-digit PIN keeps it yours',
    body:
      'Track the rider the whole way. When they arrive, your PIN is the only thing that ' +
      'closes the delivery. Nobody else can take it.',
  },
]

export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  const finish = () => {
    markOnboarded()
    navigate('/welcome', { replace: true })
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-canvas)',
      }}
    >
      <div style={{ position: 'relative', height: '52dvh', flexShrink: 0 }}>
        {/* WebP first — a twentieth of the JPEG, and these are the first three
            screens a new customer ever downloads. The JPEG stays as the
            fallback for anything that cannot decode WebP. */}
        <picture key={slide.image}>
          <source srcSet={`${slide.image}.webp`} type="image/webp" />
          <img
            src={`${slide.image}.jpg`}
            alt=""
            // The first slide is the LCP element; the rest can wait.
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: 'blorb-fade-in var(--dur-slow) var(--ease-emphasized) both',
            }}
          />
        </picture>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 40%, var(--color-canvas) 100%)',
          }}
        />
        <button
          type="button"
          onClick={finish}
          className="t-label"
          style={{
            position: 'absolute',
            top: 'calc(var(--safe-top) + var(--gap-lg))',
            right: 'var(--gap-page)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(255,255,255,0.9)',
            color: 'var(--color-ink)',
          }}
        >
          Skip
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 var(--gap-page) calc(var(--safe-bottom) + var(--gap-xxl))',
        }}
      >
        <FadeSlideIn key={index}>
          <div className="t-overline" style={{ color: 'var(--color-brand)' }}>
            {slide.eyebrow}
          </div>
          <h1 className="t-display-sm" style={{ margin: 'var(--gap-sm) 0 var(--gap-md)' }}>
            {slide.title}
          </h1>
          <p className="t-body-lg" style={{ margin: 0 }}>
            {slide.body}
          </p>
        </FadeSlideIn>

        <div style={{ flex: 1, minHeight: 'var(--gap-xxl)' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 'var(--gap-xl)',
          }}
        >
          {SLIDES.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                height: 6,
                width: i === index ? 26 : 6,
                borderRadius: 'var(--radius-pill)',
                background: i === index ? 'var(--color-brand)' : 'var(--color-line-strong)',
                transition: 'width var(--dur-normal) var(--ease-emphasized)',
              }}
            />
          ))}
        </div>

        <Button
          label={last ? 'Get started' : 'Next'}
          glow
          onClick={() => (last ? finish() : setIndex((i) => i + 1))}
        />
      </div>
    </div>
  )
}
