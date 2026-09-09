/* ═══════════════════════════════════════════════════════════════════════
   Account creation and sign-in — a port of lib/services/auth_service.dart.

   Registration is deliberately two steps. Step one creates the Firebase Auth
   account and the Firestore documents; step two verifies the emailed code.
   They are separate so a backend cold start while sending the OTP does not
   destroy an already-created account and force somebody to re-enter
   everything.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth'
import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
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
      return 'Email or password is incorrect.'
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
