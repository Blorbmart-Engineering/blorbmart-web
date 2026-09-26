/* ═══════════════════════════════════════════════════════════════════════
   A gift card on screen.

   The artwork is the same SVG the backend turns into the downloadable PNG
   (lib/giftCardArt.js), drawn live so every keystroke in the composer shows
   up on the card at once. It is set as markup rather than built as React
   elements because it is one string from one template shared with Node;
   every piece of customer text in it has already been cleaned and escaped
   by that template.

   On top of the art: a tilt that follows the pointer and a sheen that
   follows the light — the card feels like an object you are holding. Both
   stand down for anyone who has asked for less motion.
   ═══════════════════════════════════════════════════════════════════════ */

import { useId, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
import GiftCardArt, { type GiftCardArtInput } from '../../lib/giftCardArt'
import './giftFonts.css'
import './gifts.css'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function paletteOf(design: GiftCardArtInput['design']) {
  const resolved = GiftCardArt.resolveDesign(design)
  return GiftCardArt.PALETTES[resolved.palette]
}

export function GiftCardView({
  input,
  tilt = false,
  float = false,
  glow = true,
  className = '',
  style,
}: {
  input: GiftCardArtInput
  /** Follow the pointer in 3D. For the one card a screen is about. */
  tilt?: boolean
  /** Drift gently on its own, for a hero. */
  float?: boolean
  glow?: boolean
  className?: string
  style?: CSSProperties
}) {
  const reactId = useId()
  const uid = `g${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  const key = JSON.stringify(input)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svg = useMemo(() => GiftCardArt.renderGiftCardSvg({ ...input, uid }), [key, uid])
  const palette = paletteOf(input.design)
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current || prefersReducedMotion()) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    ref.current.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`)
    ref.current.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`)
    ref.current.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    ref.current.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    ref.current.dataset.lit = 'true'
  }

  const onLeave = () => {
    if (!ref.current) return
    ref.current.style.setProperty('--rx', '0deg')
    ref.current.style.setProperty('--ry', '0deg')
    delete ref.current.dataset.lit
  }

  return (
    <div
      ref={ref}
      className={`gift-card ${tilt ? 'gift-card--tilt' : ''} ${float ? 'gift-card--float' : ''} ${className}`}
      style={{
        ...style,
        ['--glow' as string]: glow ? `${palette.bg[1]}` : 'transparent',
      }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerUp={onLeave}
    >
      <div className="gift-card__art" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="gift-card__shine" aria-hidden />
    </div>
  )
}

/**
 * The back of a card, gift-wrapped: the card's own colours, a foil ribbon
 * and a bow, and who it is for. What a recipient sees before they unwrap it.
 */
export function GiftCardBack({ input }: { input: GiftCardArtInput }) {
  const palette = paletteOf(input.design)
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const to = GiftCardArt.cleanText(input.to, GiftCardArt.LIMITS.name)
  const foil = palette.foil
  const g = (n: string) => `back${reactId}${n}`
  const name = to || 'you'
  const nameSize = Math.min(112, Math.floor(900 / Math.max(GiftCardArt.measure(name, 'serifItalic', 1), 0.01)))

  return (
    <div className="gift-card gift-card--back" style={{ ['--glow' as string]: palette.bg[1] }}>
      <svg viewBox="0 0 1600 1000" role="img" aria-label={to ? `A wrapped gift for ${to}` : 'A wrapped gift'}>
        <defs>
          <linearGradient id={g('bg')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette.bg[0]} />
            <stop offset="0.55" stopColor={palette.bg[1]} />
            <stop offset="1" stopColor={palette.bg[2]} />
          </linearGradient>
          <linearGradient id={g('foil')} x1="0" y1="0" x2="1" y2="1">
            {foil.map((c, i) => (
              <stop key={i} offset={i / (foil.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
          <pattern id={g('dots')} width="56" height="56" patternUnits="userSpaceOnUse">
            <circle cx="28" cy="28" r="3" fill={palette.ink} opacity="0.12" />
          </pattern>
          <clipPath id={g('clip')}>
            <rect width="1600" height="1000" rx="56" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${g('clip')})`}>
          <rect width="1600" height="1000" fill={`url(#${g('bg')})`} />
          <rect width="1600" height="1000" fill={`url(#${g('dots')})`} />
          <rect x="1040" y="0" width="120" height="1000" fill={`url(#${g('foil')})`} />
          <rect x="0" y="560" width="1600" height="110" fill={`url(#${g('foil')})`} />
          <rect x="1040" y="0" width="14" height="1000" fill="#000" opacity="0.12" />
          <rect x="0" y="656" width="1600" height="14" fill="#000" opacity="0.12" />
          <path d="M1100 615 C990 470 860 505 905 585 C940 645 1045 640 1100 615Z" fill={`url(#${g('foil')})`} />
          <path d="M1100 615 C1210 470 1340 505 1295 585 C1260 645 1155 640 1100 615Z" fill={`url(#${g('foil')})`} />
          <path d="M1088 622 L1010 790 L1046 776 L1060 818 L1116 632Z" fill={`url(#${g('foil')})`} />
          <path d="M1112 622 L1190 790 L1154 776 L1140 818 L1084 632Z" fill={`url(#${g('foil')})`} />
          <rect x="1070" y="585" width="60" height="62" rx="18" fill={`url(#${g('foil')})`} />
          <path d="M1100 615 C1030 545 960 540 950 580" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="4" />
          <path d="M1100 615 C1170 545 1240 540 1250 580" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="4" />
          <text x="96" y="300" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight={800} fontSize="26" letterSpacing="6" fill={palette.accent}>
            A GIFT FOR
          </text>
          <text x="92" y="420" fontFamily="Fraunces, Georgia, serif" fontStyle="italic" fontWeight={500} fontSize={nameSize} fill={`url(#${g('foil')})`}>
            {name}
          </text>
          <text x="96" y="900" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight={700} fontSize="26" fill={palette.ink} opacity="0.7">
            Blorbmart gift card · tap to unwrap
          </text>
        </g>
      </svg>
    </div>
  )
}
