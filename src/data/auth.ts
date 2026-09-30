/* ═══════════════════════════════════════════════════════════════════════
   Account creation and sign-in — a port of lib/services/auth_service.dart.

   Registration is deliberately two steps. Step one creates the Firebase Auth
   account and the Firestore documents; step two verifies the emailed code.
   They are separate so a backend cold start while sending the OTP does not
   destroy an already-created account and force somebody to re-enter
   everything.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
  type UserCredential,
} from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { API_BASE_URL } from '../lib/config'

const BASE = `${API_BASE_URL}/api/vendor-auth`

/** The OTP endpoints answer with the same envelope the rest of the API uses. */
async function postJson(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let parsed: Record<string, unknown> = {}
    try {
      parsed = (await res.json()) as Record<string, unknown>
    } catch {
      parsed = {}
    }
    if (res.status === 429) {
      throw new Error(
        String(parsed.message ?? 'Please wait before requesting a new code.'),
      )
    }
    if (!res.ok) {
      throw new Error(
        String(parsed.message ?? parsed.error ?? 'Something went wrong. Please try again.'),
      )
    }
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Registration step 1. Creates the Firebase Auth account and both Firestore
 * documents. Does NOT send the OTP — the caller does that separately.
 * Returns the uid so the OTP screen can pass it to `completeVerification`.
 */
export async function initRegistration({
  email,
  password,
  firstName,
  lastName,
  phone,
  universityId,
  universityName,
}: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  universityId: string
  universityName: string
}): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  const uid = credential.user.uid

  try {
    // Both documents in a single batch — atomic and one round trip.
    const batch = writeBatch(db)
    batch.set(doc(db, 'users', uid), {
      uid,
      email: email.toLowerCase().trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      role: 'buyer',
      // The campus decides what this account can see. `universityName` rides
      // along so account screens and support tooling can read it without
      // pulling the registry down first.
      universityId,
      universityName,
      photoUrl: '',
      accountStatus: 'active',
      isEmailVerified: false,
      emailVerified: false,
      isEmailOtpVerified: false,
      fcmToken: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    })
    batch.set(doc(db, 'buyers', uid), {
      userId: uid,
      walletBalance: 0,
      loyaltyPoints: 0,
      defaultAddressId: '',
      totalOrders: 0,
      isBlocked: false,
      createdAt: serverTimestamp(),
    })
    await batch.commit()
  } catch (e) {
    // Clean up so the customer can retry rather than being locked out by a
    // half-created account.
    await deleteRegistration(uid)
    throw e
  }

  return uid
}

/**
 * Registration step 2. The backend marks isEmailOtpVerified/isEmailVerified
 * on the users document using the uid.
 */
export async function completeVerification({
  uid,
  email,
  otpCode,
}: {
  uid: string
  email: string
  otpCode: string
}): Promise<void> {
  await postJson(
    '/email-otp/verify',
    { email: email.toLowerCase().trim(), code: otpCode.trim(), uid },
    15_000,
  )
}

/**
 * Send / resend the code. The backend stores it keyed by email, so no uid is
 * needed at send time and the same endpoint serves both cases. The long
 * timeout is for the host's cold start.
 */
export async function sendOtp(email: string): Promise<void> {
  await postJson('/email-otp/send', { email: email.toLowerCase().trim() }, 30_000)
}

/** Deletes both documents and the auth account so a retry starts clean. */
export async function deleteRegistration(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid))
    await deleteDoc(doc(db, 'buyers', uid))
  } catch {
    /* the documents may never have been written */
  }
  try {
    await auth.currentUser?.delete()
  } catch {
    // delete() requires a recent sign-in; sign out as a fallback so the
    // orphaned account does not block re-registration on this device.
    try {
      await auth.signOut()
    } catch {
      /* nothing left to do */
    }
  }
}

