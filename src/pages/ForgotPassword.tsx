/* ═══════════════════════════════════════════════════════════════════════
   Password reset — a port of lib/features/auth/forgot_password_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { sendPasswordReset } from '../data/auth'
import { AuthError, AuthField } from '../components/AuthWidgets'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { FadeSlideIn } from '../ui/motion'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <>
        <AppBar onBack={() => navigate('/login')} />
        <ScreenBody padded>
          <FadeSlideIn>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 64,
                height: 64,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-success-soft)',
                color: 'var(--color-success)',
              }}
            >
              <MailCheck size={30} aria-hidden />
            </span>
            <h1 className="t-display-sm" style={{ margin: 'var(--gap-xl) 0 var(--gap-xs)' }}>
              Check your email
            </h1>
            <p className="t-body" style={{ margin: '0 0 var(--gap-xxl)' }}>
              If an account exists for{' '}
              <strong style={{ color: 'var(--color-ink)' }}>{email.trim()}</strong>, a reset
              link is on its way. It expires in an hour.
            </p>
            <Button label="Back to sign in" onClick={() => navigate('/login')} />
          </FadeSlideIn>
        </ScreenBody>
      </>
    )
  }

  return (
    <>
      <AppBar onBack={() => navigate('/login')} />
      <ScreenBody padded>
        <FadeSlideIn>
          <h1 className="t-display-sm" style={{ margin: '0 0 var(--gap-xs)' }}>
            Reset your password
          </h1>
          <p className="t-body" style={{ margin: '0 0 var(--gap-xxl)' }}>
            Tell us the email on the account and we will send a link to set a new password.
          </p>
        </FadeSlideIn>

        <AuthError message={error} />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <AuthField
            label="Email address"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            disabled={busy}
          />
          <div style={{ marginTop: 'var(--gap-lg)' }}>
            <Button label="Send reset link" type="submit" busy={busy} glow />
          </div>
        </form>
      </ScreenBody>
    </>
  )
}
