/**
 * Group orders, Blorb points and ratings — routes/groups.js, rewards.js and
 * ratings.js on the backend. Thin on purpose: the server owns every rule and
 * every number, and these just carry them.
 */

import { Api } from '../lib/api'
import { cartLineToMap, type CartLine } from '../models/cart'

/* ── Group orders ─────────────────────────────────────────────────────── */

export type GroupStatus = 'open' | 'placing' | 'placed' | 'delivered' | 'cancelled' | 'expired'
export type MemberStatus = 'editing' | 'paid' | 'ordered' | 'refunded' | 'left'

export interface GroupMember {
  uid: string
  name: string
  isHost: boolean
  isYou: boolean
  status: MemberStatus
  subtotal: number
  feeAmount: number | null
  itemCount: number
  lines: { name: string; quantity: number; lineTotal: number; addons: string[] }[]
}

export interface Group {
  code: string
  status: GroupStatus
  isHost: boolean
  hostName: string
  storeId: string
  storeName: string
  vertical: string
  dropoff: string | null
  closesAt: number | null
  joinOpen: boolean
  orderId: string | null
  orderDocId: string | null
  orderStatus: string | null
  cancelReason: string | null
  totals: { items: number; paid: number; people: number }
  members: GroupMember[]
  you: { status: MemberStatus; subtotal: number; lines: Record<string, unknown>[]; holdAmount: number } | null
}

export interface GroupPreview {
  total: number
  itemsTotal: number
  deliveryFee: number
  serviceFee: number
  fees: number
  feeShare: number
  hostPays: number
  people: { uid: string; name: string; items: number; feeShare: number }[]
  host: { uid: string; name: string; items: number; feeShare: number }
  leftOut: { uid: string; name: string }[]
}

const asGroup = (data: Record<string, unknown>) => data as unknown as Group

export const groupApi = {
  create: async (body: {
    storeId: string
    storeName: string
    vertical: string
    address: Record<string, unknown>
    closesInMinutes?: number
  }) => asGroup(await Api.post('/api/groups', { body })),

  get: async (code: string) => asGroup(await Api.get(`/api/groups/${encodeURIComponent(code)}`)),

  setLines: async (code: string, lines: CartLine[]) =>
    asGroup(await Api.post(`/api/groups/${encodeURIComponent(code)}/lines`, { body: { lines: lines.map(cartLineToMap) } })),

  pay: async (code: string, pin?: string) =>
    asGroup(await Api.post(`/api/groups/${encodeURIComponent(code)}/pay`, { body: { pin } })),

  unpay: async (code: string) => asGroup(await Api.post(`/api/groups/${encodeURIComponent(code)}/unpay`)),

  leave: (code: string) => Api.post(`/api/groups/${encodeURIComponent(code)}/leave`),

  cancel: async (code: string) => asGroup(await Api.post(`/api/groups/${encodeURIComponent(code)}/cancel`)),

  preview: async (code: string) =>
    (await Api.get(`/api/groups/${encodeURIComponent(code)}/preview`)) as unknown as GroupPreview,

  place: async (code: string, pin?: string) =>
    (await Api.post(`/api/groups/${encodeURIComponent(code)}/place`, { body: { pin } })) as unknown as {
      orderId: string
      total: number
      hostPaid: number
    },
}

/** The link a friend opens. Always the public shop domain, never localhost. */
export const groupLink = (code: string) =>
  `${typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/.test(window.location.host) ? window.location.origin : 'https://shop.blorbmart.com.ng'}/group/${code}`

/* ── Blorb points ─────────────────────────────────────────────────────── */

export interface Rewards {
  points: number
  lifetimePoints: number
  worth: number
  canRedeem: boolean
  streak: { count: number; best: number; orderedToday: boolean; next: { at: number; bonus: number } }
  rates: { pointsPer100: number; pointValue: number; minRedeem: number }
  history: { id: string; type: 'earn' | 'bonus' | 'redeem'; points: number; reason: string | null; createdAt: number | null }[]
}

export const rewardsApi = {
  get: async () => (await Api.get('/api/rewards')) as unknown as Rewards,
  redeem: async (points: number) =>
    (await Api.post('/api/rewards/redeem', { body: { points } })) as unknown as { points: number; amount: number },
}

/* ── Ratings ──────────────────────────────────────────────────────────── */

export interface OrderRating {
  orderDocId: string
  food: number
  rider: number | null
  foodTags: string[]
  riderTags: string[]
  comment: string | null
}

export const ratingApi = {
  tags: async () => (await Api.get('/api/ratings/tags')) as unknown as { food: string[]; rider: string[] },
  /** The caller's rating for an order, or null if not rated yet. */
  get: async (orderDocId: string): Promise<OrderRating | null> => {
    const data = await Api.get(`/api/ratings/${encodeURIComponent(orderDocId)}`)
    return typeof data.food === 'number' ? (data as unknown as OrderRating) : null
  },
  submit: (body: {
    orderDocId: string
    food: number
    rider?: number | null
    foodTags: string[]
    riderTags: string[]
    comment?: string
  }) => Api.post('/api/ratings', { body }),
}
