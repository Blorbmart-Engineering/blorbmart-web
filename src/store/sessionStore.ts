/* ═══════════════════════════════════════════════════════════════════════
   The signed-in person and where they want food delivered.
   A port of lib/data/repos/session.dart.

   One store the whole app listens to, rather than each screen re-reading the
   users document. It owns three things: the profile, the chosen delivery
   address, and the push-token registration.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { Api, ApiError } from '../lib/api'
import { asString, titleCase } from '../lib/format'
import { addressFromJson, type DeliveryAddress } from '../models/address'
import { BILLS_ONLY_ID, type University } from '../data/university'
import { setCampus, setUserLocation } from '../data/catalog'
import { clearSearchCache } from '../data/search'
import { useCartStore } from './cartStore'
import { registerPushToken, removePushToken } from '../lib/push'

const ADDRESS_KEY = 'blorb_selected_address_v1'

type Profile = Record<string, unknown>

interface SessionState {
  user: User | null
  profile: Profile
  address: DeliveryAddress | null
  ready: boolean

  start: () => void
  setAddress: (address: DeliveryAddress | null) => Promise<void>
  loadAddresses: () => Promise<DeliveryAddress[]>
  setUniversity: (campus: University) => Promise<void>
  signOut: () => Promise<void>
}

let authUnsub: (() => void) | null = null
let profileUnsub: (() => void) | null = null

function persistAddress(a: DeliveryAddress | null) {
  try {
    if (!a) {
      localStorage.removeItem(ADDRESS_KEY)
      return
    }
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(a))
  } catch (e) {
    console.warn('[session] address persist failed', e)
  }
}

function restoreAddress(): DeliveryAddress | null {
  try {
    const raw = localStorage.getItem(ADDRESS_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return addressFromJson(parsed as Record<string, unknown>)
  } catch (e) {
    console.warn('[session] address restore failed', e)
    return null
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  profile: {},
  address: null,
  ready: false,

  start: () => {
    if (authUnsub) return

    const restored = restoreAddress()
    if (restored) {
      set({ address: restored })
      setUserLocation(restored.lat, restored.lng)
    }

    authUnsub = onAuthStateChanged(auth, (user) => {
      const changed = user?.uid !== get().user?.uid
      set({ user })
      if (!changed) {
        set({ ready: true })
        return
      }

      Api.invalidateToken()
      clearSearchCache()

      if (!user) {
        profileUnsub?.()
        profileUnsub = null
        set({ profile: {} })
        setCampus(null)
        void useCartStore.getState().onSignOut()
      } else {
        listenToProfile(user.uid, set, get)
        void registerPushToken()
        void useCartStore.getState().onSignIn()
      }
      set({ ready: true })
    })
  },

  setAddress: async (address) => {
    set({ address })
    // Distance-sorted browsing depends on this, so push it straight through.
    setUserLocation(address?.lat ?? null, address?.lng ?? null)
    persistAddress(address)
  },

  /**
   * Loads the account's saved addresses and picks the default one when the
   * device has none selected yet.
   */
  loadAddresses: async () => {
    const uid = get().user?.uid
    if (!uid) return []
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'addresses'))
      const list = snap.docs.map((d) => addressFromJson({ ...d.data(), docId: d.id }))

      if (!get().address && list.length) {
        const preferred = list.find((a) => a.isDefault) ?? list[0]
        await get().setAddress(preferred)
      }
      return list
    } catch (e) {
      console.warn('[session] loadAddresses failed', e)
      return []
    }
  },

  /**
   * Sets this account's campus, for the one and only time it is allowed.
   *
   * Written straight to the profile document the session already listens to,
   * so every open screen re-filters itself without a manual refresh.
   *
   * Both guards below are also enforced in the Firestore security rules. The
   * rules are what actually protects the data — these exist so the app can say
   * something useful instead of surfacing a permission error.
   */
  setUniversity: async (campus) => {
    const uid = get().user?.uid
    if (!uid) return

    if (!canChooseCampus(get())) {
      throw new ApiError(
        'Your school is set for this account and cannot be changed. ' +
          'Message support if it is wrong.',
      )
    }
    if (campus.billsOnly) throw new ApiError('Choose the school you attend.')

    await setDoc(
      doc(db, 'users', uid),
      {
        universityId: campus.id,
        universityName: campus.name,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  },

  signOut: async () => {
    // Deactivated before the sign-out, while the ID token this call needs is
    // still valid. Otherwise this device keeps receiving the previous
    // customer's order and payment alerts.
    try {
      await removePushToken()
    } catch (e) {
      console.warn('[session] device token removal skipped', e)
    }
    try {
      await fbSignOut(auth)
    } finally {
      Api.invalidateToken()
      clearSearchCache()
    }
  },
}))

