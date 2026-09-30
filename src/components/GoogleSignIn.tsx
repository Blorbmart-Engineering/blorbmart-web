/* ═══════════════════════════════════════════════════════════════════════
   "Continue with Google" — the same button on sign-in and sign-up, because
   with Google they are the same act: a known account is signed in, and a new
   one is taken to /finish-signup for the two things Google cannot supply.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from 'firebase/auth'
import {
  authErrorMessage,
  embeddedBrowser,
  googleRedirectResult,
  isAuthCancelled,
  popupUnavailable,
  redirectToGoogle,
  signInWithGoogle,
  touchLastLogin,
} from '../data/auth'
import { GOOGLE_SIGN_IN_ENABLED } from '../lib/firebase'
import { Button } from '../ui/Button'

/** Google's own mark, in its own colours, as its branding rules ask. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/**
 * The button and the line under it. Draws nothing on a host Google sign-in
 * is not switched on for (see GOOGLE_AUTH_HOSTS), so the screens that hold it
 * look exactly as they did.
 */
export function GoogleSignIn({
  from = '/home',
  divider = 'or',
  disabled = false,
  onError,
  onBusyChange,
}: {
  /** Where a returning customer goes once signed in. */
  from?: string
  /** The words on the line between this and the form below. */
  divider?: string
  disabled?: boolean
  onError: (message: string | null) => void
  /** Lets the form beside the button lock while Google's window is open. */
  onBusyChange?: (busy: boolean) => void
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const setBoth = (next: boolean) => {
    setBusy(next)
    onBusyChange?.(next)
  }

  const arrive = (user: User, hasProfile: boolean, to: string) => {
    if (hasProfile) {
      void touchLastLogin(user.uid)
      navigate(to, { replace: true })
    } else {
      navigate('/finish-signup', { replace: true, state: { from: to } })
    }
  }

  // Back from Google by the whole-page route (see redirectToGoogle).
  useEffect(() => {
    if (!GOOGLE_SIGN_IN_ENABLED) return
    let live = true
    void googleRedirectResult()
      .then((result) => {
        if (live && result) arrive(result.user, result.hasProfile, result.from || '/home')
      })
      .catch((e) => {
        if (live && !isAuthCancelled(e)) onError(authErrorMessage(e))
      })
    return () => {
      live = false
    }
    // Once, on arrival: this reads what the previous page load left behind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!GOOGLE_SIGN_IN_ENABLED) return null

  const start = async () => {
    onError(null)

    const host = embeddedBrowser()
    if (host) {
      onError(
        `Google sign-in does not work inside ${host}. Open this page in Chrome or Safari, or use your email and password.`,
      )
      return
    }

    setBoth(true)
    try {
      const { user, hasProfile } = await signInWithGoogle()
      arrive(user, hasProfile, from)
    } catch (e) {
      if (popupUnavailable(e)) {
        try {
          // The page leaves here; nothing after this line runs on success.
          await redirectToGoogle(from)
          return
        } catch (again) {
          onError(authErrorMessage(again))
        }
      } else if (!isAuthCancelled(e)) {
        onError(authErrorMessage(e))
      }
    } finally {
      setBoth(false)
    }
  }

  return (
    <>
      <Button
        label="Continue with Google"
        kind="outline"
        icon={<GoogleMark />}
        busy={busy}
        disabled={disabled}
        onClick={() => void start()}
      />
      <OrDivider label={divider} />
    </>
  )
}

/** The line between the Google button and the form under it. */
function OrDivider({ label }: { label: string }) {
  const rule = { flex: 1, height: 1, background: 'var(--color-line-strong)' }
  return (
    <div
      role="separator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        margin: 'var(--gap-xl) 0',
      }}
    >
      <span style={rule} />
      <span className="t-caption" style={{ color: 'var(--color-ink-muted)' }}>
        {label}
      </span>
      <span style={rule} />
    </div>
  )
}
