/* ═══════════════════════════════════════════════════════════════════════
   Loading, done properly.

   The old indicator was a stroked icon turned by a CSS animation, and the
   app's reduced-motion rule clamps every animation to one 0.01ms run. Phones
   in battery saver report reduced motion, so on a great many Android phones
   the "spinner" was a frozen grey arc: nothing said the app was working.

   Two pieces replace it, drawn the same way in the Flutter app
   (lib/core/widgets/blorb_loader.dart):

     Spinner     a comet: a ring whose arc fades from nothing to a solid
                 head with a round cap. Sized for buttons and inline text,
                 coloured by `currentColor`, so it reads on any ground.
     PageLoader  the Blorbmart B breathing inside an orbiting comet, with a
                 line of status underneath that changes if the wait drags on
                 — "Almost there", then an honest word about the connection.

   Under reduced motion both keep turning, slower: a progress indicator is
   the one animation that carries information, and stopping it lies.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type CSSProperties } from 'react'
import { MARK_PATH, MARK_VIEWBOX } from './mark'

/* ── Spinner ───────────────────────────────────────────────────────────── */

export function Spinner({
  size = 20,
  thickness,
  color,
  label,
  style,
}: {
  size?: number
  /** Ring width. Defaults to about an eighth of the size. */
  thickness?: number
  /** Defaults to the surrounding text colour. */
  color?: string
  /** Announced to screen readers; omit where a parent already says it. */
  label?: string
  style?: CSSProperties
}) {
  const t = thickness ?? Math.max(2, Math.round(size / 8))
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="blorb-spinner"
      style={{
        ...style,
        ['--s' as string]: `${size}px`,
        ['--t' as string]: `${t}px`,
        color,
      }}
    >
      <span className="blorb-spinner-arc" />
    </span>
  )
}

/* ── Page loader ───────────────────────────────────────────────────────── */

/**
 * What the loader says as time passes. A wait that has run long gets told
 * the truth about itself, instead of the same word for thirty seconds.
 */
function useStatusLine(label: string) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    setStage(0)
    const a = window.setTimeout(() => setStage(1), 4000)
    const b = window.setTimeout(() => setStage(2), 11000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [label])
  return stage === 0 ? label : stage === 1 ? 'Almost there…' : 'Your connection is slow. Still working on it.'
}

export function PageLoader({
  label = 'Loading',
  fill = true,
  delay = 0,
}: {
  label?: string
  /** Take the screen's height, centred. Off for a loader inside a section. */
  fill?: boolean
  /**
   * Milliseconds before anything shows. A load that finishes inside it never
   * flashes a loader at all, which is what makes a fast screen feel instant.
   */
  delay?: number
}) {
  const line = useStatusLine(label)
  return (
    <div
      role="status"
      aria-live="polite"
      className="blorb-page-loader"
      style={{
        minHeight: fill ? '70dvh' : undefined,
        padding: fill ? 'var(--gap-page)' : 'var(--gap-xxxl) var(--gap-page)',
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="blorb-loader-stage" aria-hidden>
        <span className="blorb-loader-halo" />
        <span className="blorb-loader-orbit" />
        <span className="blorb-loader-core">
          <svg viewBox={MARK_VIEWBOX} width={26} height={27}>
            <path d={MARK_PATH} fill="currentColor" />
          </svg>
        </span>
      </div>
      <p key={line} className="t-label blorb-loader-line">
        {line}
      </p>
    </div>
  )
}

/**
 * The fallback while a screen's code downloads, once the app is running.
 *
 * The full blue splash used to stand in here too, so every first visit to a
 * tab flashed the whole screen blue and looked like the app restarting.
 * Inside the app, a loader on the page's own canvas — and only if the wait
 * outlasts a blink.
 */
export function RouteLoader() {
  return <PageLoader label="Opening" delay={180} />
}
