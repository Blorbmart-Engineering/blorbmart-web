/* ═══════════════════════════════════════════════════════════════════════
   Small, reusable surface pieces — a port of lib/core/widgets/blorb_ui.dart.

   Every screen is assembled from these, so spacing and radii stay identical
   everywhere without anyone thinking about it.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { Button } from './Button'
import { FadeSlideIn, PressScale } from './motion'

/* ── Card ──────────────────────────────────────────────────────────────── */

interface CardProps {
  children: ReactNode
  padding?: string
  onClick?: () => void
  radius?: string
  color?: string
  border?: string
  shadow?: string
  clip?: boolean
  className?: string
  style?: CSSProperties
}

/** The standard white card. */
export function Card({
  children,
  padding = 'var(--gap-lg)',
  onClick,
  radius = 'var(--radius-lg)',
  color = 'var(--color-surface)',
  border,
  shadow = 'var(--shadow-sm)',
  clip = false,
  className = '',
  style,
}: CardProps) {
  const css: CSSProperties = {
    ...style,
    padding,
    background: color,
    borderRadius: radius,
    border: border ? `1px solid ${border}` : undefined,
    boxShadow: shadow,
    overflow: clip ? 'hidden' : undefined,
    textAlign: 'left',
    width: '100%',
    display: 'block',
  }

  if (!onClick) {
    return (
      <div className={className} style={css}>
        {children}
      </div>
    )
  }
  return (
    <PressScale scale={0.985} onClick={onClick} className={className} style={css}>
      {children}
    </PressScale>
  )
}

/* ── Section header ────────────────────────────────────────────────────── */

interface SectionHeaderProps {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  leading?: ReactNode
  padding?: string
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  leading,
  padding = 'var(--gap-xxl) var(--gap-page) var(--gap-md)',
}: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', padding }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 className="t-h2">{title}</h2>
        {subtitle && (
          <p className="t-body-sm" style={{ margin: '2px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <PressScale
          scale={0.94}
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: 'var(--gap-xs) var(--gap-sm)',
            color: 'var(--color-brand)',
            flexShrink: 0,
          }}
        >
          <span className="t-label" style={{ color: 'var(--color-brand)' }}>
            {actionLabel}
          </span>
          <ChevronRight size={18} aria-hidden />
        </PressScale>
      )}
    </div>
  )
}

/* ── Pill ──────────────────────────────────────────────────────────────── */

export type PillTone =
  | 'neutral'
  | 'brand'
  | 'appetite'
  | 'success'
  | 'warning'
  | 'danger'
  | 'amber'

const PILL_COLORS: Record<PillTone, [string, string]> = {
  neutral: ['var(--color-surface-sunken)', 'var(--color-ink-body)'],
  brand: ['var(--color-brand-soft)', 'var(--color-brand-ink)'],
  appetite: ['var(--color-appetite-soft)', 'var(--color-appetite-deep)'],
  success: ['var(--color-success-soft)', 'var(--color-success)'],
  warning: ['var(--color-warning-soft)', '#9A5B00'],
  danger: ['var(--color-danger-soft)', 'var(--color-danger)'],
  amber: ['var(--color-amber-soft)', '#8A5D00'],
}

/**
 * A small status/metadata pill. Seven semantic tones cover every use in the
 * app, which keeps colour meaning consistent.
 */
export function Pill({
  label,
  icon,
  tone = 'neutral',
  dense = false,
  solid = false,
  style,
}: {
  label: string
  icon?: ReactNode
  tone?: PillTone
  dense?: boolean
  solid?: boolean
  style?: CSSProperties
}) {
  const [bg, fg] = PILL_COLORS[tone]
  return (
    <span
      className={dense ? 't-caption-sm' : 't-label-sm'}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: dense ? '3px 7px' : '5px 10px',
        borderRadius: 'var(--radius-sm)',
        background: solid ? fg : bg,
        color: solid ? '#fff' : fg,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  )
}

/* ── Chip rail ─────────────────────────────────────────────────────────── */

/** Horizontally scrolling filter chips with a sliding selection. */
export function ChipRail({
  options,
  selected,
  onSelect,
  icons,
}: {
  options: string[]
  selected: string
  onSelect: (value: string) => void
  icons?: Record<string, ReactNode>
}) {
  return (
    <div className="rail" style={{ gap: 'var(--gap-sm)', paddingBlock: 2 }}>
      {options.map((option) => {
        const active = option === selected
        return (
          <PressScale
            key={option}
            scale={0.94}
            onClick={() => onSelect(option)}
            className="t-label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--gap-xs)',
              height: 40,
              paddingInline: 'var(--gap-lg)',
              borderRadius: 'var(--radius-pill)',
              background: active ? 'var(--color-ink)' : 'var(--color-surface)',
              color: active ? '#fff' : 'var(--color-ink-body)',
              border: `1px solid ${active ? 'var(--color-ink)' : 'var(--color-line)'}`,
              boxShadow: active ? 'var(--shadow-sm)' : undefined,
              transition: 'background var(--dur-fast) var(--ease-emphasized), color var(--dur-fast) var(--ease-emphasized)',
            }}
          >
            {icons?.[option]}
            {option}
          </PressScale>
        )
      })}
    </div>
  )
}

/* ── Empty / error state ───────────────────────────────────────────────── */

