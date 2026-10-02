/* ═══════════════════════════════════════════════════════════════════════
   The student marketplace.

   Everything goes through the backend (/api/marketplace): listings are
   scoped to the student's campus there, and the money — held when an item
   is bought, released at the handover — only ever moves on the server.

   Photos are the one exception. They go straight from the phone to
   Cloudinary through the shared unsigned preset (the vendor apps do the
   same), and the backend refuses any listing photo not hosted there.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import { asDouble, asString } from '../lib/format'
import type { PillTone } from '../ui/kit'

export type ListingStatus = 'active' | 'reserved' | 'sold' | 'hidden' | 'removed'
export type MarketOrderStatus = 'awaiting_seller' | 'accepted' | 'completed' | 'cancelled' | 'disputed'

export interface Option {
  id: string
  label: string
}

export interface Listing {
  id: string
  title: string
  description: string
  price: number
  category: string
  categoryLabel: string
  condition: string
  conditionLabel: string
  photos: string[]
  status: ListingStatus
  seller: { name: string; photoUrl: string | null; verified?: boolean }
  mine: boolean
  createdAt: string | null
  reportCount?: number
  hiddenReason?: string | null
}

export interface MarketOrder {
  id: string
  role: 'buyer' | 'seller'
  status: MarketOrderStatus
  listing: { id: string; title: string; photo: string | null; price: number }
  amount: number
  fee: number
  sellerAmount: number
  buyer: { name: string; phone?: string | null }
  seller: { name: string; phone?: string | null }
  meetupNote: string | null
  cancelReason: string | null
  cancelledBy: string | null
  dispute: { reason: string; by: string; openedAt: string | null; resolution: { outcome: string; note: string | null } | null } | null
  handoverPin?: string
  pinLocked: boolean
  answerBy: string | null
  createdAt: string | null
  acceptedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

export interface Earnings {
  balance: number
  totalEarned: number
  minWithdrawal: number
  bankAccount: { bankName: string; accountName: string; accountMasked: string; verified: boolean } | null
  transactions: { id: string; direction: 'in' | 'out'; amount: number; description: string | null; createdAt: string | null }[]
}

export interface ListingInput {
  title: string
  description: string
  price: number
  category: string
  condition: string
  photos: string[]
}

/** Kept in step with CATEGORIES / CONDITIONS in the backend's marketplaceService.js. */
export const CATEGORIES: Option[] = [
  { id: 'books', label: 'Books & notes' },
  { id: 'phones', label: 'Phones & tablets' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'hostel', label: 'Hostel & kitchen' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'sports', label: 'Sports & games' },
  { id: 'other', label: 'Other' },
]

export const CONDITIONS: Option[] = [
  { id: 'new', label: 'New' },
  { id: 'like_new', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
]

export const REPORT_REASONS: Option[] = [
  { id: 'banned', label: 'Not allowed on Blorbmart' },
  { id: 'scam', label: 'Looks like a scam' },
  { id: 'wrong', label: 'Wrong price or details' },
  { id: 'offensive', label: 'Offensive' },
  { id: 'other', label: 'Something else' },
]

export const MAX_PHOTOS = 5

const unwrap = <T>(data: unknown) => data as T

/* ── Becoming a seller ────────────────────────────────────────────────── */

export type SellerStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended'

export interface SellerState {
  status: SellerStatus
  reason: string | null
  fullName: string | null
  matricNumber: string | null
  submittedAt: string | null
}

export const sellerStatus = async () => unwrap<SellerState>(await Api.get('/api/marketplace/seller'))

export const applyToSell = async (input: { fullName: string; matricNumber: string; idPhotoUrl: string; selfieUrl: string }) =>
  unwrap<SellerState>(await Api.post('/api/marketplace/seller', { body: { ...input } }))

/* ── Listings ─────────────────────────────────────────────────────────── */

export async function marketFeed(params: { category?: string; q?: string } = {}): Promise<Listing[]> {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.q?.trim()) query.set('q', params.q.trim())
  const qs = query.toString()
  const data = unwrap<{ listings: Listing[] }>(await Api.get(`/api/marketplace/listings${qs ? `?${qs}` : ''}`))
  return data.listings ?? []
}

export const myListings = async () => unwrap<Listing[]>(await Api.get('/api/marketplace/listings/mine'))

export const getListing = async (id: string) =>
  unwrap<Listing>(await Api.get(`/api/marketplace/listings/${encodeURIComponent(id)}`))

export const createListing = async (input: ListingInput) =>
  unwrap<Listing>(await Api.post('/api/marketplace/listings', { body: { ...input } }))

export const updateListing = async (id: string, input: Partial<ListingInput>) =>
  unwrap<Listing>(await Api.patch(`/api/marketplace/listings/${encodeURIComponent(id)}`, { body: { ...input } }))

export const removeListing = async (id: string) => {
  await Api.delete(`/api/marketplace/listings/${encodeURIComponent(id)}`)
}

