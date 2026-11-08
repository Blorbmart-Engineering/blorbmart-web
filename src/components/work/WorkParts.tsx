/* ═══════════════════════════════════════════════════════════════════════
   Pieces shared by the Blorbmart for Work screens: labelled fields, a
   naira input and the weekly schedule editor.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from 'react'
import { DAY_LABELS, scheduleSummary, type DayKey, type Schedule, type Template } from '../../data/work'
import '../marketplace/marketplace.css'

export function WField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginTop: 'var(--gap-lg)' }}>
      <span className="t-label" style={{ display: 'block', marginBottom: 'var(--gap-sm)' }}>{label}</span>
      {children}
      {hint && <span className="t-caption" style={{ display: 'block', marginTop: 6 }}>{hint}</span>}
    </label>
  )
}

export const inputClass = 'mkt-input'

export function NairaInput({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span className="t-label" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)' }}>₦</span>
      <input
        className={inputClass}
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
        style={{ paddingLeft: 34 }}
      />
    </div>
  )
}

export const sectionTitle: CSSProperties = { margin: 'var(--gap-xl) 0 var(--gap-sm)' }

/**
 * A template picker with a "custom" option that opens a per-day editor. One
 * meal window per day here; the backend accepts up to three, so a schedule
 * made elsewhere with more is shown as is and replaced only when edited.
 */
export function ScheduleEditor({
  templates,
  template,
  schedule,
  onChange,
}: {
  templates: Template[]
  template: string
  schedule: Schedule
  onChange: (template: string, schedule: Schedule) => void
}) {
  const custom = template === 'custom'
  const setDay = (day: DayKey, on: boolean, from = '11:00', to = '15:00') => {
    const next: Schedule = { ...schedule, [day]: on ? [{ from, to }] : [] }
    onChange('custom', next)
  }
  return (
    <div>
      <select
        className={inputClass}
        value={template}
        aria-label="Meal times"
        onChange={(e) => {
          const id = e.target.value
          const t = templates.find((x) => x.id === id)
          onChange(id, t ? t.schedule : schedule)
        }}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
        <option value="custom">Custom times…</option>
      </select>
      {!custom && <p className="t-caption" style={{ margin: '6px 0 0' }}>{scheduleSummary(schedule)}</p>}
      {custom && (
        <div style={{ marginTop: 'var(--gap-md)', display: 'grid', gap: 'var(--gap-sm)' }}>
          {DAY_LABELS.map(([day, label]) => {
            const w = schedule[day]?.[0]
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 74 }}>
                  <input type="checkbox" checked={Boolean(w)} onChange={(e) => setDay(day, e.target.checked)} />
                  <span className="t-label">{label}</span>
                </label>
                {w ? (
                  <>
                    <input className={inputClass} type="time" aria-label={`${label} from`} value={w.from} onChange={(e) => setDay(day, true, e.target.value, w.to)} style={{ flex: 1, minWidth: 0 }} />
                    <span className="t-caption">to</span>
                    <input className={inputClass} type="time" aria-label={`${label} to`} value={w.to} onChange={(e) => setDay(day, true, w.from, e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  </>
                ) : (
                  <span className="t-caption">Not covered</span>
                )}
              </div>
            )
          })}
          <p className="t-caption" style={{ margin: 0 }}>An end time before the start runs past midnight, for night shifts.</p>
        </div>
      )}
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ flex: '1 1 140px', padding: 'var(--gap-md) var(--gap-lg)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
      <div className="t-caption">{label}</div>
      <div className="t-h3" style={{ marginTop: 4, color: tone }}>{value}</div>
    </div>
  )
}

export function Banner({ tone = 'brand', children }: { tone?: 'brand' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const colors = {
    brand: ['var(--color-brand-soft)', 'var(--color-brand-ink)'],
    warning: ['var(--color-warning-soft)', '#9A5B00'],
    danger: ['var(--color-danger-soft)', 'var(--color-danger)'],
    success: ['var(--color-success-soft)', 'var(--color-success)'],
  }[tone]
  return (
    <div className="t-body-sm" role={tone === 'danger' ? 'alert' : undefined} style={{ marginTop: 'var(--gap-md)', padding: 'var(--gap-md) var(--gap-lg)', borderRadius: 'var(--radius-md)', background: colors[0], color: colors[1], fontWeight: 600 }}>
      {children}
    </div>
  )
}
