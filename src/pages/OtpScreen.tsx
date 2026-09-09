/* ═══════════════════════════════════════════════════════════════════════
   Email verification — a port of lib/features/auth/otp_screen.dart.

   The account already exists by the time this screen opens; this only proves
   the address is reachable. Leaving without verifying is allowed — the
   account works, and the customer is asked again later — because trapping
   somebody on a screen whose only exit is an email that may not arrive is how
   signups are lost.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { auth } from '../lib/firebase'
import { completeVerification, sendOtp } from '../data/auth'
import { AuthError } from '../components/AuthWidgets'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { FadeSlideIn } from '../ui/motion'

const LENGTH = 6
const RESEND_SECONDS = 45

export default function OtpScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? auth.currentUser?.email ?? ''

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const code = digits.join('')

  const setDigit = (index: number, value: string) => {
    // A pasted code fills the whole row rather than one box.
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) {
      setDigits((d) => d.map((x, i) => (i === index ? '' : x)))
      return
    }
    setDigits((d) => {
      const next = [...d]
      for (let i = 0; i < cleaned.length && index + i < LENGTH; i++) {
        next[index + i] = cleaned[i]
      }
      return next
    })
    const landed = Math.min(index + cleaned.length, LENGTH - 1)
    inputs.current[landed]?.focus()
  }

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const submit = async () => {
    if (code.length !== LENGTH) {
      setError('Enter the six digits we emailed you.')
      return
    }
    const uid = auth.currentUser?.uid
    if (!uid) {
      navigate('/login', { replace: true })
      return
    }

    setBusy(true)
    setError(null)
    try {
      await completeVerification({ uid, email, otpCode: code })
      showToast('Email verified. Welcome to Blorbmart.', 'success')
      navigate('/home', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work. Try again.')
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      await sendOtp(email)
      setCooldown(RESEND_SECONDS)
      showToast('We sent a new code.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not send the code. Try again.')
    }
  }

  return (
    <>
      <AppBar onBack={() => navigate('/home', { replace: true })} />
      <ScreenBody padded>
        <FadeSlideIn>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 64,
              height: 64,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-brand-soft)',
              color: 'var(--color-brand)',
            }}
          >
            <MailCheck size={30} aria-hidden />
          </span>

          <h1 className="t-display-sm" style={{ margin: 'var(--gap-xl) 0 var(--gap-xs)' }}>
            Check your email
          </h1>
          <p className="t-body" style={{ margin: '0 0 var(--gap-xxl)' }}>
            We sent a six-digit code to{' '}
            <strong style={{ color: 'var(--color-ink)' }}>{email}</strong>. It expires in ten
            minutes.
          </p>
        </FadeSlideIn>

        <AuthError message={error} />

        <FadeSlideIn delay={60}>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'space-between' }}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el
                }}
                value={digit}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1}`}
                disabled={busy}
                className="t-price-lg"
                style={{
                  width: '100%',
                  height: 60,
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  border: `1.5px solid ${digit ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
                  outlineOffset: 2,
                  transition: 'border-color var(--dur-fast) var(--ease-emphasized)',
                }}
              />
            ))}
          </div>
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <div style={{ marginTop: 'var(--gap-xxl)' }}>
            <Button
              label="Verify email"
              busy={busy}
              disabled={code.length !== LENGTH}
              glow
              onClick={() => void submit()}
            />
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--gap-xl)' }}>
            {cooldown > 0 ? (
              <span className="t-body-sm">Resend the code in {cooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                className="t-label"
                style={{ color: 'var(--color-brand)' }}
              >
                Send a new code
              </button>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 'var(--gap-md)' }}>
            <button
              type="button"
              onClick={() => navigate('/home', { replace: true })}
              className="t-body-sm"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              I&apos;ll do this later
            </button>
          </div>
        </FadeSlideIn>
      </ScreenBody>
    </>
  )
}
