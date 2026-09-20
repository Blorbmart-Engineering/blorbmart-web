/* ═══════════════════════════════════════════════════════════════════════
   My tickets, and one ticket — ports of
   lib/features/events/my_tickets_screen.dart and ticket_screen.dart.

   The QR string is produced and signed by the backend. Nothing here builds
   one: a ticket the client could mint is not a ticket.

   Both screens draw the same object — a stub with a torn edge — at two
   sizes. That shape is the point: the thing in your hand at a door is not a
   card with a code on it, and a screen that looks like one is harder to
   present and harder to trust. The tear, the data strip and the serial are
   what a printed ticket carries, so they are what these carry.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Download, Share2, Ticket as TicketIcon } from 'lucide-react'


import { cachedEvent, getTicket, myTickets } from '../data/events'
import {
  clockTime,
  dayOfMonth,
  money,
  monthShort,
  weekdayAndDate,
} from '../lib/format'
import {
  TICKET_STATUS_LABELS,
  ticketIsUsable,
  type EventTicket,
} from '../models/events'
import { Button } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

/* ── List ──────────────────────────────────────────────────────────────── */

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
              height={72}
              radius="var(--radius-md)"
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
              <TicketRow ticket={ticket} onOpen={() => navigate(`/tickets/${ticket.id}`)} />
            </FadeSlideIn>
          ))
        )}
      </ScreenBody>
    </>
  )
}

/**
 * A ticket at list size: the date block torn off down the left, the event
 * and tier in the middle, the status on the right.
 */
function TicketRow({ ticket, onOpen }: { ticket: EventTicket; onOpen: () => void }) {
  const usable = ticketIsUsable(ticket)
  const meta = [ticket.ticketTypeName, ticket.seat || ticket.venueName]
    .filter(Boolean)
    .join(' · ')

  return (
    <PressScale
      scale={0.985}
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        marginBottom: 'var(--gap-md)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          flex: 'none',
          width: 62,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          padding: 'var(--gap-md) 0',
          background: 'var(--color-events-soft)',
          color: 'var(--color-events)',
          // The same perforation as the full ticket, at row scale.
          borderRight: '2px dashed var(--color-line-strong)',
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {dayOfMonth(ticket.eventStartsAt)}
        </span>
        <span className="t-mono-label">{monthShort(ticket.eventStartsAt)}</span>
      </span>

      <span style={{ flex: 1, minWidth: 0, padding: 'var(--gap-md) var(--gap-lg)' }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {ticket.eventTitle || 'Ticket'}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {meta}
        </span>
      </span>

      <span style={{ flex: 'none', display: 'flex', alignItems: 'center', paddingRight: 'var(--gap-lg)' }}>
        <span
          className="t-mono-label"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-xs)',
            background: usable
              ? 'color-mix(in srgb, var(--color-success) 13%, transparent)'
              : 'var(--color-surface-sunken)',
            color: usable ? 'var(--color-success)' : 'var(--color-ink-faint)',
          }}
        >
          {TICKET_STATUS_LABELS[ticket.status]}
        </span>
      </span>
    </PressScale>
  )
}

/* ── One ticket ────────────────────────────────────────────────────────── */

