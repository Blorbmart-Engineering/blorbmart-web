/* ═══════════════════════════════════════════════════════════════════════
   The one button in the app — a port of lib/core/widgets/blorb_button.dart.

   Handles press-scale, a busy state that keeps its own width (so the layout
   never jumps), and a disabled state that stays legible.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

export type ButtonKind = 'brand' | 'appetite' | 'soft' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface Palette {
  background: string
  color: string
  border?: string
  shadow?: string
}

function paletteFor(kind: ButtonKind, glow: boolean): Palette {
  switch (kind) {
    case 'brand':
      return {
        background: 'var(--gradient-brand)',
        color: '#fff',
        shadow: glow ? 'var(--shadow-brand)' : undefined,
      }
    case 'appetite':
      return {
        background: 'var(--gradient-appetite)',
        color: '#fff',
        shadow: glow ? 'var(--shadow-appetite)' : undefined,
      }
    case 'soft':
      return { background: 'var(--color-brand-soft)', color: 'var(--color-brand-ink)' }
    case 'outline':
      return {
        background: '#fff',
        color: 'var(--color-ink)',
        border: '1.3px solid var(--color-line-strong)',
      }
    case 'ghost':
      return { background: 'transparent', color: 'var(--color-brand)' }
    case 'danger':
      return { background: 'var(--color-danger)', color: '#fff' }
  }
}

const HEIGHTS: Record<ButtonSize, string> = {
  sm: 'var(--size-button-sm)',
  md: 'var(--size-button-md)',
  lg: 'var(--size-button-lg)',
}

const TYPE_CLASS: Record<ButtonSize, string> = {
  sm: 't-label-sm',
  md: 't-label',
  lg: 't-label-lg',
}

interface ButtonProps {
  label: string
  onClick?: () => void
  kind?: ButtonKind
  size?: ButtonSize
  icon?: ReactNode
  trailing?: ReactNode
  busy?: boolean
  /** Full width. The default, because most CTAs in the app are. */
  expand?: boolean
  glow?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  style?: CSSProperties
}

export function Button({
  label,
  onClick,
  kind = 'brand',
  size = 'lg',
  icon,
  trailing,
  busy = false,
  expand = true,
  glow = false,
  disabled = false,
  type = 'button',
  className = '',
  style,
}: ButtonProps) {
  const enabled = !disabled && !busy
  const palette = paletteFor(kind, glow && enabled)

  return (
    <button
      type={type}
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-busy={busy || undefined}
      className={`press ${TYPE_CLASS[size]} ${className}`}
      style={{
        ...style,
        ['--press-scale' as string]: '0.972',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--gap-sm)',
        width: expand ? '100%' : undefined,
        height: HEIGHTS[size],
        paddingInline: size === 'sm' ? 'var(--gap-lg)' : 'var(--gap-xxl)',
        background: palette.background,
        color: palette.color,
        border: palette.border ?? 'none',
        borderRadius: size === 'sm' ? 'var(--radius-sm)' : 'var(--radius-md)',
        boxShadow: palette.shadow,
        opacity: enabled ? 1 : 0.55,
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'opacity var(--dur-fast) var(--ease-emphasized), transform var(--dur-instant) var(--ease-snappy)',
      }}
    >
      {busy ? (
        <LoaderCircle
          size={20}
          aria-hidden
          style={{ animation: 'blorb-spin 900ms linear infinite' }}
        />
      ) : (
        <>
          {icon}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'inherit',
            }}
          >
            {label}
          </span>
          {trailing}
        </>
      )}
    </button>
  )
}

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  label: string
  size?: number
  background?: string
  color?: string
  /**
   * Sitting on top of food photography, where a tinted ground would vanish —
   * flips to a frosted white.
   */
  onImage?: boolean
  badgeCount?: number
  className?: string
  style?: CSSProperties
}

/** Square icon button with a soft tinted ground. Used in app bars. */
export function IconButton({
  children,
  onClick,
  label,
  size = 42,
  background,
  color,
  onImage = false,
  badgeCount,
  className = '',
  style,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`press ${className}`}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        background:
          background ?? (onImage ? 'rgba(255,255,255,0.92)' : 'var(--color-surface-sunken)'),
        color: color ?? 'var(--color-ink-strong)',
        backdropFilter: onImage ? 'blur(8px)' : undefined,
        boxShadow: onImage ? 'var(--shadow-sm)' : undefined,
        ['--press-scale' as string]: '0.92',
      }}
    >
      {children}
      {badgeCount != null && badgeCount > 0 && (
        <span
          aria-hidden
          className="t-caption-sm"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            paddingInline: 5,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-appetite)',
            color: '#fff',
            fontWeight: 800,
            border: '2px solid var(--color-surface)',
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </button>
  )
}
