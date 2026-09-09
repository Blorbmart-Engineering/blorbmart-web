/* ═══════════════════════════════════════════════════════════════════════
   A Blorbmart receipt — a port of lib/data/models/receipt.dart.

   One shape for every kind of money that moves through the app: a wallet
   top-up, a data bundle, a plate of rice, an event ticket. The backend
   normalises all four into this before anything is drawn, so the receipt a
   customer gets for airtime is recognisably the same document as the one
   they get for dinner.

   `signature` is produced on the server and never on the client. That is the
   whole security model: a device cannot mint a receipt, and anybody can check
   one by scanning the QR — which resolves to a page that re-derives the
   record from the database rather than trusting the URL.
   ═══════════════════════════════════════════════════════════════════════ */

import { asBool, asDate, asDouble, asInt, asString } from '../lib/format'

/**
 * The kinds of transaction that produce a receipt. The wire value is what the
 * receipts endpoint expects in its path, so these names are a contract with
 * the backend rather than a local label.
 */
export type ReceiptKind = 'wallet' | 'bill' | 'order' | 'ticket'

/** One line of the detail table. */
export interface ReceiptRow {
  label: string
  value: string
  /** Rendered in a monospaced face — references, account numbers, tokens. */
  mono: boolean
}

export function receiptRowFromMap(m: Record<string, unknown>): ReceiptRow {
  return {
    label: asString(m.label),
    value: asString(m.value),
    mono: asBool(m.mono),
  }
}

/** One priced line: a dish, a ticket tier. */
export interface ReceiptItem {
  name: string
  quantity: number
  amount: number
}

export function receiptItemFromMap(m: Record<string, unknown>): ReceiptItem {
  return {
    name: asString(m.name),
    quantity: asInt(m.quantity, 1),
    amount: asDouble(m.amount),
  }
}

/**
 * The one thing on the page worth stealing: an electricity token, an exam
 * PIN, an admission code.
 */
export interface ReceiptSecret {
  label: string
  value: string
  hint: string
}

export function receiptSecretFromMap(m: Record<string, unknown>): ReceiptSecret {
  return {
    label: asString(m.label),
    value: asString(m.value),
    hint: asString(m.hint),
  }
}

export interface BlorbReceipt {
  kind: ReceiptKind
  kindLabel: string
  id: string
  reference: string
  /**
   * Deterministic per record: the same transaction always produces the same
   * receipt number, so a "second" receipt for one payment cannot exist.
   */
  receiptNo: string
  amount: number
  currency: string
  /** One of completed, pending, failed, refunded. */
  status: string
  statusLabel: string
  issuedAt: Date
  title: string
  subtitle: string
  /**
   * Masked before it leaves the server, so a shared receipt does not leak a
   * full email address or phone number.
   */
  customerName: string
  customerEmail: string
  customerPhone: string
  rows: ReceiptRow[]
  items: ReceiptItem[]
  totals: ReceiptRow[]
  secret: ReceiptSecret | null
  note: string
  simulated: boolean
  signature: string
  verificationCode: string
  verifyUrl: string
}

const KINDS: ReceiptKind[] = ['wallet', 'bill', 'order', 'ticket']

function listOf<T>(
  source: unknown,
  parse: (m: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(source)) return []
  return source
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map(parse)
}

/** Parses the `data` object returned by `/api/receipts/:kind/:id`. */
export function receiptFromEnvelope(envelope: Record<string, unknown>): BlorbReceipt {
  const raw = (envelope.receipt ?? {}) as Record<string, unknown>
  const customer = (raw.customer ?? {}) as Record<string, unknown>
  const kindWire = asString(raw.kind, 'wallet')
  const secure = raw.secure

  return {
    kind: KINDS.includes(kindWire as ReceiptKind) ? (kindWire as ReceiptKind) : 'wallet',
    kindLabel: asString(raw.kindLabel, 'Receipt'),
    id: asString(raw.id),
    reference: asString(raw.reference),
    receiptNo: asString(raw.receiptNo),
    amount: asDouble(raw.amount),
    currency: asString(raw.currency, 'NGN'),
    status: asString(raw.status, 'pending'),
    statusLabel: asString(raw.statusLabel, 'Pending'),
    issuedAt: asDate(raw.issuedAt) ?? new Date(),
    title: asString(raw.title, 'Blorbmart'),
    subtitle: asString(raw.subtitle),
    customerName: asString(customer.name),
    customerEmail: asString(customer.email),
    customerPhone: asString(customer.phone),
    rows: listOf(raw.rows, receiptRowFromMap),
    items: listOf(raw.items, receiptItemFromMap),
    totals: listOf(raw.totals, receiptRowFromMap),
    secret:
      secure && typeof secure === 'object'
        ? receiptSecretFromMap(secure as Record<string, unknown>)
        : null,
    note: asString(raw.note),
    simulated: asBool(raw.simulated),
    signature: asString(envelope.signature),
    verificationCode: asString(envelope.verificationCode),
    verifyUrl: asString(envelope.verifyUrl),
  }
}

export const receiptIsSuccessful = (r: BlorbReceipt) => r.status === 'completed'
export const receiptIsFailed = (r: BlorbReceipt) => r.status === 'failed'
export const receiptIsRefunded = (r: BlorbReceipt) => r.status === 'refunded'

export function receiptIssuedTo(r: BlorbReceipt): string {
  return [r.customerName, r.customerEmail, r.customerPhone]
    .filter((e) => e.trim().length > 0)
    .join(' · ')
}
