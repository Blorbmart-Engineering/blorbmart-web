/* ═══════════════════════════════════════════════════════════════════════
   The receipt, printed.

   A point-of-sale terminal's head sits at the top of the screen and the
   paper feeds out of its slot: in short jolts, the way a thermal printer's
   stepper motor pushes it, with the status light blinking and a faint buzz
   per line. Once it is out it drops a hair and settles, as paper does when
   the last line clears the roller.

   The paper is the same .rcpt document it always was; this only decides how
   it arrives. Reprint runs it again. Anyone who asked their device for less
   motion gets the receipt at once, with no sound.

   Mirrored in the Flutter app by lib/features/receipts/receipt_printer.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MARK_PATH, MARK_VIEWBOX } from '../ui/mark'

type Phase = 'idle' | 'printing' | 'done'

/** How long a feed takes, whatever the receipt's length. */
const MIN_MS = 1500
const MAX_MS = 2600
/** One motor step: a line of paper, then a pause. */
const STEP_MS = 48

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/* ── The sound ─────────────────────────────────────────────────────────────
   Synthesised, so there is no file to download: each step is a 30ms burst of
   band-passed noise with a fast buzz on it, which is close enough to a
   thermal head that the ear fills in the rest. Quiet on purpose. Browsers
   only allow it after a tap, and opening a receipt always follows one. */

let audio: AudioContext | null = null
let noise: AudioBuffer | null = null

function printerSound(): ((at: number) => void) | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
    const ctx = audio
    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        // White noise under a 180Hz buzz: the head firing.
        data[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sign(Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 180)))
      }
    }
    const buffer = noise
    return (at: number) => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 2600 + Math.random() * 500
      band.Q.value = 0.9
      const gain = ctx.createGain()
      const t = ctx.currentTime + at
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.045, t + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.032)
      source.connect(band).connect(gain).connect(ctx.destination)
      source.start(t)
      source.stop(t + 0.04)
    }
  } catch {
    return null
  }
}

export function ReceiptPrinter({
  children,
  run,
  onPrinted,
  sound = true,
}: {
  children: ReactNode
  /** Changing this prints the receipt again. */
  run: number
  onPrinted?: () => void
  sound?: boolean
}) {
  const paper = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [fed, setFed] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const done = useRef(onPrinted)
  done.current = onPrinted

  // The paper's full length, kept current as the QR code and fonts land.
  useLayoutEffect(() => {
    const el = paper.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!height) return
    if (prefersReducedMotion()) {
      setFed(1)
      setPhase('done')
      done.current?.()
      return
    }

    setPhase('printing')
    setFed(0)
    const total = Math.min(MAX_MS, Math.max(MIN_MS, height * 2.4))
    const steps = Math.max(12, Math.round(total / STEP_MS))
    const click = sound ? printerSound() : null
    try {
      navigator.vibrate?.([12, 40, 12, 40, 12])
    } catch {
      /* no vibration motor, or not allowed yet */
    }

    let step = 0
    let timer = 0
    const tick = () => {
      step += 1
      // Each step feeds one line, a touch faster in the middle of the job
      // than at the start and end, like a motor spinning up and down.
      const t = step / steps
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      setFed(Math.min(1, 0.15 * t + 0.85 * eased))
      click?.(0)
      if (step < steps) {
        timer = window.setTimeout(tick, STEP_MS)
      } else {
        setFed(1)
        setPhase('done')
        done.current?.()
      }
    }
    // A beat of the light blinking before the first line, as a real
    // terminal hesitates between "approved" and the paper.
    timer = window.setTimeout(tick, 380)
    return () => window.clearTimeout(timer)
    // `height` is read once per run: a receipt that grows mid-print (the QR
    // arriving) keeps feeding to its new length because `fed` is a fraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, height > 0, sound])

  const offset = Math.round((1 - fed) * height)

  return (
    <div className={`pos pos--${phase}`}>
      <div className="pos-head" aria-hidden>
        <span className="pos-brand">
          <svg viewBox={MARK_VIEWBOX} width={13} height={14}>
            <path d={MARK_PATH} fill="currentColor" />
          </svg>
          blorbmart pay
        </span>
        <span className="pos-status">
          {phase === 'printing' ? 'Printing' : phase === 'done' ? 'Approved' : 'Ready'}
          <span className="pos-led" />
        </span>
        <span className="pos-slot" />
      </div>

      <div className="pos-feed" style={{ height: height || undefined }}>
        <div
          ref={paper}
          className="pos-paper"
          style={{ transform: `translate3d(0, ${-offset}px, 0)` }}
        >
          {children}
        </div>
      </div>

      <p className="sr-only" role="status">
        {phase === 'done' ? 'Receipt printed.' : 'Printing your receipt.'}
      </p>
    </div>
  )
}
