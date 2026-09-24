/* ═══════════════════════════════════════════════════════════════════════
   Notifications — a port of
   lib/features/notifications/notifications_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { auth, db } from '../lib/firebase'
import { asDate, asString, timeAgo } from '../lib/format'
import { canPromptForPush, isStandalone, requestPush } from '../lib/push'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { ChipRail, EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { isIosSafari } from '../hooks/useInstallPrompt'

interface Note {
  id: string
  title: string
  body: string
  route: string
  status: string
  type: string
  at: Date | null
}

/* ── Tabs ──────────────────────────────────────────────────────────────── */

const TABS = ['All', 'Activity', 'Promotions', 'Updates'] as const
type Tab = (typeof TABS)[number]

/**
 * Which tab a notification belongs on, from the `type` the backend wrote.
 *
 *   Activity    something that happened to this customer's own money or
 *               orders: orders, bills, wallet, tickets, referral bonuses.
 *   Promotions  things sent to many people at once: broadcasts, offers.
 *   Updates     everything else, such as maintenance and account notices.
 *
 * Kept in step with notifications_screen.dart.
 */
const ACTIVITY = /^(order|delivery|bill|wallet|payment|refund|deposit|withdrawal|ticket|event_ticket|event_broadcast|referral|receipt|debit|credit|reversal)/
const PROMOTIONS = /^(broadcast|campus_broadcast|promo|offer|announcement|marketing|deal)/

function tabFor(type: string): Exclude<Tab, 'All'> {
  const t = type.toLowerCase()
  if (PROMOTIONS.test(t)) return 'Promotions'
  if (ACTIVITY.test(t)) return 'Activity'
  return 'Updates'
}

const EMPTY_COPY: Record<Tab, string> = {
  All: 'Order updates, payment confirmations and offers land here.',
  Activity: 'Orders, payments, bills and tickets will show up here.',
  Promotions: 'Deals and announcements from Blorbmart will show up here.',
  Updates: 'Account and service notices will show up here.',
}

