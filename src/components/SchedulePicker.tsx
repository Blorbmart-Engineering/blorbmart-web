/* ═══════════════════════════════════════════════════════════════════════
   "When?" on checkout: as soon as possible, or a time the customer picks.

   The slots come from the server (GET /api/orders/schedule-slots), already
   cut to the store's hours and the riders' delivery window in Lagos time,
   so nothing here does clock arithmetic. The chosen slot is checked again
   at payment; a slot that lapsed meanwhile comes back as a sentence.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarClock, Zap } from 'lucide-react'
import {
  isPreorderTime,
  preorderOptions,
  preorderTime,
  scheduleSlots,
  type DeliveryTime,
  type PreorderOptions,
  type ScheduleOptions,
} from '../data/orders'
import { apiErrorMessage } from '../lib/api'
import { Skeleton } from '../ui/kit'

/**
 * Pre-orders (added 2026-11-09). A store can take orders ahead for the days
 * it cooks (backend preorderService). With one such store in the basket the
 * second choice here is "Pre-order" and its days; a store that takes nothing
 * but pre-orders has no "as soon as possible" at all. Pre-order days can only
 * be shared by one store, so a basket mixing a pre-order-only store with
 * others is told to split.
 */
export function SchedulePicker(props: {
  storeIds: string[]
  value: DeliveryTime
  onChange: (value: DeliveryTime, label: string | null) => void
  onModeChange?: (mode: 'now' | 'later') => void
  disabledReason?: string | null
}) {
  const { storeIds, value, onChange, onModeChange, disabledReason } = props
  const storesKey = storeIds.join(',')
  // null while loading; one entry per store in the basket.
  const [windows, setWindows] = useState<PreorderOptions[] | null>(null)

  useEffect(() => {
    if (!storesKey) return
    let live = true
    setWindows(null)
    Promise.all(
      storesKey.split(',').map((id) =>
        preorderOptions(id).catch((): PreorderOptions => ({ enabled: false, allowAsap: true, days: [], statusMessage: null })),
      ),
    ).then((list) => live && setWindows(list))
    return () => {
      live = false
    }
  }, [storesKey])

  const single = windows?.length === 1 && windows[0].enabled ? windows[0] : null
  const preorderOnly = Boolean(windows?.some((w) => w.enabled && !w.allowAsap))

  if (!windows) return <Skeleton height={48} />

  if (single) {
    return (
      <PreorderPicker
        window={single}
        value={value}
        onChange={onChange}
        onModeChange={onModeChange}
        disabledReason={disabledReason}
      />
    )
  }

  return (
    <>
      <SlotPicker {...props} />
      {preorderOnly && (
        <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>
          A store in your basket only takes pre-orders. Order from it on its own to choose a day.
        </p>
      )}
    </>
  )
}

function PreorderPicker({
  window: w,
  value,
  onChange,
  onModeChange,
  disabledReason,
}: {
  window: PreorderOptions
  value: DeliveryTime
  onChange: (value: DeliveryTime, label: string | null) => void
  onModeChange?: (mode: 'now' | 'later') => void
  disabledReason?: string | null
}) {
  const asapAllowed = w.allowAsap
  const [chosen, setChosen] = useState<'now' | 'preorder'>(asapAllowed && !isPreorderTime(value) ? 'now' : 'preorder')
  const mode = disabledReason && asapAllowed ? 'now' : chosen

  const pick = (day: PreorderOptions['days'][number]) => onChange(preorderTime(day.scheduledFor), `Pre-order · ${day.label}`)

  // A pre-order-only store starts on pre-order, with its first day chosen.
  useEffect(() => {
    if (mode !== 'preorder') return
    onModeChange?.('later')
    if (!isPreorderTime(value) && w.days[0]) pick(w.days[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, w])

  const pickMode = (next: 'now' | 'preorder') => {
    setChosen(next)
    if (next === 'now') {
      onModeChange?.('now')
      onChange(null, null)
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="When" style={{ display: 'grid', gridTemplateColumns: asapAllowed ? '1fr 1fr' : '1fr', gap: 'var(--gap-sm)' }}>
        {asapAllowed && (
          <ModeTile active={mode === 'now'} onClick={() => pickMode('now')} icon={<Zap size={18} aria-hidden />} title="As soon as possible" />
        )}
        <ModeTile
          active={mode === 'preorder'}
          disabled={Boolean(disabledReason) && asapAllowed}
          onClick={() => pickMode('preorder')}
          icon={<CalendarCheck size={18} aria-hidden />}
          title="Pre-order"
        />
      </div>

      {disabledReason && asapAllowed && (
        <p className="t-caption" style={{ margin: '6px 0 0' }}>
          {disabledReason}
        </p>
      )}

      {mode === 'preorder' && (
        <div style={{ marginTop: 'var(--gap-md)' }}>
          {!w.days.length ? (
            <p className="t-caption" style={{ margin: 0 }}>
              {w.statusMessage || 'Pre-orders are closed for now.'} Check back soon.
            </p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Pre-order day" style={{ display: 'grid', gap: 'var(--gap-xs)' }}>
                {w.days.map((day) => {
                  const active = value === preorderTime(day.scheduledFor)
                  return (
                    <button
                      key={day.scheduledFor}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pick(day)}
                      className="press"
                      style={{
                        ['--press-scale' as string]: '0.98',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--gap-md)',
                        padding: 'var(--gap-md) var(--gap-lg)',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'left',
                        background: active ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                        border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-line)'}`,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="t-label" style={{ display: 'block', color: active ? 'var(--color-brand-ink)' : 'var(--color-ink)' }}>
                          {day.label}
                        </span>
                        <span className="t-caption" style={{ display: 'block' }}>
                          Order by {day.cutoffLabel}
                          {day.ordersRemaining != null && day.ordersRemaining <= 10 ? ` · ${day.ordersRemaining} left` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
                You pay now. The kitchen gets your order that morning, and it is delivered from the time shown.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SlotPicker({
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

  // A held time that is no longer offered (the basket changed store) is let go,
  // and so is a pre-order day held from a store no longer in the basket.
  useEffect(() => {
    if (isPreorderTime(value)) {
      onChange(null, null)
      return
    }
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
