/* ═══════════════════════════════════════════════════════════════════════
   Sign in — a port of lib/features/auth/sign_in_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authErrorMessage, login, touchLastLogin } from '../data/auth'
import { AuthError, AuthField } from '../components/AuthWidgets'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { FadeSlideIn, staggerFor } from '../ui/motion'

export default function LoginScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/home'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setBusy(true)
    try {
      const credential = await login(email, password)
      void touchLastLogin(credential.user.uid)
      navigate(from, { replace: true })
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppBar onBack={() => navigate('/welcome')} />
      <ScreenBody padded>
        <FadeSlideIn>
          <h1 className="t-display-sm" style={{ margin: '0 0 var(--gap-xs)' }}>
            Welcome back
          </h1>
          <p className="t-body" style={{ margin: '0 0 var(--gap-xxl)' }}>
            Sign in to pick up where you left off.
          </p>
        </FadeSlideIn>

        <AuthError message={error} />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <FadeSlideIn delay={staggerFor(0)}>
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
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(1)}>
            <AuthField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              type="password"
              autoComplete="current-password"
              disabled={busy}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(2)}>
            <div style={{ textAlign: 'right', marginBottom: 'var(--gap-xl)' }}>
              <Link
                to="/forgot-password"
                className="t-label"
                style={{ color: 'var(--color-brand)' }}
              >
                Forgot password?
              </Link>
            </div>

            <Button label="Sign in" type="submit" busy={busy} glow />

            <p
              className="t-body-sm"
              style={{ textAlign: 'center', margin: 'var(--gap-xl) 0 0' }}
            >
              New to Blorbmart?{' '}
              <Link to="/signup" style={{ color: 'var(--color-brand)', fontWeight: 700 }}>
                Create an account
              </Link>
            </p>
          </FadeSlideIn>
        </form>
      </ScreenBody>
    </>
  )
}
