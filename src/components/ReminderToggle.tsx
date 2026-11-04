/* ═══════════════════════════════════════════════════════════════════════
   Reminders on or off: the occasional "your basket is waiting" push
   (backend services/engagementService.js). Separate from push alerts, which
   carry orders and payments and stay on whatever this says. Saved on the
   account, so it holds on every device.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { reminderPrefs } from '../lib/engagement'
import { showToast } from '../ui/Screen'

export function ReminderToggle({ last = false }: { last?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void reminderPrefs.get().then(setOn).catch(() => setOn(null))
  }, [])

  if (on === null) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      await reminderPrefs.set(!on)
      setOn(!on)
      showToast(on ? 'Reminders are off.' : 'Reminders are on.', 'neutral')
    } catch {
      showToast('Could not save that. Try again.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
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
        cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid transparent',
        backgroundImage: last ? undefined : 'linear-gradient(var(--color-line), var(--color-line))',
        backgroundSize: 'calc(100% - 60px) 1px',
        backgroundPosition: 'right bottom',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <span aria-hidden style={{ color: 'var(--color-ink-strong)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <Sparkles size={21} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4" style={{ display: 'block', color: 'var(--color-ink-strong)' }}>
          Reminders
        </span>
        <span className="t-caption-sm" style={{ display: 'block', marginTop: 2 }}>
          {on ? 'On: now and then, a nudge about a basket you left' : 'Off: no reminders. Order updates still arrive.'}
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
          opacity: busy ? 0.7 : 1,
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