/** Always offers a way forward — never a dead end. */
export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  tone = 'var(--color-brand)',
  compact = false,
}: {
  title: string
  message: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  tone?: string
  compact?: boolean
}) {
  const dimension = compact ? 64 : 84
  return (
    <FadeSlideIn>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: `${compact ? 'var(--gap-xxl)' : 'var(--gap-giant)'} var(--gap-xxxl)`,
        }}
      >
        <div
          style={{
            width: dimension,
            height: dimension,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            // A 10%-alpha wash of the tone, without needing a second token.
            background: `color-mix(in srgb, ${tone} 10%, transparent)`,
            color: tone,
          }}
        >
          {icon ?? <Search size={compact ? 28 : 36} aria-hidden />}
        </div>
        <h3 className={compact ? 't-h3' : 't-h2'} style={{ margin: 'var(--gap-xl) 0 0' }}>
          {title}
        </h3>
        <p className="t-body" style={{ margin: 'var(--gap-sm) 0 0', maxWidth: 320 }}>
          {message}
        </p>
        {actionLabel && onAction && (
          <div style={{ marginTop: 'var(--gap-xxl)' }}>
            <Button label={actionLabel} onClick={onAction} size="md" expand={false} />
          </div>
        )}
      </div>
    </FadeSlideIn>
  )
}

/* ── Summary row ───────────────────────────────────────────────────────── */

/** A labelled key/value, used in receipts and order summaries. */
export function SummaryRow({
  label,
  value,
  emphasise = false,
  valueColor,
  hint,
}: {
  label: string
  value: ReactNode
  emphasise?: boolean
  valueColor?: string
  hint?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--gap-lg)',
        padding: '7px 0',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={emphasise ? 't-h4' : 't-body'}
          style={emphasise ? undefined : { color: 'var(--color-ink-muted)' }}
        >
          {label}
        </div>
        {hint && (
          <div className="t-caption-sm" style={{ marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <div
        className={emphasise ? 't-price' : 't-price-sm'}
        style={{
          fontSize: emphasise ? 17 : undefined,
          color: valueColor ?? (emphasise ? undefined : 'var(--color-ink-strong)'),
          fontWeight: emphasise ? 800 : 700,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  )
}

/* ── Dividers ──────────────────────────────────────────────────────────── */

/**
 * Dashed horizontal rule — between an order summary and its total, and on the
 * receipt. A repeating gradient, so it is one element rather than a row of
 * them.
 */
export function DashedDivider({
  color = 'var(--color-line-strong)',
  dash = 4,
  gap = 4,
  thickness = 1,
}: {
  color?: string
  dash?: number
  gap?: number
  thickness?: number
}) {
  return (
    <div
      aria-hidden
      style={{
        height: thickness,
        width: '100%',
        backgroundImage: `repeating-linear-gradient(to right, ${color} 0 ${dash}px, transparent ${dash}px ${dash + gap}px)`,
      }}
    />
  )
}

export function Divider({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{ height: 1, width: '100%', background: 'var(--color-line)', ...style }}
    />
  )
}

/* ── Skeletons ─────────────────────────────────────────────────────────── */

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 'var(--radius-sm)',
  style,
}: {
  width?: number | string
  height?: number | string
  radius?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden
      className="blorb-skeleton"
      style={{ ...style, width, height, borderRadius: radius }}
    />
  )
}

/* ── Rails ─────────────────────────────────────────────────────────────── */

/** A horizontally scrolling row of cards. */
export function Rail({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="rail" style={style}>
      {children}
    </div>
  )
}

/* ── Sheet handle ──────────────────────────────────────────────────────── */

export function SheetHandle() {
  return (
    <div
      aria-hidden
      style={{
        width: 40,
        height: 4,
        margin: 'var(--gap-md) auto',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-line-strong)',
        flexShrink: 0,
      }}
    />
  )
}

/* ── Stepper ───────────────────────────────────────────────────────────── */

/** The quantity control on a menu row and in the basket. */
export function Stepper({
  quantity,
  onIncrement,
  onDecrement,
  min = 0,
  max = 99,
  compact = false,
  label = 'quantity',
}: {
  quantity: number
  onIncrement: () => void
  onDecrement: () => void
  min?: number
  max?: number
  compact?: boolean
  label?: string
}) {
  const height = compact ? 32 : 38
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-brand-soft)',
        padding: 3,
        gap: 2,
      }}
    >
      <StepperButton
        label={`Decrease ${label}`}
        onClick={onDecrement}
        disabled={quantity <= min}
        size={height - 6}
      >
        &minus;
      </StepperButton>
      <span
        className="t-label"
        style={{
          minWidth: 22,
          textAlign: 'center',
          color: 'var(--color-brand-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {quantity}
      </span>
      <StepperButton
        label={`Increase ${label}`}
        onClick={onIncrement}
        disabled={quantity >= max}
        size={height - 6}
      >
        +
      </StepperButton>
    </div>
  )
}

function StepperButton({
  children,
  onClick,
  disabled,
  label,
  size,
}: {
  children: ReactNode
  onClick: () => void
  disabled: boolean
  label: string
  size: number
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      className="press"
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: 'var(--color-surface)',
        color: disabled ? 'var(--color-ink-disabled)' : 'var(--color-brand)',
        fontWeight: 800,
        fontSize: 16,
        lineHeight: 1,
        opacity: disabled ? 0.6 : 1,
        ['--press-scale' as string]: '0.88',
      }}
    >
      {children}
    </button>
  )
}