export default function NotificationsScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [canAsk, setCanAsk] = useState(false)
  const [tab, setTab] = useState<Tab>('All')

  useEffect(() => {
    void canPromptForPush().then(setCanAsk)
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!signedIn || !uid) {
      setNotes([])
      return
    }
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        fbLimit(50),
      ),
      (snap) =>
        setNotes(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              title: asString(data.title, 'Blorbmart'),
              body: asString(data.body ?? data.message),
              route: asString(data.route ?? data.link),
              status: asString(data.status, 'read'),
              type: asString(data.type, 'general'),
              at: asDate(data.createdAt),
            }
          }),
        ),
      () => setNotes([]),
    )
  }, [signedIn])

  const unread = (notes ?? []).filter((n) => n.status === 'unread')
  const shown = (notes ?? []).filter((n) => tab === 'All' || tabFor(n.type) === tab)

  /** "Promotions · 2" when a tab has unread items, so they are not missed. */
  const unreadIn = (t: Tab) =>
    unread.filter((n) => t === 'All' || tabFor(n.type) === t).length
  const labelFor = (t: Tab) => (unreadIn(t) > 0 ? `${t} · ${unreadIn(t)}` : t)
  const labels = TABS.map(labelFor)

  const markAllRead = async () => {
    const uid = auth.currentUser?.uid
    if (!uid || unread.length === 0) return
    try {
      const batch = writeBatch(db)
      for (const note of unread) {
        batch.update(doc(db, 'notifications', note.id), {
          status: 'read',
          readAt: serverTimestamp(),
        })
      }
      await batch.commit()
    } catch {
      showToast('We could not update those. Try again.', 'danger')
    }
  }

  const open = async (note: Note) => {
    if (note.status === 'unread') {
      try {
        await updateDoc(doc(db, 'notifications', note.id), {
          status: 'read',
          readAt: serverTimestamp(),
        })
      } catch {
        /* reading it matters more than recording that it was read */
      }
    }
    if (note.route) navigate(note.route)
  }

  const enablePush = async () => {
    const result = await requestPush()
    if (result === 'granted') {
      setCanAsk(false)
      showToast('Alerts are on.', 'success')
    } else if (result === 'unsupported') {
      showToast('Add Blorbmart to your Home Screen first.', 'neutral')
    } else {
      showToast('Alerts are blocked in your browser settings.', 'danger')
    }
  }

  return (
    <>
      <AppBar
        title="Notifications"
        subtitle={unread.length > 0 ? `${unread.length} unread` : 'Order and payment alerts'}
        trailing={
          unread.length > 0 ? (
            <IconButton label="Mark all as read" onClick={() => void markAllRead()}>
              <CheckCheck size={19} aria-hidden />
            </IconButton>
          ) : undefined
        }
      />

      <ScreenBody bottomGap="150px" padded>
        {/* iOS only allows push once the app has been added to the Home
            Screen, so the ask is framed differently there. */}
        {canAsk && (
          <FadeSlideIn>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-md)',
                padding: 'var(--gap-md) var(--gap-lg)',
                marginBottom: 'var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-brand-softer)',
                border: '1px solid var(--color-brand-soft)',
              }}
            >
              <Bell size={20} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-h4">Turn on alerts</div>
                <div className="t-caption">Know the moment your rider is outside</div>
              </div>
              <Button
                label="Enable"
                size="sm"
                expand={false}
                onClick={() => void enablePush()}
              />
            </div>
          </FadeSlideIn>
        )}

        {!canAsk && isIosSafari() && !isStandalone() && (
          <p
            className="t-body-sm"
            style={{
              padding: 'var(--gap-md) var(--gap-lg)',
              marginBottom: 'var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
            }}
          >
            On iPhone, alerts work once Blorbmart is on your Home Screen. Tap Share, then Add
            to Home Screen.
          </p>
        )}

        {notes !== null && notes.length > 0 && (
          <div style={{ marginBottom: 'var(--gap-lg)' }}>
            <ChipRail
              options={labels}
              selected={labelFor(tab)}
              onSelect={(label) => setTab(TABS[labels.indexOf(label)] ?? 'All')}
            />
          </div>
        )}

        {notes === null ? (
          [0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              height={72}
              radius="var(--radius-md)"
              style={{ marginBottom: 'var(--gap-sm)' }}
            />
          ))
        ) : shown.length === 0 ? (
          <EmptyState
            title={tab === 'All' ? 'Nothing yet' : `No ${tab.toLowerCase()} yet`}
            message={EMPTY_COPY[tab]}
            icon={<BellOff size={30} aria-hidden />}
          />
        ) : (
          shown.map((note, i) => (
            <FadeSlideIn key={note.id} delay={staggerFor(i, 6)}>
              <PressScale
                scale={0.99}
                onClick={() => void open(note)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--gap-md)',
                  width: '100%',
                  padding: 'var(--gap-md)',
                  marginBottom: 'var(--gap-sm)',
                  borderRadius: 'var(--radius-md)',
                  background:
                    note.status === 'unread'
                      ? 'var(--color-brand-softer)'
                      : 'var(--color-surface)',
                  border: '1px solid var(--color-line)',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'var(--color-brand-soft)',
                    color: 'var(--color-brand)',
                  }}
                >
                  <Bell size={17} aria-hidden />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-h4 clamp-2" style={{ display: 'block' }}>
                    {note.title}
                  </span>
                  {note.body && (
                    <span className="t-body-sm clamp-2" style={{ display: 'block', marginTop: 2 }}>
                      {note.body}
                    </span>
                  )}
                  <span className="t-caption-sm" style={{ display: 'block', marginTop: 4 }}>
                    {timeAgo(note.at)}
                  </span>
                </span>
                {note.status === 'unread' && (
                  <span
                    aria-label="Unread"
                    style={{
                      width: 8,
                      height: 8,
                      flexShrink: 0,
                      marginTop: 6,
                      borderRadius: '50%',
                      background: 'var(--color-brand)',
                    }}
                  />
                )}
              </PressScale>
            </FadeSlideIn>
          ))
        )}
      </ScreenBody>
    </>
  )
}
