/* ═══════════════════════════════════════════════════════════════════════
   Formatting and coercion — a port of lib/core/utils/formatters.dart.

   Every screen reads money, dates and counts through here, so a malformed
   document cannot produce a different string on web than it does on the
   phone.
   ═══════════════════════════════════════════════════════════════════════ */

const nairaWhole = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const nairaExact = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plain = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

/**
 * NaN and Infinity are the two values that turn a formatter into a crash.
 * They reach us for real — a computed field that once divided by zero, or a
 * document imported with the literal string "NaN" — so every money and count
 * formatter funnels through here and treats them as "no value".
 */
function finiteOrZero(value: number | null | undefined): number {
  if (value == null) return 0
  return Number.isFinite(value) ? value : 0
}

/** Prices, with no decimals — the Nigerian norm for food. */
export function money(value: number | null | undefined): string {
  return nairaWhole.format(Math.round(finiteOrZero(value)))
}

/** Where kobo matter, such as the wallet ledger. */
export function moneyExact(value: number | null | undefined): string {
  return nairaExact.format(finiteOrZero(value))
}

export function plainNumber(value: number | null | undefined): string {
  return plain.format(finiteOrZero(value))
}

/** Compact counts for social proof: 1200 -> "1.2k". */
export function compactCount(value: number | null | undefined): string {
  const v = finiteOrZero(value)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1000) {
    const k = v / 1000
    return `${k.toFixed(k >= 10 ? 0 : 1)}k`
  }
  return String(Math.round(v))
}

/**
 * "24-34 min" style delivery window. Food apps sell certainty, so we always
 * show a range, never a single number.
 */
export function etaWindow(minutes: number, spread = 10): string {
  const low = minutes < 5 ? 5 : minutes
  return `${low}-${low + spread} min`
}

/* ── Coercion ─────────────────────────────────────────────────────────── */

/** A Firestore Timestamp, as it arrives over the wire or from the SDK. */
type TimestampLike = { toDate?: () => Date; seconds?: number; _seconds?: number }

/**
 * Timestamps arrive as Timestamp, int, String or null depending on which
 * client wrote them. One coercion point avoids scattering try/catch.
 */
export function asDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'object') {
    const t = value as TimestampLike
    if (typeof t.toDate === 'function') {
      try {
        return t.toDate()
      } catch {
        return null
      }
    }
    const seconds = t.seconds ?? t._seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000)
  }

  if (typeof value === 'number') {
    // Seconds and milliseconds both appear in the collection.
    return new Date(value > 100_000_000_000 ? value : value * 1000)
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

/**
 * Non-finite input yields `fallback` rather than NaN. Without this, a rating
 * of "NaN" clamped to a perfect 5.0 — which is worse than a crash, because
 * it is wrong and silent.
 */
export function asDouble(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const d = Number.parseFloat(value)
    return Number.isFinite(d) ? d : fallback
  }
  return fallback
}

export function asInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : fallback
  }
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === 'yes' || v === '1') return true
    if (v === 'false' || v === 'no' || v === '0') return false
  }
  return fallback
}

export function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  const s = String(value).trim()
  return s.length === 0 ? fallback : s
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((e) => (e == null ? '' : String(e).trim()))
      .filter((e) => e.length > 0)
  }
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()]
  return []
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/* ── Dates ────────────────────────────────────────────────────────────── */

const shortDate = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' })
const dayTime = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** Human relative time: "Just now", "12 min ago", "Yesterday", "3 Mar". */
export function timeAgo(when: Date | null | undefined): string {
  if (!when) return ''
  const diffMs = Date.now() - when.getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 45) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return shortDate.format(when)
}

export function dayAndTime(when: Date | null | undefined): string {
  return when ? dayTime.format(when) : ''
}

/* ── Phone ────────────────────────────────────────────────────────────── */

/** Masks a phone number for display on receipts: 0704 *** 9911. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 4)} *** ${digits.slice(-4)}`
}

/**
 * Normalises a Nigerian mobile number to the 11-digit local form that VTU
 * providers expect: +2348012345678 / 2348012345678 / 8012345678 -> 08012345678.
 */
export function normaliseNgPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('234')) d = `0${d.slice(3)}`
  if (d.length === 10 && !d.startsWith('0')) d = `0${d}`
  if (d.length !== 11 || !d.startsWith('0')) return null
  return d
}

const MTN = new Set([
  '0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814',
  '0903', '0906', '0913', '0916', '0704', '0707',
])
const GLO = new Set(['0805', '0807', '0705', '0815', '0811', '0905', '0915'])
const AIRTEL = new Set([
  '0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907',
  '0912', '0911',
])
const NINE_MOBILE = new Set(['0809', '0817', '0818', '0908', '0909'])

/**
 * Detects the Nigerian mobile network from a number so the airtime screen can
 * preselect the right operator. Ported numbers are the known limitation,
 * which is why the customer can always override the selection.
 */
export function guessNetwork(phone: string): string | null {
  const d = normaliseNgPhone(phone)
  if (!d || d.length < 4) return null
  const p = d.slice(0, 4)
  if (MTN.has(p)) return 'MTN'
  if (GLO.has(p)) return 'GLO'
  if (AIRTEL.has(p)) return 'AIRTEL'
  if (NINE_MOBILE.has(p)) return '9MOBILE'
  return null
}

/* ── Text ─────────────────────────────────────────────────────────────── */

/** Title-cases a string that arrived as "jollof rice AND chicken". */
export function titleCase(input: string): string {
  const s = input.trim()
  if (!s) return s
  return s
    .split(/\s+/)
    .map((w) =>
      w.length === 1 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ')
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