export function TicketScreen() {
  const { ticketId = '' } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<EventTicket | null | undefined>(undefined)
  const [qr, setQr] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

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

  /**
   * Keeps a copy that survives a flat battery at the gate.
   *
   * Printing is the download. There is no PDF library in this bundle and the
   * backend renders receipts as HTML, not PDF — so a fetch-and-save-as-.pdf
   * writes a file that is not a PDF and will not open. Every print dialog on
   * every platform offers "Save as PDF" as a destination, and the print
   * stylesheet in index.css puts the ticket alone on the page.
   */
  const download = () => {
    setDownloading(true)
    // Let the button paint its busy state before the dialog blocks the thread.
    requestAnimationFrame(() => {
      try {
        window.print()
      } finally {
        setDownloading(false)
      }
    })
  }

  const share = async () => {
    if (!ticket) return
    const text = `${ticket.eventTitle || 'Blorbmart ticket'} · ${ticket.reference}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Blorbmart ticket', text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Ticket details copied.', 'success')
      }
    } catch {
      /* the guest dismissed the share sheet */
    }
  }

  if (ticket === undefined) {
    return (
      <>
        <AppBar title="Ticket" />
        <ScreenBody padded>
          <Skeleton height={520} radius="var(--radius-xl)" />
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

  return (
    <>
      <AppBar title={ticket.eventTitle || 'Ticket'} subtitle={ticket.ticketTypeName} />
      <ScreenBody bottomGap="150px" padded>
        <FadeSlideIn>
          <TicketStub ticket={ticket} qr={qr} />
        </FadeSlideIn>

        {/* The one moment this is wanted is before leaving the house, on a
            connection you are about to lose. It belongs under the ticket,
            not behind a menu. */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--gap-md)',
            maxWidth: 380,
            margin: 'var(--gap-xl) auto 0',
          }}
        >
          <Button
            label="Share"
            kind="outline"
            icon={<Share2 size={17} aria-hidden />}
            onClick={() => void share()}
          />
          <Button
            label="Save PDF"
            busy={downloading}
            icon={<Download size={17} aria-hidden />}
            onClick={download}
          />
        </div>
      </ScreenBody>
    </>
  )
}

/** The three slots on the data strip, filled with whatever this ticket has. */
function fieldsFor(ticket: EventTicket): { label: string; value: string }[] {
  const spent = !ticketIsUsable(ticket)
  const fields: { label: string; value: string }[] = []

  if (ticket.eventStartsAt) {
    fields.push({ label: 'Date', value: weekdayAndDate(ticket.eventStartsAt) })
  }

  // A spent ticket answers "when did I go in?"; a live one answers "when do
  // I need to be there?". Same slot, different question.
  if (spent && ticket.usedAt) {
    fields.push({ label: 'Scanned', value: clockTime(ticket.usedAt) })
  } else if (ticket.seat) {
    fields.push({ label: 'Seat', value: ticket.seat })
  } else if (ticket.eventStartsAt) {
    fields.push({ label: 'Doors', value: clockTime(ticket.eventStartsAt) })
  }

  if (ticket.price > 0) {
    fields.push({ label: 'Paid', value: money(ticket.price) })
  } else if (ticket.venueName) {
    fields.push({ label: 'Venue', value: ticket.venueName })
  }

  return fields.slice(0, 3)
}

function TicketStub({ ticket, qr }: { ticket: EventTicket; qr: string | null }) {
  const usable = ticketIsUsable(ticket)
  const voided = ticket.status === 'cancelled' || ticket.status === 'refunded'
  const fields = fieldsFor(ticket)

  // The cover lives on the event, not the ticket. Read from the cache the
  // events screens already fill; when it is not there the header falls back
  // to flat violet rather than holding the ticket back on a network call.
  const cover = cachedEvent(ticket.eventId)?.coverUrl ?? ''

  const notch = 26

  return (
    <div
      className="blorb-ticket"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 380,
        margin: '0 auto',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* ── Header: the event's own photograph under a violet wash ────── */}
      <div
        style={{
          position: 'relative',
          height: 168,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          overflow: 'hidden',
          background: 'var(--color-events)',
        }}
      >
        {cover && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              filter: usable ? undefined : 'grayscale(1)',
              opacity: usable ? 1 : 0.45,
            }}
          >
            <SmartImage src={cover} alt="" renderWidth={760} height="100%" eager />
          </div>
        )}
        {/* Violet at the top ties it to the events vertical; the dark foot
            keeps the title legible over any photograph. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(124,92,255,0.30) 0%, rgba(91,59,224,0.10) 45%, rgba(8,6,24,0.86) 100%)',
          }}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 var(--gap-xl) var(--gap-lg)' }}>
          {ticket.ticketTypeName && (
            <span
              className="t-mono-label"
              style={{
                display: 'inline-block',
                marginBottom: 9,
                padding: '3px 9px',
                borderRadius: 'var(--radius-pill)',
                color: '#fff',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.32)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {ticket.ticketTypeName}
            </span>
          )}
          <h1
            style={{
              margin: 0,
              fontSize: 23,
              lineHeight: 1.16,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#fff',
              textWrap: 'balance',
            }}
          >
            {ticket.eventTitle || 'Ticket'}
          </h1>
        </div>
      </div>

      {/* ── Data strip ────────────────────────────────────────────────── */}
      {fields.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))`,
            padding: 'var(--gap-lg) var(--gap-xl) var(--gap-lg)',
          }}
        >
          {fields.map((field, i) => (
            <div
              key={field.label}
              style={{
                minWidth: 0,
                paddingLeft: i === 0 ? 0 : 'var(--gap-md)',
                borderLeft: i === 0 ? undefined : '1px solid var(--color-line)',
              }}
            >
              <span className="t-mono-label" style={{ display: 'block', marginBottom: 4 }}>
                {field.label}
              </span>
              <span
                className="t-h4"
                style={{ display: 'block', fontSize: 14, lineHeight: 1.35, overflowWrap: 'anywhere' }}
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── The tear ──────────────────────────────────────────────────────
          Two notches punched in the page colour with a perforation between.
          This is the detail that stops the whole thing reading as a card. */}
      <div style={{ position: 'relative', height: 0 }} aria-hidden>
        <span style={{ ...notchStyle(notch), left: -notch / 2 }} />
        <span style={{ ...notchStyle(notch), right: -notch / 2 }} />
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: 17,
            right: 17,
            height: 0,
            transform: 'translateY(-50%)',
            borderTop: '2px dashed var(--color-line-strong)',
          }}
        />
      </div>

      {/* ── Stub ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          padding: 'var(--gap-xxl) var(--gap-xl) var(--gap-xl)',
          textAlign: 'center',
        }}
      >
        <p
          className="t-mono-label"
          style={{
            margin: '0 0 var(--gap-lg)',
            letterSpacing: '0.3em',
            color: usable ? 'var(--color-events)' : 'var(--color-ink-faint)',
          }}
        >
          {usable ? 'Admit one' : voided ? 'Not valid' : 'Admitted'}
        </p>

        <div
          style={{
            position: 'relative',
            width: 196,
            height: 196,
            margin: '0 auto',
            padding: 'var(--gap-md)',
            borderRadius: 'var(--radius-md)',
            background: '#fff',
            border: '1px solid var(--color-line)',
          }}
        >
          {qr ? (
            <img
              src={qr}
              alt="Your ticket QR code"
              width={172}
              height={172}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                filter: usable ? undefined : 'grayscale(1)',
                opacity: usable ? 1 : 0.45,
              }}
            />
          ) : (
            <span className="t-caption" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              Preparing your code…
            </span>
          )}

          {/* Struck across the code, not the details: a spent ticket is still
              opened to check when and where, and only the code is dead. */}
          {!usable && (
            <span
              className="t-mono-label"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-11deg)',
                fontSize: 15,
                letterSpacing: '0.22em',
                whiteSpace: 'nowrap',
                padding: '7px 16px',
                borderRadius: 'var(--radius-xs)',
                color: voided ? 'var(--color-danger)' : 'var(--color-ink-muted)',
                border: `2.5px solid ${voided ? 'var(--color-danger)' : 'var(--color-ink-muted)'}`,
                background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
                pointerEvents: 'none',
              }}
            >
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
          )}
        </div>

        <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0' }}>
          {usable
            ? 'Show this at the door. Works without a connection.'
            : ticket.status === 'used' && ticket.usedAt
              ? `Checked in ${weekdayAndDate(ticket.usedAt)} at ${clockTime(ticket.usedAt)}.`
              : 'This ticket can no longer be used.'}
        </p>

        {ticket.reference && (
          <p
            className="t-mono-label"
            style={{
              margin: 'var(--gap-lg) 0 0',
              fontSize: 13,
              letterSpacing: '0.14em',
              color: 'var(--color-ink)',
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
            }}
          >
            № {ticket.reference}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--gap-md)',
            marginTop: 'var(--gap-lg)',
            paddingTop: 'var(--gap-md)',
            borderTop: '1px solid var(--color-line)',
          }}
        >
          <span
            className="t-mono-label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: voided
                ? 'var(--color-danger)'
                : usable
                  ? 'var(--color-success)'
                  : 'var(--color-ink-faint)',
            }}
          >
            <span
              aria-hidden
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }}
            />
            {TICKET_STATUS_LABELS[ticket.status]}
          </span>
          {ticket.holderName && (
            <span className="t-mono-label clamp-1" style={{ minWidth: 0 }}>
              {ticket.holderName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One notch in the ticket's edge.
 *
 * Filled with the page colour rather than cut out, because a real cut-out
 * (a mask) takes the card's shadow with it.
 */
function notchStyle(size: number): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'var(--color-canvas)',
    transform: 'translateY(-50%)',
  }
}

export default TicketsScreen
