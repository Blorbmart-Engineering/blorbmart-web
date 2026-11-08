/* ═══════════════════════════════════════════════════════════════════════
   Blorbmart for Work — company meal plans. The backend decides everything
   that involves money (Blorbmart-backend/services/work); this file only
   carries requests and shapes the answers.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api, type Json } from '../lib/api'

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type Schedule = Partial<Record<DayKey, { from: string; to: string }[]>>
export type Template = { id: string; label: string; schedule: Schedule }

export interface Office {
  id: string
  name: string
  address: { addressLine1: string; landmark?: string; deliveryInstructions?: string; latitude?: number; longitude?: number }
  dropTimes: string[]
}

export interface Membership {
  uid: string
  companyId: string
  status: 'active' | 'paused' | 'removed'
  name: string
  team: string
  dailyLimit: number
  monthlyLimit: number | null
  scheduleTemplate: string
  schedule: Schedule
  deliveryMode: 'office' | 'remote'
  officeId: string | null
  coversDelivery: boolean
  company: { id: string; name: string; status: string }
  office: Office | null
  spentToday: number
  leftToday: number
  coverNow: boolean
  reason: string | null
  reasonCode: string | null
}

export interface Company {
  id: string
  name: string
  kind: string
  campusId: string
  campusName: string
  status: 'pending' | 'active' | 'suspended' | 'closed' | 'rejected'
  plan: string
  planLabel: string
  maxSeats: number
  maxOffices: number
  seatFee: number
  seats: Record<string, number>
  activeMembers: number
  offices: Office[]
  defaults: { dailyLimit?: number; coversDelivery?: boolean; scheduleTemplate?: string }
  lowBalanceAlert: number
  team: { uid: string; role: 'owner' | 'manager'; name: string; email: string }[]
  contactName: string
  contactPhone: string
  contactEmail: string
  rejectReason: string | null
  suspendReason: string | null
  role?: 'owner' | 'manager'
}

export interface Overview {
  company: Company
  role: 'owner' | 'manager'
  balance: number
  month: string
  nextMonth: string
  paidThisMonth: boolean
  paidNextMonth: boolean
  seatsThisMonth: number
  seatsNextMonth: number
  spentThisMonth: number
  mealsThisMonth: number
  templates: Template[]
  plans: { id: string; label: string; maxSeats: number; maxOffices: number; seatFee: number }[]
}

export interface Member {
  uid: string
  status: 'active' | 'paused'
  name: string
  email: string
  phone: string
  team: string
  dailyLimit: number
  monthlyLimit: number | null
  scheduleTemplate: string
  schedule: Schedule
  deliveryMode: 'office' | 'remote'
  officeId: string | null
  coversDelivery: boolean
  joinedAt: number | null
}

export interface Invite {
  code: string
  name: string
  email: string | null
  phone: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  createdAt: number | null
  expiresAt: number | null
}

export interface Invoice {
  id: string
  kind: 'subscription' | 'seats' | 'topup'
  month: string | null
  seats: number
  addSeats: number
  seatFee: number
  feeAmount: number
  budgetAmount: number
  total: number
  status: 'unpaid' | 'paid' | 'cancelled'
  paidVia: string | null
  cancelReason: string | null
  reference: string
  createdAt: number | null
  paidAt: number | null
}

export interface Report {
  month: string
  total: number
  funded: number
  staff: { uid: string; name: string; total: number; meals: number }[]
  stores: { storeId: string | null; name: string; total: number; meals: number }[]
  lines: { at: number | null; type: string; uid: string; name: string; orderId: string | null; storeName: string; amount: number; day: string | null }[]
}

export interface Quote {
  ok: boolean
  code: string | null
  message: string
  total: number
  covered: number
  staffPays: number
  leftToday?: number
  companyName?: string
  coversDelivery?: boolean
  totals?: { subtotal: number; deliveryFee: number; deliveryDiscount: number; serviceFee: number; discountAmount: number; totalAmount: number }
  address?: Json | null
}

const enc = encodeURIComponent
const c = (id: string) => `/api/work/companies/${enc(id)}`
const list = <T,>(r: Json): T[] => (Array.isArray(r.data) ? (r.data as T[]) : [])

export const workMe = async () => (await Api.get('/api/work/me')) as unknown as {
  membership: Membership | null
  teams: Company[]
  templates: Template[]
}

export const applyForWork = async (body: Json) => (await Api.post('/api/work/apply', { body })) as unknown as Company
export const previewInvite = async (code: string) => (await Api.get(`/api/work/invites/${enc(code)}`)) as unknown as {
  code: string; companyName: string; name: string; sentTo: string; dailyLimit: number; schedule: Schedule; scheduleTemplate: string; deliveryMode: 'office' | 'remote'
}
export const acceptInvite = (code: string) => Api.post(`/api/work/invites/${enc(code)}/accept`)
export const leaveWork = () => Api.post('/api/work/leave')

export const overview = async (id: string) => (await Api.get(c(id))) as unknown as Overview
export const saveSettings = (id: string, body: Json) => Api.patch(`${c(id)}/settings`, { body })
export const saveOffice = (id: string, body: Json) => Api.post(`${c(id)}/offices`, { body })
export const removeOffice = (id: string, officeId: string) => Api.delete(`${c(id)}/offices/${enc(officeId)}`)
export const addManager = (id: string, email: string) => Api.post(`${c(id)}/managers`, { body: { email } })
export const removeManager = (id: string, uid: string) => Api.delete(`${c(id)}/managers/${enc(uid)}`)

export const members = async (id: string) => list<Member>(await Api.get(`${c(id)}/members`))
export const updateMember = (id: string, uid: string, body: Json) => Api.patch(`${c(id)}/members/${enc(uid)}`, { body })
export const removeMember = (id: string, uid: string) => Api.delete(`${c(id)}/members/${enc(uid)}`)

export const invites = async (id: string) => list<Invite>(await Api.get(`${c(id)}/invites`))
export const sendInvites = async (id: string, people: Json[]) =>
  (await Api.post(`${c(id)}/invites`, { body: { people } })) as unknown as {
    created: { code: string; name: string; email: string | null; phone: string | null }[]
    refused: { line: number; name: string; reason: string }[]
  }
export const revokeInvite = (id: string, code: string) => Api.delete(`${c(id)}/invites/${enc(code)}`)

export const invoices = async (id: string) => list<Invoice>(await Api.get(`${c(id)}/invoices`))
export const createInvoice = async (id: string, body: Json) => (await Api.post(`${c(id)}/invoices`, { body })) as unknown as Invoice
export const payInvoice = async (id: string, invoiceId: string) =>
  (await Api.post(`${c(id)}/invoices/${enc(invoiceId)}/pay`, { body: { returnPath: `/work/c/${id}?tab=billing&paid=${invoiceId}` } })) as unknown as {
    authorizationUrl: string; reference: string
  }
export const verifyInvoice = async (id: string, invoiceId: string) =>
  (await Api.post(`${c(id)}/invoices/${enc(invoiceId)}/verify`)) as unknown as Invoice

export const report = async (id: string, month: string) => (await Api.get(`${c(id)}/report`, { query: { month } })) as unknown as Report

/** Checkout: points an office meal at the office, prices it, and says what the company would cover. */
export const workQuote = async (orderId: string, body: Json) =>
  (await Api.post('/api/orders/checkout/work/quote', { body: { orderId, ...body } })) as unknown as Quote

