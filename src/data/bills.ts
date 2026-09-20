/* ═══════════════════════════════════════════════════════════════════════
   The bills engine — a port of lib/data/repos/bills_repo.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import {
  beneficiaryFromMap,
  billCategoryFromMap,
  billIsSettled,
  billPaymentFromMap,
  billServiceFromMap,
  billVariationFromMap,
  type Beneficiary,
  type BillCategory,
  type BillPayment,
  type BillService,
  type BillVariation,
} from '../models/bills'

/** Catalogue of billers, grouped by category. */
export interface BillCatalog {
  categories: BillCategory[]
  services: BillService[]
  /**
   * True when the backend has no aggregator credentials and is running its
   * simulator. Surfaced in the UI so nobody mistakes a test purchase for a
   * real one.
   */
  simulated: boolean
}

export const EMPTY_CATALOG: BillCatalog = {
  categories: [],
  services: [],
  simulated: false,
}

export const servicesInCategory = (c: BillCatalog, categoryId: string) =>
  c.services.filter((s) => s.category === categoryId)

export const serviceById = (c: BillCatalog, id: string) =>
  c.services.find((s) => s.id === id) ?? null

let catalogCache: BillCatalog | null = null
let catalogAt = 0
const variationCache = new Map<string, BillVariation[]>()

function listOf<T>(raw: unknown, parse: (m: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map(parse)
}

/**
 * The catalogue is cached for minutes rather than the session: it now carries
 * the transaction fee on each biller and leaves out categories the aggregator
 * cannot sell, and both of those change without a deploy. A half-hour cache
 * would quote a fee the backend has stopped charging.
 */
export async function catalog(refresh = false): Promise<BillCatalog> {
  const fresh = catalogAt > 0 && Date.now() - catalogAt < 10 * 60_000
  if (!refresh && fresh && catalogCache) return catalogCache

  const data = await Api.get('/api/bills/catalog', { auth: false })
  catalogCache = {
    categories: listOf(data.categories, billCategoryFromMap),
    services: listOf(data.services, billServiceFromMap),
    simulated: data.simulated === true,
  }
  catalogAt = Date.now()
  return catalogCache
}

export async function variations(serviceKey: string): Promise<BillVariation[]> {
  const cached = variationCache.get(serviceKey)
  if (cached) return cached

  const data = await Api.get(
    `/api/bills/services/${encodeURIComponent(serviceKey)}/variations`,
    { auth: false },
  )
  const list = listOf(data.variations, billVariationFromMap)
    .filter((v) => v.amount > 0)
    .sort((a, b) => a.amount - b.amount)

  variationCache.set(serviceKey, list)
  return list
}

/**
 * Confirms a meter or smartcard belongs to a real customer. Called before the
 * pay button is ever enabled for those billers.
 */
export function verifyCustomer({
  serviceKey,
  accountNumber,
  meterType,
}: {
  serviceKey: string
  accountNumber: string
  meterType?: string
}) {
  return Api.post('/api/bills/verify-customer', {
    body: { serviceKey, accountNumber, ...(meterType ? { meterType } : {}) },
  })
}

export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const suffix = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `bill_${Date.now()}_${suffix}`
}

/**
 * Buys the thing.
 *
 * The idempotency key is generated here and reused across retries of the same
 * logical purchase, so a customer who taps Pay twice on a slow connection is
 * charged once.
 */
export async function purchase({
  serviceKey,
  paymentMethod,
  amount,
  phone,
  accountNumber,
  variationCode,
  meterType,
  idempotencyKey,
}: {
  serviceKey: string
  paymentMethod: string
  amount?: number
  phone?: string
  accountNumber?: string
  variationCode?: string
  meterType?: string
  idempotencyKey?: string
}): Promise<BillPayment> {
  const data = await Api.post('/api/bills/purchase', {
    body: {
      serviceKey,
      paymentMethod,
      ...(amount != null ? { amount } : {}),
      ...(phone ? { phone } : {}),
      ...(accountNumber ? { accountNumber } : {}),
      ...(variationCode ? { variationCode } : {}),
      ...(meterType ? { meterType } : {}),
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
    },
  })
  return billPaymentFromMap(data)
}

export async function verify(billId: string, reference?: string): Promise<BillPayment> {
  const data = await Api.post(`/api/bills/${encodeURIComponent(billId)}/verify`, {
    body: { ...(reference ? { reference } : {}) },
  })
  return billPaymentFromMap(data)
}

export async function requery(billId: string): Promise<BillPayment> {
  const data = await Api.post(`/api/bills/${encodeURIComponent(billId)}/requery`)
  return billPaymentFromMap(data)
}

export async function getBill(billId: string): Promise<BillPayment | null> {
  try {
    const data = await Api.get(`/api/bills/${encodeURIComponent(billId)}`)
    return billPaymentFromMap(data)
  } catch (e) {
    console.warn('[bills] get failed', e)
    return null
  }
}

export async function beneficiaries(): Promise<Beneficiary[]> {
  try {
    const data = await Api.get('/api/bills/beneficiaries')
    return listOf(data.beneficiaries, beneficiaryFromMap)
  } catch (e) {
    // Saved numbers are a convenience — never block the screen on them.
    console.warn('[bills] beneficiaries failed', e)
    return []
  }
}

export async function history({
  category,
  limit = 30,
}: { category?: string; limit?: number } = {}): Promise<BillPayment[]> {
  const data = await Api.get('/api/bills/history', {
    query: { limit: String(limit), ...(category ? { category } : {}) },
  })
  return listOf(data.payments, billPaymentFromMap)
}

/**
 * History for the "recent" strip on the Bills screen.
 *
 * Same call, but a failure here is not the customer's problem: the screen it
 * decorates is fully usable without it, so it degrades to an empty list rather
 * than taking the catalogue down with it.
 */
export async function recentSafe(limit = 5): Promise<BillPayment[]> {
  try {
    return await history({ limit })
  } catch (e) {
    console.warn('[bills] recent failed', e)
    return []
  }
}

/**
 * Polls a purchase the aggregator has not committed to yet.
 *
 * Backs off as it goes — an aggregator that has not answered in ten seconds
 * will not answer faster for being asked more often. Gives up after roughly a
 * minute and leaves the receipt showing "confirming", which is honest: the
 * money is safe either way, because a failure refunds automatically.
 */
export async function pollUntilSettled(
  billId: string,
  {
    budgetMs = 70_000,
    onUpdate,
  }: { budgetMs?: number; onUpdate?: (p: BillPayment) => void } = {},
): Promise<BillPayment | null> {
  const deadline = Date.now() + budgetMs
  let attempt = 0
  let last: BillPayment | null = null

  while (Date.now() < deadline) {
    const wait = Math.min(8000, Math.floor(1200 * Math.pow(1.6, attempt)))
    await new Promise((r) => setTimeout(r, wait))
    attempt++

    try {
      const result = await requery(billId)
      last = result
      onUpdate?.(result)
      if (billIsSettled(result)) return result
    } catch (e) {
      console.warn(`[bills] poll attempt ${attempt} failed`, e)
    }
  }
  return last ?? (await getBill(billId))
}

export function clearBillsCache(): void {
  catalogCache = null
  catalogAt = 0
  variationCache.clear()
}
