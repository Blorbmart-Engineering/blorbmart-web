/* ═══════════════════════════════════════════════════════════════════════
   PWA check.

   Asserts the things that decide whether Blorbmart installs and survives a
   dead connection: a valid manifest, a service worker that takes control, a
   cached shell, and the iOS meta tags Apple reads instead of the manifest.

     npm run build && npx vite preview --port 5173
     node scripts/pwa-check.mjs
   ═══════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright-core'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173'
const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

/* ── Manifest ────────────────────────────────────────────────────────── */
const manifest = await (await context.request.get(`${BASE}/manifest.webmanifest`)).json()
check(manifest.name === 'Blorbmart', 'manifest name', manifest.name)
check(manifest.display === 'standalone', 'display: standalone', manifest.display)
check(manifest.start_url === '/home', 'start_url', manifest.start_url)
check(manifest.theme_color === '#1F77F1', 'theme_color matches --color-brand', manifest.theme_color)
check(
  manifest.icons.some((i) => i.sizes === '192x192' && i.purpose === 'any') &&
    manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'),
  'has 192 and 512 "any" icons',
)
check(
  manifest.icons.some((i) => i.purpose === 'maskable'),
  'has a maskable icon (Android adaptive)',
)
check((manifest.shortcuts ?? []).length >= 3, 'app shortcuts', `${(manifest.shortcuts ?? []).length}`)

/* ── Icons resolve ───────────────────────────────────────────────────── */
for (const icon of manifest.icons) {
  const res = await context.request.get(`${BASE}${icon.src}`)
  if (!res.ok()) check(false, `icon ${icon.src}`, `HTTP ${res.status()}`)
}
check(true, 'every manifest icon resolves')

/* ── iOS meta, which Apple reads instead of the manifest ─────────────── */
await page.goto(`${BASE}/home`, { waitUntil: 'load', timeout: 45_000 })
const head = await page.evaluate(() => ({
  appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
  appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
  statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
  touchIcons: document.querySelectorAll('link[rel="apple-touch-icon"]').length,
  viewportFit: document.querySelector('meta[name="viewport"]')?.getAttribute('content')?.includes('viewport-fit=cover'),
  manifestLink: !!document.querySelector('link[rel="manifest"]'),
}))
check(head.appleCapable === 'yes', 'iOS: apple-mobile-web-app-capable')
check(head.appleTitle === 'Blorbmart', 'iOS: home-screen title', head.appleTitle)
check(head.statusBar === 'black-translucent', 'iOS: status bar style', head.statusBar)
check(head.touchIcons >= 4, 'iOS: apple-touch-icon sizes', `${head.touchIcons}`)
check(head.viewportFit === true, 'iOS: viewport-fit=cover (safe areas)')
check(head.manifestLink, 'manifest is linked')

/* ── Service worker ──────────────────────────────────────────────────── */
const swReady = await page
  .waitForFunction(
    () => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready,
    undefined,
    { timeout: 20_000 },
  )
  .then(() => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return { scope: reg.scope, active: !!reg.active }
  }))
  .catch(() => null)

check(!!swReady?.active, 'service worker is active', swReady?.scope ?? '')

/* ── Offline ─────────────────────────────────────────────────────────── */
if (swReady?.active) {
  // Reload once so the worker is controlling this client before the network
  // is cut — a worker that installed on this very load controls nothing yet.
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await context.setOffline(true)
  let offlineOk = false
  try {
    await page.goto(`${BASE}/home`, { waitUntil: 'load', timeout: 20_000 })
    const text = await page.locator('body').innerText()
    offlineOk = text.length > 0 && !text.includes('ERR_INTERNET_DISCONNECTED')
  } catch {
    offlineOk = false
  }
  await context.setOffline(false)
  check(offlineOk, 'opens offline from the cached shell')
}

await browser.close()
console.log(`\n${failures === 0 ? 'All PWA checks passed' : `${failures} PWA check(s) failed`}`)
process.exit(failures > 0 ? 1 : 0)
