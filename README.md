# Blorbmart — web

The Blorbmart buyer app, on the web. Not a companion site: the same product,
built from the same design system and talking to the same backend, so a
customer who uses the phone app and then opens this recognises it immediately.

Installable as a PWA on Android and iOS.

## What it is a port of

Every module here has a counterpart in `../blorbmart` (the Flutter app), and the
file headers name it. The correspondence is deliberate — when the app changes,
the file to change here is the one that names it.

| Web | Flutter |
| --- | --- |
| `src/index.css` | `lib/core/theme/blorb_colors.dart`, `blorb_tokens.dart`, `blorb_type.dart` |
| `src/ui/` | `lib/core/widgets/` |
| `src/models/` | `lib/data/models/` |
| `src/data/` | `lib/data/repos/`, `lib/data/search/` |
| `src/store/sessionStore.ts` | `lib/data/repos/session.dart` |
| `src/store/cartStore.ts` | `lib/data/repos/cart_repo.dart` |
| `src/components/AppShell.tsx` | `lib/features/shell/blorb_shell.dart` |
| `src/pages/` | `lib/features/*/` |

The colour, spacing, radius, motion and type scales are transcribed value for
value. The two must not drift.

## Feature parity

Everything the phone app does, except what a browser genuinely cannot:

- **Home** — the four hubs, live order strip with the four-stage bar, fastest
  near you, deals, trending, all restaurants with cuisine filtering
- **Hubs** — restaurants and pharmacy storefront lists, with sort and filters
- **Vendor** — live menu subscription, sections, in-menu search, dish
  customiser with add-on group validation
- **Basket and checkout** — one vendor per basket, server-side pricing, promo
  codes, wallet or Paystack, draft abandonment on exit
- **Orders** — history, live tracking, rider details, and the delivery PIN
  fetched over the authenticated API (never from the order document)
- **Wallet** — balance, ledger, top-ups, and recovery of unfinished top-ups
- **Bills** — the full biller catalogue, backend-driven form fields, customer
  verification, bundles, purchase, polling, and the token receipt
- **Events** — listings, detail, ticket tiers, free and paid checkout, and
  tickets with their signed QR rendered locally so they work at the door
- **Receipts** — the signed receipt for all four kinds, with PDF and share
- **Account** — campus (chosen once), addresses, notifications, sign-out
- **Auth** — sign up with campus, email OTP, sign in, password reset

### What differs, and why

- **Paystack** is a full-page redirect rather than a WebView. Paystack blocks
  iframes and mobile browsers eat popups. `src/lib/payment.ts` records the
  pending transaction before redirecting, and `PaymentReturn` verifies it on
  the way back — including when the customer returns via the back button or
  the installed app icon rather than Paystack's redirect.
- **Reverse geocoding** is not done. The phone has a platform geocoder; the
  browser does not, and paying a third party to turn a pin into a street name
  is not worth it when the rider gets exact coordinates either way. "Use my
  current location" drops a pin the customer can label.
- **Push on iOS** only works once the app is on the Home Screen — Apple's
  rule, not ours. The install banner says so, on iOS only.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run verify       # build, then drive the built app in a real browser
```

`npm run verify` runs two suites:

- `npm run smoke` — loads every route and asserts the copy that proves the
  screen did its job, including that the catalogue actually resolves rather
  than sitting on skeletons.
- `npm run pwa-check` — manifest, icons, iOS meta tags, service worker
  activation, and that the app opens with the network cut.

Both need `vite preview --port 5173` running. **Port 5173 specifically**: the
backend's CORS allowlist includes it, and any other origin gets a 500.

`npm run icons` regenerates `public/icons/` from `public/assets/icon.png`, and
`npm run images` re-compresses the onboarding photographs to WebP (2.9MB down
to 79KB across the three slides — they were cut for a Flutter bundle, where
they install once instead of downloading). Both write committed output, so a
normal build does not need `sharp`.

## Configuration

Copy `.env.example` to `.env`. Every value in it is public by design — Firebase
web config and the VAPID public key ship in the client bundle on every
platform, and Firestore rules plus backend auth are the real boundary.

The one that matters:

```
VITE_API_BASE_URL=https://blorbmart-tr1i.onrender.com
```

## Deploying

`vercel.json` sets the SPA rewrite, the cache headers, and
`Service-Worker-Allowed: /`.

Two things must be done outside this repo, or the deployed app half-works:

1. **Add the production origin to the backend's CORS allowlist.** Set
   `BUYER_ORIGINS` in the API's environment (see `Blorbmart-backend/server.js`).
   Without it, every wallet, bills, checkout and receipt call fails while
   Firestore-backed browsing keeps working — which looks like a random,
   partial outage rather than a config problem.
2. **Serve over HTTPS.** Service workers, push and geolocation all require it.
   `localhost` is exempt, nothing else is.

## Known gap, shared with the phone app

The "Save today" rail is always empty. The `deals` query needs a composite
index on `products` over `(status, discountPrice)` and it is not declared in
`../blorbmart/firestore.indexes.json`, so Firestore refuses the query. Both
clients catch it and degrade to an empty rail, which is why it has gone
unnoticed. Adding the index turns the discount rail on for web and phone at
once.
