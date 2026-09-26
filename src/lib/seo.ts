/* ═══════════════════════════════════════════════════════════════════════
   What search engines and link previews read on each screen.

   Every URL serves the same index.html, so each screen writes its own
   title, description, canonical URL, robots rule and structured data once
   it knows what it is showing. Google runs the app and reads them. Link
   previews (WhatsApp, X, Telegram) run no scripts, so vercel.json sends
   those bots to api/share.js for store and event links instead.

   The site-wide graph (WebSite, WebApplication) lives in index.html and
   points at the company's Organization on www by @id.
   ═══════════════════════════════════════════════════════════════════════ */

import { titleCase } from './format'
import { isSoldOut, type MenuItem, type Vendor, type Vertical } from '../models/catalog'
import { salesClosed, type BlorbEvent } from '../models/events'

export const SITE = 'https://shop.blorbmart.com.ng'
const ORG = { '@id': 'https://www.blorbmart.com.ng/#organization' }
const DEFAULT_IMAGE = `${SITE}/og.png`
const DEFAULT_IMAGE_ALT = 'Blorbmart — order food, pay bills and buy event tickets on campus'
const DEFAULT_DESCRIPTION =
  'Order from campus kitchens and pharmacies, top up airtime and data, pay for power and TV, and buy event tickets. Live at UNIOSUN, LAUTECH, UNN and OOU.'

const IN_STOCK = 'https://schema.org/InStock'
const SOLD_OUT = 'https://schema.org/SoldOut'

export interface Seo {
  title: string
  description?: string
  /** The canonical path. Left out on a noindex screen. */
  path?: string
  image?: string
  noindex?: boolean
  /** Structured data for this screen only. */
  jsonLd?: Record<string, unknown>
}

const brand = (name: string) => `${name} | Blorbmart`

/** Search results show about 160 characters; cut at a word, not mid-word. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length)}…`
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (content === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (href === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

export function applySeo(seo: Seo): void {
  const description = clip(seo.description || DEFAULT_DESCRIPTION, 160)
  const image = seo.image || DEFAULT_IMAGE
  const isDefaultImage = image === DEFAULT_IMAGE
  const url = seo.path ? SITE + seo.path : null

  document.title = seo.title
  setMeta('name', 'description', description)
  setMeta('name', 'robots', seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large')
  setCanonical(seo.noindex ? null : url)

  setMeta('property', 'og:title', seo.title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', url ?? SITE + window.location.pathname)
  setMeta('property', 'og:image', image)
  // The declared size and alt text belong to the default card; a store
  // banner or event cover is another shape and another picture.
  setMeta('property', 'og:image:width', isDefaultImage ? '1200' : null)
  setMeta('property', 'og:image:height', isDefaultImage ? '630' : null)
  setMeta('property', 'og:image:alt', isDefaultImage ? DEFAULT_IMAGE_ALT : seo.title)
  setMeta('name', 'twitter:title', seo.title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)

  let script = document.getElementById('screen-jsonld')
  if (!seo.jsonLd) {
    script?.remove()
    return
  }
  if (!script) {
    script = document.createElement('script')
    script.id = 'screen-jsonld'
    script.setAttribute('type', 'application/ld+json')
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(seo.jsonLd)
}

// ── Routes ─────────────────────────────────────────────────────────────

/**
 * Screens that belong to one person, or are a step in a flow. They are kept
 * out of the index (robots.txt also asks crawlers not to fetch them). The
 * checkout pattern comes before the event page it sits under.
 */
