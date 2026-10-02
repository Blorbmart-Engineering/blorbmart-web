/* ═══════════════════════════════════════════════════════════════════════
   The on/off switch for push alerts on this browser.

   On asks the browser the first time; after that it just registers this
   device again. Off removes this device from our server and stays off here
   until switched back (see turnAlertsOff in lib/push).

   The browser has the last word: if it blocked notifications, or cannot do
   push at all (iOS before the app is on the Home Screen), the switch says
   so and explains the one way forward instead of pretending to work.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { alertsSwitchedOff, pushState, turnAlertsOff, turnAlertsOn, whyNoPush, type PushState } from '../lib/push'
import { showToast } from '../ui/Screen'

export function PushToggle({ last = false }: { last?: boolean }) {
  const [state, setState] = useState<PushState | null>(null)
  const [off, setOff] = useState(alertsSwitchedOff)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState<string | null>(null)

  useEffect(() => {
    void pushState().then((s) => {
      setState(s)
      if (s === 'unsupported') void whyNoPush().then(setWhy)
    })
  }, [])

  if (state === null || state === 'not_configured') return null

  const on = state === 'granted' && !off
  const blocked = state === 'denied'
  const unsupported = state === 'unsupported'

  const subtitle = blocked
    ? 'Blocked by your browser. Allow notifications for this site in its settings, then come back.'
    : unsupported
      ? why ?? 'Checking this device…'
      : on
        ? 'On — orders, payments and messages'
        : 'Off — you will not get alerts on this device'

  const toggle = async () => {
    if (busy || blocked || unsupported) return
    setBusy(true)
    try {
      if (on) {
        await turnAlertsOff()
        setOff(true)
        showToast('Alerts are off on this device.', 'neutral')
      } else {
        const result = await turnAlertsOn()
        setOff(false)
        setState(result)
        if (result === 'granted') showToast('Alerts are on.', 'success')
        else if (result === 'denied') showToast('Your browser blocked alerts. Allow them in its site settings.', 'danger')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={blocked || unsupported || undefined}
      onClick={() => void toggle()}
      className="press"
      style={{
        ['--press-scale' as string]: '0.99',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-lg)',
        width: '100%',
        padding: 'var(--gap-lg)',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        cursor: blocked || unsupported ? 'default' : 'pointer',
        borderBottom: last ? 'none' : '1px solid transparent',
        backgroundImage: last ? undefined : 'linear-gradient(var(--color-line), var(--color-line))',
        backgroundSize: 'calc(100% - 60px) 1px',
        backgroundPosition: 'right bottom',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <span aria-hidden style={{ color: 'var(--color-ink-strong)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <BellRing size={21} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4" style={{ display: 'block', color: 'var(--color-ink-strong)' }}>
          Push notifications
        </span>
        <span className="t-caption-sm" style={{ display: 'block', marginTop: 2 }}>
          {subtitle}
        </span>
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 44,
          height: 26,
          flexShrink: 0,
          borderRadius: 'var(--radius-pill)',
          background: on ? 'var(--color-brand)' : 'var(--color-line-strong)',
          opacity: blocked || unsupported ? 0.45 : busy ? 0.7 : 1,
          transition: 'background var(--dur-fast) var(--ease-emphasized)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--shadow-xs)',
            transition: 'left var(--dur-fast) var(--ease-emphasized)',
          }}
        />
      </span>
    </button>
  )
}
