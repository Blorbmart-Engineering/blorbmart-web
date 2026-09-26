/* ═══════════════════════════════════════════════════════════════════════
   The wallet PIN, on the wallet screen: whether it is on, and the way to
   create, change or reset it without having to start a payment first.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { pinStatus, type PinStatus } from '../data/walletPin'
import { Button } from '../ui/Button'
import { Card, Skeleton } from '../ui/kit'
import { useWalletPin } from './WalletPinSheet'

export function WalletPinCard() {
  const [status, setStatus] = useState<PinStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const walletPin = useWalletPin()

  const load = useCallback(() => {
    pinStatus()
      .then((s) => {
        setStatus(s)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [])

  useEffect(load, [load])

  const run = async (start: 'setup' | 'change' | 'reset') => {
    await walletPin.manage(start)
    load()
  }

  if (failed) return null
  if (!status) return <Skeleton height={112} radius="var(--radius-lg)" />

  const on = status.pinSet
  const locked = Boolean(status.lockedUntil)

  return (
    <>
      <Card>
        <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              background: on && !locked ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
              color: on && !locked ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {on && !locked ? <ShieldCheck size={20} aria-hidden /> : <ShieldAlert size={20} aria-hidden />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h4">
              {locked ? 'Wallet PIN locked' : on ? 'Wallet PIN is on' : 'Protect your wallet'}
            </div>
            <div className="t-caption" style={{ marginTop: 2 }}>
              {locked
                ? 'Too many wrong PINs. Reset it by email to pay from your wallet again.'
                : on
                  ? 'Every payment from your wallet asks for your 4-digit PIN.'
                  : 'Set a 4-digit PIN so nobody else can spend your balance.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
          {!on && <Button label="Create PIN" size="md" onClick={() => void run('setup')} />}
          {on && !locked && (
            <Button label="Change PIN" kind="outline" size="md" onClick={() => void run('change')} />
          )}
          {on && (
            <Button
              label={locked ? 'Reset PIN' : 'Forgot PIN?'}
              kind={locked ? 'brand' : 'ghost'}
              size="md"
              onClick={() => void run('reset')}
            />
          )}
        </div>
      </Card>

      {walletPin.sheet}
    </>
  )
}
