/* ═══════════════════════════════════════════════════════════════════════
   Shared auth furniture — a port of lib/features/auth/auth_widgets.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Eye, EyeOff, GraduationCap, Search } from 'lucide-react'
import {
  universityOptions,
  universityLabel,
  type University,
} from '../data/university'
import { PressScale } from '../ui/motion'
import { Sheet } from '../ui/Sheet'
import { Skeleton } from '../ui/kit'

/* ── Text field ────────────────────────────────────────────────────────── */

export function AuthField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  type = 'text',
  inputMode,
  autoComplete,
  disabled = false,
  leading,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string
  type?: string
  inputMode?: 'text' | 'tel' | 'numeric' | 'email' | 'decimal'
  autoComplete?: string
  disabled?: boolean
  leading?: ReactNode
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type

  return (
    <div style={{ marginBottom: 'var(--gap-lg)' }}>
      <label htmlFor={id} className="t-label-sm" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 'var(--size-input)',
          paddingInline: 'var(--gap-lg)',
          gap: 'var(--gap-sm)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-line-strong)'}`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {leading}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={inputType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            style={{ display: 'grid', placeItems: 'center', color: 'var(--color-ink-faint)' }}
          >
            {revealed ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p
          className="t-caption"
          style={{
            margin: '6px 0 0',
            color: error ? 'var(--color-danger)' : 'var(--color-ink-muted)',
          }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

/* ── Campus picker ─────────────────────────────────────────────────────── */

/**
 * The school this account shops on.
 *
 * `includeBillsOnly` offers "my school is not listed" — a real answer at
 * signup, and never offered anywhere the account has to belong somewhere.
 *
 * The list is never hard-coded as a fallback: a stale bundled campus would be
 * written to the profile and then silently filter the buyer against a tag no
 * store carries.
 */
export function CampusPicker({
  value,
  onChange,
  label = 'School',
  includeBillsOnly = true,
  disabled = false,
  error,
}: {
  value: University | null
  onChange: (campus: University) => void
  label?: string
  includeBillsOnly?: boolean
  disabled?: boolean
  error?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div style={{ marginBottom: 'var(--gap-lg)' }}>
        <span className="t-label-sm" style={{ display: 'block', marginBottom: 6 }}>
          {label}
        </span>
        <PressScale
          scale={0.99}
          disabled={disabled}
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            width: '100%',
            height: 'var(--size-input)',
            paddingInline: 'var(--gap-lg)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-line-strong)'}`,
            textAlign: 'left',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <GraduationCap
            size={19}
            aria-hidden
            style={{ color: 'var(--color-ink-faint)', flexShrink: 0 }}
          />
          <span
            className="t-body clamp-1"
            style={{
              flex: 1,
              minWidth: 0,
              color: value ? 'var(--color-ink)' : 'var(--color-ink-faint)',
            }}
          >
            {value ? universityLabel(value) : 'Choose your school'}
          </span>
          <ChevronDown size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
        </PressScale>
        {error && (
          <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </div>

      <CampusSheet
        open={open}
        onClose={() => setOpen(false)}
        selectedId={value?.id ?? null}
        includeBillsOnly={includeBillsOnly}
        onSelect={(campus) => {
          onChange(campus)
          setOpen(false)
        }}
      />
    </>
  )
}

export function CampusSheet({
  open,
  onClose,
  onSelect,
  selectedId,
  includeBillsOnly = true,
  title = 'Your school',
}: {
  open: boolean
  onClose: () => void
  onSelect: (campus: University) => void
  selectedId: string | null
  includeBillsOnly?: boolean
  title?: string
}) {
  const [all, setAll] = useState<University[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    universityOptions()
      .then((list) => {
        if (!cancelled) setAll(list)
      })
      .catch(() => {
        if (!cancelled) setError('We could not load the school list. Try again.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const options = (all ?? [])
    .filter((u) => includeBillsOnly || !u.billsOnly)
    .filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.shortName.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q),
    )

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          height: 46,
          paddingInline: 'var(--gap-md)',
          marginBottom: 'var(--gap-md)',
          background: 'var(--color-surface-sunken)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Search size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools"
          aria-label="Search schools"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
          }}
        />
      </div>

      {error ? (
        <p className="t-body" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      ) : all == null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={52} radius="var(--radius-md)" />
          ))}
        </div>
      ) : options.length === 0 ? (
        <p className="t-body">No school matches that. Try a different spelling.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
          {options.map((campus) => {
            const selected = campus.id === selectedId
            return (
              <PressScale
                key={campus.id}
                scale={0.99}
                onClick={() => onSelect(campus)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  width: '100%',
                  padding: 'var(--gap-md)',
                  borderRadius: 'var(--radius-md)',
                  background: selected ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                  border: `1px solid ${selected ? 'var(--color-brand)' : 'var(--color-line)'}`,
                  textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                    {universityLabel(campus)}
                  </span>
                  {(campus.city || campus.description) && (
                    <span className="t-caption clamp-1" style={{ display: 'block' }}>
                      {campus.billsOnly
                        ? campus.description || 'Bill payments only, for now'
                        : [campus.city, campus.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check size={18} aria-hidden style={{ color: 'var(--color-brand)' }} />
                )}
              </PressScale>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

/* ── Terms checkbox ────────────────────────────────────────────────────── */

export function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--gap-md)',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <span
        aria-hidden
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 22,
          height: 22,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: 'var(--radius-xs)',
          background: checked ? 'var(--color-brand)' : 'var(--color-surface)',
          border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
          color: '#fff',
          transition: 'background var(--dur-fast) var(--ease-emphasized)',
        }}
      >
        {checked && <Check size={15} strokeWidth={3} />}
      </span>
      <span className="t-body-sm">
        I agree to Blorbmart&apos;s Terms of Service and Privacy Policy.
      </span>
    </label>
  )
}

/* ── Error banner ──────────────────────────────────────────────────────── */

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="t-body-sm blorb-fade-slide-in"
      style={{
        padding: 'var(--gap-md) var(--gap-lg)',
        marginBottom: 'var(--gap-lg)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-danger-soft)',
        color: 'var(--color-danger)',
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  )
}
