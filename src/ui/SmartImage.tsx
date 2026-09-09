/* ═══════════════════════════════════════════════════════════════════════
   Network image with a calm three-state life — a port of
   lib/core/widgets/blorb_image.dart: a tinted placeholder, a decoded image,
   and a fallback that says what was meant to be there.

   The host allowlist is the web-only addition. A vendor-supplied URL is
   untrusted input; rendering an arbitrary one lets a third party set a cookie
   and log the IP of every customer who scrolls past a menu.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { ALLOWED_IMAGE_HOSTS } from '../lib/config'

function isAllowed(url: string): boolean {
  if (!url) return false
  // Data URIs and same-origin paths are ours by construction.
  if (url.startsWith('/') || url.startsWith('data:')) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_IMAGE_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Cloudinary can resize and re-encode on delivery, so a 1600px menu photo
 * does not travel down a phone connection to be drawn at 92px. Anything else
 * is served as-is.
 */
function optimised(url: string, width?: number): string {
  if (!width) return url
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  if (/\/upload\/[a-z]_/.test(url)) return url // already transformed
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  const target = Math.round(width * dpr)
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_fill,w_${target}/`)
}

interface SmartImageProps {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  /** Intrinsic pixel width, used to pick a Cloudinary transform. */
  renderWidth?: number
  radius?: string
  className?: string
  style?: CSSProperties
  /** Shown when there is no usable URL. Defaults to a muted icon. */
  fallback?: ReactNode
  objectFit?: CSSProperties['objectFit']
  eager?: boolean
}

export function SmartImage({
  src,
  alt,
  width = '100%',
  height = '100%',
  renderWidth,
  radius = '0',
  className = '',
  style,
  fallback,
  objectFit = 'cover',
  eager = false,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const url = useMemo(() => {
    if (!isAllowed(src)) return ''
    return optimised(src, renderWidth)
  }, [src, renderWidth])

  const frame: CSSProperties = {
    ...style,
    position: 'relative',
    width,
    height,
    borderRadius: radius,
    overflow: 'hidden',
    background: 'var(--color-surface-sunken)',
    flexShrink: 0,
  }

  if (!url || failed) {
    return (
      <div className={className} style={frame}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--color-ink-faint)',
          }}
        >
          {fallback ?? <ImageOff size={20} aria-hidden />}
        </div>
      </div>
    )
  }

  return (
    <div className={className} style={frame}>
      {!loaded && (
        <div
          aria-hidden
          className="blorb-skeleton"
          style={{ position: 'absolute', inset: 0, borderRadius: 0 }}
        />
      )}
      <img
        src={url}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          opacity: loaded ? 1 : 0,
          transition: 'opacity var(--dur-normal) var(--ease-emphasized)',
        }}
      />
    </div>
  )
}

/**
 * A vendor logo, which is square, small, and falls back to the first letter
 * of the name rather than a generic icon — a lettered tile reads as "this
 * store has no logo yet", an image icon reads as "this is broken".
 */
export function VendorAvatar({
  src,
  name,
  size = 56,
  radius = 'var(--radius-md)',
}: {
  src: string
  name: string
  size?: number
  radius?: string
}) {
  return (
    <SmartImage
      src={src}
      alt=""
      width={size}
      height={size}
      renderWidth={size}
      radius={radius}
      fallback={
        <span className="t-h3" style={{ color: 'var(--color-ink-faint)' }}>
          {(name.trim()[0] ?? '?').toUpperCase()}
        </span>
      }
    />
  )
}
