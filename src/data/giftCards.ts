/* ═══════════════════════════════════════════════════════════════════════
   Gift cards.

   Everything goes through the backend. A code is only ever minted there,
   after the money has arrived, and it never touches Firestore in a form a
   client could read — so there is nothing here to query directly.

   The artwork is drawn in the browser (lib/giftCardArt.js, generated from
   the backend's template) for the live preview; the downloadable PNG comes
   from the backend so that it is byte-for-byte what the email carries.
   ═══════════════════════════════════════════════════════════════════════ */

import QRCode from 'qrcode'
import { Api, BASE_URL } from '../lib/api'
import { asDate, asDouble, asString } from '../lib/format'
import { auth } from '../lib/firebase'
import type { GiftDesign } from '../lib/giftCardArt'
import type { PillTone } from '../ui/kit'

export type GiftStatus =
  | 'pending_payment'
  | 'active'
  | 'redeemed'
  | 'expired'
  | 'revoked'
  | 'failed'

export interface GiftCard {
  id: string
  role: 'sent' | 'received'
  amount: number
  design: GiftDesign
  to: string
  from: string
  message: string
  status: GiftStatus
  codeMasked: string | null
  paymentMethod: string
  reference: string
  recipientEmail: string | null
  emailSentAt: Date | null
  createdAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  authorizationUrl: string | null
}

/** What a code holds, before it is redeemed. */
export interface GiftPreview {
  amount: number
  design: GiftDesign
  to: string
  from: string
  message: string
  status: GiftStatus
  expiresAt: Date | null
  redeemable: boolean
}

/** Where the QR on a card points. Must match the backend's GIFT_CARD_REDEEM_URL. */
export const REDEEM_URL = 'https://shop.blorbmart.com.ng/gift'

export const GIFT_AMOUNTS = { min: 2000, max: 200000, step: 100, presets: [2000, 5000, 10000, 20000, 50000] }

function designFrom(raw: unknown): GiftDesign {
  const m = (raw ?? {}) as Record<string, unknown>
  return {
    theme: asString(m.theme, 'birthday'),
    palette: asString(m.palette),
    motif: asString(m.motif),
    type: asString(m.type),
    headline: asString(m.headline),
  }
}

export function giftCardFromMap(m: Record<string, unknown>): GiftCard {
  return {
    id: asString(m.id),
    role: m.role === 'received' ? 'received' : 'sent',
    amount: asDouble(m.amount),
    design: designFrom(m.design),
    to: asString(m.to),
    from: asString(m.from),
    message: asString(m.message),
    status: asString(m.status, 'active') as GiftStatus,
    codeMasked: asString(m.codeMasked) || null,
    paymentMethod: asString(m.paymentMethod),
    reference: asString(m.reference),
    recipientEmail: asString(m.recipientEmail) || null,
    emailSentAt: asDate(m.emailSentAt),
    createdAt: asDate(m.createdAt),
    expiresAt: asDate(m.expiresAt),
    redeemedAt: asDate(m.redeemedAt),
    authorizationUrl: asString(m.authorizationUrl) || null,
  }
}

function previewFromMap(m: Record<string, unknown>): GiftPreview {
  return {
    amount: asDouble(m.amount),
    design: designFrom(m.design),
    to: asString(m.to),
    from: asString(m.from),
    message: asString(m.message),
    status: asString(m.status, 'active') as GiftStatus,
    expiresAt: asDate(m.expiresAt),
    redeemable: Boolean(m.redeemable),
  }
}

export interface PurchaseInput {
  amount: number
  design: GiftDesign
  to: string
  from: string
  message: string
  recipientEmail?: string
  paymentMethod: 'wallet' | 'paystack'
  pin?: string
  idempotencyKey: string
}

export interface PurchaseResult {
  card: GiftCard
  code?: string
  downloadToken?: string
  authorizationUrl?: string
  reference?: string
}

function purchaseFromMap(data: Record<string, unknown>): PurchaseResult {
  return {
    card: giftCardFromMap((data.card ?? {}) as Record<string, unknown>),
    code: asString(data.code) || undefined,
    downloadToken: asString(data.downloadToken) || undefined,
    authorizationUrl: asString(data.authorizationUrl) || undefined,
    reference: asString(data.reference) || undefined,
  }
}

