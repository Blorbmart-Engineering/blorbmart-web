/*
 * Link previews for shared store and event links.
 *
 * WhatsApp, X, Facebook, Telegram and the rest read a page's <meta> tags
 * without running JavaScript, so a shared /r/:id or /events/:id link would
 * preview as the generic shop card. vercel.json sends only those preview
 * bots here, matched on User-Agent. People and search engines never reach
 * this function; they get the app, which writes the same tags itself.
 */
const SITE = 'https://shop.blorbmart.com.ng'
const API = 'https://blorbmart-tr1i.onrender.com'
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/blorbmart-b29b7/databases/(default)/documents'
const FIREBASE_KEY = 'AIzaSyAGGDTIx4YY8_7cwuPBDkJV-plZpr-IhWs'

const FALLBACK = {
  title: 'Blorbmart — Order food, bills & event tickets on campus',
  description:
    'Order from campus kitchens and pharmacies, top up airtime and data, pay for power and TV, and buy event tickets. Live at UNIOSUN, LAUTECH, UNN and OOU.',
  image: `${SITE}/og.png`,
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
const clip = (text, max) => {
  const flat = String(text).replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}
const naira = (n) => `₦${Number(n).toLocaleString('en-NG')}`

async function eventCard(id) {
  const res = await fetch(`${API}/api/events/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) return null
  const event = (await res.json())?.data
  if (!event?.title) return null

  const when = event.startsAt
    ? new Date(event.startsAt).toLocaleString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Africa/Lagos',
      })
    : ''
  const price = event.isFree ? 'Free' : event.lowestPrice > 0 ? `From ${naira(event.lowestPrice)}` : ''
  const facts = [when, event.venueName || event.city, price].filter(Boolean).join(' · ')

  return {
    title: `${event.title} — tickets on Blorbmart`,
    description: event.description ? `${facts}. ${event.description}` : `${facts}. Get your ticket on Blorbmart.`,
    image: event.coverUrl || FALLBACK.image,
  }
}

async function storeCard(id) {
  const res = await fetch(`${FIRESTORE}/stores/${encodeURIComponent(id)}?key=${FIREBASE_KEY}`, {
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return null
  const fields = (await res.json())?.fields ?? {}
  const text = (...keys) => keys.map((k) => fields[k]?.stringValue).find(Boolean) || ''

  const name = text('storeName', 'businessName', 'name')
  if (!name) return null
  const city = text('city')
  const tagline = text('tagline', 'description')
  const verb = text('vertical') === 'pharmacy' ? 'Order medicine' : 'Order food'

  return {
    title: `${name}${city ? ` in ${city}` : ''} — order on Blorbmart`,
    description: tagline
      ? `${tagline} ${verb} from ${name} on Blorbmart, delivered on campus.`
      : `${verb} from ${name}${city ? ` in ${city}` : ''} on Blorbmart and get it delivered on campus.`,
    image: text('bannerUrl', 'bannerImageUrl', 'logoUrl', 'logoImageUrl') || FALLBACK.image,
  }
}

export default async function handler(req, res) {
  const kind = String(req.query.kind || '')
  const id = String(req.query.id || '')
  const path = kind === 'event' ? `/events/${encodeURIComponent(id)}` : kind === 'store' ? `/r/${encodeURIComponent(id)}` : '/'

  let card = null
  try {
    if (id && kind === 'event') card = await eventCard(id)
    if (id && kind === 'store') card = await storeCard(id)
  } catch {
    card = null
  }
  const { title, description, image } = card ?? FALLBACK
  const url = SITE + path

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Browser cache only: the answer depends on who asked, so a shared CDN
  // copy must never be handed to a person.
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.setHeader('Vary', 'User-Agent')
  res.status(200).send(`<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clip(description, 200))}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Blorbmart">
<meta property="og:locale" content="en_NG">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(clip(description, 200))}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@blorbmart">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(clip(description, 200))}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${esc(url)}">Open on Blorbmart</a></p>
</body>
</html>`)
}