export function login(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

/* ── Google ───────────────────────────────────────────────────────────── */

/**
 * The app this page is open inside, when it is one Google refuses to sign
 * people in from. Instagram, Facebook and the like open links in a browser of
 * their own, and Google answers it with a bare "disallowed_useragent" page —
 * so the person is told to open the link in a real browser instead.
 */
export function embeddedBrowser(): string | null {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook'
  if (/Instagram/.test(ua)) return 'Instagram'
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'TikTok'
  if (/Snapchat/.test(ua)) return 'Snapchat'
  if (/LinkedInApp/.test(ua)) return 'LinkedIn'
  if (/Twitter/.test(ua)) return 'X'
  if (/\bLine\//.test(ua)) return 'Line'
  // Any other Android app showing the page in a view of its own.
  if (/; wv\)/.test(ua)) return 'this app'
  return null
}

/**
 * Opens Google's account chooser and signs in with whichever account is
 * picked. An email that already has a password account lands in that same
 * account — Firebase keeps one account per address.
 *
 * `hasProfile` is false for somebody Blorbmart has never seen: Google gives a
 * name and an email, but not the phone number a rider calls or the campus the
 * catalogue is filtered by, so the caller sends them to finish signing up.
 *
 * Nothing is awaited before the popup opens. A browser only allows a popup
 * straight from a tap; any wait in between and it is blocked.
 */
export async function signInWithGoogle(): Promise<{ user: User; hasProfile: boolean }> {
  const { user } = await signInWithPopup(auth, googleProvider())
  return { user, hasProfile: await hasProfile(user.uid) }
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  // Always show the chooser: a shared phone must not sign the next person
  // into the last person's account.
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

const REDIRECT_KEY = 'blorb_google_redirect_v1'

/** A browser that will not open the window at all, tap or no tap. */
export function popupUnavailable(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment'
  )
}

/**
 * The same sign-in without a window: the whole page goes to Google and comes
 * back. For the browsers that refuse a popup outright — an installed app on
 * an iPhone is one. `from` is kept for the return, since the page reloads.
 */
export async function redirectToGoogle(from: string): Promise<void> {
  try {
    sessionStorage.setItem(REDIRECT_KEY, from)
  } catch {
    /* without it the return lands on home, which is fine */
  }
  await signInWithRedirect(auth, googleProvider())
}

/**
 * Picks up a sign-in that left through `redirectToGoogle`. Null when this
 * page load is not a return from Google, and asked only when one is expected:
 * the check itself loads Firebase's sign-in frame.
 */
export function googleRedirectResult(): Promise<GoogleReturn | null> {
  // One answer per page load, however many times it is asked: the note left
  // for the return is read once and then gone.
  redirectReturn ??= readRedirectReturn()
  return redirectReturn
}

interface GoogleReturn {
  user: User
  hasProfile: boolean
  from: string
}

let redirectReturn: Promise<GoogleReturn | null> | null = null

async function readRedirectReturn(): Promise<GoogleReturn | null> {
  let from: string | null = null
  try {
    from = sessionStorage.getItem(REDIRECT_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    from = null
  }
  if (from == null) return null

  const result = await getRedirectResult(auth)
  if (!result) return null
  return { user: result.user, hasProfile: await hasProfile(result.user.uid), from }
}

/**
 * Whether the account has its users document. Asked of the server: the local
 * cache has never seen a new account's document, and its "not there" is not
 * an answer. If the server cannot be reached the cache is the best there is,
 * and the app's own guard (see ProfileGate) corrects a wrong guess.
 */
async function hasProfile(uid: string): Promise<boolean> {
  const ref = doc(db, 'users', uid)
  try {
    return (await getDocFromServer(ref)).exists()
  } catch {
    try {
      return (await getDoc(ref)).exists()
    } catch {
      return true
    }
  }
}

/** First and last name out of the one string Google gives. */
export function splitDisplayName(displayName: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const parts = String(displayName ?? '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

/**
 * Writes the documents sign-up writes, for an account that came in through
 * Google. The email counts as verified: Google has already proved it.
 */
export async function completeGoogleProfile({
  firstName,
  lastName,
  phone,
  universityId,
  universityName,
}: {
  firstName: string
  lastName: string
  phone: string
  universityId: string
  universityName: string
}): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Your session ended. Sign in again.')
  const uid = user.uid

  // Only ever missing together, but a buyers record that is already there
  // cannot be written again: the rules treat that as an edit of a wallet.
  let buyerExists = false
  try {
    buyerExists = (await getDocFromServer(doc(db, 'buyers', uid))).exists()
  } catch {
    buyerExists = false
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), {
    uid,
    email: String(user.email ?? '').toLowerCase().trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    role: 'buyer',
    universityId,
    universityName,
    photoUrl: user.photoURL ?? '',
    accountStatus: 'active',
    isEmailVerified: true,
    emailVerified: true,
    isEmailOtpVerified: true,
    signInProvider: 'google',
    fcmToken: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  })
  if (!buyerExists) {
    batch.set(doc(db, 'buyers', uid), {
      userId: uid,
      walletBalance: 0,
      loyaltyPoints: 0,
      defaultAddressId: '',
      totalOrders: 0,
      isBlocked: false,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

/** Closing Google's window is a change of mind, not an error to show. */
export function isAuthCancelled(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  )
}

export async function sendPasswordReset(email: string, firstName?: string): Promise<void> {
  await postJson(
    '/password-reset/send',
    {
      email: email.toLowerCase().trim(),
      ...(firstName ? { firstName } : {}),
    },
    15_000,
  )
}

/** Records the sign-in so support can see when an account was last used. */
export async function touchLastLogin(uid: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid),
      { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true },
    )
  } catch {
    /* never block a sign-in on telemetry */
  }
}

/**
 * Turns a Firebase Auth error code into something a customer can act on.
 * The raw codes ("auth/invalid-credential") are meaningless to them.
 */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/user-disabled':
      return 'This account has been suspended. Message support.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect. If you usually continue with Google, use that instead.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.'
    case 'auth/account-exists-with-different-credential':
      return 'That email already has an account. Sign in with your email and password.'
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not available here right now. Use your email and password.'
    case 'auth/web-storage-unsupported':
    case 'auth/operation-not-supported-in-this-environment':
      return 'This browser cannot open Google sign-in. Open this page in Chrome or Safari.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'Google sign-in was cancelled.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Sign in instead.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'No internet connection.'
    default:
      if (error instanceof Error && error.message && error.message.length < 180) {
        return error.message
      }
      return 'Something went wrong. Please try again.'
  }
}
