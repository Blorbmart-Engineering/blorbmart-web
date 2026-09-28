/**
 * Blorbmart's sounds on the web — the same files the Android app plays.
 *
 *   alert           public/sounds/blorbmart-alert.wav, any foreground push
 *   orderAccepted   public/sounds/blorbmart_order_accepted.mp3, the kitchen
 *                   accepted the order
 *
 * Browsers refuse to start sound before the page has had a tap or a key
 * press. `primeAlertSound` plays each file silently on the first one, which
 * unlocks it, so a later push can ring with nobody touching the screen.
 * An alert that repeats stops on the next tap anywhere, or after `repeatFor`.
 *
 * Only the open tab can ring. A closed tab gets the browser's own
 * notification sound, which no web page can change.
 */
const SOURCES = {
  alert: '/sounds/blorbmart-alert.wav',
  orderAccepted: '/sounds/blorbmart_order_accepted.mp3',
} as const

export type AlertSound = keyof typeof SOURCES

const players: Partial<Record<AlertSound, HTMLAudioElement>> = {}
let current: HTMLAudioElement | null = null
let unlocked = false
let stopTimer: number | null = null

function element(sound: AlertSound): HTMLAudioElement | null {
  if (!players[sound] && typeof Audio !== 'undefined') {
    const a = new Audio(SOURCES[sound])
    a.preload = 'auto'
    a.volume = 1
    players[sound] = a
  }
  return players[sound] ?? null
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const

export function primeAlertSound() {
  if (typeof window === 'undefined' || unlocked) return
  const prime = () => {
    if (unlocked) return
    const all = (Object.keys(SOURCES) as AlertSound[])
      .map(element)
      .filter((a): a is HTMLAudioElement => a !== null)
    Promise.all(
      all.map((a) => {
        a.muted = true
        return a.play().then(() => {
          a.pause()
          a.currentTime = 0
          a.muted = false
        })
      }),
    )
      .then(() => {
        unlocked = true
        for (const g of GESTURES) window.removeEventListener(g, prime, true)
      })
      .catch(() => {
        for (const a of all) a.muted = false
      })
  }
  for (const g of GESTURES) window.addEventListener(g, prime, { capture: true, passive: true })
}

export function stopAlert() {
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer)
    stopTimer = null
  }
  window.removeEventListener('pointerdown', stopAlert, true)
  if (current) {
    current.loop = false
    current.pause()
    current.currentTime = 0
  }
}

/** Plays a sound. With `repeatFor`, it loops until a tap or that many ms. */
export function playAlert({
  repeatFor = 0,
  sound = 'alert',
}: { repeatFor?: number; sound?: AlertSound } = {}) {
  const a = element(sound)
  if (!a) return
  stopAlert()
  current = a
  a.loop = repeatFor > 0
  a.currentTime = 0
  void a.play().catch(() => undefined)
  try {
    // Good news gets two short taps; everything else the long alert buzz.
    navigator.vibrate?.(sound === 'orderAccepted' ? [90, 110, 160] : [700, 250, 700, 250, 700])
  } catch {
    // Blocked before the first gesture.
  }
  if (repeatFor > 0) {
    stopTimer = window.setTimeout(stopAlert, repeatFor)
    // Deferred, so the tap that caused the alert (if any) does not stop it.
    window.setTimeout(() => window.addEventListener('pointerdown', stopAlert, { capture: true, once: true }), 400)
  }
}
