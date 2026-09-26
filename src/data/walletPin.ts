/* ═══════════════════════════════════════════════════════════════════════
   The wallet PIN: the second step on every payment from the wallet
   (checkout, bills, event tickets). The backend checks it on each of those;
   these calls only set it up, change it, check it and reset it.
   ═══════════════════════════════════════════════════════════════════════ */

import { Api } from '../lib/api'
import { asString } from '../lib/format'

export interface PinStatus {
  pinSet: boolean
  /** ISO time the lock lifts, while five wrong PINs have it locked. */
  lockedUntil: string | null
}

/** Refusal codes the backend sends, so a screen can react to each. */
export const PIN_CODES = {
  notSet: 'PIN_NOT_SET',
  required: 'PIN_REQUIRED',
  invalid: 'PIN_INVALID',
  locked: 'PIN_LOCKED',
  alreadySet: 'PIN_ALREADY_SET',
} as const

export async function pinStatus(): Promise<PinStatus> {
  const data = await Api.get('/api/wallet/pin')
  return {
    pinSet: Boolean(data.pinSet),
    lockedUntil: asString(data.pinLockedUntil) || null,
  }
}

export async function setUpPin(pin: string): Promise<void> {
  await Api.post('/api/wallet/pin/setup', { body: { pin } })
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await Api.post('/api/wallet/pin/change', { body: { currentPin, newPin } })
}

/** Throws with code PIN_INVALID or PIN_LOCKED when it is not right. */
export async function checkPin(pin: string): Promise<void> {
  await Api.post('/api/wallet/pin/verify', { body: { pin } })
}

/** Emails a 6-digit code. Returns the masked address it went to. */
export async function requestPinReset(): Promise<string> {
  const data = await Api.post('/api/wallet/pin/reset-request')
  return asString(data.emailMasked)
}

export async function resetPin(otp: string, newPin: string): Promise<void> {
  await Api.post('/api/wallet/pin/reset', { body: { otp, newPin } })
}
