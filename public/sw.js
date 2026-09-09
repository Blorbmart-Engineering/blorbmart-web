/* ═══════════════════════════════════════════════════════════════════════
   Blorbmart service worker.

   Does two jobs, and deliberately only two:

   1. Makes the app open offline. The shell and the build's static assets are
      cached, so an installed Blorbmart on a dead connection still opens to a
      real screen — Firestore's own IndexedDB cache then fills it with the
      last menus and orders it saw.

   2. Draws background push notifications. Firebase Messaging registers
      against this worker (push.ts passes it explicitly), so there is one
      worker rather than the usual two fighting over the same scope.

   What it deliberately does NOT do is cache API responses. Prices, wallet
   balances and order status are the things a stale copy would do real damage
   to, so every /api call goes to the network and fails honestly.
   ═══════════════════════════════════════════════════════════════════════ */

const VERSION = 'v1'
const SHELL_CACHE = `blorb-shell-${VERSION}`
const ASSET_CACHE = `blorb-assets-${VERSION}`

/**
 * The bare minimum for a first paint. The hashed JS/CSS bundles are not
 * listed — their names change every build, so they are cached as they are
 * requested instead.
 */
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/assets/icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 in the list cannot fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Lets the page tell a waiting worker to take over immediately. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|json)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache the API, Firestore, or auth. A stale price or order status is
  // worse than an error message.
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('onrender.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('paystack')
  ) {
    return
  }

  // Navigations: network first, so a deployed change is picked up, falling
  // back to the cached shell when there is no connection. Single-page routes
  // all resolve to the same document.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() =>
          caches.match('/').then((cached) => cached ?? caches.match(request)),
        ),
    )
    return
  }

  // Static assets: cache first. Vite fingerprints them, so a cached hit can
  // never be the wrong version.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // Menu and store photography: stale-while-revalidate. A slightly old photo
  // is fine; a blank card is not.
  if (url.hostname === 'res.cloudinary.com' || url.hostname.includes('firebasestorage')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response.ok) void cache.put(request, response.clone())
              return response
            })
            .catch(() => cached)
          return cached ?? network
        }),
      ),
    )
  }
})

/* ── Push ──────────────────────────────────────────────────────────────
   Firebase Messaging's own SW helper is not imported here: it pulls two
   compat bundles over the network on every worker start, and all it does for
   a data payload is what the handler below does directly. */

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { notification: { title: 'Blorbmart', body: event.data.text() } }
  }

  const notification = payload.notification ?? {}
  const data = payload.data ?? {}
  const title = notification.title ?? data.title ?? 'Blorbmart'
  const body = notification.body ?? data.body ?? ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      // Groups repeated updates about one order into a single notification
      // rather than stacking five.
      tag: data.tag ?? data.orderId ?? 'blorbmart',
      renotify: true,
      data: { link: data.link ?? data.route ?? '/home' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link ?? '/home'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an open Blorbmart rather than opening a second copy.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          void client.focus()
          if ('navigate' in client) return client.navigate(link)
          return undefined
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
