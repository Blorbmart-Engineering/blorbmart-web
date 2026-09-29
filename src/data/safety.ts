/**
 * SOS and the emergency contact — routes/safety.js on the backend.
 *
 * The server works out who is on the other end of the order and which campus
 * to page; the app only says where it is and which order it is looking at.
 */

import { Api } from '../lib/api'
import { asString } from '../lib/format'

export interface SosCallList {
  /** The national emergency number — 112 in Nigeria. */
  emergency: string
  /** A staffed Blorbmart line, when there is one. */
  hotline: string | null
  /** The campus head of operations, when the campus has one with a phone. */
  campusOps: { name: string; phone: string } | null
}

export interface SosState {
  alertId: string
  status: 'open' | 'acknowledged' | 'resolved'
  call: SosCallList
}

export interface EmergencyContact {
  name: string
  phone: string
}

function callListFrom(raw: unknown): SosCallList {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ops = c.campusOps && typeof c.campusOps === 'object' ? (c.campusOps as Record<string, unknown>) : null
  return {
    emergency: asString(c.emergency, '112'),
    hotline: asString(c.hotline) || null,
    campusOps: ops && asString(ops.phone) ? { name: asString(ops.name, 'Campus operations'), phone: asString(ops.phone) } : null,
  }
}

function stateFrom(data: Record<string, unknown>): SosState | null {
  const alertId = asString(data.alertId)
  if (!alertId) return null
  const status = asString(data.status, 'open')
  return {
    alertId,
    status: status === 'acknowledged' || status === 'resolved' ? status : 'open',
    call: callListFrom(data.call),
  }
}

/**
 * Where the phone is, or null. Never waits long and never throws: an alert
 * without a location still reaches a person, an alert stuck behind a GPS fix
 * does not reach anyone.
 */
export function currentPosition(timeoutMs = 6000): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs + 500)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy })
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}

/** Raises an SOS, or refreshes the one already open. Throws ApiError. */
export async function raiseSos(orderDocId: string | null, note?: string): Promise<SosState> {
  const location = await currentPosition()
  const data = await Api.post('/api/safety/sos', {
    body: { as: 'buyer', orderDocId, location, note: note || undefined },
  })
  const state = stateFrom(data)
  if (!state) throw new Error('Could not send your alert. Call 112 if you are in danger.')
  return state
}

/** The caller's open alert, if there is one. Null on any failure. */
export async function mySos(): Promise<SosState | null> {
  try {
    return stateFrom(await Api.get('/api/safety/sos/mine'))
  } catch {
    return null
  }
}

export async function markSafe(alertId: string): Promise<void> {
  await Api.post(`/api/safety/sos/${encodeURIComponent(alertId)}/safe`)
}

export async function emergencyContact(): Promise<EmergencyContact | null> {
  const data = await Api.get('/api/safety/emergency-contact')
  const phone = asString(data.phone)
  return phone ? { name: asString(data.name), phone } : null
}

/** An empty phone clears it. Throws ApiError with a message fit to show. */
export async function saveEmergencyContact(name: string, phone: string): Promise<EmergencyContact | null> {
  const data = await Api.post('/api/safety/emergency-contact', { body: { name, phone } })
  const saved = asString(data.phone)
  return saved ? { name: asString(data.name), phone: saved } : null
}
