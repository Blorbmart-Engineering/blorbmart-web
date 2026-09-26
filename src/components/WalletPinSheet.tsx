/* ═══════════════════════════════════════════════════════════════════════
   The wallet PIN sheet.

   One sheet for every PIN job: confirming a wallet payment, creating the PIN
   the first time someone pays from the wallet, changing it, and getting back
   in by email when it is forgotten or locked. Screens do not render it
   themselves — they call `useWalletPin()` and await the PIN.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Delete, Lock, Mail, ShieldCheck } from 'lucide-react'
import {
  PIN_CODES,
  changePin,
  checkPin,
  pinStatus,
  requestPinReset,
  resetPin,
  setUpPin,
} from '../data/walletPin'
import { ApiError } from '../lib/api'
import { Button } from '../ui/Button'
import { showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'

export type PinStart = 'pay' | 'setup' | 'change' | 'reset'

/** What a new PIN is being chosen for, which decides the call that saves it. */
type NewPinFor = 'setup' | 'change' | 'reset'

type Step =
  | { kind: 'loading' }
  | { kind: 'enter' }
  | { kind: 'current' }
  | { kind: 'create'; purpose: NewPinFor; first?: string }
  | { kind: 'reset-send' }
  | { kind: 'reset-code'; email: string }
  | { kind: 'locked' }

const messageOf = (e: unknown, fallback: string) =>
  e instanceof ApiError || e instanceof Error ? e.message || fallback : fallback

const codeOf = (e: unknown) => (e instanceof ApiError ? e.code : undefined)

/* ── The keypad ─────────────────────────────────────────────────────────── */

