/* ═══════════════════════════════════════════════════════════════════════
   "When?" on checkout: as soon as possible, or a time the customer picks.

   The slots come from the server (GET /api/orders/schedule-slots), already
   cut to the store's hours and the riders' delivery window in Lagos time,
   so nothing here does clock arithmetic. The chosen slot is checked again
   at payment; a slot that lapsed meanwhile comes back as a sentence.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { CalendarClock, Zap } from 'lucide-react'
import { scheduleSlots, type DeliveryTime, type ScheduleOptions } from '../data/orders'
import { apiErrorMessage } from '../lib/api'
import { Skeleton } from '../ui/kit'

export function SchedulePicker({
  storeIds,
  value,
  onChange,
  onModeChange,
  disabledReason,
}: {
  storeIds: string[]
  /** null is "as soon as possible". */
  value: DeliveryTime
  onChange: (value: DeliveryTime, label: string | null) => void
  /** Told when the customer switches between "now" and "schedule". */
  onModeChange?: (mode: 'now' | 'later') => void
  /** Set when the chosen way of paying cannot carry a time. */
  disabledReason?: string | null
}) {
  const [chosenMode, setMode] = useState<'now' | 'later'>(value ? 'later' : 'now')
  // A way of paying that cannot carry a time reads as "now"; the checkout
  // sends no time with it either.
  const mode = disabledReason ? 'now' : chosenMode
  const [options, setOptions] = useState<ScheduleOptions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dayKey, setDayKey] = useState<string | null>(null)
  const storesKey = storeIds.join(',')

  // Loaded the first time "Schedule" is opened, and again if the basket
  // moves to another store.
  useEffect(() => {
    if (mode !== 'later' || !storesKey) return
    let live = true
    setOptions(null)
    setLoadError(null)
    scheduleSlots(storesKey.split(','))
      .then((o) => {
        if (!live) return
        setOptions(o)
        setDayKey((k) => (k && o.days.some((d) => d.key === k) ? k : o.days[0]?.key ?? null))
      })
      .catch((e) => live && setLoadError(apiErrorMessage(e, 'We could not load delivery times.')))
    return () => {
      live = false
    }
  }, [mode, storesKey])

  // A held time that is no longer offered (the basket changed store) is let go.
  useEffect(() => {
    if (!value || !options) return
    if (!options.days.some((d) => d.slots.some((s) => s.at === value))) onChange(null, null)
  }, [options, value, onChange])

  const pickMode = (next: 'now' | 'later') => {
    setMode(next)
    onModeChange?.(next)
    if (next === 'now') onChange(null, null)
  }


  const day = options?.days.find((d) => d.key === dayKey) ?? options?.days[0]

  return (
    <div>
      <div role="radiogroup" aria-label="When" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-sm)' }}>
        <ModeTile
          active={mode === 'now'}
          onClick={() => pickMode('now')}
          icon={<Zap size={18} aria-hidden />}
          title="As soon as possible"
        />
        <ModeTile
          active={mode === 'later'}
          disabled={Boolean(disabledReason)}
          onClick={() => pickMode('later')}
          icon={<CalendarClock size={18} aria-hidden />}
          title="Schedule"
        />
      </div>

      {disabledReason && (
        <p className="t-caption" style={{ margin: '6px 0 0' }}>
          {disabledReason}
        </p>
      )}

      {mode === 'later' && !disabledReason && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          {loadError ? (
            <p className="t-caption" style={{ margin: 0, color: 'var(--color-danger)' }}>
              {loadError}
            </p>
          ) : !options ? (
            <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
              <Skeleton height={36} />
              <Skeleton height={84} />
            </div>
          ) : !options.days.length ? (
            <p className="t-caption" style={{ margin: 0 }}>
              {options.reason || 'No delivery times are open for this store right now.'}
            </p>
          ) : (
            <>
              {options.days.length > 1 && (
                <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginBottom: 'var(--gap-sm)' }}>
                  {options.days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setDayKey(d.key)}
                      className="press t-label"
                      aria-pressed={d.key === day?.key}
                      style={{
                        ['--press-scale' as string]: '0.96',
                        height: 36,
                        paddingInline: 'var(--gap-lg)',
                        borderRadius: 'var(--radius-pill)',
                        background: d.key === day?.key ? 'var(--color-ink)' : 'var(--color-surface)',
                        color: d.key === day?.key ? '#fff' : 'var(--color-ink-body)',
                        border: `1px solid ${d.key === day?.key ? 'var(--color-ink)' : 'var(--color-line)'}`,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              <div
                role="radiogroup"
                aria-label={`Delivery times, ${day?.label ?? ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                  gap: 'var(--gap-xs)',
                  maxHeight: 188,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}
              >
                {day?.slots.map((slot) => {
                  const active = slot.at === value
                  return (
                    <button
                      key={slot.at}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onChange(slot.at, `${day.label}, ${slot.label}`)}
                      className="press t-label-sm"
                      style={{
                        ['--press-scale' as string]: '0.95',
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: active ? 'var(--color-brand)' : 'var(--color-surface)',
                        color: active ? '#fff' : 'var(--color-ink-body)',
                        border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-line)'}`,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
              <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
                {value
                  ? `The kitchen starts about ${Math.round(options.releaseMinutes)} minutes before. You can cancel for a full refund until then.`
                  : 'Pick a time.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ModeTile({
  active,
  disabled = false,
  onClick,
  icon,
  title,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className="press t-label"
      style={{
        ['--press-scale' as string]: '0.98',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-sm)',
        minHeight: 48,
        padding: 'var(--gap-sm) var(--gap-md)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'left',
        background: active ? 'var(--color-brand-soft)' : 'var(--color-surface)',
        color: active ? 'var(--color-brand-ink)' : 'var(--color-ink-body)',
        border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-line)'}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {title}
    </button>
  )
}