/**
 * Live profile: a name change in the profile screen, or an account being
 * suspended by an admin, reaches every screen without a refresh.
 */
function listenToProfile(
  uid: string,
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
) {
  profileUnsub?.()
  profileUnsub = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const previousCampus = catalogCampusId(get())
      set({ profile: snap.data() ?? {} })

      // Pushed rather than pulled, for the same reason the delivery address
      // is: both hold a filtered index, so they have to be told when the
      // filter changes instead of discovering it on the next read. Gated on
      // an actual change — this stream also fires for a name edit or a
      // push-token write, and dropping caches for those would refetch the
      // whole catalogue for nothing.
      const next = catalogCampusId(get())
      if (next !== previousCampus) {
        setCampus(next)
        clearSearchCache()
      }
    },
    (e) => console.warn('[session] profile stream failed', e),
  )
}

/* ── Derived reads ────────────────────────────────────────────────────── */

export function isSignedIn(s: SessionState): boolean {
  return s.user != null
}

export function firstName(s: SessionState): string {
  const name = asString(s.profile.firstName)
  if (name) return titleCase(name)
  const display = s.user?.displayName ?? ''
  if (display) return titleCase(display.split(' ')[0])
  return 'there'
}

export function fullName(s: SessionState): string {
  const parts = [asString(s.profile.firstName), asString(s.profile.lastName)].filter(
    Boolean,
  )
  if (parts.length) return titleCase(parts.join(' '))
  return s.user?.displayName ?? ''
}

export function sessionEmail(s: SessionState): string {
  return s.user?.email ?? asString(s.profile.email)
}

export function sessionPhone(s: SessionState): string {
  return asString(s.profile.phone)
}

export function photoUrl(s: SessionState): string {
  return asString(s.profile.photoUrl, s.user?.photoURL ?? '')
}

/**
 * The campus this account shops on, chosen at signup.
 *
 * Empty for accounts created before campuses existed, and that is read
 * everywhere as "show them everything" rather than "show them nothing" — an
 * older account must not open to an empty app.
 */
export function universityId(s: SessionState): string {
  return asString(s.profile.universityId)
}

export function universityName(s: SessionState): string {
  return asString(s.profile.universityName)
}

export function hasCampus(s: SessionState): boolean {
  return universityId(s).length > 0
}

/**
 * True when this person told us their school is not on our list.
 *
 * They are a bills customer, not a broken account: the app opens on bill
 * payments for them and the marketplace tabs stay out of the way until they
 * pick a real campus from their profile.
 */
export function isBillsOnly(s: SessionState): boolean {
  return universityId(s) === BILLS_ONLY_ID
}

/** True once this account is tied to an actual campus. */
export function hasRealCampus(s: SessionState): boolean {
  return universityId(s).length > 0 && !isBillsOnly(s)
}

/**
 * Whether the campus can still be chosen.
 *
 * Once. The campus decides which catalogue, prices and delivery zone this
 * account sees, so an account that can flip between campuses can shop one it
 * is not on — and can do it after seeing the prices on both. It is set at
 * signup and fixed from then on.
 *
 * The exception is the account that signed up saying its school was not
 * listed. That account never chose a campus, so choosing one for the first
 * time when we open their school is finishing signup, not switching.
 */
export function canChooseCampus(s: SessionState): boolean {
  return !hasRealCampus(s)
}

/** The campus used to filter the catalogue. Null means "do not filter". */
export function catalogCampusId(s: SessionState): string | null {
  const id = universityId(s)
  return !id || isBillsOnly(s) ? null : id
}

/** Greeting that tracks the clock — small touch, reads as attentive. */
export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
