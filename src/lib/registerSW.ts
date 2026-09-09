/* ═══════════════════════════════════════════════════════════════════════
   Service worker registration.

   Kept out of main.tsx so the boot path stays readable, and deliberately
   quiet: a worker that fails to register must never stop the app loading.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * A new build is live in the background.
 *
 * The app does not reload underneath somebody — a forced refresh mid-checkout
 * would lose a half-filled form. The worker takes over on the next launch,
 * which for an installed app is usually minutes away.
 */
function onUpdateReady(registration: ServiceWorkerRegistration): void {
  console.info('[sw] a new version is ready and will apply on next launch')
  // Nothing is claimed now, but the waiting worker is told to skip its wait so
  // the next navigation gets the new build rather than the one after that.
  registration.waiting?.postMessage('SKIP_WAITING')
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // Vite serves /public straight through in dev, but a caching worker there
  // fights the HMR pipeline and hides changes.
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady(registration)
            }
          })
        })
      })
      .catch((e) => {
        // A blocked worker costs offline support and background push. The app
        // itself still works, so this is a warning and not an error.
        console.warn('[sw] registration failed', e)
      })
  })
}
