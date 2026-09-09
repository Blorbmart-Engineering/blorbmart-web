/* ═══════════════════════════════════════════════════════════════════════
   The basket — a port of lib/data/repos/cart_repo.dart.

   Persistence is two-tier:
     * localStorage, written on every mutation, so a closed tab mid-order
       loses nothing;
     * Firestore, written debounced, so the basket follows the account onto
       another device without costing a write per tap.

   One vendor per basket. Mixing two kitchens into one delivery is a promise
   the logistics cannot keep, so adding across vendors prompts to start over.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import {
  cartLineFromMap,
  cartLineToMap,
  lineSignature,
  lineTotal,
  type CartLine,
} from '../models/cart'
import type { Vertical } from '../models/catalog'
import { clamp } from '../lib/format'

const LOCAL_KEY = 'blorb_cart_v2'
const SYNC_DEBOUNCE_MS = 2000

function scopedKey(): string {
  return `${LOCAL_KEY}_${auth.currentUser?.uid ?? 'guest'}`
}

interface CartState {
  lines: CartLine[]
  loaded: boolean

  load: () => Promise<void>
  /**
   * Adds a line, merging into an identical one when the add-ons and note
   * match. Returns false when the basket belongs to another vendor and the
   * caller has not confirmed a reset.
   */
  add: (line: CartLine, replaceOtherStore?: boolean) => boolean
  increment: (signature: string) => void
  decrement: (signature: string) => void
  removeLine: (signature: string) => void
  /**
   * Decrements by product id — used by the stepper on a menu row, which does
   * not know about individual add-on combinations. Removes the most recently
   * added variation first, which is what a person expects.
   */
  decrementItem: (itemId: string) => void
  setNote: (signature: string, note: string) => void
  clear: () => void
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function persistLocal(lines: CartLine[]) {
  try {
    if (!lines.length) localStorage.removeItem(scopedKey())
    else localStorage.setItem(scopedKey(), JSON.stringify(lines.map(cartLineToMap)))
  } catch (e) {
    console.warn('[cart] local save failed', e)
  }
}

