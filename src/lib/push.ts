/* ═══════════════════════════════════════════════════════════════════════
   Web push — the browser half of lib/services/notification_service.dart.

   The token has to reach the backend's `deviceTokens` collection, because
   that is the only place the sender looks. Writing it to `users/{uid}
   .fcmToken` alone put it somewhere nothing reads, so every send found zero
   tokens and returned "skipped: no active device tokens" without an error
   anywhere. Both writes happen here, for the same reason they do on the phone.

   Everything in this module is best-effort. A browser that refuses
   notifications — which is every iOS browser until the app is added to the
   Home Screen — still gets a fully working app.
   ═══════════════════════════════════════════════════════════════════════ */

import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, auth, db } from './firebase'
import { API_BASE_URL, APP_VERSION, VAPID_KEY } from './config'

export type PushState =
  | 'unsupported'
  | 'not_configured'
  | 'denied'
  | 'default'
  | 'granted'

/**
 * iOS only exposes the Push API to a web app that has been added to the Home
 * Screen. Asking before then throws, so the prompt is gated on this.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's non-standard flag, the only signal on older iOS.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export async function pushSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

export async function pushState(): Promise<PushState> {
  if (!(await pushSupported())) return 'unsupported'
  if (!VAPID_KEY) return 'not_configured'
  return Notification.permission as PushState
}

/** Whether it is worth showing the customer an "enable alerts" prompt. */
export async function canPromptForPush(): Promise<boolean> {
  return (await pushState()) === 'default'
}

async function swRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return undefined
  }
}

async function currentToken(): Promise<string | null> {
  if (!(await pushSupported()) || !VAPID_KEY) return null
  try {
    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await swRegistration(),
    })
    return token || null
  } catch (e) {
    console.warn('[push] getToken failed', e)
    return null
  }
}

/**
 * Posts the token to the backend. Uses raw fetch rather than the Api helper
 * because a push failure must never surface as an ApiError to a screen.
 */
async function postToken(userId: string, token: string): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) return
    await fetch(`${API_BASE_URL}/api/notifications/tokens/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        userId,
        token,
        platform: 'web',
        // Full UA strings are needless fingerprinting surface in our own DB.
        deviceId: navigator.userAgent.slice(0, 120),
        appVersion: APP_VERSION,
      }),
    })
  } catch (e) {
    console.warn('[push] token registration failed', e)
  }
}

/**
 * Registers this browser for push.
 *
 * Never requests permission on its own — a permission prompt fired on page
 * load is the fastest way to a permanent "denied". Call `requestPush` from a
 * real tap instead. This only picks up a permission that has already been
 * granted, which is the case on every launch after the first.
 */
export async function registerPushToken(): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  if ((await pushState()) !== 'granted') return

  const token = await currentToken()
  if (!token) return

  await postToken(user.uid, token)

  // The user-document copy is kept alongside it: it costs one write and it is
  // the field an admin looking at a customer's record would expect.
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      { fcmToken: token, updatedAt: serverTimestamp() },
      { merge: true },
    )
  } catch (e) {
    console.warn('[push] token mirror skipped', e)
  }
}

/** Asks for permission, then registers. Must be called from a user gesture. */
export async function requestPush(): Promise<PushState> {
  if (!(await pushSupported())) return 'unsupported'
  if (!VAPID_KEY) return 'not_configured'
  try {
    const result = await Notification.requestPermission()
    if (result === 'granted') await registerPushToken()
    return result as PushState
  } catch (e) {
    console.warn('[push] permission request failed', e)
    return 'denied'
  }
}

/**
 * Called on sign-out, while the ID token this needs is still valid. Otherwise
 * this browser keeps receiving the previous customer's order and payment
 * alerts.
 */
export async function removePushToken(): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  const token = await currentToken()
  if (!token) return

  try {
    const idToken = await user.getIdToken()
    await fetch(`${API_BASE_URL}/api/notifications/tokens/remove`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ userId: user.uid, token }),
    })
  } catch (e) {
    console.warn('[push] token removal failed', e)
  }

  try {
    await deleteToken(getMessaging(app))
  } catch {
    /* the local token is gone either way once the account changes */
  }
}

/**
 * Foreground messages. The service worker only shows a notification when the
 * page is in the background, so a push that lands while somebody is looking at
 * the app has to be surfaced by the app itself.
 */
export async function onForegroundPush(
  handler: (payload: { title: string; body: string; link?: string }) => void,
): Promise<() => void> {
  if (!(await pushSupported())) return () => {}
  try {
    return onMessage(getMessaging(app), (payload) => {
      const n = payload.notification
      const data = payload.data ?? {}
      handler({
        title: n?.title ?? data.title ?? 'Blorbmart',
        body: n?.body ?? data.body ?? '',
        link: data.link ?? data.route,
      })
    })
  } catch (e) {
    console.warn('[push] foreground listener failed', e)
    return () => {}
  }
}