function PinPad({
  length,
  value,
  onChange,
  disabled,
}: {
  length: number
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  // A laptop has a keyboard; making someone click digits there is silly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      if (/^\d$/.test(e.key) && value.length < length) onChange(value + e.key)
      else if (e.key === 'Backspace') onChange(value.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, length, onChange, value])

  const press = (digit: string) => {
    if (disabled || value.length >= length) return
    onChange(value + digit)
  }

  const key = (label: ReactNode, onClick: () => void, aria: string) => (
    <button
      type="button"
      aria-label={aria}
      disabled={disabled}
      onClick={onClick}
      className="press t-h2"
      style={{
        height: 58,
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface-sunken)',
        color: 'var(--color-ink)',
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div
        aria-live="polite"
        aria-label={`${value.length} of ${length} digits entered`}
        style={{ display: 'flex', justifyContent: 'center', gap: 'var(--gap-md)', margin: 'var(--gap-xl) 0' }}
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: i < value.length ? 'var(--color-brand)' : 'transparent',
              border: `2px solid ${i < value.length ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
              transition: 'background var(--dur-fast)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-sm)' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => press(d), d))}
        <span />
        {key('0', () => press('0'), '0')}
        {key(<Delete size={22} />, () => onChange(value.slice(0, -1)), 'Delete')}
      </div>
    </div>
  )
}

/* ── The sheet ──────────────────────────────────────────────────────────── */

interface SheetProps {
  open: boolean
  start: PinStart
  /** "₦2,500" — shown while confirming a payment. */
  amountLabel?: string
  onClose: () => void
  /** Called with the PIN that is now valid: entered, created or reset. */
  onDone: (pin: string) => void
}

export function WalletPinSheet({ open, start, amountLabel, onClose, onDone }: SheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const currentPin = useRef('')
  const otp = useRef('')

  const go = useCallback((next: Step, message = '') => {
    setStep(next)
    setValue('')
    setError(message)
  }, [])

  // Where the sheet begins. Paying looks the PIN up first: someone who has
  // never set one creates it here, and a locked one goes straight to reset.
  useEffect(() => {
    if (!open) return
    if (start === 'setup') return go({ kind: 'create', purpose: 'setup' })
    if (start === 'change') return go({ kind: 'current' })
    if (start === 'reset') return go({ kind: 'reset-send' })
    go({ kind: 'loading' })
    pinStatus()
      .then((s) => {
        if (s.lockedUntil) go({ kind: 'locked' })
        else if (!s.pinSet) go({ kind: 'create', purpose: 'setup' })
        else go({ kind: 'enter' })
      })
      .catch((e) => {
        showToast(messageOf(e, 'Could not load your PIN settings.'), 'danger')
        onClose()
      })
  }, [open, start, go, onClose])

  const refused = (e: unknown, back: Step) => {
    if (codeOf(e) === PIN_CODES.locked) return go({ kind: 'locked' })
    go(back, messageOf(e, 'That did not work. Try again.'))
  }

  const saveNewPin = async (purpose: NewPinFor, pin: string) => {
    setBusy(true)
    try {
      if (purpose === 'setup') await setUpPin(pin)
      else if (purpose === 'change') await changePin(currentPin.current, pin)
      else await resetPin(otp.current, pin)
      showToast(purpose === 'setup' ? 'Wallet PIN created' : 'Wallet PIN updated', 'success')
      onDone(pin)
    } catch (e) {
      if (codeOf(e) === PIN_CODES.alreadySet) {
        go({ kind: 'enter' }, 'You already have a wallet PIN. Enter it to continue.')
      } else if (purpose === 'reset') {
        // Almost always the emailed code; send them back to type it again.
        go({ kind: 'reset-code', email: '' }, messageOf(e, 'That code did not work.'))
      } else if (purpose === 'change') {
        refused(e, { kind: 'current' })
      } else {
        go({ kind: 'create', purpose }, messageOf(e, 'Could not save your PIN.'))
      }
    } finally {
      setBusy(false)
    }
  }

  // Each step acts the moment its last digit goes in.
  const onEntry = async (next: string) => {
    setValue(next)
    if (error) setError('')

    if (step.kind === 'reset-code') {
      if (next.length < 6) return
      otp.current = next
      return go({ kind: 'create', purpose: 'reset' })
    }
    if (next.length < 4) return

    if (step.kind === 'enter' || step.kind === 'current') {
      setBusy(true)
      try {
        await checkPin(next)
        if (step.kind === 'enter') return onDone(next)
        currentPin.current = next
        go({ kind: 'create', purpose: 'change' })
      } catch (e) {
        refused(e, step)
      } finally {
        setBusy(false)
      }
      return
    }

    if (step.kind === 'create') {
      if (!step.first) return go({ kind: 'create', purpose: step.purpose, first: next })
      if (step.first !== next) {
        return go({ kind: 'create', purpose: step.purpose }, 'Those PINs did not match. Start again.')
      }
      await saveNewPin(step.purpose, next)
    }
  }

  const sendCode = async () => {
    setBusy(true)
    try {
      const email = await requestPinReset()
      go({ kind: 'reset-code', email })
    } catch (e) {
      setError(messageOf(e, 'Could not send the code.'))
    } finally {
      setBusy(false)
    }
  }

  const heading = (() => {
    switch (step.kind) {
      case 'enter':
        return {
          title: 'Enter your wallet PIN',
          body: amountLabel ? `To pay ${amountLabel} from your wallet.` : 'To confirm this payment.',
        }
      case 'current':
        return { title: 'Enter your current PIN', body: 'Then you can choose a new one.' }
      case 'create':
        if (step.first) return { title: 'Confirm your PIN', body: 'Enter the same 4 digits again.' }
        return step.purpose === 'setup'
          ? {
              title: 'Create a wallet PIN',
              body: 'You will enter these 4 digits to approve every payment from your wallet.',
            }
          : { title: 'Choose a new PIN', body: 'Pick 4 digits that are hard to guess.' }
      case 'reset-send':
        return {
          title: 'Reset your PIN',
          body: 'We will email you a 6-digit code. Enter it here, then choose a new PIN.',
        }
      case 'reset-code':
        return {
          title: 'Enter the code',
          body: step.email
            ? `We sent a 6-digit code to ${step.email}. It expires in 10 minutes.`
            : 'Enter the 6-digit code from the email we sent you.',
        }
      case 'locked':
        return {
          title: 'Your PIN is locked',
          body: 'Too many wrong PINs. Reset it by email to use your wallet again now.',
        }
      default:
        return { title: 'Wallet PIN', body: '' }
    }
  })()

  const icon =
    step.kind === 'locked' ? <Lock size={24} /> : step.kind.startsWith('reset') ? <Mail size={24} /> : <ShieldCheck size={24} />

  const padLength = step.kind === 'reset-code' ? 6 : 4
  const showPad = step.kind === 'enter' || step.kind === 'current' || step.kind === 'create' || step.kind === 'reset-code'

  return (
    <Sheet open={open} onClose={busy ? () => undefined : onClose} title={undefined}>
      <div style={{ textAlign: 'center', paddingTop: 'var(--gap-sm)' }}>
        <div
          style={{
            width: 52,
            height: 52,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            background: step.kind === 'locked' ? 'var(--color-danger-soft)' : 'var(--color-brand-soft)',
            color: step.kind === 'locked' ? 'var(--color-danger)' : 'var(--color-brand)',
          }}
        >
          {icon}
        </div>
        <h2 className="t-h2" style={{ margin: 'var(--gap-md) 0 0' }}>
          {heading.title}
        </h2>
        {heading.body && (
          <p className="t-body-sm" style={{ margin: 'var(--gap-xs) 0 0', color: 'var(--color-ink-muted)' }}>
            {heading.body}
          </p>
        )}
      </div>

      {step.kind === 'loading' && (
        <p className="t-body-sm" style={{ textAlign: 'center', margin: 'var(--gap-xxl) 0' }}>
          Loading…
        </p>
      )}

      {showPad && <PinPad length={padLength} value={value} onChange={onEntry} disabled={busy} />}

      <p
        role="alert"
        className="t-body-sm"
        style={{
          minHeight: 20,
          margin: 'var(--gap-md) 0 0',
          textAlign: 'center',
          color: 'var(--color-danger)',
        }}
      >
        {busy && showPad ? 'Checking…' : error}
      </p>

      {step.kind === 'enter' && (
        <Button
          label="Forgot PIN?"
          kind="ghost"
          size="md"
          disabled={busy}
          onClick={() => go({ kind: 'reset-send' })}
          style={{ marginTop: 'var(--gap-sm)' }}
        />
      )}

      {step.kind === 'reset-code' && (
        <Button
          label="Send a new code"
          kind="ghost"
          size="md"
          disabled={busy}
          onClick={() => void sendCode()}
          style={{ marginTop: 'var(--gap-sm)' }}
        />
      )}

      {(step.kind === 'reset-send' || step.kind === 'locked') && (
        <Button
          label={step.kind === 'locked' ? 'Reset PIN by email' : 'Email me a code'}
          icon={<Mail size={18} />}
          busy={busy}
          onClick={() => (step.kind === 'locked' ? go({ kind: 'reset-send' }) : void sendCode())}
          style={{ marginTop: 'var(--gap-xl)' }}
        />
      )}
    </Sheet>
  )
}

/* ── The hook screens use ───────────────────────────────────────────────── */

/**
 * `const walletPin = useWalletPin()`, render `{walletPin.sheet}`, then
 * `const pin = await walletPin.ask('₦2,500')` before a wallet payment —
 * null means the customer backed out. `manage('change' | 'setup' | 'reset')`
 * runs the same sheet from the wallet screen.
 */
export function useWalletPin() {
  const [session, setSession] = useState<{ id: number; start: PinStart; amountLabel?: string } | null>(null)
  const resolver = useRef<((pin: string | null) => void) | null>(null)

  const open = useCallback((start: PinStart, amountLabel?: string) => {
    resolver.current?.(null)
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve
      setSession({ id: Date.now(), start, amountLabel })
    })
  }, [])

  const finish = useCallback((pin: string | null) => {
    resolver.current?.(pin)
    resolver.current = null
    setSession(null)
  }, [])

  const close = useCallback(() => finish(null), [finish])

  const sheet = (
    <WalletPinSheet
      // A fresh sheet per prompt, so no step or half-typed PIN carries over.
      key={session?.id ?? 0}
      open={Boolean(session)}
      start={session?.start ?? 'pay'}
      amountLabel={session?.amountLabel}
      onClose={close}
      onDone={finish}
    />
  )

  return {
    sheet,
    ask: useCallback((amountLabel?: string) => open('pay', amountLabel), [open]),
    manage: useCallback((start: Exclude<PinStart, 'pay'>) => open(start), [open]),
  }
}
