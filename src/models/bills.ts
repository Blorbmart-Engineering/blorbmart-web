/* ═══════════════════════════════════════════════════════════════════════
   Bills — a port of lib/data/models/bills.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { asBool, asDate, asDouble, asString, asStringList, maskPhone } from '../lib/format'

/**
 * A tab on the Bills screen: Airtime, Data, Electricity, Cable TV, Betting,
 * Education. Defined by the backend so a new one ships without a release.
 */
export interface BillCategory {
  id: string
  label: string
  icon: string
  accent: string
}

function parseColor(hex: string, fallback: string): string {
  const value = hex.replace('#', '').trim()
  if (value.length === 6 || value.length === 8) {
    // Dart writes AARRGGBB; CSS wants RRGGBBAA. An 8-digit value therefore
    // has its alpha moved to the end rather than being read as red.
    const rgba = value.length === 8 ? `${value.slice(2)}${value.slice(0, 2)}` : value
    if (/^[0-9a-fA-F]+$/.test(rgba)) return `#${rgba}`
  }
  return fallback
}

export function billCategoryFromMap(m: Record<string, unknown>): BillCategory {
  return {
    id: asString(m.id),
    label: asString(m.label, 'Bills'),
    icon: asString(m.icon, 'receipt'),
    accent: parseColor(asString(m.accent), 'var(--color-brand)'),
  }
}

/** One biller: MTN, Ikeja Electric, DStv. */
export interface BillService {
  id: string
  category: string
  name: string
  network: string
  color: string
  /**
   * Which fields the form must render: phone, account, amount, variation,
   * meterType. Driven entirely by the backend.
   */
  inputs: string[]
  accountLabel: string
  min: number
  max: number
  cashbackPercent: number
  /**
   * The transaction fee added on top of this purchase, in naira. Set in the
   * admin dashboard and sent with the catalogue, so the form can show the
   * real total before anyone taps Pay rather than after.
   */
  fee: number
}

export function billServiceFromMap(m: Record<string, unknown>): BillService {
  return {
    id: asString(m.id),
    category: asString(m.category),
    name: asString(m.name),
    network: asString(m.network),
    color: parseColor(asString(m.color), 'var(--color-brand)'),
    inputs: asStringList(m.inputs),
    accountLabel: asString(m.accountLabel, 'Account number'),
    min: asDouble(m.min),
    max: asDouble(m.max),
    cashbackPercent: asDouble(m.cashbackPercent),
    fee: asDouble(m.fee),
  }
}

export const needsPhone = (s: BillService) => s.inputs.includes('phone')
export const needsAccount = (s: BillService) => s.inputs.includes('account')
export const needsAmount = (s: BillService) => s.inputs.includes('amount')
export const needsVariation = (s: BillService) => s.inputs.includes('variation')
export const needsMeterType = (s: BillService) => s.inputs.includes('meterType')

/** Whether the account must be confirmed with the biller before charging. */
export function isVerifiable(s: BillService): boolean {
  return needsAccount(s) && s.category !== 'betting'
}

/** A data bundle, TV package or exam PIN. */
export interface BillVariation {
  code: string
  name: string
  amount: number
  /**
   * How long a data plan lasts, as the backend shelved it: "Daily",
   * "Weekly", "Monthly", "2 months+" or "Other". Empty for TV and
   * education packages, which are not sorted by validity.
   */
  periodLabel: string
}

export function billVariationFromMap(m: Record<string, unknown>): BillVariation {
  return {
    code: asString(m.code),
    name: asString(m.name),
    amount: asDouble(m.amount),
    periodLabel: asString(m.periodLabel),
  }
}

/** The order the period tabs appear in. */
const PERIOD_ORDER = ['Daily', 'Weekly', 'Monthly', '2 months+', 'Other']

export const ALL_PLANS = 'All'

/**
 * The tabs worth showing over a bundle list: "All" plus every period that
 * has at least one plan. Empty when there is nothing to split, so a list of
 * TV packages, or plans that are all monthly, shows no tabs at all.
 */
export function bundlePeriods(bundles: BillVariation[]): string[] {
  const present = new Set(bundles.map((b) => b.periodLabel).filter(Boolean))
  if (present.size < 2) return []
  const ordered = PERIOD_ORDER.filter((p) => present.has(p))
  const extra = [...present].filter((p) => !PERIOD_ORDER.includes(p))
  return [ALL_PLANS, ...ordered, ...extra]
}

export const bundlesInPeriod = (bundles: BillVariation[], period: string) =>
  period === ALL_PLANS ? bundles : bundles.filter((b) => b.periodLabel === period)

/**
 * Bundles are usually named "1GB — 30 days"; split so the size can lead
 * visually and the validity sit underneath.
 */
