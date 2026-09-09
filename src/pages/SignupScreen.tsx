/* ═══════════════════════════════════════════════════════════════════════
   Create an account — a port of lib/features/auth/sign_up_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  authErrorMessage,
  initRegistration,
  sendOtp,
} from '../data/auth'
import { universityOptions, type University } from '../data/university'
import { normaliseNgPhone } from '../lib/format'
import {
  AuthError,
  AuthField,
  CampusPicker,
  TermsCheckbox,
} from '../components/AuthWidgets'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { FadeSlideIn, staggerFor } from '../ui/motion'

interface Errors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  password?: string
  campus?: string
}

export default function SignupScreen() {
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [campus, setCampus] = useState<University | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  /**
   * Pulls the campus list into the session cache while the person is still
   * typing their name, so the picker opens instantly rather than spinning.
   *
   * Fire-and-forget on purpose. The picker fetches and retries on its own, so
   * a failure here costs nothing and must not put an error on a form the
   * person has not finished filling in.
   */
  useEffect(() => {
    void universityOptions().catch(() => [])
  }, [])

  const validate = (): boolean => {
    const next: Errors = {}
    if (firstName.trim().length < 2) next.firstName = 'Enter your first name.'
    if (lastName.trim().length < 2) next.lastName = 'Enter your last name.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!normaliseNgPhone(phone)) next.phone = 'Enter a valid Nigerian phone number.'
    if (password.length < 8) next.password = 'At least 8 characters.'
    if (!campus) next.campus = 'Choose your school.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    setError(null)
    if (!validate()) return
    if (!accepted) {
      setError('Please accept the terms to continue.')
      return
    }

    setBusy(true)
    const cleanEmail = email.trim().toLowerCase()

    try {
      // Two steps on purpose. The account is created first so a slow or
      // sleeping backend cannot destroy details the person already typed; the
      // code is then sent separately and can be retried on its own.
      await initRegistration({
        email: cleanEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        universityId: campus?.id ?? '',
        universityName: campus?.name ?? '',
      })

      try {
        await sendOtp(cleanEmail)
      } catch {
        // The account exists either way — the OTP screen can resend.
      }

      navigate('/verify', { state: { email: cleanEmail }, replace: true })
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
            Create your account
          </h1>
          <p className="t-body" style={{ margin: '0 0 var(--gap-xxl)' }}>
            It takes under a minute. Then we deliver.
          </p>
        </FadeSlideIn>

        <AuthError message={error} />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            <FadeSlideIn delay={staggerFor(0)} style={{ flex: 1 }}>
              <AuthField
                label="First name"
                value={firstName}
                onChange={setFirstName}
                placeholder="first name"
                autoComplete="given-name"
                disabled={busy}
                error={errors.firstName}
              />
            </FadeSlideIn>
            <FadeSlideIn delay={staggerFor(1)} style={{ flex: 1 }}>
              <AuthField
                label="Last name"
                value={lastName}
                onChange={setLastName}
                placeholder="last name"
                autoComplete="family-name"
                disabled={busy}
                error={errors.lastName}
              />
            </FadeSlideIn>
          </div>

          <FadeSlideIn delay={staggerFor(2)}>
            <AuthField
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              hint="We send your order receipts here."
              type="email"
              inputMode="email"
              autoComplete="email"
              disabled={busy}
              error={errors.email}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(3)}>
            <AuthField
              label="Phone number"
              value={phone}
              onChange={setPhone}
              placeholder="08012345678"
              hint="Your rider calls this number."
              inputMode="tel"
              autoComplete="tel"
              disabled={busy}
              error={errors.phone}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(4)}>
            <CampusPicker
              value={campus}
              onChange={setCampus}
              disabled={busy}
              error={errors.campus}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(5)}>
            <AuthField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              type="password"
              autoComplete="new-password"
              disabled={busy}
              error={errors.password}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(6)}>
            <div style={{ margin: 'var(--gap-sm) 0 var(--gap-xxl)' }}>
              <TermsCheckbox checked={accepted} onChange={setAccepted} />
            </div>

            <Button label="Create account" type="submit" busy={busy} glow />

            <p
              className="t-body-sm"
              style={{ textAlign: 'center', margin: 'var(--gap-xl) 0 0' }}
            >
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--color-brand)', fontWeight: 700 }}>
                Sign in
              </Link>
            </p>
          </FadeSlideIn>
        </form>
      </ScreenBody>
    </>
  )
}
