/* ═══════════════════════════════════════════════════════════════════════
   Smoke test.

   Drives the built app in a real Chrome and asserts that each screen renders
   the thing it exists to render. Run against `vite preview` on port 5173 —
   that origin is on the backend's CORS allowlist, so the bill catalogue and
   the wallet actually answer.

     npm run build && npx vite preview --port 5173
     node scripts/smoke.mjs
   ═══════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright-core'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173'
const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

/** Each case: a route, and text that proves the screen did its job. */
const CASES = [
  { route: '/welcome', expect: ['are hungry for', 'Create an account', 'Restaurants', 'Bills'] },
  { route: '/home', expect: ['What are you eating today', 'DELIVER TO', 'Pharmacy', 'Account'] },
  { route: '/bills', expect: ['Pay a bill', 'Airtime', 'Electricity'] },
  { route: '/events', expect: ['Events'] },
  { route: '/search', expect: ['Try one of these', 'Jollof rice'] },
  { route: '/cart', expect: ['Your basket is empty'] },
  { route: '/login', expect: ['Welcome back', 'Email address', 'Password'] },
  { route: '/signup', expect: ['Create your account', 'School', 'Phone number'] },
  { route: '/orders', expect: ['Sign in to see your orders'] },
  { route: '/wallet', expect: ['Sign in to use your wallet'] },
  { route: '/account', expect: ['browsing as a guest'] },
]

const results = []
let failures = 0

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

const consoleErrors = []
context.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
context.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

for (const { route, expect } of CASES) {
  const page = await context.newPage()
  const missing = []
  try {
    // 'load', never 'networkidle': Firestore holds a long-lived WebChannel
    // open, so a screen that reads the catalogue is never network-idle.
    await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 45_000 })

    // Wait for the copy itself rather than for skeletons to clear — before
    // React mounts there are no skeletons either, so that check passes
    // trivially and races the very data it is meant to wait for.
    for (const needle of expect) {
      await page
        .waitForFunction((text) => document.body.innerText.includes(text), needle, {
          timeout: 30_000,
        })
        .catch(() => missing.push(needle))
    }
  } catch (e) {
    missing.push(`NAVIGATION FAILED: ${(e && e.message) || e}`)
  }
  await page.close()

  if (missing.length) failures++
  results.push({ route, ok: missing.length === 0, missing })
}

/* ── The catalogue, specifically ─────────────────────────────────────────
   Home is the screen most likely to sit on skeletons forever if the
   Firestore cache configuration is wrong, so it gets its own assertion
   rather than being covered by a text match. */
const page = await context.newPage()
let catalogue = 'unknown'
try {
  await page.goto(`${BASE}/home`, { waitUntil: 'load', timeout: 45_000 })
  await page.waitForFunction(() => document.body.innerText.includes('All restaurants'), undefined, {
    timeout: 40_000,
  })
  const body = await page.locator('body').innerText()
  catalogue = body.includes('All restaurants') ? 'loaded' : 'settled-but-empty'
} catch {
  catalogue = 'STUCK ON SKELETONS'
  failures++
}
await page.close()

await browser.close()

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.route}${r.ok ? '' : `  missing: ${r.missing.join(', ')}`}`)
}
console.log(`${catalogue === 'loaded' ? 'PASS' : catalogue === 'STUCK ON SKELETONS' ? 'FAIL' : 'WARN'}  /home catalogue: ${catalogue}`)

if (consoleErrors.length) {
  console.log('\nConsole errors:')
  for (const e of [...new Set(consoleErrors)].slice(0, 12)) console.log('  -', e)
}

console.log(`\n${results.length + 1 - failures}/${results.length + 1} checks passed`)
process.exit(failures > 0 ? 1 : 0)
