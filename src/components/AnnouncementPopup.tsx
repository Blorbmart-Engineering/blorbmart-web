/* ═══════════════════════════════════════════════════════════════════════
   In-app pop-ups — the flyer an admin publishes from the console's
   "In-app pop-ups" page, shown when the app opens.

   At most one per app open, whichever is most important and not yet seen.
   How often a person sees each one ("once", "daily", "every open") is kept
   here in the browser: the list comes from a public endpoint and a guest
   has no account to remember it against. The same rules live in the phone
   app's announcement_gate.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Api } from '../lib/api'
import { isSignedIn, universityId, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'

interface Announcement {
  id: string
  title: string
  body: string
  imageUrl: string
  ctaLabel: string
  ctaLink: string
  frequency: 'once' | 'daily' | 'every_open'
  version: number
}

const SEEN_KEY = 'blorb_popups_seen_v1'

/**
 * One chance per app open. Module state, not component state: every screen
 * mounts its own shell, and a flag inside it would reset on each navigation
 * and show the flyer again on every tap. The lookup is shared too, so a
 * buyer who moves to another screen before it answers still gets the flyer
 * there rather than losing it with the screen that asked.
 */
let pick: Promise<Announcement | null> | null = null
let shownThisOpen = false

/** The flyer to show this open, with its image already loaded, or null. */
function pickAnnouncement(campus: string): Promise<Announcement | null> {
  return Api.get('/api/announcements/active', { auth: false, query: { campusId: campus || undefined } })
    .then((data) => {
      const list = (data.announcements as Announcement[] | undefined) ?? []
      const seen = readSeen()
      const next = list.find((a) => isDue(a, seen))
      if (!next || !next.imageUrl) return next ?? null
      // Loaded before showing, so a slow flyer never pops in as a blank box.
      // A flyer that will not load still shows if it has words to show.
      return new Promise<Announcement | null>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(next)
        img.onerror = () => resolve(next.title ? { ...next, imageUrl: '' } : null)
        img.src = next.imageUrl
      })
    })
    .catch(() => null)
}

type SeenMap = Record<string, { v: number; at: number }>

function readSeen(): SeenMap {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as SeenMap
  } catch {
    return {}
  }
}

function markSeen(a: Announcement) {
  try {
    const seen = readSeen()
    seen[a.id] = { v: a.version, at: Date.now() }
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    /* Private mode: it may show again next time, which is harmless. */
  }
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

function isDue(a: Announcement, seen: SeenMap, now = Date.now()): boolean {
  const record = seen[a.id]
  if (a.frequency === 'every_open') return true
  // A changed version is an edit the admin asked everyone to see again.
  if (!record || record.v !== a.version) return true
  if (a.frequency === 'daily') return !sameDay(record.at, now)
  return false
}

const track = (id: string, kind: 'view' | 'click') => {
  Api.post(`/api/announcements/${id}/${kind}`, { auth: false }).catch(() => {})
}

export default function AnnouncementPopup() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const [current, setCurrent] = useState<Announcement | null>(null)

  const signedIn = isSignedIn(session)
  const profileLoaded = Object.keys(session.profile).length > 0
  const campus = universityId(session)

  // Waits for the campus: asked before the profile lands, a signed-in buyer
  // would be treated as a guest and miss their own campus's flyers. A
  // profile that never arrives stops the wait after three seconds.
  const [waitedOut, setWaitedOut] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedOut(true), 3000)
    return () => window.clearTimeout(timer)
  }, [])
  const campusKnown = session.ready && (!signedIn || profileLoaded || waitedOut)

  useEffect(() => {
    if (shownThisOpen || !campusKnown) return
    pick ??= pickAnnouncement(campus)
    let cancelled = false
    pick.then((next) => {
      if (cancelled || shownThisOpen || !next) return
      shownThisOpen = true
      setCurrent(next)
    })
    return () => {
      cancelled = true
    }
  }, [campusKnown, campus])

  useEffect(() => {
    if (!current) return
    markSeen(current)
    track(current.id, 'view')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCurrent(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!current) return null

  const close = () => setCurrent(null)
  const open = () => {
    track(current.id, 'click')
    const link = current.ctaLink
    close()
    if (link.startsWith('https://')) window.open(link, '_blank', 'noopener,noreferrer')
    else if (link.startsWith('/')) navigate(link)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title || 'Announcement'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gap-page)',
      }}
    >
      <div
        onClick={close}
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: 'rgba(11, 18, 32, 0.62)' }}
      />

      <div
        className="blorb-fade-slide-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          maxHeight: 'calc(100dvh - 48px)',
          overflow: 'auto',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 60px rgba(11, 18, 32, 0.35)',
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1,
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(11, 18, 32, 0.55)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <X size={18} aria-hidden />
        </button>

        {current.imageUrl && (
          <img
            src={current.imageUrl}
            alt={current.title || 'Announcement'}
            onClick={current.ctaLink ? open : undefined}
            style={{
              display: 'block',
              width: '100%',
              maxHeight: '65dvh',
              objectFit: 'contain',
              background: 'var(--color-surface-sunken)',
              cursor: current.ctaLink ? 'pointer' : 'default',
            }}
          />
        )}

        {(current.title || current.body || current.ctaLabel) && (
          <div style={{ padding: current.imageUrl ? 'var(--gap-lg)' : '44px var(--gap-lg) var(--gap-lg)' }}>
            {current.title && (
              <h2 className="t-h2" style={{ margin: 0 }}>
                {current.title}
              </h2>
            )}
            {current.body && (
              <p className="t-body" style={{ margin: current.title ? '6px 0 0' : 0 }}>
                {current.body}
              </p>
            )}
            {current.ctaLabel && current.ctaLink && (
              <div style={{ marginTop: 'var(--gap-lg)' }}>
                <Button label={current.ctaLabel} onClick={open} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