export const payWithWork = (orderId: string, body: Json) => Api.post('/api/orders/checkout/work', { body: { orderId, ...body } })

/* ── Display helpers ─────────────────────────────────────────────────── */

export const DAY_LABELS: [DayKey, string][] = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
]

/** "Mon–Fri 11:00–15:00" style summary of a schedule. */
export function scheduleSummary(schedule: Schedule): string {
  const parts: string[] = []
  let run: { start: string; end: string; text: string } | null = null
  for (const [day, label] of DAY_LABELS) {
    const text = (schedule[day] || []).map((w) => `${w.from}–${w.to}`).join(', ')
    if (run && text && run.text === text) {
      run.end = label
      continue
    }
    if (run) parts.push(`${run.start === run.end ? run.start : `${run.start}–${run.end}`} ${run.text}`)
    run = text ? { start: label, end: label, text } : null
  }
  if (run) parts.push(`${run.start === run.end ? run.start : `${run.start}–${run.end}`} ${run.text}`)
  return parts.join(' · ') || 'No times set'
}

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const COMPANY_KINDS: [string, string][] = [
  ['hospital', 'Hospital or clinic'],
  ['university', 'University faculty or department'],
  ['school', 'School'],
  ['business', 'Business'],
  ['ngo', 'NGO'],
  ['government', 'Government office'],
  ['other', 'Something else'],
]
