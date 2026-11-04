/* ═══════════════════════════════════════════════════════════════════════
   What a signed-in customer does, for reminder nudges
   (backend services/engagementService.js).

   Events are queued in memory and sent in one small batch every 15 seconds,
   and when the tab is hidden, so browsing a menu costs one request, not one
   per tap. Signed-out visitors send nothing. A failed send is dropped: an
   event is a hint, never a record anything depends on.
   ═══════════════════════════════════════════════════════════════════════ */

import { auth } from './firebase'
import { Api } from './api'

export type EngagementEvent =
  | { type: 'app_open' }
  | { type: 'store_view'; storeId: string; storeName?: string }
  | { type: 'product_view'; storeId?: string }
  | { type: 'add_to_cart'; storeId: string; storeName?: string }
  | { type: 'checkout_start' }
  | { type: 'order_placed' }

const queue: Array<EngagementEvent & { at: number }> = []
let timer: ReturnType<typeof setTimeout> | null = null

export function track(event: EngagementEvent) {
  if (!auth.currentUser) return
  queue.push({ ...event, at: Date.now() })
  if (queue.length >= 40) void flush()
  else if (!timer) timer = setTimeout(() => void flush(), 15_000)
}

export async function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!queue.length || !auth.currentUser) return
  const events = queue.splice(0, queue.length)
  try {
    await Api.post('/api/engagement/events', { body: { events } })
  } catch {
    // Dropped on purpose; see above.
  }
}

/** A reminder that opened this page carries ?nudge=<id>: count the open. */
function reportNudgeOpen() {
  const params = new URLSearchParams(window.location.search)
  const nudgeId = params.get('nudge')
  if (!nudgeId) return
  params.delete('nudge')
  const rest = params.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
  const send = () => void Api.post('/api/engagement/opened', { body: { nudgeId } }).catch(() => {})
  if (auth.currentUser) send()
  else {
    const off = auth.onAuthStateChanged((user) => {
      if (user) {
        off()
        send()
      }
    })
  }
}

let started = false

/** Called once from main. */
export function startEngagement() {
  if (started) return
  started = true
  reportNudgeOpen()
  let opened = false
  auth.onAuthStateChanged((user) => {
    if (user && !opened) {
      opened = true
      track({ type: 'app_open' })
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
    else if (auth.currentUser) track({ type: 'app_open' })
  })
}

/** Reminders on or off, from the customer's account screen. */
export const reminderPrefs = {
  get: async () => (await Api.get('/api/engagement/preferences')).reminders !== false,
  set: (reminders: boolean) => Api.patch('/api/engagement/preferences', { body: { reminders } }),
}