export const reportListing = async (id: string, reason: string, note: string) =>
  unwrap<{ hidden: boolean }>(
    await Api.post(`/api/marketplace/listings/${encodeURIComponent(id)}/report`, { body: { reason, note } }),
  )

export const buyListing = async (id: string, pin: string) =>
  unwrap<MarketOrder>(await Api.post(`/api/marketplace/listings/${encodeURIComponent(id)}/buy`, { body: { pin } }))

/* ── Orders ───────────────────────────────────────────────────────────── */

export const myMarketOrders = async (role: 'buyer' | 'seller') =>
  unwrap<MarketOrder[]>(await Api.get(`/api/marketplace/orders?role=${role}`))

export const getMarketOrder = async (id: string) =>
  unwrap<MarketOrder>(await Api.get(`/api/marketplace/orders/${encodeURIComponent(id)}`))

const orderAction = (id: string, action: string, body: Record<string, unknown> = {}) =>
  Api.post(`/api/marketplace/orders/${encodeURIComponent(id)}/${action}`, { body }).then(unwrap<MarketOrder>)

export const acceptMarketOrder = (id: string, meetupNote: string) => orderAction(id, 'accept', { meetupNote })
export const cancelMarketOrder = (id: string, reason: string) => orderAction(id, 'cancel', { reason })
export const handOver = (id: string, pin: string) => orderAction(id, 'handover', { pin })
export const confirmReceived = (id: string) => orderAction(id, 'received')
export const disputeMarketOrder = (id: string, reason: string) => orderAction(id, 'dispute', { reason })

/* ── Earnings ─────────────────────────────────────────────────────────── */

export const getEarnings = async () => unwrap<Earnings>(await Api.get('/api/marketplace/earnings'))

export const moveEarnings = async (amount: number, pin: string) =>
  unwrap<Earnings>(await Api.post('/api/marketplace/earnings/move', { body: { amount, pin } }))

export const listBanks = async () =>
  unwrap<{ name: string; code: string; active: boolean }[]>(await Api.get('/api/marketplace/earnings/banks'))

export const verifyBank = async (bankCode: string, accountNumber: string) =>
  unwrap<{ bankName: string; accountName: string }>(
    await Api.post('/api/marketplace/earnings/bank-account/verify', { body: { bankCode, accountNumber } }),
  )

export const saveBank = async (bankCode: string, accountNumber: string, pin: string) =>
  unwrap<{ bankName: string; accountName: string; accountMasked: string }>(
    await Api.post('/api/marketplace/earnings/bank-account', { body: { bankCode, accountNumber, pin } }),
  )

export const withdrawEarnings = async (amount: number, pin: string) =>
  unwrap<{ id: string; amount: number; status: string }>(
    await Api.post('/api/marketplace/earnings/withdraw', { body: { amount, pin } }),
  )

/* ── Photos ───────────────────────────────────────────────────────────── */

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dwshyzftx/image/upload'
const UPLOAD_PRESET = 'blorbmart'

/**
 * Shrinks a phone photo before it leaves: a 12MP camera shot is 4–6MB, which
 * on campus data is a long wait and a real cost. 1600px on the long side is
 * plenty for a listing.
 */
async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 900_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadPhoto(file: File, folder = 'blorbmart/marketplace'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That is not a photo.')
  if (file.size > 15 * 1024 * 1024) throw new Error('That photo is too big. Pick one under 15MB.')
  const form = new FormData()
  form.append('file', await shrink(file))
  form.append('upload_preset', UPLOAD_PRESET)
  form.append('folder', folder)
  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: form })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const url = asString(body.secure_url)
  if (!res.ok || !url) throw new Error('That photo did not upload. Check your connection and try again.')
  return url
}

/* ── Labels ───────────────────────────────────────────────────────────── */

export function orderStatusLabel(o: Pick<MarketOrder, 'status' | 'role'>): string {
  switch (o.status) {
    case 'awaiting_seller':
      return o.role === 'seller' ? 'Waiting for you' : 'Waiting for the seller'
    case 'accepted':
      return 'Meet up and hand over'
    case 'completed':
      return o.role === 'seller' ? 'Sold' : 'Bought'
    case 'cancelled':
      return 'Cancelled'
    case 'disputed':
      return 'With the campus team'
  }
}

export function orderStatusTone(status: MarketOrderStatus): PillTone {
  switch (status) {
    case 'awaiting_seller':
      return 'warning'
    case 'accepted':
      return 'brand'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'neutral'
    case 'disputed':
      return 'danger'
  }
}

export function listingStatusLabel(status: ListingStatus): string {
  return { active: 'For sale', reserved: 'Someone is buying', sold: 'Sold', hidden: 'Taken down', removed: 'Removed' }[status]
}

export function listingStatusTone(status: ListingStatus): PillTone {
  return ({ active: 'success', reserved: 'warning', sold: 'brand', hidden: 'danger', removed: 'neutral' } as const)[status]
}

/** A naira amount typed by a person: digits only, commas ignored. */
export function parseNaira(input: string): number {
  return asDouble(String(input).replace(/[^\d.]/g, ''), 0)
}
