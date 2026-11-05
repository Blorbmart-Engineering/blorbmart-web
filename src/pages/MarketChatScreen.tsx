/* ═══════════════════════════════════════════════════════════════════════
   The chat between a marketplace buyer and seller.

   Plans change: someone is late, the gate is closed, the buyer found one
   cheaper. They sort it out here instead of swapping numbers. A new meet-up
   is suggested from here too, and counts once the other side accepts.

   There is no live connection: while the screen is open and visible it asks
   the backend every few seconds for anything newer than the last message it
   has. The thread goes read-only once the sale is over, and the campus team
   can read it if the sale is disputed.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, Phone, SendHorizontal } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { asDate, clockTime, weekdayAndDate } from '../lib/format'
import { getMarketThread, sendMarketMessage, type MarketMessage, type MarketThread } from '../data/marketplace'
import { IconButton } from '../ui/Button'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { EmptyState, Skeleton } from '../ui/kit'
import { MeetupSheet, PendingBanners, meetupLabel } from '../components/marketplace/MarketChatParts'

const POLL_MS = 5000

const QUICK = {
  buyer: ['I’m on my way', 'Running a bit late', 'I’m here', 'Can we change the place?', 'Is it still working well?'],
  seller: ['I’m on my way', 'Running a bit late', 'I’m here', 'Can we change the time?', 'Still coming?'],
}

export default function MarketChatScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [thread, setThread] = useState<MarketThread | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [meetupOpen, setMeetupOpen] = useState(false)
  const bottom = useRef<HTMLDivElement | null>(null)
  // The newest message id, read by the poller without re-creating it.
  const lastId = useRef<string | undefined>(undefined)

  /** Folds a { messages, order } answer in: a full thread or only its newer part. */
  const absorb = useCallback((next: MarketThread, full = false) => {
    setThread((prev) => {
      const known = full || !prev ? [] : prev.messages
      const seen = new Set(known.map((m) => m.id))
      // Proposals change status in place, so a re-sent message replaces the old copy.
      const fresh = next.messages.filter((m) => !seen.has(m.id))
      const updated = known.map((m) => next.messages.find((n) => n.id === m.id) ?? m)
      const messages = [...updated, ...fresh]
      lastId.current = messages.length ? messages[messages.length - 1].id : undefined
      return { messages, order: next.order }
    })
  }, [])

  const loadAll = useCallback(async () => {
    try {
      absorb(await getMarketThread(id), true)
    } catch {
      setThread((prev) => prev ?? null)
    }
  }, [absorb, id])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Poll while the screen is on show; catch up at once when it comes back.
  useEffect(() => {
    let stopped = false
    const tick = async () => {
      if (document.hidden || stopped) return
      try {
        const next = await getMarketThread(id, lastId.current)
        // A status line usually means a suggestion card further up changed
        // too (accepted, declined), so take the whole thread to refresh it.
        if (next.messages.some((m) => m.kind !== 'text')) absorb(await getMarketThread(id), true)
        else absorb(next)
      } catch {
        /* a dropped poll is retried on the next tick */
      }
    }
    const timer = window.setInterval(() => void tick(), POLL_MS)
    const onShow = () => {
      // Proposal statuses can change without a new message id, so take it all.
      if (!document.hidden) void loadAll()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [absorb, id, loadAll])

  const count = thread?.messages.length ?? 0
  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [count])

  const send = async (body: string) => {
    const clean = body.trim()
    if (!clean || sending) return
    setSending(true)
    try {
      absorb(await sendMarketMessage(id, clean, lastId.current))
      setText('')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setSending(false)
    }
  }

  if (thread === undefined) {
    return (
      <>
        <AppBar title="Chat" />
        <ScreenBody padded>
          <Skeleton height={44} radius="18px" style={{ marginTop: 'var(--gap-xl)', width: '60%' }} />
          <Skeleton height={44} radius="18px" style={{ marginTop: 'var(--gap-md)', width: '50%', marginLeft: 'auto' }} />
        </ScreenBody>
      </>
    )
  }

  if (thread === null) {
    return (
      <>
        <AppBar title="Chat" />
        <EmptyState title="We could not open this chat" message="It may belong to another account." actionLabel="My marketplace" onAction={() => navigate('/marketplace/mine')} />
      </>
    )
  }

  const { order, messages } = thread
  const me = order.role
  const other = me === 'buyer' ? order.seller : order.buyer
  const open = order.chat?.open ?? false
  const canMoveMeetup = order.status === 'awaiting_seller' || order.status === 'accepted'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-canvas)' }}>
      <AppBar
        title={other.name}
        subtitle={order.listing.title}
        onBack={() => navigate(`/marketplace/orders/${order.id}`, { replace: true })}
        trailing={other.phone ? (
          <IconButton label={`Call ${other.name}`} onClick={() => (window.location.href = `tel:${other.phone}`)}>
            <Phone size={18} aria-hidden />
          </IconButton>
        ) : undefined}
      />

      <ScreenBody padded bottomGap="var(--gap-md)" style={{ flex: 1 }}>
        <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
          {order.meetup && (
            <div className="t-caption" style={{ textAlign: 'center' }}>
              Meet-up: <strong>{meetupLabel(order.meetup)}</strong>
            </div>
          )}
          <PendingBanners order={order} onThread={(t) => absorb(t, true)} />
        </div>

        <div className="mkt-thread">
          {messages.length === 0 && (
            <p className="t-body-sm" style={{ textAlign: 'center', color: 'var(--color-ink-muted)', margin: 'var(--gap-xl) 0' }}>
              {open ? `Say hi to ${other.name}. Keep the chat here so the campus team can help if anything goes wrong.` : 'No messages.'}
            </p>
          )}
          {messages.map((m) => (
            <Message key={m.id} m={m} me={me} otherName={other.name} />
          ))}
          <div ref={bottom} />
        </div>
      </ScreenBody>

      <StickyFooter>
        {open ? (
          <>
            {!text && (
              <div className="mkt-quick" role="list" aria-label="Quick replies">
                {QUICK[me].map((q) => (
                  <button key={q} type="button" role="listitem" onClick={() => void send(q)} disabled={sending}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="mkt-composer">
              {canMoveMeetup && (
                <IconButton label="Suggest a new meet-up" onClick={() => setMeetupOpen(true)}>
                  <CalendarClock size={19} aria-hidden />
                </IconButton>
              )}
              <textarea
                className="mkt-input"
                rows={1}
                value={text}
                maxLength={500}
                placeholder="Message"
                aria-label="Message"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends on a keyboard; Shift+Enter is a new line.
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
              />
              <IconButton
                label="Send"
                background="var(--color-brand)"
                color="#fff"
                onClick={() => void send(text)}
                style={{ opacity: text.trim() && !sending ? 1 : 0.5 }}
              >
                <SendHorizontal size={19} aria-hidden />
              </IconButton>
            </div>
          </>
        ) : (
          <p className="t-caption" style={{ margin: 0, textAlign: 'center' }}>
            This sale is {order.status === 'completed' ? 'complete' : 'closed'}, so the chat is read-only.
          </p>
        )}
      </StickyFooter>

      <MeetupSheet open={meetupOpen} onClose={() => setMeetupOpen(false)} order={order} onThread={(t) => absorb(t, true)} />
    </div>
  )
}

const PROPOSAL_STATUS: Record<string, string> = {
  pending: 'Waiting for an answer',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Taken back',
  replaced: 'Replaced by a newer suggestion',
}

function Message({ m, me, otherName }: { m: MarketMessage; me: 'buyer' | 'seller'; otherName: string }) {
  const at = asDate(m.at)
  if (m.kind === 'system') return <div className="mkt-system">{m.text}</div>
  if (m.kind === 'proposal' && m.proposal) {
    return (
      <div className="mkt-proposal">
        <div className="t-overline">{m.from === me ? 'You suggested' : `${otherName} suggested`}</div>
        <div className="t-label" style={{ marginTop: 4 }}>{meetupLabel(m.proposal)}</div>
        <div className="t-caption" style={{ marginTop: 4 }}>{PROPOSAL_STATUS[m.proposal.status] ?? ''}</div>
      </div>
    )
  }
  return (
    <div className={`mkt-bubble ${m.from === me ? 'mkt-bubble--mine' : 'mkt-bubble--theirs'}`}>
      {m.text}
      {at && <span className="mkt-bubble__time">{sameDay(at) ? clockTime(at) : `${weekdayAndDate(at)}, ${clockTime(at)}`}</span>}
    </div>
  )
}

const sameDay = (d: Date) => d.toDateString() === new Date().toDateString()