export function variationHeadline(v: BillVariation): string {
  return v.name.split(/\s*[-—–]\s*/)[0].trim()
}

export function variationDetail(v: BillVariation): string {
  const parts = v.name.split(/\s*[-—–]\s*/)
  return parts.length > 1 ? parts.slice(1).join(' · ').trim() : ''
}

/** A number this customer has topped up before. One tap refills the form. */
export interface Beneficiary {
  serviceKey: string
  serviceName: string
  category: string
  target: string
  lastAmount: number
  lastVariationCode: string
  lastVariationName: string
}

export function beneficiaryFromMap(m: Record<string, unknown>): Beneficiary {
  return {
    serviceKey: asString(m.serviceKey),
    serviceName: asString(m.serviceName),
    category: asString(m.category),
    target: asString(m.target),
    lastAmount: asDouble(m.lastAmount),
    lastVariationCode: asString(m.lastVariationCode),
    lastVariationName: asString(m.lastVariationName),
  }
}

export function beneficiaryDisplay(b: Beneficiary): string {
  return maskPhone(b.target)
}

export type BillStatus =
  | 'pending'
  | 'processing'
  | 'awaitingConfirmation'
  | 'delivered'
  | 'failed'
  | 'refunded'
  /**
   * Started, never paid for, and confirmed with Paystack that no money moved.
   * A settled ending rather than a permanent "awaiting payment".
   */
  | 'abandoned'

function billStatusFrom(raw: string): BillStatus {
  switch (raw) {
    case 'delivered':
      return 'delivered'
    case 'failed':
      return 'failed'
    case 'refunded':
      return 'refunded'
    case 'processing':
      return 'processing'
    case 'pending_confirmation':
      return 'awaitingConfirmation'
    case 'abandoned':
    case 'cancelled':
    case 'canceled':
      return 'abandoned'
    default:
      return 'pending'
  }
}

/** A bill payment, as it comes back from the backend. */
export interface BillPayment {
  id: string
  serviceKey: string
  serviceName: string
  category: string
  /** The value bought — the airtime or the bundle, before the fee. */
  amount: number
  fee: number
  /** What was actually taken from the wallet or the card: amount + fee. */
  total: number
  status: BillStatus
  target: string
  variationName: string
  /** Electricity token, or an exam PIN. The whole point of the receipt. */
  token: string
  units: string
  failureReason: string
  reference: string
  paymentMethod: string
  authorizationUrl: string
  createdAt: Date | null
  simulated: boolean
}

export function billPaymentFromMap(m: Record<string, unknown>): BillPayment {
  const phone = asString(m.phone)
  const amount = asDouble(m.amount)
  return {
    id: asString(m.id),
    serviceKey: asString(m.serviceKey),
    serviceName: asString(m.serviceName, 'Bill'),
    category: asString(m.category),
    amount,
    fee: asDouble(m.fee),
    // Purchases made before fees existed carry no total; back then the value
    // was the whole charge.
    total: asDouble(m.totalAmount) || amount,
    status: billStatusFrom(asString(m.status)),
    target: phone || asString(m.accountNumber),
    variationName: asString(m.variationName),
    token: asString(m.token),
    units: asString(m.units),
    failureReason: asString(m.failureReason),
    reference: asString(m.reference),
    paymentMethod: asString(m.paymentMethod),
    authorizationUrl: asString(m.authorizationUrl),
    createdAt: asDate(m.createdAt),
    simulated: asBool(m.simulated),
  }
}

export function billIsSettled(p: BillPayment): boolean {
  return (
    p.status === 'delivered' ||
    p.status === 'failed' ||
    p.status === 'refunded' ||
    p.status === 'abandoned'
  )
}

/** True while the result is genuinely unknown and worth polling. */
export function billIsPending(p: BillPayment): boolean {
  return p.status === 'processing' || p.status === 'awaitingConfirmation'
}

export function billNeedsPayment(p: BillPayment): boolean {
  return p.authorizationUrl.length > 0 && !billIsSettled(p)
}

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  delivered: 'Successful',
  failed: 'Failed',
  refunded: 'Refunded',
  processing: 'Processing',
  awaitingConfirmation: 'Confirming',
  abandoned: 'Not completed',
  pending: 'Awaiting payment',
}

export const BILL_STATUS_COLORS: Record<BillStatus, string> = {
  delivered: 'var(--color-success)',
  failed: 'var(--color-danger)',
  refunded: 'var(--color-warning)',
  abandoned: 'var(--color-ink-faint)',
  processing: 'var(--color-brand)',
  awaitingConfirmation: 'var(--color-brand)',
  pending: 'var(--color-brand)',
}

export function billTitle(p: BillPayment): string {
  return p.variationName ? `${p.serviceName} · ${p.variationName}` : p.serviceName
}
