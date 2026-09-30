/**
 * Invite links — /api/referrals on the backend.
 *
 * Every customer has one: shop.blorbmart.com.ng/invite/<code>. Opening it
 * remembers the code on this device, and the first time an account is signed
 * in here afterwards the code is sent to the server, which records who
 * invited whom. Whether anybody is paid for that is the server's call — this
 * side only carries the code.
 */

import { Api, ApiError } from '../lib/api'
import { SITE } from '../lib/seo'

const PENDING_KEY = 'blorb_referral_code_v1'

export interface ReferralOverview {
  referralCode: string
  referralLink: string
  referralCount: number
  referralEarnings: number
  referredByCode: string | null
  rewardsLive: boolean
  rewardNaira: number
}

export const cleanReferralCode = (value: string | null | undefined) =>
  String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16)

export const inviteLink = (code: string) => `${SITE}/invite/${code}`

/* ── The code this device arrived with ────────────────────────────────── */

export function rememberReferral(code: string | null | undefined): void {
  const clean = cleanReferralCode(code)
  if (!clean) return
  try {
    localStorage.setItem(PENDING_KEY, clean)
  } catch {
    // Private mode: the code is lost, the signup is not.
  }
}

export function pendingReferral(): string {
  try {
    return cleanReferralCode(localStorage.getItem(PENDING_KEY))
  } catch {
    return ''
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* nothing to clear */
  }
}

/* ── Server ───────────────────────────────────────────────────────────── */

export const referralApi = {
  async me(): Promise<ReferralOverview> {
    const d = await Api.get('/api/referrals/me')
    const code = String(d.referralCode ?? '')
    return {
      referralCode: code,
      referralLink: String(d.referralLink || inviteLink(code)),
      referralCount: Number(d.referralCount ?? 0),
      referralEarnings: Number(d.referralEarnings ?? 0),
      referredByCode: d.referredByCode ? String(d.referredByCode) : null,
      rewardsLive: d.rewardsLive === true,
      rewardNaira: Number(d.buyerReferralRewardNaira ?? 0),
    }
  },

  apply: (code: string) => Api.post('/api/referrals/apply', { body: { code } }),
}

let applying = false

/**
 * Sends the remembered code, if there is one, for the signed-in account.
 *
 * Called once the profile document exists — not on the auth event, which
 * fires before a new account's documents are written, and the server would
 * answer "account not found" and the code would be thrown away.
 *
 * A refusal (own code, unknown code, an account too old to be referred) is
 * final, so the code is dropped. A network failure or a sleeping backend is
 * not, so it stays for the next visit.
 */
export async function applyPendingReferral(): Promise<void> {
  const code = pendingReferral()
  if (!code || applying) return
  applying = true
  try {
    await referralApi.apply(code)
    clearPendingReferral()
  } catch (e) {
    const status = e instanceof ApiError ? e.statusCode : undefined
    if (status === 400 || status === 403 || status === 404) clearPendingReferral()
    console.debug('[referral] not applied', e)
  } finally {
    applying = false
  }
}
