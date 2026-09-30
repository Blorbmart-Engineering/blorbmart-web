/* ═══════════════════════════════════════════════════════════════════════
   Finish signing up — the second half of "Continue with Google".

   Google supplies a name and a proven email. It does not supply the phone
   number a rider calls or the campus the catalogue is filtered by, and an
   account without those cannot order. So a Google account Blorbmart has not
   seen before stops here once, and its documents are written when it leaves.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authErrorMessage, completeGoogleProfile, splitDisplayName } from '../data/auth'
import { universityOptions, type University } from '../data/university'
import { asString, normaliseNgPhone } from '../lib/format'
import {
  cleanReferralCode,
  clearPendingReferral,
  pendingReferral,
  rememberReferral,
} from '../data/referral'
import {
  AuthError,
  AuthField,
  CampusPicker,
  TermsCheckbox,
} from '../components/AuthWidgets'
import { SplashVisual } from '../components/SplashVisual'
import { isSignedIn, sessionEmail, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { FadeSlideIn, staggerFor } from '../ui/motion'

interface Errors {
  firstName?: string
  lastName?: string
  phone?: string
  campus?: string
}

export default function FinishSignupScreen() {
  const location = useLocation()
  const session = useSessionStore()
  const from = (location.state as { from?: string } | null)?.from ?? '/home'

  if (!session.ready) return <SplashVisual />
  if (!isSignedIn(session)) return <Navigate to="/login" replace />
  // Already a full account — including the moment the form's own save lands.
  // There is nothing to finish.
  if (asString(session.profile.role)) return <Navigate to={from} replace />

  // Mounted only once the session is known, so the form can start from the
  // name Google gave: on a reload that arrives after the first paint.
  return <FinishForm from={from} />
}

function FinishForm({ from }: { from: string }) {
  const navigate = useNavigate()
  const session = useSessionStore()

  const google = splitDisplayName(session.user?.displayName)
  const [firstName, setFirstName] = useState(google.firstName)
  const [lastName, setLastName] = useState(google.lastName)
  const [phone, setPhone] = useState('')
  const [campus, setCampus] = useState<University | null>(null)
  const [inviteCode, setInviteCode] = useState(pendingReferral)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    void universityOptions().catch(() => [])
  }, [])

  const validate = (): boolean => {
    const next: Errors = {}
    if (firstName.trim().length < 2) next.firstName = 'Enter your first name.'
    if (lastName.trim().length < 2) next.lastName = 'Enter your last name.'
    if (!normaliseNgPhone(phone)) next.phone = 'Enter a valid Nigerian phone number.'
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

    // Stored now and sent once the profile exists (see applyPendingReferral).
    const code = cleanReferralCode(inviteCode)
    if (code) rememberReferral(code)
    else clearPendingReferral()

    setBusy(true)
    try {
      await completeGoogleProfile({
        firstName,
        lastName,
        phone,
        universityId: campus?.id ?? '',
        universityName: campus?.name ?? '',
      })
      navigate(from, { replace: true })
    } catch (e) {
      setError(
        (e as { code?: string })?.code === 'permission-denied'
          ? 'We could not save your details. Sign out and try again, or message support.'
          : authErrorMessage(e),
      )
      setBusy(false)
    }
  }

  const useAnotherAccount = () => {
    void session.signOut().then(() => navigate('/login', { replace: true }))
  }

  return (
    <>
      <AppBar onBack={useAnotherAccount} />
      <ScreenBody padded>
        <FadeSlideIn>
          <h1 className="t-display-sm" style={{ margin: '0 0 var(--gap-xs)' }}>
            Almost there
          </h1>
          <p className="t-body" style={{ margin: '0 0 var(--gap-sm)' }}>
            Two things Google could not tell us, then you are in.
          </p>
          <p className="t-body-sm" style={{ margin: '0 0 var(--gap-xxl)' }}>
            Signed in as <strong>{sessionEmail(session)}</strong>.{' '}
            <button
              type="button"
              onClick={useAnotherAccount}
              disabled={busy}
              style={{ color: 'var(--color-brand)', fontWeight: 700 }}
            >
              Use another account
            </button>
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
            <FadeSlideIn delay={staggerFor(0)} style={{ flex: 1, minWidth: 0 }}>
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
            <FadeSlideIn delay={staggerFor(1)} style={{ flex: 1, minWidth: 0 }}>
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

          <FadeSlideIn delay={staggerFor(3)}>
            <CampusPicker
              value={campus}
              onChange={setCampus}
              disabled={busy}
              error={errors.campus}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(4)}>
            <AuthField
              label="Invite code (optional)"
              value={inviteCode}
              onChange={(v) => setInviteCode(cleanReferralCode(v))}
              placeholder="BLB123ABC"
              hint={inviteCode ? 'The friend who invited you.' : 'Got one from a friend? Enter it here.'}
              autoComplete="off"
              disabled={busy}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={staggerFor(5)}>
            <div style={{ margin: 'var(--gap-sm) 0 var(--gap-xxl)' }}>
              <TermsCheckbox checked={accepted} onChange={setAccepted} />
            </div>

            <Button label="Finish" type="submit" busy={busy} glow />
          </FadeSlideIn>
        </form>
      </ScreenBody>
    </>
  )
}
