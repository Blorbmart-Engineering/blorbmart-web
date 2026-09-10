/* ═══════════════════════════════════════════════════════════════════════
   Screen chrome — the web equivalent of Scaffold + AppBar.

   Every pushed screen in the Flutter app has a back button, a title, and a
   body that scrolls under a fixed bar. This is that, plus the safe-area
   padding an installed PWA needs on a notched phone.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from './Button'
import toast, { type Renderable } from 'react-hot-toast'
import { CircleCheckBig, CircleAlert, Info } from 'lucide-react'

/** Fixed top bar. Transparent over a hero, solid once content scrolls under. */
export function AppBar({
  title,
  subtitle,
  onBack,
  trailing,
  transparent = false,
  onImage = false,
  showBack = true,
}: {
  title?: string
  subtitle?: string
  /** Defaults to browser-back, which is what the Flutter back arrow does. */
  onBack?: () => void
  trailing?: ReactNode
  transparent?: boolean
  onImage?: boolean
  /**
   * Tab screens have no back arrow, because there is nothing behind them —
   * the bottom nav is how you leave. Matches a Flutter AppBar on a tab, which
   * only grows a leading button when the route was pushed.
   */
  showBack?: boolean
}) {
  const navigate = useNavigate()
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        padding: 'calc(var(--safe-top) + var(--gap-md)) var(--gap-lg) var(--gap-md)',
        background: transparent ? 'transparent' : 'var(--color-surface)',
        borderBottom: transparent ? 'none' : '1px solid var(--color-line)',
      }}
    >
      {showBack && (
        <IconButton
          label="Go back"
          onImage={onImage}
          onClick={onBack ?? (() => navigate(-1))}
        >
          <ArrowLeft size={20} aria-hidden />
        </IconButton>
      )}
      {title && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="t-h3 clamp-1" style={{ margin: 0 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="t-caption clamp-1" style={{ margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {!title && <div style={{ flex: 1 }} />}
      {trailing}
    </header>
  )
}

/**
 * The scrolling body of a screen.
 *
 * `bottomGap` clears whatever floats above it — the nav bar and cart bar on a
 * tab screen, a single sticky CTA on a pushed one.
 */
export function ScreenBody({
  children,
  bottomGap = 'var(--gap-xxxl)',
  padded = false,
  style,
}: {
  children: ReactNode
  bottomGap?: string
  padded?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        ...style,
        paddingInline: padded ? 'var(--gap-page)' : undefined,
        paddingBottom: `calc(${bottomGap} + var(--safe-bottom))`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * A sticky footer for the single action a screen exists to complete —
 * "Place order", "Pay ₦4,200". Mirrors the bottomNavigationBar CTA the
 * Flutter screens use.
 */
export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 15,
        padding: 'var(--gap-md) var(--gap-page) calc(var(--gap-md) + var(--safe-bottom))',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-line)',
        boxShadow: 'var(--shadow-lift)',
      }}
    >
      {children}
    </div>
  )
}

/* ── Toasts ────────────────────────────────────────────────────────────── */

export type ToastTone = 'neutral' | 'success' | 'danger' | 'brand'

const TONES: Record<ToastTone, { bg: string; icon: Renderable }> = {
  success: { bg: 'var(--color-success)', icon: <CircleCheckBig size={20} /> },
  danger: { bg: 'var(--color-danger)', icon: <CircleAlert size={20} /> },
  brand: { bg: 'var(--color-brand)', icon: <Info size={20} /> },
  neutral: { bg: 'var(--color-ink)', icon: <Info size={20} /> },
}

/**
 * A floating toast that reads as part of the design system rather than a
 * stock notification. Mirrors showBlorbToast.
 */
export function showToast(message: string, tone: ToastTone = 'neutral') {
  const { bg, icon } = TONES[tone]
  toast(message, {
    icon,
    style: {
      background: bg,
      color: '#fff',
      fontWeight: 700,
      fontSize: 13.5,
      lineHeight: 1.35,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      maxWidth: '90vw',
      boxShadow: 'var(--shadow-lg)',
    },
  })
}
