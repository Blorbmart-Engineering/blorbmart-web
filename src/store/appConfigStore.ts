/* ═══════════════════════════════════════════════════════════════════════
   The switches an admin flips without a release. A port of
   lib/data/repos/app_config.dart.

   Read from the public /api/settings when the shop loads and whenever the
   tab comes back into view (at most once a minute). The last answer is kept
   in localStorage, so a reload with no network keeps a switched-off feature
   off. A first visit with no answer assumes on: the backend refuses a bill
   purchase when bills are off, whatever the page shows.
   ═══════════════════════════════════════════════════════════════════════ */

import { create } from 'zustand'
import { Api } from '../lib/api'

const BILLS_KEY = 'config.billPaymentsEnabled'
const REFRESH_MS = 60_000

const stored = (): boolean => {
  try {
    return localStorage.getItem(BILLS_KEY) !== 'false'
  } catch {
    return true
  }
}

interface AppConfigState {
  billPaymentsEnabled: boolean
  fetchedAt: number
  refresh: (force?: boolean) => Promise<void>
}

export const useAppConfig = create<AppConfigState>((set, get) => ({
  billPaymentsEnabled: stored(),
  fetchedAt: 0,
  refresh: async (force = false) => {
    if (!force && Date.now() - get().fetchedAt < REFRESH_MS) return
    set({ fetchedAt: Date.now() })
    try {
      const data = await Api.get('/api/settings', { auth: false })
      const bills = data.billPaymentsEnabled !== false
      set({ billPaymentsEnabled: bills })
      try {
        localStorage.setItem(BILLS_KEY, String(bills))
      } catch {
        // Private mode: the in-memory value is enough for this visit.
      }
    } catch {
      set({ fetchedAt: 0 })
    }
  },
}))

/** Starts the reads. Called once from main. */
export function startAppConfig() {
  void useAppConfig.getState().refresh(true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void useAppConfig.getState().refresh()
  })
}
