/* ═══════════════════════════════════════════════════════════════════════
   The splash artwork.

   Lives apart from the splash screen's boot logic because it is also the
   Suspense fallback for every lazy route — keeping them in one file would
   pull the boot sequence into the entry bundle and defeat the code-splitting
   it exists to hide.
   ═══════════════════════════════════════════════════════════════════════ */

import { useLayoutEffect, useRef } from 'react'
import { MARK_PATH, MARK_VIEWBOX } from '../ui/mark'

/*
 * When the first splash of this page load appeared.
 *
 * Boot shows several splashes back to back — the Suspense fallback while the
 * boot screen downloads, the boot screen itself, the session gate — and each
 * is a fresh mount. Without a shared clock the pen would restart on every
 * one. With it, a later splash joins the drawing where it is, and a splash
 * that turns up long after boot is simply the finished mark.
 */
let drawStartedAt: number | null = null

/**
 * The mark, written in: the outline is traced, then the fill comes in behind
 * the pen. White, because the splash is brand blue — the blue artwork on
 * this ground was not there at all.
 */
function MarkDraw({ size }: { size: number }) {
  const path = useRef<SVGPathElement>(null)

  useLayoutEffect(() => {
    const now = performance.now()
    drawStartedAt ??= now
    path.current?.style.setProperty('--mark-t', `${drawStartedAt - now}ms`)
  }, [])

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={Math.round((size * 630) / 659)}
      height={size}
      role="img"
      aria-label="Blorbmart"
      style={{ overflow: 'visible', filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.18))' }}
    >
      <path
        ref={path}
        className="blorb-mark-draw"
        d={MARK_PATH}
        pathLength={1}
        fill="#fff"
        stroke="#fff"
        strokeWidth={14}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SplashVisual({ slow = false }: { slow?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--gap-xl)',
        background: 'var(--gradient-brand)',
        padding: 'var(--gap-page)',
      }}
    >
      <MarkDraw size={96} />
      <div
        className="t-h2"
        style={{
          color: '#fff',
          animation: 'blorb-fade-in var(--dur-slow) var(--ease-emphasized) 700ms both',
        }}
      >
        Blorbmart
      </div>

      <div
        aria-hidden
        style={{
          width: 120,
          height: 4,
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,255,255,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '40%',
            height: '100%',
            borderRadius: 'var(--radius-pill)',
            background: '#fff',
            animation: 'blorb-sheen 1.4s var(--ease-gentle) infinite',
          }}
        />
      </div>

      {slow && (
        <p
          className="t-caption"
          style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 260 }}
        >
          Waking up the kitchen. This takes a few seconds on a cold start.
        </p>
      )}
    </div>
  )
}

export default SplashVisual
