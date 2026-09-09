/* ═══════════════════════════════════════════════════════════════════════
   My tickets, and one ticket — ports of
   lib/features/events/my_tickets_screen.dart and ticket_screen.dart.

   The QR string is produced and signed by the backend. Nothing here builds
   one: a ticket the client could mint is not a ticket.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { CalendarDays, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { getTicket, myTickets } from '../data/events'
import { dayAndTime, money } from '../lib/format'
import {

  TICKET_STATUS_LABELS,
  ticketIsUsable,
  type EventTicket,
} from '../models/events'
import { Card, DashedDivider, EmptyState, Pill, Skeleton, SummaryRow } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody } from '../ui/Screen'

export function TicketsScreen() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<EventTicket[] | null>(null)

  useEffect(() => {
    myTickets(60)
      .then(setTickets)
      .catch(() => setTickets([]))
  }, [])

  return (
    <>
      <AppBar title="Your tickets" subtitle="Show the QR at the door" />
      <ScreenBody bottomGap="150px" padded>
        {tickets === null ? (
          [0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              height={96}
              radius="var(--radius-lg)"
              style={{ marginBottom: 'var(--gap-md)' }}
            />
          ))
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            message="When you get a ticket, it lives here — with its QR, offline."
            icon={<TicketIcon size={30} aria-hidden />}
            tone="var(--color-events)"
            actionLabel="See what is on"
            onAction={() => navigate('/events')}
          />
        ) : (
          tickets.map((ticket, i) => (
            <FadeSlideIn key={ticket.id} delay={staggerFor(i, 5)}>
              <PressScale
                scale={0.985}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  width: '100%',
                  marginBottom: 'var(--gap-md)',
                  padding: 'var(--gap-lg)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-line)',
                  boxShadow: 'var(--shadow-sm)',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 46,
                    height: 46,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-events-soft)',
                    color: 'var(--color-events)',
                  }}
                >
                  <TicketIcon size={22} aria-hidden />
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-h4 clamp-2" style={{ display: 'block' }}>
                    {ticket.eventTitle || 'Ticket'}
                  </span>
                  <span className="t-caption clamp-1" style={{ display: 'block' }}>
                    {ticket.ticketTypeName}
                    {ticket.seat ? ` · ${ticket.seat}` : ''}
                  </span>
                </span>

                <Pill
                  label={TICKET_STATUS_LABELS[ticket.status]}
                  tone={ticket.status === 'valid' ? 'success' : 'neutral'}
                  dense
                />
              </PressScale>
            </FadeSlideIn>
          ))
        )}
      </ScreenBody>
    </>
  )
}

export function TicketScreen() {
  const { ticketId = '' } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<EventTicket | null | undefined>(undefined)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    getTicket(ticketId).then(setTicket)
  }, [ticketId])

  useEffect(() => {
    if (!ticket?.qr) return
    // Rendered locally so the ticket still shows at a venue with no signal —
    // which is most venues.
    QRCode.toDataURL(ticket.qr, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B1220', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [ticket])

  if (ticket === undefined) {
    return (
      <>
        <AppBar title="Ticket" />
        <ScreenBody padded>
          <Skeleton height={320} radius="var(--radius-lg)" />
        </ScreenBody>
      </>
    )
  }

  if (ticket === null) {
    return (
      <>
        <AppBar title="Not found" />
        <EmptyState
          title="Ticket not found"
          message="We could not load that ticket. Check your ticket list."
          icon={<TicketIcon size={30} aria-hidden />}
          actionLabel="My tickets"
          onAction={() => navigate('/tickets')}
        />
      </>
    )
  }

  const usable = ticketIsUsable(ticket)

  return (
    <>
      <AppBar title={ticket.eventTitle || 'Ticket'} subtitle={ticket.ticketTypeName} />

      <ScreenBody bottomGap="150px" padded>
        <FadeSlideIn>
          <Card padding="0" clip>
            <div
              style={{
                padding: 'var(--gap-xxl)',
                textAlign: 'center',
                background: usable ? 'var(--color-surface)' : 'var(--color-surface-sunken)',
              }}
            >
              <Pill
                label={TICKET_STATUS_LABELS[ticket.status]}
                tone={usable ? 'success' : 'neutral'}
              />

              <div
                style={{
                  width: 232,
                  height: 232,
                  margin: 'var(--gap-xl) auto var(--gap-md)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 'var(--gap-md)',
                  borderRadius: 'var(--radius-md)',
                  background: '#fff',
                  border: '1px solid var(--color-line)',
                  filter: usable ? undefined : 'grayscale(1) opacity(0.5)',
                }}
              >
                {qr ? (
                  <img
                    src={qr}
                    alt="Your ticket QR code"
                    width={200}
                    height={200}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <span className="t-caption">Preparing your code…</span>
                )}
              </div>

              <p className="t-caption" style={{ margin: 0 }}>
                {usable
                  ? 'Show this at the door. It works without a connection.'
                  : ticket.status === 'used' && ticket.usedAt
                    ? `Checked in ${dayAndTime(ticket.usedAt)}`
                    : 'This ticket can no longer be used.'}
              </p>
            </div>

            <div style={{ padding: '0 var(--gap-lg)' }}>
              <DashedDivider />
            </div>

            <div style={{ padding: 'var(--gap-lg)' }}>
              {ticket.holderName && <SummaryRow label="Holder" value={ticket.holderName} />}
              {ticket.seat && <SummaryRow label="Seat" value={ticket.seat} />}
              {ticket.eventStartsAt && (
                <SummaryRow label="Starts" value={dayAndTime(ticket.eventStartsAt)} />
              )}
              {ticket.venueName && <SummaryRow label="Venue" value={ticket.venueName} />}
              <SummaryRow
                label="Paid"
                value={ticket.price > 0 ? money(ticket.price) : 'Free'}
              />
              {ticket.reference && <SummaryRow label="Reference" value={ticket.reference} />}
            </div>
          </Card>
        </FadeSlideIn>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 'var(--gap-xl)',
          }}
        >
          {ticket.eventStartsAt && (
            <span
              className="t-caption"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CalendarDays size={14} aria-hidden />
              {dayAndTime(ticket.eventStartsAt)}
            </span>
          )}
          {ticket.venueName && (
            <span
              className="t-caption"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <MapPin size={14} aria-hidden />
              {ticket.venueName}
            </span>
          )}
        </div>
      </ScreenBody>
    </>
  )
}

export default TicketsScreen
