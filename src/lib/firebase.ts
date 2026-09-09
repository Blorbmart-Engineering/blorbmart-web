import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { FIREBASE_CONFIG } from './config'

export const app = initializeApp(FIREBASE_CONFIG)

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
