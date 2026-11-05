/* ═══════════════════════════════════════════════════════════════════════
   Pieces shared by a marketplace order and its chat: the agreed meet-up,
   the two things waiting on someone's yes (a new meet-up, the buyer asking
   to cancel), and the sheet for suggesting a new meet-up.

   Every action here answers with { messages, order }; the screens pass
   `onThread` so they can refresh both from the one response.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { CalendarClock, Undo2 } from 'lucide-react'
import { apiErrorMessage } from '../../lib/api'
import { asDate, clockTime, weekdayAndDate } from '../../lib/format'
import { answerCancel, answerMeetup, proposeMeetup, type MarketOrder, type MarketThread } from '../../data/marketplace'
import { Button } from '../../ui/Button'
import { showToast } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

/** "Library steps · Fri 7 Nov, 4:00 pm", or just the place. */
export function meetupLabel(m: { place: string; time: string | null }): string {
  const at = asDate(m.time)
  return at ? `${m.place} · ${weekdayAndDate(at)}, ${clockTime(at)}` : m.place
}

type OnThread = (t: MarketThread) => void

/**
 * Whatever is waiting on someone in this order. The person who has to
 * answer gets the buttons; the one who asked sees that it is pending and can
 * take it back.
 */
export function PendingBanners({ order, after, onThread }: { order: MarketOrder; after?: string; onThread: OnThread }) {
  const [busy, setBusy] = useState<string | null>(null)
  const me = order.role
  const otherName = me === 'buyer' ? order.seller.name : order.buyer.name

  const run = async (key: string, call: () => Promise<MarketThread>, done?: string) => {
    setBusy(key)
    try {
      onThread(await call())
      if (done) showToast(done, 'success')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const p = order.meetupProposal
  const c = order.cancelRequest
  if (!p && !c) return null

  return (
    <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
      {p && (
        <div className="mkt-banner">
          <CalendarClock size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-label">{p.by === me ? 'You suggested a new meet-up' : `${otherName} suggests a new meet-up`}</div>
            <div className="t-body-sm" style={{ marginTop: 2 }}>{meetupLabel(p)}</div>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)', flexWrap: 'wrap' }}>
              {p.by === me ? (
                <Button label="Take it back" kind="ghost" size="sm" expand={false} busy={busy === 'withdraw'}
                  onClick={() => void run('withdraw', () => answerMeetup(order.id, p.id, false, after))} />
              ) : (
                <>
                  <Button label="Accept" size="sm" expand={false} busy={busy === 'agree'}
                    onClick={() => void run('agree', () => answerMeetup(order.id, p.id, true, after), 'Meet-up updated')} />
                  <Button label="Can't make it" kind="outline" size="sm" expand={false} busy={busy === 'decline'}
                    onClick={() => void run('decline', () => answerMeetup(order.id, p.id, false, after))} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {c && (
        <div className="mkt-banner mkt-banner--warning">
          <Undo2 size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-label">{me === 'buyer' ? 'You asked to cancel' : `${order.buyer.name} wants to cancel`}</div>
            <div className="t-body-sm" style={{ marginTop: 2 }}>
              {c.reason ? `“${c.reason}”. ` : ''}
              {me === 'buyer'
                ? 'If the seller agrees, your money comes straight back.'
                : 'If you agree, they get their money back and your item goes back up for sale.'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)', flexWrap: 'wrap' }}>
              {me === 'buyer' ? (
                <Button label="Never mind" kind="ghost" size="sm" expand={false} busy={busy === 'keep'}
                  onClick={() => void run('keep', () => answerCancel(order.id, false, after))} />
              ) : (
                <>
                  <Button label="Agree and refund" kind="danger" size="sm" expand={false} busy={busy === 'refund'}
                    onClick={() => void run('refund', () => answerCancel(order.id, true, after), 'Cancelled — the buyer was refunded.')} />
                  <Button label="Keep the sale" kind="outline" size="sm" expand={false} busy={busy === 'keep'}
                    onClick={() => void run('keep', () => answerCancel(order.id, false, after))} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** "2026-11-05T16:00", the value a datetime-local input takes, in the phone's own time. */
const localInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Suggest a new place and, optionally, a time. It counts once the other side accepts. */
export function MeetupSheet({
  open,
  onClose,
  order,
  after,
  onThread,
}: {
  open: boolean
  onClose: () => void
  order: MarketOrder
  after?: string
  onThread: OnThread
}) {
  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const now = new Date()
  const latest = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const send = async () => {
    setBusy(true)
    try {
      onThread(await proposeMeetup(order.id, place.trim(), time ? new Date(time).toISOString() : null, after))
      showToast(`Sent — ${order.role === 'buyer' ? 'the seller' : 'the buyer'} will be asked to accept it.`, 'success')
      setPlace('')
      setTime('')
      onClose()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Suggest a new meet-up">
      <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
        {order.meetup ? `Now: ${meetupLabel(order.meetup)}. ` : ''}
        It only changes once {order.role === 'buyer' ? order.seller.name : order.buyer.name} accepts.
      </p>
      <label className="t-label mkt-label" htmlFor="meetup-place" style={{ marginTop: 0 }}>Where</label>
      <input
        id="meetup-place"
        className="mkt-input"
        value={place}
        maxLength={120}
        onChange={(e) => setPlace(e.target.value)}
        placeholder="e.g. Faculty of Science gate"
      />
      <label className="t-label mkt-label" htmlFor="meetup-time">When (optional)</label>
      <input
        id="meetup-time"
        className="mkt-input"
        type="datetime-local"
        value={time}
        min={localInputValue(now)}
        max={localInputValue(latest)}
        onChange={(e) => setTime(e.target.value)}
      />
      <Button label="Send suggestion" style={{ marginTop: 'var(--gap-lg)' }} disabled={place.trim().length < 2} busy={busy} onClick={() => void send()} />
    </Sheet>
  )
}
