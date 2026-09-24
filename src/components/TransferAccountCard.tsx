/* ═══════════════════════════════════════════════════════════════════════
   The customer's own bank account number for funding the wallet.

   A Paystack dedicated account at Titan: copy the number, send money from
   any bank app, and the wallet is credited when the transfer lands. No card,
   no OTP, no payment page — which is where most top-ups used to die.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Building2, Check, Copy } from 'lucide-react'
import { ApiError, apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import {
  checkForTransfer,
  openTransferAccount,
  transferAccount,
  type TransferAccount,
} from '../data/wallet'
import { Button } from '../ui/Button'
import { Card, Skeleton } from '../ui/kit'
import { showToast } from '../ui/Screen'

type Phase = 'loading' | 'none' | 'details' | 'ready' | 'error'

export function TransferAccountCard({ onFunded }: { onFunded?: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [account, setAccount] = useState<TransferAccount | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState({ firstName: '', lastName: '', phone: '' })

  useEffect(() => {
    let alive = true
    transferAccount()
      .then((found) => {
        if (!alive) return
        setAccount(found)
        setPhase(found ? 'ready' : 'none')
      })
      .catch(() => alive && setPhase('error'))
    return () => {
      alive = false
    }
  }, [])

  const open = async (withDetails = false) => {
    setBusy(true)
    setError(null)
    try {
      const opened = await openTransferAccount(withDetails ? details : undefined)
      setAccount(opened)
      setPhase('ready')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PROFILE_INCOMPLETE') {
        setPhase('details')
        if (withDetails) setError(e.message)
      } else {
        setError(apiErrorMessage(e, 'We could not open your account number. Try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account.accountNumber)
      setCopied(true)
      showToast('Account number copied', 'success')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Your browser blocked the clipboard — copy it by hand.', 'neutral')
    }
  }

  const check = async () => {
    setChecking(true)
    try {
      const amount = await checkForTransfer()
      if (amount > 0) {
        showToast(`${money(amount)} added to your wallet`, 'success')
        onFunded?.()
      } else {
        showToast('Not in yet. Transfers usually land within a minute — we will credit it automatically.', 'neutral')
      }
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card padding="var(--gap-lg)" border="var(--color-line)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--color-brand-soft)',
            color: 'var(--color-brand)',
          }}
        >
          <Building2 size={19} aria-hidden />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="t-h4" style={{ display: 'block' }}>
            Fund by bank transfer
          </span>
          <span className="t-caption" style={{ display: 'block' }}>
            Your own account number. Money sent here lands in your wallet.
          </span>
        </span>
      </div>

      <div style={{ marginTop: 'var(--gap-lg)' }}>
        {phase === 'loading' && <Skeleton height={74} radius="var(--radius-md)" />}

        {phase === 'error' && (
          <Button label="Try again" kind="soft" size="md" onClick={() => void open()} busy={busy} />
        )}

        {phase === 'none' && (
          <Button
            label="Get my account number"
            kind="soft"
            size="md"
            busy={busy}
            onClick={() => void open()}
          />
        )}

        {phase === 'details' && (
          <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
            <p className="t-body-sm" style={{ margin: 0 }}>
              The bank needs your name and phone number to open the account.
            </p>
            <DetailInput
              label="First name"
              value={details.firstName}
              autoComplete="given-name"
              onChange={(v) => setDetails((d) => ({ ...d, firstName: v }))}
            />
            <DetailInput
              label="Last name"
              value={details.lastName}
              autoComplete="family-name"
              onChange={(v) => setDetails((d) => ({ ...d, lastName: v }))}
            />
            <DetailInput
              label="Phone number"
              value={details.phone}
              inputMode="tel"
              autoComplete="tel"
              onChange={(v) => setDetails((d) => ({ ...d, phone: v.replace(/[^\d+ ]/g, '') }))}
            />
            <Button
              label="Open my account"
              size="md"
              busy={busy}
              disabled={
                !details.firstName.trim() ||
                !details.lastName.trim() ||
                details.phone.replace(/\D/g, '').length < 10
              }
              onClick={() => void open(true)}
            />
          </div>
        )}

        {phase === 'ready' && account && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-md)',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-sunken)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-caption clamp-1" style={{ display: 'block' }}>
                  {account.bankName}
                </span>
                <span
                  className="t-price-lg"
                  style={{ display: 'block', letterSpacing: '0.06em', fontSize: 24 }}
                >
                  {account.accountNumber}
                </span>
                <span className="t-caption clamp-1" style={{ display: 'block' }}>
                  {account.accountName}
                </span>
              </span>
              <Button
                label={copied ? 'Copied' : 'Copy'}
                kind={copied ? 'soft' : 'brand'}
                size="sm"
                expand={false}
                icon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                onClick={() => void copy()}
              />
            </div>
            <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 var(--gap-md)' }}>
              Send any amount from your bank app. It usually shows up within a minute.
            </p>
            <Button
              label="I've sent the money"
              kind="outline"
              size="md"
              busy={checking}
              onClick={() => void check()}
            />
          </>
        )}

        {error && (
          <p className="t-caption" style={{ margin: '8px 0 0', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}

function DetailInput({
  label,
  value,
  onChange,
  inputMode,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  inputMode?: 'tel' | 'text'
  autoComplete?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className="t-body"
      style={{
        height: 48,
        paddingInline: 'var(--gap-lg)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-line-strong)',
        background: 'var(--color-surface)',
        outline: 'none',
        width: '100%',
      }}
    />
  )
}
