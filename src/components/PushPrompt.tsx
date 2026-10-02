/* ═══════════════════════════════════════════════════════════════════════
   Asking for notifications — the soft ask before the browser's own.

   A browser asks once. Whatever the customer answers to its dialog sticks,
   and a "Block" can only be undone deep in site settings, which nobody does.
   So the browser's dialog is only ever opened from a tap on this sheet, at
   a moment the reason is obvious: right after an order is placed ("know
   when it is accepted and at your door"), on a marketplace sale (a held
   payment waits on the other student answering), or on home for a
   signed-in customer who has not been asked lately.

   "Not now" is remembered on this device: no asking again for three days,
   and never after the third time. Browsers that cannot do push at all — iOS
   until the app is on the Home Screen — never see it; InstallBanner covers
   that first step.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import { canPromptForPush, requestPush } from '../lib/push'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'

const KEY = 'blorb_push_ask_v1'
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000
const MAX_DECLINES = 3

interface AskRecord {
  at: number
  declines: number
}

function readRecord(): AskRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<AskRecord> | null
    return { at: Number(raw?.at) || 0, declines: Number(raw?.declines) || 0 }
  } catch {
    return { at: 0, declines: 0 }
  }
}

function writeRecord(record: AskRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    /* private mode: it may ask again next time, which is harmless */
  }
}

/** Once per page load at most, whichever moment gets there first. */
let askedThisLoad = false

const COPY = {
  order: {
    title: 'Know when it’s on the way',
    body: 'Turn on alerts and we’ll tell you the moment the store accepts your order and when your rider is at the door.',
  },
  marketplace: {
    title: 'Know when they answer',
    body: 'Turn on alerts and we’ll tell you the moment a buyer pays for your item or a seller accepts — your money is held until then.',
  },
  home: {
    title: 'Don’t miss your order',
    body: 'Get an alert when your food is accepted, picked up and at your door, plus deals from stores near you.',
  },
} as const

export type PushMoment = keyof typeof COPY

export function PushPrompt({ moment }: { moment: PushMoment }) {
  const { pathname } = useLocation()
  const signedIn = useSessionStore((s) => s.ready && isSignedIn(s))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!signedIn || askedThisLoad) return
    if (moment === 'home' && pathname !== '/home') return
    const record = readRecord()
    if (record.declines >= MAX_DECLINES) return
    // Straight after paying for food is always worth asking; anywhere else
    // waits out the cooldown after a "Not now".
    if (Date.now() - record.at < COOLDOWN_MS && moment !== 'order') return

    let live = true
    // After the screen has settled; on the order screen, after the
    // celebration has had its moment.
    const timer = setTimeout(async () => {
      if (!live || askedThisLoad) return
      if (!(await canPromptForPush())) return
      // Never on top of another sheet or the opening flyer.
      if (document.querySelector('[aria-modal="true"]')) return
      askedThisLoad = true
      setOpen(true)
    }, moment === 'home' ? 6000 : 2800)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [signedIn, moment, pathname])

  const decline = () => {
    const record = readRecord()
    writeRecord({ at: Date.now(), declines: record.declines + 1 })
    setOpen(false)
  }

  const enable = async () => {
    setBusy(true)
    const result = await requestPush()
    setBusy(false)
    setOpen(false)
    writeRecord({ at: Date.now(), declines: result === 'granted' ? 0 : readRecord().declines + 1 })
    if (result === 'granted') showToast('Alerts are on.', 'success')
    else if (result === 'denied') {
      showToast('Alerts are blocked. You can turn them on in your browser’s site settings.', 'neutral')
    }
  }

  const copy = COPY[moment]

  return (
    <Sheet open={open} onClose={decline}>
      <div style={{ textAlign: 'center', padding: 'var(--gap-sm) var(--gap-lg) var(--gap-lg)' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-brand-soft)',
            color: 'var(--color-brand)',
          }}
        >
          <BellRing size={30} />
        </span>
        <h2 className="t-h2" style={{ margin: 'var(--gap-lg) 0 0' }}>
          {copy.title}
        </h2>
        <p className="t-body" style={{ margin: 'var(--gap-sm) 0 0' }}>
          {copy.body}
        </p>
        <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xl)' }}>
          <Button label="Turn on alerts" glow busy={busy} onClick={() => void enable()} />
          <Button label="Not now" kind="ghost" onClick={decline} />
        </div>
      </div>
    </Sheet>
  )
}
