import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { FIREBASE_CONFIG, GOOGLE_AUTH_HOSTS, IS_DEV } from './config'

const host = typeof location === 'undefined' ? '' : location.hostname
const servesOwnAuthPages = GOOGLE_AUTH_HOSTS.includes(host)

/** Whether this page may offer "Continue with Google". See GOOGLE_AUTH_HOSTS. */
export const GOOGLE_SIGN_IN_ENABLED = servesOwnAuthPages || IS_DEV

export const app = initializeApp({
  ...FIREBASE_CONFIG,
  // Google's sign-in pages are loaded from the auth domain. On a host that
  // serves them itself that is this host, so nothing depends on reaching
  // firebaseapp.com from the customer's network.
  authDomain: servesOwnAuthPages ? host : FIREBASE_CONFIG.authDomain,
})

export const auth = getAuth(app)

// Session survives a reload but never leaves the device. Installed as a PWA,
// this is what keeps somebody signed in between launches.
void setPersistence(auth, browserLocalPersistence)

/**
 * Persistent cache: menus and restaurant cards are read constantly and change
 * slowly. Serving them from IndexedDB makes repeat navigation feel instant,
 * cuts Firestore reads (and cost) hard, and is what lets an installed app
 * open to real content with no connection at all.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