export function newGiftIdempotencyKey(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return `gft_${Date.now()}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export async function purchaseGiftCard(input: PurchaseInput): Promise<PurchaseResult> {
  const data = await Api.post('/api/gift-cards/purchase', {
    body: {
      ...input,
      ...(input.recipientEmail ? {} : { recipientEmail: undefined }),
      // Paystack sends the browser back here; PaymentReturn takes it on.
      returnPath: '/gifts',
    },
  })
  return purchaseFromMap(data)
}

export async function verifyGiftCard(id: string, reference?: string): Promise<PurchaseResult> {
  const data = await Api.post(`/api/gift-cards/${encodeURIComponent(id)}/verify`, {
    body: reference ? { reference } : {},
  })
  return purchaseFromMap(data)
}

export async function myGiftCards(): Promise<{ sent: GiftCard[]; received: GiftCard[] }> {
  const data = await Api.get('/api/gift-cards/mine')
  const list = (raw: unknown) =>
    Array.isArray(raw)
      ? raw.filter((m): m is Record<string, unknown> => !!m && typeof m === 'object').map(giftCardFromMap)
      : []
  return { sent: list(data.sent), received: list(data.received) }
}

export async function getGiftCard(id: string): Promise<GiftCard> {
  return giftCardFromMap(await Api.get(`/api/gift-cards/${encodeURIComponent(id)}`))
}

/** The code again, behind the wallet PIN. */
export async function revealGiftCard(
  id: string,
  pin?: string,
): Promise<{ code: string; downloadToken: string }> {
  const data = await Api.post(`/api/gift-cards/${encodeURIComponent(id)}/reveal`, {
    body: pin ? { pin } : {},
  })
  return { code: asString(data.code), downloadToken: asString(data.downloadToken) }
}

/** What a code holds. Works signed out, so a friend can see their gift first. */
export async function checkGiftCode(code: string): Promise<GiftPreview> {
  const data = await Api.post('/api/gift-cards/check', {
    body: { code },
    auth: Boolean(auth.currentUser),
  })
  return previewFromMap(data)
}

export async function redeemGiftCode(
  code: string,
): Promise<{ amount: number; balanceAfter: number; card: GiftCard }> {
  const data = await Api.post('/api/gift-cards/redeem', { body: { code } })
  return {
    amount: asDouble(data.amount),
    balanceAfter: asDouble(data.balanceAfter),
    card: giftCardFromMap((data.card ?? {}) as Record<string, unknown>),
  }
}

/** The finished PNG. The token is short-lived and only minted after the PIN. */
export function giftCardImageUrl(id: string, token: string, download = false): string {
  const q = new URLSearchParams({ t: token })
  if (download) q.set('download', '1')
  return `${BASE_URL}/api/gift-cards/${encodeURIComponent(id)}/card.png?${q.toString()}`
}

/** The QR a real card carries, as one SVG path, drawn exactly as the backend draws it. */
export function qrForCode(code: string): { qrPath: string; qrSize: number } {
  const qr = QRCode.create(`${REDEEM_URL}#${encodeURIComponent(code)}`, { errorCorrectionLevel: 'M' })
  const { size, data } = qr.modules
  const parts: string[] = []
  for (let y = 0; y < size; y++) {
    let run = 0
    for (let x = 0; x <= size; x++) {
      const dark = x < size && data[y * size + x]
      if (dark) run += 1
      else if (run) {
        parts.push(`M${x - run} ${y}h${run}v1h${-run}Z`)
        run = 0
      }
    }
  }
  return { qrPath: parts.join(''), qrSize: size }
}

/** Formats as the customer types: upper case, groups of four, dashes between. */
export function formatCodeInput(raw: string): string {
  const clean = raw
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, '')
    .slice(0, 16)
  return clean.match(/.{1,4}/g)?.join('-') ?? ''
}

export function giftStatusLabel(status: GiftStatus): string {
  switch (status) {
    case 'active':
      return 'Ready to redeem'
    case 'redeemed':
      return 'Redeemed'
    case 'pending_payment':
      return 'Awaiting payment'
    case 'expired':
      return 'Expired'
    case 'revoked':
      return 'Cancelled'
    default:
      return 'Not completed'
  }
}

export function giftStatusTone(status: GiftStatus): PillTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'redeemed':
      return 'brand'
    case 'pending_payment':
      return 'warning'
    case 'expired':
    case 'revoked':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** A message to send along with the card, for WhatsApp and friends. */
export function shareMessage(card: { amount: number; from: string; to: string }, code: string, money: (n: number) => string): string {
  const hi = card.to ? `Hi ${card.to}! ` : ''
  return `${hi}🎁 I got you a ${money(card.amount)} Blorbmart gift card. Open ${REDEEM_URL} and enter this code: ${code} — it goes straight into your wallet.`
}
