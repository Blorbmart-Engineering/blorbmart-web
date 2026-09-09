/* ═══════════════════════════════════════════════════════════════════════
   The one place the app talks to the Blorbmart backend.

   A port of lib/data/repos/api_client.dart. Responsibilities it takes off
   every caller:
     * attaching a fresh Firebase ID token;
     * a single retry on cold starts (the API is on a platform that sleeps,
       so the first request after idle can take 30s or fail outright);
     * unwrapping the {status, data, message} envelope the backend uses;
     * turning every failure into a sentence a person can read.
   ═══════════════════════════════════════════════════════════════════════ */

import { auth } from './firebase'
import { API_BASE_URL, TRUSTED_API_ORIGINS } from './config'

export const BASE_URL = API_BASE_URL

/**
 * Raised for any non-2xx response or transport failure. Carries a message
 * already fit to show a customer — the UI never has to translate.
 */
export class ApiError extends Error {
  readonly statusCode?: number
  readonly code?: string

  constructor(message: string, statusCode?: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }

  get isAuth(): boolean {
    return this.statusCode === 401 || this.statusCode === 403
  }

  get isNetwork(): boolean {
    return this.statusCode == null
  }
}

export type Json = Record<string, unknown>

const TIMEOUT_MS = 30_000

/**
 * Cached briefly so a screen firing three calls at once does not mint three
 * tokens. Firebase tokens last an hour; 50 minutes is a safe reuse window
 * that still refreshes well before expiry.
 */
let token: string | null = null
let tokenAt = 0
const TOKEN_TTL_MS = 50 * 60_000

/** When the host last answered — decides whether a wake-up ping is worth it. */
let awakeAt = 0
let warming: Promise<void> | null = null

export function invalidateToken(): void {
  token = null
  tokenAt = 0
}

async function idToken(force = false): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  const fresh = tokenAt > 0 && Date.now() - tokenAt < TOKEN_TTL_MS
  if (!force && fresh && token) return token
  try {
    token = await user.getIdToken(force)
    tokenAt = Date.now()
    return token
  } catch (e) {
    console.warn('[api] token refresh failed', e)
    return null
  }
}

/**
 * Wakes the API host ahead of a request that matters.
 *
 * The backend sleeps after idle, and its first request costs roughly twenty
 * seconds. Left alone, that bill is paid at the worst possible moment — the
 * tap that is supposed to open Paystack, where nothing on screen explains the
 * wait. Calling this as soon as a payment becomes likely (the wallet opening,
 * the top-up sheet opening) moves the wake-up into the seconds the customer
 * spends typing an amount.
 *
 * Fire-and-forget by design: unauthenticated, never throws, deduplicated
 * against concurrent callers, and skipped when the host answered recently.
 */
export function warmUp(): void {
  const recentlyAwake = awakeAt > 0 && Date.now() - awakeAt < 5 * 60_000
  if (recentlyAwake || warming) return
  warming = wake()
}

async function wake(): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 45_000)
    await fetch(`${BASE_URL}/health`, { signal: controller.signal })
    clearTimeout(timer)
    awakeAt = Date.now()
  } catch (e) {
    console.debug('[api] warmUp failed', e)
  } finally {
    warming = null
  }
}

function readableError(body: Json, status: number): string {
  const raw = body.message ?? body.error
  const message = typeof raw === 'string' ? raw.trim() : ''
  if (message && message.length < 180) return message

  if (status === 400) return 'That request was not valid. Please check and try again.'
  if (status === 401 || status === 403) return 'Please sign in again to continue.'
  if (status === 404) return 'We could not find that.'
  if (status === 409) return 'That has already been done.'
  if (status === 422) return 'Some details are missing or incorrect.'
  if (status === 429) return 'Too many attempts. Please wait a moment.'
  if (status >= 500) return 'Blorbmart is having a moment. Please try again shortly.'
  return 'Something went wrong. Please try again.'
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface SendOptions {
  body?: unknown
  query?: Record<string, string | undefined>
  auth?: boolean
  attempt?: number
  /** Returns the raw Response instead of the unwrapped envelope. */
  raw?: boolean
}

async function send(
  method: Method,
  path: string,
  options: SendOptions = {},
): Promise<Json> {
  const { body, query, auth: needsAuth = true, attempt = 0 } = options

  const url = new URL(`${BASE_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (needsAuth) {
    // Never let an absolute path or a redirect carry a bearer token off-site.
    if (!TRUSTED_API_ORIGINS.includes(url.origin)) {
      throw new ApiError('Refusing to send credentials to an untrusted host.')
    }
    const bearer = await idToken(attempt > 0)
    if (!bearer) throw new ApiError('Please sign in to continue.', 401)
    headers.Authorization = `Bearer ${bearer}`
  }

  let res: Response
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    // A sleeping backend wakes on the first request and answers the second.
    if (attempt === 0) {
      return send(method, path, { ...options, attempt: 1 })
    }
    if ((e as Error)?.name === 'AbortError') {
      throw new ApiError('That took too long. Check your connection and try again.')
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiError('No internet connection.')
    }
    throw new ApiError('Could not reach Blorbmart. Try again.')
  } finally {
    clearTimeout(timer)
  }

  // Any answer at all proves the host is up, so a wake-up ping would be
  // wasted for the next few minutes.
  awakeAt = Date.now()

  let decoded: Json = {}
  try {
    const parsed = await res.json()
    decoded =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Json)
        : { data: parsed }
  } catch {
    decoded = {}
  }

  if (res.ok) {
    const data = decoded.data
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Json
    if (data == null) return decoded
    return { data }
  }

  // An expired token deserves exactly one silent retry with a forced refresh.
  if (res.status === 401 && needsAuth && attempt === 0) {
    invalidateToken()
    return send(method, path, { ...options, attempt: 1 })
  }

  throw new ApiError(
    readableError(decoded, res.status),
    res.status,
    decoded.code == null ? undefined : String(decoded.code),
  )
}

export const Api = {
  get: (path: string, options: Omit<SendOptions, 'body'> = {}) =>
    send('GET', path, options),

  post: (path: string, options: SendOptions = {}) => send('POST', path, options),

  patch: (path: string, options: SendOptions = {}) => send('PATCH', path, options),

  put: (path: string, options: SendOptions = {}) => send('PUT', path, options),

  delete: (path: string, options: SendOptions = {}) => send('DELETE', path, options),

  warmUp,
  invalidateToken,

  /**
   * Fetches an authenticated file and hands back an object URL.
   *
   * Receipts used to be opened as `?token=<idToken>`, which writes a live
   * credential into browser history, the Referer header and any proxy log.
   * Caller must revokeObjectURL when done.
   */
  async blob(path: string): Promise<string> {
    const bearer = await idToken()
    if (!bearer) throw new ApiError('Please sign in to continue.', 401)
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (!res.ok) throw new ApiError('We could not open that document.', res.status)
    return URL.createObjectURL(await res.blob())
  },
}

/** Normalised, user-safe error text. Never surfaces a stack or a token. */
export function apiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message && err.message.length < 180) return err.message
  return fallback
}