async function syncRemote(lines: CartLine[]) {
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    const ref = doc(db, 'carts', uid)
    if (!lines.length) {
      await setDoc(
        ref,
        { userId: uid, lines: [], itemCount: 0, subtotal: 0, updatedAt: serverTimestamp() },
        { merge: true },
      )
      return
    }
    await setDoc(
      ref,
      {
        userId: uid,
        storeId: lines[0].storeId,
        storeName: lines[0].storeName,
        vertical: lines[0].vertical,
        lines: lines.map(cartLineToMap),
        itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        subtotal: lines.reduce((s, l) => s + lineTotal(l), 0),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (e) {
    console.warn('[cart] remote sync failed', e)
  }
}

function scheduleSync(lines: CartLine[]) {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => void syncRemote(lines), SYNC_DEBOUNCE_MS)
}

export const useCartStore = create<CartState>((set, get) => {
  /** notify + persist + schedule the remote write, in one place. */
  const commit = (lines: CartLine[]) => {
    set({ lines })
    persistLocal(lines)
    scheduleSync(lines)
  }

  return {
    lines: [],
    loaded: false,

    load: async () => {
      if (get().loaded) return
      set({ loaded: true })

      try {
        const raw = localStorage.getItem(scopedKey())
        if (raw) {
          const decoded: unknown = JSON.parse(raw)
          if (Array.isArray(decoded)) {
            set({
              lines: decoded
                .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
                .map(cartLineFromMap),
            })
          }
        }
      } catch (e) {
        console.warn('[cart] local load failed', e)
      }

      // Remote is best-effort and must never block the UI.
      const uid = auth.currentUser?.uid
      if (!uid) return
      try {
        const snap = await getDoc(doc(db, 'carts', uid))
        if (!snap.exists()) return
        const raw = snap.data()?.lines
        if (!Array.isArray(raw) || !raw.length) return

        const remote = raw
          .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
          .map(cartLineFromMap)

        // The local basket is the one the person was just holding, so it
        // wins. Remote only fills an empty basket after a new device.
        if (!get().lines.length && remote.length) {
          set({ lines: remote })
          persistLocal(remote)
        }
      } catch (e) {
        console.warn('[cart] remote load failed', e)
      }
    },

    add: (line, replaceOtherStore = false) => {
      let lines = get().lines
      if (lines.length && lines[0].storeId !== line.storeId) {
        if (!replaceOtherStore) return false
        lines = []
      }

      const signature = lineSignature(line)
      const index = lines.findIndex((l) => lineSignature(l) === signature)
      if (index >= 0) {
        const next = [...lines]
        next[index] = {
          ...next[index],
          quantity: clamp(next[index].quantity + line.quantity, 1, 99),
        }
        commit(next)
      } else {
        commit([...lines, line])
      }
      return true
    },

    increment: (signature) => {
      const lines = get().lines
      const i = lines.findIndex((l) => lineSignature(l) === signature)
      if (i < 0 || lines[i].quantity >= 99) return
      const next = [...lines]
      next[i] = { ...next[i], quantity: next[i].quantity + 1 }
      commit(next)
    },

    decrement: (signature) => {
      const lines = get().lines
      const i = lines.findIndex((l) => lineSignature(l) === signature)
      if (i < 0) return
      const next = [...lines]
      if (next[i].quantity <= 1) next.splice(i, 1)
      else next[i] = { ...next[i], quantity: next[i].quantity - 1 }
      commit(next)
    },

    removeLine: (signature) => {
      commit(get().lines.filter((l) => lineSignature(l) !== signature))
    },

    decrementItem: (itemId) => {
      const lines = get().lines
      let i = -1
      for (let k = lines.length - 1; k >= 0; k--) {
        if (lines[k].itemId === itemId) {
          i = k
          break
        }
      }
      if (i < 0) return
      const next = [...lines]
      if (next[i].quantity <= 1) next.splice(i, 1)
      else next[i] = { ...next[i], quantity: next[i].quantity - 1 }
      commit(next)
    },

    setNote: (signature, note) => {
      const lines = get().lines
      const i = lines.findIndex((l) => lineSignature(l) === signature)
      if (i < 0) return
      const next = [...lines]
      next[i] = { ...next[i], note }
      commit(next)
    },

    clear: () => {
      if (!get().lines.length) return
      commit([])
    },

    /** Called after sign-in so a guest basket is adopted by the account. */
    onSignIn: async () => {
      set({ loaded: false })
      await get().load()
      scheduleSync(get().lines)
    },

    /**
     * Called on sign-out: drops the in-memory basket without wiping the
     * signed-in user's saved one.
     */
    onSignOut: async () => {
      if (syncTimer) clearTimeout(syncTimer)
      await syncRemote(get().lines)
      set({ lines: [], loaded: false })
    },
  }
})

/* ── Derived reads. Selectors rather than stored fields, so nothing can
      drift out of step with `lines`. ──────────────────────────────────── */

export const cartIsEmpty = (lines: CartLine[]) => lines.length === 0

export const cartItemCount = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.quantity, 0)

export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce((s, l) => s + lineTotal(l), 0)

/** The vendor this basket belongs to, or null when empty. */
export const cartStoreId = (lines: CartLine[]): string | null =>
  lines.length ? lines[0].storeId : null

export const cartStoreName = (lines: CartLine[]): string =>
  lines.length ? lines[0].storeName : ''

export const cartVertical = (lines: CartLine[]): Vertical =>
  lines.length ? lines[0].vertical : 'restaurants'

/**
 * Quantity of a given product across all its variations — drives the stepper
 * on the menu row.
 */
export const cartQuantityOf = (lines: CartLine[], itemId: string) =>
  lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.quantity, 0)

export const cartBelongsToOtherStore = (lines: CartLine[], otherStoreId: string) =>
  lines.length > 0 && lines[0].storeId !== otherStoreId
