/* ═══════════════════════════════════════════════════════════════════════
   Motion primitives — a port of lib/core/widgets/blorb_motion.dart.

   The rule: things that enter use `emphasized` (fast out, slow settle);
   things that respond to a finger use `snappy`; things that leave are always
   quicker than things that arrive.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

/** Stagger delay between siblings in a list entrance, capped so a long list
    does not end with items arriving a second late. */
export function staggerFor(index: number, cap = 8): number {
  return 55 * Math.min(index, cap)
}

interface FadeSlideInProps {
  children: ReactNode
  /** Milliseconds. */
  delay?: number
  duration?: number
  /** Pixels the child travels on the way in. */
  offsetY?: number
  offsetX?: number
  className?: string
  style?: CSSProperties
}

export function FadeSlideIn({
  children,
  delay = 0,
  duration = 420,
  offsetY = 14,
  offsetX = 0,
  className = '',
  style,
}: FadeSlideInProps) {
  return (
    <div
      className={`blorb-fade-slide-in ${className}`}
      style={{
        ...style,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        ['--fs-y' as string]: `${offsetY}px`,
        ['--fs-x' as string]: `${offsetX}px`,
      }}
    >
      {children}
    </div>
  )
}

interface PressScaleProps {
  children: ReactNode
  onClick?: () => void
  /** How far it shrinks under a finger. 1 = no scale. */
  scale?: number
  disabled?: boolean
  className?: string
  style?: CSSProperties
  as?: 'button' | 'div'
  ariaLabel?: string
  type?: 'button' | 'submit'
}

/**
 * Near-instant response on the way down, gentle release on the way back.
 *
 * Rendered as a real `<button>` by default so it is focusable and reachable
 * by keyboard — the Flutter original gets that from the framework, and a
 * `<div onClick>` would silently lose it on the web.
 */
export function PressScale({
  children,
  onClick,
  scale = 0.972,
  disabled = false,
  className = '',
  style,
  as = 'button',
  ariaLabel,
  type = 'button',
}: PressScaleProps) {
  const props = {
    className: `press ${className}`,
    style: { ...style, ['--press-scale' as string]: String(scale) },
    onClick: disabled ? undefined : onClick,
    'aria-disabled': disabled || undefined,
    'aria-label': ariaLabel,
  }

  if (as === 'div') {
    return <div {...props}>{children}</div>
  }
  return (
    <button {...props} type={type} disabled={disabled}>
      {children}
    </button>
  )
}

/**
 * Counts a number up to its new value rather than snapping.
 *
 * Used on the basket total and the wallet balance: a figure that animates is
 * read as "this just changed", which is exactly what somebody adding an item
 * needs to notice.
 */
export function useAnimatedNumber(value: number, duration = 420): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic — matches Motion.gentle.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      fromRef.current = value
    }
  }, [value, duration])

  return display
}

/** Cross-fades between two children when `swapKey` changes. */
export function SwapIn({
  swapKey,
  children,
  className = '',
}: {
  swapKey: string | number | boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      key={String(swapKey)}
      className={className}
      style={{ animation: 'blorb-fade-in var(--dur-fast) var(--ease-emphasized) both' }}
    >
      {children}
    </span>
  )
}

/** The pulsing halo on an in-flight order. */
export function LivePulse({ color = 'var(--color-success)', size = 8 }: {
  color?: string
  size?: number
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          animation: 'blorb-pulse-ring var(--dur-ambient) var(--ease-emphasized) infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
        }}
      />
    </span>
  )
}

/** A slow highlight sweep. Used on the PIN card so it reads as the live thing. */
export function Sheen({ children }: { children: ReactNode }) {
  return (
    <span style={{ position: 'relative', display: 'block', overflow: 'hidden' }}>
      {children}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
          animation: 'blorb-sheen 2.4s var(--ease-gentle) infinite',
          pointerEvents: 'none',
        }}
      />
    </span>
  )
}