const PRIVATE: [RegExp, string][] = [
  [/^\/cart$/, 'Your basket'],
  [/^\/checkout$/, 'Checkout'],
  [/^\/order-placed\//, 'Order placed'],
  [/^\/orders$/, 'Your orders'],
  [/^\/track(-order)?\//, 'Track your order'],
  [/^\/wallet$/, 'Wallet'],
  [/^\/transactions$/, 'Transactions'],
  [/^\/bills\/pay\//, 'Pay a bill'],
  [/^\/bills\/receipt\//, 'Bill receipt'],
  [/^\/bills\/history$/, 'Bill history'],
  [/^\/events\/[^/]+\/checkout$/, 'Buy tickets'],
  [/^\/tickets(\/|$)/, 'Your tickets'],
  [/^\/account$/, 'Account'],
  [/^\/addresses$/, 'Addresses'],
  [/^\/notifications$/, 'Notifications'],
  [/^\/receipt\//, 'Receipt'],
  [/^\/gifts\/.+/, 'Gift card'],
  [/^\/search$/, 'Search'],
  [/^\/verify$/, 'Verify your number'],
  [/^\/forgot-password$/, 'Reset your password'],
]

/** The default for each route. Store and event screens refine theirs once loaded. */
export function seoForPath(pathname: string): Seo {
  const path = pathname.replace(/\/+$/, '') || '/'

  for (const [pattern, name] of PRIVATE) {
    if (pattern.test(path)) return { title: brand(name), noindex: true }
  }

  // The splash, onboarding and welcome screens are all the shop's front
  // door, and every first visit (a crawler's included) passes through them.
  if (path === '/' || path === '/onboarding' || path === '/welcome') {
    return { title: 'Blorbmart — Order food, bills & event tickets on campus', path: '/' }
  }
  if (path === '/home') {
    return {
      title: brand('Order food on campus'),
      description:
        'Browse the kitchens and pharmacies on your campus, see what is open now, and order for delivery to your hostel or faculty.',
      path,
    }
  }
  const hub = /^\/hub\/([^/]+)$/.exec(path)
  if (hub) {
    return hub[1] === 'pharmacy'
      ? {
          title: brand('Campus pharmacies — order medicine online'),
          description: 'Order medicine and health essentials from pharmacies on your campus and get them delivered.',
          path: '/hub/pharmacy',
        }
      : {
          title: brand('Campus restaurants — order food online'),
          description:
            'Jollof, shawarma, swallow and more from the kitchens on your campus. Order online and track your rider live.',
          path: '/hub/restaurants',
        }
  }
  if (path === '/events') {
    return {
      title: brand('Campus events and tickets'),
      description:
        'Parties, concerts, conferences and shows on your campus. Buy tickets in seconds and keep your QR ticket on your phone.',
      path,
    }
  }
  if (/^\/events\/[^/]+$/.test(path)) return { title: brand('Event tickets'), path }
  if (/^\/r\/[^/]+$/.test(path)) return { title: brand('Order online'), path }
  if (path === '/gifts') {
    return {
      title: brand('Gift cards — send a little joy'),
      description:
        'Beautiful gift cards for birthdays, anniversaries, weddings, Eid, Christmas and more, from ₦2,000. They land straight in their Blorbmart wallet.',
      path,
    }
  }
  // Indexable, but never with a code in it: the code rides in the fragment,
  // which no crawler or server ever sees.
  if (path === '/gift') {
    return {
      title: brand('Redeem a gift card'),
      description: 'Got a Blorbmart gift card? Enter the code and its value goes straight into your wallet.',
      path,
    }
  }
  if (path === '/bills') {
    return {
      title: brand('Buy airtime, data, electricity and TV'),
      description:
        'Top up airtime and data, pay for electricity and renew your TV subscription in seconds, from anywhere in Nigeria.',
      path,
    }
  }
  if (path === '/signup') {
    return {
      title: brand('Create your account'),
      description: 'Sign up free to order food, pay bills and buy event tickets on your campus.',
      path,
    }
  }
  if (path === '/login') return { title: brand('Sign in'), path }

  // Anything else is about to be redirected by the router.
  return { title: 'Blorbmart', noindex: true }
}

// ── Storefronts ────────────────────────────────────────────────────────

const STORE_TYPE: Partial<Record<Vertical, string>> = { restaurants: 'Restaurant', pharmacy: 'Pharmacy' }

const priceOf = (i: MenuItem) => (i.discountPrice > 0 && i.discountPrice < i.price ? i.discountPrice : i.price)

export function storeSeo(store: Vendor, items: MenuItem[] | null): Seo {
  const path = `/r/${encodeURIComponent(store.id)}`
  const url = SITE + path
  const where = store.city ? ` in ${store.city}` : ''
  const pharmacy = store.vertical === 'pharmacy'
  const verb = pharmacy ? 'Order medicine' : 'Order food'
  const cuisines = store.cuisines.slice(0, 4).map(titleCase).filter(Boolean)

  const description = store.tagline
    ? `${store.tagline} ${verb} from ${store.name}${where} on Blorbmart and get it delivered on campus.`
    : `${verb} from ${store.name}${where} on Blorbmart${cuisines.length ? `: ${cuisines.join(', ')}` : ''}. Delivered on campus.`

  // A menu in structured data is what lets a search for a dish find the
  // kitchen that makes it. Capped so a huge catalogue stays a small script.
  const sections = new Map<string, MenuItem[]>()
  if (!pharmacy) {
    for (const item of (items ?? []).slice(0, 80)) {
      const name = titleCase(item.section || item.categoryName) || 'Menu'
      sections.set(name, [...(sections.get(name) ?? []), item])
    }
  }

  const hasRating = store.ratingCount > 0 && store.rating > 0

  return {
    title: brand(`${store.name}${where} — ${verb.toLowerCase()} online`),
    description,
    path,
    image: store.bannerUrl || store.logoUrl || undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': STORE_TYPE[store.vertical] ?? 'LocalBusiness',
      '@id': `${url}#store`,
      name: store.name,
      url,
      description: store.tagline || undefined,
      image: [store.bannerUrl, store.logoUrl].filter(Boolean),
      logo: store.logoUrl || undefined,
      priceRange: '₦'.repeat(store.priceLevel),
      servesCuisine: !pharmacy && cuisines.length ? cuisines : undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address || undefined,
        addressLocality: store.city || undefined,
        addressCountry: 'NG',
      },
      geo:
        store.latitude != null && store.longitude != null
          ? { '@type': 'GeoCoordinates', latitude: store.latitude, longitude: store.longitude }
          : undefined,
      aggregateRating: hasRating
        ? {
            '@type': 'AggregateRating',
            ratingValue: Math.round(store.rating * 10) / 10,
            ratingCount: store.ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
      hasMenu: sections.size
        ? {
            '@type': 'Menu',
            hasMenuSection: [...sections].map(([name, list]) => ({
              '@type': 'MenuSection',
              name,
              hasMenuItem: list.map((item) => ({
                '@type': 'MenuItem',
                name: item.name,
                description: item.description || undefined,
                image: item.images[0] || undefined,
                offers: {
                  '@type': 'Offer',
                  price: priceOf(item),
                  priceCurrency: 'NGN',
                  availability: isSoldOut(item) ? SOLD_OUT : IN_STOCK,
                },
              })),
            })),
          }
        : undefined,
      potentialAction: {
        '@type': 'OrderAction',
        target: { '@type': 'EntryPoint', urlTemplate: url, actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'] },
      },
      isPartOf: { '@id': `${SITE}/#website` },
    },
  }
}

// ── Events ─────────────────────────────────────────────────────────────

export function eventSeo(event: BlorbEvent): Seo {
  const path = `/events/${encodeURIComponent(event.id)}`
  const url = SITE + path
  const when = event.startsAt
    ? event.startsAt.toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Lagos',
      })
    : ''
  const where = [event.venueName, event.city].filter(Boolean).join(', ')
  const price = event.isFree
    ? 'Free entry'
    : event.lowestPrice > 0
      ? `Tickets from ₦${event.lowestPrice.toLocaleString('en-NG')}`
      : 'Tickets on sale'
  const facts = [when, where, price].filter(Boolean).join(' · ')

  return {
    title: brand(`${event.title}${event.city ? `, ${event.city}` : ''} — tickets`),
    description: `${facts}. ${event.description || 'Get your ticket on Blorbmart and keep the QR code on your phone.'}`,
    path,
    image: event.coverUrl || undefined,
    // Google needs a start date to read an event at all.
    jsonLd: event.startsAt
      ? {
          '@context': 'https://schema.org',
          '@type': 'Event',
          '@id': `${url}#event`,
          name: event.title,
          url,
          description: event.description || `${event.title}${where ? ` at ${where}` : ''}. ${price}.`,
          startDate: event.startsAt.toISOString(),
          endDate: event.endsAt?.toISOString(),
          eventStatus:
            event.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: event.venueName || event.city || 'Venue to be announced',
            address: {
              '@type': 'PostalAddress',
              streetAddress: event.venueAddress || undefined,
              addressLocality: event.city || undefined,
              addressCountry: 'NG',
            },
          },
          image: [event.coverUrl || DEFAULT_IMAGE],
          organizer: event.organizerName ? { '@type': 'Organization', name: event.organizerName } : ORG,
          isAccessibleForFree: event.isFree,
          offers: event.ticketTypes.map((t) => ({
            '@type': 'Offer',
            name: t.name,
            price: t.price,
            priceCurrency: 'NGN',
            availability: t.soldOut || salesClosed(t) ? SOLD_OUT : IN_STOCK,
            url,
          })),
        }
      : undefined,
  }
}
