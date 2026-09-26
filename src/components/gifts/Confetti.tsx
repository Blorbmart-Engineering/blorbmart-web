/* ═══════════════════════════════════════════════════════════════════════
   A burst of confetti, for the two moments that deserve one: a gift card
   bought, and a gift card unwrapped.

   One canvas, a few hundred lines of nothing — no library for something
   that runs for three seconds. Skipped entirely for anyone who has asked
   their device for less motion.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react'

const COLOURS = ['#FF4FB8', '#22D3EE', '#FFC94A', '#8B6CFF', '#FF7A59', '#34D399', '#FFFFFF', '#E2B550']

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  colour: string
  round: boolean
  wobble: number
}

/**
 * Fires once per distinct `burst` value. Pass a counter or a timestamp;
 * zero or undefined fires nothing.
 */
export function Confetti({ burst, origin = { x: 0.5, y: 0.35 } }: { burst?: number; origin?: { x: number; y: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!burst || !canvas.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const el = canvas.current
    const ctx = el.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
    }
    resize()

    const pieces: Piece[] = []
    const ox = window.innerWidth * origin.x
    const oy = window.innerHeight * origin.y
    for (let i = 0; i < 170; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
      const speed = 7 + Math.random() * 10
      pieces.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 6 + Math.random() * 7,
        spin: (Math.random() - 0.5) * 0.4,
        angle: Math.random() * Math.PI,
        colour: COLOURS[i % COLOURS.length],
        round: Math.random() < 0.3,
        wobble: Math.random() * 10,
      })
    }

    let frame = 0
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      const fade = Math.max(0, 1 - Math.max(0, t - 2000) / 900)
      for (const p of pieces) {
        p.vy += 0.32
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx + Math.sin((frame + p.wobble) / 9) * 0.8
        p.y += p.vy
        p.angle += p.spin
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.colour
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.angle * 2)) + 1)
        }
        ctx.restore()
      }
      frame += 1
      if (t < 2900) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [burst, origin.x, origin.y])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 300 }}
    />
  )
}
