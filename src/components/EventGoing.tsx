/* ═══════════════════════════════════════════════════════════════════════
   Who's going — the guest list on an event page.

   People put themselves on it by tapping "I'm going"; nobody is added for
   buying a ticket. It shows a first name and an initial, and a tick beside
   anyone who already holds a ticket.

   The list is the reason to share an event, so the share button lives here
   too: "I'm going to X, come with me" is a better message than a bare link.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Share2, Ticket, Users } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { initials } from '../lib/format'
import { SITE } from '../lib/seo'
import { shareOrCopy } from '../lib/share'
import { eventGoing, setEventGoing } from '../data/events'
import type { BlorbEvent, GoingList, GoingPerson } from '../models/events'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { showToast } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

const FACES = 4

/** "Kemi B., Tomi A. and 12 others". */
function namesLine(list: GoingList): string {
  const shown = list.people.slice(0, 2).map((p) => (p.you ? 'You' : p.name))
  const rest = list.count - shown.length
  if (!shown.length) return ''
  if (rest <= 0) return shown.join(' and ')
  return `${shown.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`
}

export function EventGoing({ event, ended }: { event: BlorbEvent; ended: boolean }) {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const ready = useSessionStore((s) => s.ready)
  const [list, setList] = useState<GoingList | null>(null)
  const [busy, setBusy] = useState(false)

  // After the session has restored, so a signed-in visitor is told whether
  // they are on the list rather than being shown "I'm going" a second time.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    eventGoing(event.id, signedIn)
      .then((next) => {
        if (!cancelled) setList(next)
      })
      .catch((e) => console.warn('[events] going failed', e))
    return () => {
      cancelled = true
    }
  }, [event.id, signedIn, ready])

  const toggle = async () => {
    if (busy) return
    if (!signedIn) {
      navigate('/login', { state: { from: `/events/${event.id}` } })
      return
    }
    const next = !(list?.going ?? false)
    setBusy(true)
    try {
      setList(await setEventGoing(event.id, next))
      if (next) showToast('You’re on the guest list. Bring a friend?', 'success')
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not update the guest list.'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    const lead = list?.going ? `I’m going to ${event.title}. Come with me:` : `${event.title} is on Blorbmart:`
    const outcome = await shareOrCopy({ title: event.title, text: `${lead} ${SITE}/events/${event.id}` })
    if (outcome === 'copied') showToast('Link copied. Paste it to a friend.', 'success')
    if (outcome === 'failed') showToast('Could not share this event.', 'danger')
  }

  // The event's own count until the list arrives, so the row does not jump.
  const count = list?.count ?? event.goingCount
  const going = list?.going ?? false
  const people = list?.people ?? []

  return (
    <section aria-label="Who is going" style={{ marginTop: 'var(--gap-xxl)' }}>
      <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
        Who’s going
      </div>

      <div
        style={{
          padding: 'var(--gap-lg)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          {people.length > 0 ? (
            <Faces people={people.slice(0, FACES)} />
          ) : (
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--color-events-soft)',
                color: 'var(--color-events)',
              }}
            >
              <Users size={19} aria-hidden />
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="t-h4" style={{ display: 'block' }}>
              {count > 0 ? `${count} going` : ended ? 'Nobody said they were going' : 'Be the first to say you’re going'}
            </span>
            {namesLine({ count, people, going }) && (
              <span className="t-caption clamp-1" style={{ display: 'block' }}>
                {namesLine({ count, people, going })}
              </span>
            )}
          </span>
        </div>

        {people.some((p) => p.hasTicket) && (
          <p
            className="t-caption-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 'var(--gap-sm) 0 0' }}
          >
            <Ticket size={13} aria-hidden style={{ color: 'var(--color-events)' }} />
            A ticket mark means they already have theirs.
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
          {!ended && (
            <Button
              label={going ? 'You’re going' : 'I’m going'}
              kind={going ? 'soft' : 'brand'}
              size="md"
              busy={busy}
              icon={going ? <Check size={17} aria-hidden /> : undefined}
              onClick={() => void toggle()}
            />
          )}
          <Button
            label="Share"
            kind="outline"
            size="md"
            expand={ended}
            icon={<Share2 size={17} aria-hidden />}
            onClick={() => void share()}
          />
        </div>

        {!ended && (
          <p className="t-caption-sm" style={{ margin: 'var(--gap-sm) 0 0' }}>
            {going
              ? 'Your first name shows here. Tap “You’re going” to take it off.'
              : 'Only your first name and an initial are shown.'}
          </p>
        )}
      </div>
    </section>
  )
}

/** Overlapping faces: a photo where there is one, initials where there is not. */
function Faces({ people }: { people: GoingPerson[] }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }} aria-hidden>
      {people.map((person, i) => (
        <span
          key={`${person.name}-${i}`}
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            marginLeft: i === 0 ? 0 : -12,
            borderRadius: '50%',
            border: '2px solid var(--color-surface)',
            background: 'var(--color-events-soft)',
            color: 'var(--color-events)',
            fontSize: 13,
            fontWeight: 800,
            overflow: 'visible',
            zIndex: people.length - i,
          }}
        >
          <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
            {person.photoUrl ? (
              <SmartImage src={person.photoUrl} alt="" width={36} height={36} renderWidth={80} fallback={initials(person.name)} />
            ) : (
              initials(person.name)
            )}
          </span>
          {person.hasTicket && (
            <span
              style={{
                position: 'absolute',
                right: -3,
                bottom: -3,
                display: 'grid',
                placeItems: 'center',
                width: 17,
                height: 17,
                borderRadius: '50%',
                background: 'var(--color-events)',
                color: '#fff',
                border: '2px solid var(--color-surface)',
              }}
            >
              <Ticket size={9} strokeWidth={3} />
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
