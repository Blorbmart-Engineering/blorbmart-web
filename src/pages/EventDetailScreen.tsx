/* ═══════════════════════════════════════════════════════════════════════
   One event — a port of lib/features/events/event_detail_screen.dart.

   Always fetched fresh: ticket counts on this screen are what somebody is
   about to spend money against.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, MapPin, Ticket, Users } from 'lucide-react'
import { getEvent } from '../data/events'
import { dayAndTime } from '../lib/format'
import {
  eventHasEnded,
  eventWhereLabel,
  orderCeiling,
  ticketLimitNote,
  salesClosed,
  ticketPriceLabel,
  type BlorbEvent,
  type TicketType,
} from '../models/events'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { EmptyState, Pill, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

export default function EventDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)

  const [event, setEvent] = useState<BlorbEvent | null | undefined>(undefined)
  const [selected, setSelected] = useState<TicketType | null>(null)

  useEffect(() => {
    let cancelled = false
    getEvent(id)
      .then((e) => {
        if (cancelled) return
        setEvent(e)
        // Preselect the cheapest tier that can actually be bought.
        const available = e.ticketTypes.filter((t) => !t.soldOut && !salesClosed(t))
        setSelected(available[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setEvent(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (event === undefined) {
    return (
      <>
        <AppBar title="Event" />
        <ScreenBody padded>
          <Skeleton height={210} radius="var(--radius-lg)" />
          <Skeleton width="80%" height={24} style={{ marginTop: 16 }} />
          <Skeleton width="55%" height={14} style={{ marginTop: 10 }} />
        </ScreenBody>
      </>
    )
  }

  if (event === null) {
    return (
      <>
        <AppBar title="Not found" />
        <EmptyState
          title="Event not found"
          message="It may have been unlisted or removed. Browse what else is on."
          icon={<CalendarDays size={30} aria-hidden />}
          actionLabel="Back to events"
          onAction={() => navigate('/events')}
        />
      </>
    )
  }

  const ended = eventHasEnded(event)
  const canBuy = !ended && !event.soldOut && selected != null

  return (
    <>
      <div style={{ position: 'relative' }}>
        <SmartImage
          src={event.coverUrl}
          alt=""
          height={230}
          renderWidth={520}
          eager
          fallback={
            <CalendarDays size={40} aria-hidden style={{ color: 'var(--color-events)' }} />
          }
        />
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, background: 'var(--gradient-image-scrim)' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--safe-top) + var(--gap-md))',
            left: 'var(--gap-lg)',
          }}
        >
          <IconButton label="Go back" onImage onClick={() => navigate(-1)}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
          </IconButton>
        </div>
      </div>

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        <FadeSlideIn>
          <div style={{ paddingTop: 'var(--gap-lg)' }}>
            {ended && <Pill label="This event has ended" tone="neutral" />}
            {!ended && event.soldOut && <Pill label="Sold out" tone="danger" />}

            <h1 className="t-display-sm" style={{ margin: 'var(--gap-sm) 0 var(--gap-md)' }}>
              {event.title}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
              {event.startsAt && (
                <InfoRow icon={<CalendarDays size={17} aria-hidden />} label={dayAndTime(event.startsAt)} />
              )}
              {eventWhereLabel(event) && (
                <InfoRow icon={<MapPin size={17} aria-hidden />} label={eventWhereLabel(event)} />
              )}
              {event.organizerName && (
                <InfoRow icon={<Users size={17} aria-hidden />} label={`By ${event.organizerName}`} />
              )}
            </div>
          </div>
        </FadeSlideIn>

        {event.description && (
          <FadeSlideIn delay={80}>
            <div className="t-overline" style={{ margin: 'var(--gap-xxl) 0 var(--gap-sm)' }}>
              About
            </div>
            <p className="t-body" style={{ margin: 0, whiteSpace: 'pre-line' }}>
              {event.description}
            </p>
          </FadeSlideIn>
        )}

        {/* ── Tiers ──────────────────────────────────────────────────── */}
        {!ended && event.ticketTypes.length > 0 && (
          <FadeSlideIn delay={140}>
            <div className="t-overline" style={{ margin: 'var(--gap-xxl) 0 var(--gap-sm)' }}>
              Tickets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
              {event.ticketTypes.map((tier, i) => {
                const unavailable = tier.soldOut || salesClosed(tier)
                const chosen = selected?.id === tier.id
                return (
                  <FadeSlideIn key={tier.id} delay={staggerFor(i, 5)}>
                    <PressScale
                      scale={0.99}
                      disabled={unavailable}
                      onClick={() => setSelected(tier)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--gap-md)',
                        width: '100%',
                        padding: 'var(--gap-lg)',
                        borderRadius: 'var(--radius-md)',
                        background: chosen ? 'var(--color-events-soft)' : 'var(--color-surface)',
                        border: `1px solid ${chosen ? 'var(--color-events)' : 'var(--color-line)'}`,
                        opacity: unavailable ? 0.55 : 1,
                        textAlign: 'left',
                      }}
                    >
                      <Ticket
                        size={20}
                        aria-hidden
                        style={{ flexShrink: 0, color: 'var(--color-events)' }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                          {tier.name}
                        </span>
                        {tier.description && (
                          <span className="t-caption clamp-2" style={{ display: 'block' }}>
                            {tier.description}
                          </span>
                        )}
                        {tier.remaining != null && tier.remaining > 0 && tier.remaining <= 20 && (
                          <span
                            className="t-caption-sm"
                            style={{ display: 'block', color: 'var(--color-appetite)', marginTop: 2 }}
                          >
                            Only {tier.remaining} left
                          </span>
                        )}
                        {/* Said before a quantity is picked. A cap discovered
                            at checkout reads as a bug, not a rule. */}
                        {ticketLimitNote(tier) && (
                          <span className="t-caption-sm" style={{ display: 'block', marginTop: 2 }}>
                            {ticketLimitNote(tier)}
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className="t-price" style={{ display: 'block' }}>
                          {ticketPriceLabel(tier)}
                        </span>
                        {unavailable && (
                          <span className="t-caption-sm">
                            {tier.soldOut ? 'Sold out' : 'Sales closed'}
                          </span>
                        )}
                      </span>
                    </PressScale>
                  </FadeSlideIn>
                )
              })}
            </div>
          </FadeSlideIn>
        )}
      </ScreenBody>

      {!ended && (
        <StickyFooter>
          <Button
            label={
              event.soldOut
                ? 'Sold out'
                : selected
                  ? selected.price <= 0
                    ? 'Get your free ticket'
                    : `Get tickets · ${ticketPriceLabel(selected)}`
                  : 'Choose a ticket'
            }
            disabled={!canBuy}
            glow
            onClick={() =>
              signedIn
                ? navigate(`/events/${event.id}/checkout`, {
                    state: { ticketTypeId: selected?.id, max: selected ? orderCeiling(selected) : 1 },
                  })
                : navigate('/login', { state: { from: `/events/${event.id}` } })
            }
          />
        </StickyFooter>
      )}
    </>
  )
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="t-body-sm"
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}
    >
      <span style={{ color: 'var(--color-events)', display: 'inline-flex', flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </span>
  )
}
