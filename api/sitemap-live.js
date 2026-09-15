/*
 * The part of the sitemap that changes every day: every open storefront
 * and every published event. Served at /sitemap-live.xml (see vercel.json)
 * and listed in /sitemap.xml next to the static pages.
 *
 * The app's links are buttons, not <a href>s, so a crawler cannot walk
 * from the home screen to a store. This list is how Google finds them.
 */
const SITE = 'https://shop.blorbmart.com.ng'
const API = 'https://blorbmart-tr1i.onrender.com'
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/blorbmart-b29b7/databases/(default)/documents'
const FIREBASE_KEY = 'AIzaSyAGGDTIx4YY8_7cwuPBDkJV-plZpr-IhWs'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])

/** Published events, straight from the public events API. */
async function events() {
  const res = await fetch(`${API}/api/events?limit=200`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`events answered ${res.status}`)
  const list = (await res.json())?.data?.events ?? []
  return list
    .filter((e) => e?.id && e.status === 'published')
    .map((e) => ({ loc: `${SITE}/events/${encodeURIComponent(e.id)}`, image: e.coverUrl, title: e.title }))
}

/**
 * Active storefronts. `stores` is publicly readable, which is what lets a
 * guest browse the app, so this reads it the same way the app does.
 * Organizer stores (vertical "events") are left out: their page is an empty
 * menu, and their events are listed above.
 */
async function stores() {
  const res = await fetch(`${FIRESTORE}:runQuery?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'stores' }],
        where: { fieldFilter: { field: { fieldPath: 'isActive' }, op: 'EQUAL', value: { booleanValue: true } } },
        select: {
          fields: ['storeName', 'vertical', 'updatedAt', 'bannerUrl', 'logoUrl'].map((fieldPath) => ({ fieldPath })),
        },
        limit: 1000,
      },
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`stores answered ${res.status}`)
  const rows = await res.json()
  return rows
    .map((row) => row.document)
    .filter(Boolean)
    .filter((doc) => {
      const vertical = doc.fields?.vertical?.stringValue
      return vertical !== 'events' && vertical !== 'bills'
    })
    .map((doc) => {
      const f = doc.fields ?? {}
      const id = doc.name.split('/').pop()
      return {
        loc: `${SITE}/r/${encodeURIComponent(id)}`,
        lastmod: (f.updatedAt?.timestampValue || doc.updateTime || '').slice(0, 10) || undefined,
        image: f.bannerUrl?.stringValue || f.logoUrl?.stringValue,
        title: f.storeName?.stringValue,
      }
    })
}

export default async function handler(_req, res) {
  // One source being down must not empty the other half of the list.
  const [eventUrls, storeUrls] = await Promise.all([events().catch(() => []), stores().catch(() => [])])

  const body = [...storeUrls, ...eventUrls]
    .map(
      (u) => `  <url>
    <loc>${esc(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${esc(u.lastmod)}</lastmod>` : ''}${
      u.image
        ? `\n    <image:image>\n      <image:loc>${esc(u.image)}</image:loc>${u.title ? `\n      <image:title>${esc(u.title)}</image:title>` : ''}\n    </image:image>`
        : ''
    }
  </url>`,
    )
    .join('\n')

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`)
}
