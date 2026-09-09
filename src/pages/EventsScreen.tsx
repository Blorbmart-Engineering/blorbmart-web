/* ═══════════════════════════════════════════════════════════════════════
   What is on — a port of lib/features/events/events_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Ticket, WifiOff } from 'lucide-react'
import { listEvents, myTicketsSafe } from '../data/events'
import { dayAndTime } from '../lib/format'
import {
  eventHasEnded,
  eventPriceLabel,
  eventWhereLabel,
  type BlorbEvent,
  type EventTicket,
} from '../models/events'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { IconButton } from '../ui/Button'
import { EmptyState, Pill, Rail, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

export default function EventsScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)

  const [events, setEvents] = useState<BlorbEvent[] | null>(null)
  const [tickets, setTickets] = useState<EventTicket[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      setError(null)
      try {
        setEvents(await listEvents({ refresh }))
      } catch {
        setError('We could not load events. Check your connection and try again.')
        setEvents([])
      }
      if (signedIn) setTickets(await myTicketsSafe(5))
    },
    [signedIn],
  )

  useEffect(() => {
    void load()
  }, [load])

  const upcoming = (events ?? []).filter((e) => !eventHasEnded(e))

  return (
    <>
      <AppBar
        title="Events"
        subtitle="Tickets to what is on"
        trailing={
          signedIn ? (
            <IconButton label="My tickets" onClick={() => navigate('/tickets')}>
              <Ticket size={19} aria-hidden />
            </IconButton>
          ) : undefined
        }
      />

      <ScreenBody bottomGap="150px">
        {/* ── My tickets ─────────────────────────────────────────────── */}
        {tickets.length > 0 && (
          <>
            <SectionHeader
              title="Your tickets"
              actionLabel="See all"
              onAction={() => navigate('/tickets')}
            />
            <Rail>
              {tickets.map((ticket, i) => (
                <FadeSlideIn key={ticket.id} delay={staggerFor(i, 4)} offsetX={14} offsetY={0}>
                  <PressScale
                    scale={0.97}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    style={{
                      display: 'block',
                      width: 210,
                      padding: 'var(--gap-md)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-events-soft)',
                      border: '1px solid color-mix(in srgb, var(--color-events) 20%, transparent)',
                      textAlign: 'left',
                    }}
                  >
                    <Ticket size={18} aria-hidden style={{ color: 'var(--color-events)' }} />
                    <span className="t-h4 clamp-2" style={{ display: 'block', marginTop: 8 }}>
                      {ticket.eventTitle || 'Your ticket'}
                    </span>
                    <span className="t-caption-sm clamp-1" style={{ display: 'block' }}>
                      {ticket.ticketTypeName}
                    </span>
                  </PressScale>
                </FadeSlideIn>
              ))}
            </Rail>
          </>
        )}

        {/* ── Listing ────────────────────────────────────────────────── */}
        <SectionHeader
          title="Happening near you"
          subtitle={events == null ? 'Loading' : `${upcoming.length} upcoming`}
        />

        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {error ? (
            <EmptyState
              title="Events unavailable"
              message={error}
              icon={<WifiOff size={30} aria-hidden />}
              actionLabel="Try again"
              onAction={() => void load(true)}
            />
          ) : events === null ? (
            [0, 1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 'var(--gap-lg)' }}>
                <Skeleton height={150} radius="var(--radius-lg)" />
                <Skeleton width="70%" height={17} style={{ marginTop: 12 }} />
                <Skeleton width="45%" height={13} style={{ marginTop: 8 }} />
              </div>
            ))
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="Nothing on right now"
              message="When an organizer lists something near you, it shows up here first."
              icon={<CalendarDays size={30} aria-hidden />}
              tone="var(--color-events)"
            />
          ) : (
            upcoming.map((event, i) => (
              <FadeSlideIn key={event.id} delay={staggerFor(i, 4)}>
                <EventCard event={event} onClick={() => navigate(`/events/${event.id}`)} />
              </FadeSlideIn>
            ))
          )}
        </div>
      </ScreenBody>
    </>
  )
}

function EventCard({ event, onClick }: { event: BlorbEvent; onClick: () => void }) {
  return (
    <PressScale
      scale={0.985}
      onClick={onClick}
      style={{ display: 'block', width: '100%', marginBottom: 'var(--gap-lg)', textAlign: 'left' }}
    >
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={event.coverUrl}
          alt={event.title}
          height={150}
          renderWidth={520}
          radius="var(--radius-lg)"
          fallback={
            <CalendarDays size={30} aria-hidden style={{ color: 'var(--color-events)' }} />
          }
        />
        <div style={{ position: 'absolute', top: 'var(--gap-md)', left: 'var(--gap-md)' }}>
          <Pill
            label={eventPriceLabel(event)}
            tone={event.isFree ? 'success' : 'brand'}
            solid
            dense
          />
        </div>
        {event.soldOut && (
          <div style={{ position: 'absolute', top: 'var(--gap-md)', right: 'var(--gap-md)' }}>
            <Pill label="Sold out" tone="danger" solid dense />
          </div>
        )}
      </div>

      <div className="t-h3 clamp-2" style={{ marginTop: 'var(--gap-md)' }}>
        {event.title}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-lg)',
          marginTop: 6,
          flexWrap: 'wrap',
        }}
      >
        {event.startsAt && (
          <span
            className="t-caption"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <CalendarDays size={14} aria-hidden />
            {dayAndTime(event.startsAt)}
          </span>
        )}
        {eventWhereLabel(event) && (
          <span
            className="t-caption clamp-1"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}
          >
            <MapPin size={14} aria-hidden style={{ flexShrink: 0 }} />
            {eventWhereLabel(event)}
          </span>
        )}
      </div>
    </PressScale>
  )
}
