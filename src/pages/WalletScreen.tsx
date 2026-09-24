/* ═══════════════════════════════════════════════════════════════════════
   The wallet — a port of lib/features/wallet/wallet_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ReceiptText,
  RotateCw,
  Wallet,
} from 'lucide-react'
import { apiErrorMessage, warmUp } from '../lib/api'
import { asString, money, timeAgo } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import {
  balance,
  cancelTopUp,
  entryCanComplete,
  entryIsCredit,
  entryIsUnsettled,
  entryStatusLabel,
  entryTitle,
  startTopUp,
  transactions,
  watchLiveBalance,
  type WalletEntry,
} from '../data/wallet'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { EmptyState, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor, useAnimatedNumber } from '../ui/motion'
import { Sheet } from '../ui/Sheet'
import { ScreenBody, showToast } from '../ui/Screen'
import { TransferAccountCard } from '../components/TransferAccountCard'

const PRESETS = [1000, 2000, 5000, 10000]

export default function WalletScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)

  const [amount, setAmount] = useState(0)
  const [entries, setEntries] = useState<WalletEntry[] | null>(null)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const animated = useAnimatedNumber(amount)

  const load = useCallback(async (refresh = false) => {
    const [value, list] = await Promise.all([balance(refresh), transactions(20)])
    setAmount(value)
    setEntries(list)
  }, [])

  useEffect(() => {
    if (!signedIn) {
      setEntries([])
      return
    }
    // Waking the host while the customer looks at their balance moves the cold
    // start out of the tap that is supposed to open Paystack.
    warmUp()
    void load()
  }, [signedIn, load])

  // The balance follows the wallet document, and the list below it is re-read
  // whenever the balance moves — a top-up or a refund shows up on this screen
  // without a reload (QA-BM-WEB-002, item 5).
  useEffect(() => {
    if (!signedIn) return
    let first = true
    return watchLiveBalance((value) => {
      setAmount(value)
      if (first) {
        first = false
        return
      }
      void transactions(20).then(setEntries)
    })
  }, [signedIn])

  if (!signedIn) {
    return (
      <ScreenBody bottomGap="150px">
        <div style={{ paddingTop: 'calc(var(--safe-top) + var(--gap-xl))' }}>
          <EmptyState
            title="Sign in to use your wallet"
            message="Top up once and pay for orders and bills in one tap."
            icon={<Wallet size={30} aria-hidden />}
            actionLabel="Sign in"
            onAction={() => navigate('/login', { state: { from: '/wallet' } })}
          />
        </div>
      </ScreenBody>
    )
  }

  const unsettled = (entries ?? []).filter(entryIsUnsettled)

  return (
    <>
      <ScreenBody bottomGap="150px">
        {/* ── Balance ────────────────────────────────────────────────── */}
        <div
          style={{
            padding:
              'calc(var(--safe-top) + var(--gap-xxl)) var(--gap-page) var(--gap-xxl)',
            background: 'var(--gradient-brand)',
            borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
            color: '#fff',
          }}
        >
          <div className="t-overline" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Wallet balance
          </div>
          <div
            className="t-display-md"
            style={{ color: '#fff', margin: 'var(--gap-xs) 0 var(--gap-xl)' }}
          >
            {money(animated)}
          </div>

          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            <Button
              label="Top up"
              kind="outline"
              size="md"
              icon={<Plus size={18} aria-hidden />}
              onClick={() => setTopUpOpen(true)}
            />
            <Button
              label="History"
              kind="outline"
              size="md"
              icon={<ReceiptText size={18} aria-hidden />}
              onClick={() => navigate('/transactions')}
            />
          </div>
        </div>

        {/* ── Bank transfer account ──────────────────────────────────── */}
        <div style={{ padding: 'var(--gap-xl) var(--gap-page) 0' }}>
          <TransferAccountCard onFunded={() => void load(true)} />
        </div>

        {/* ── Unfinished top-ups ─────────────────────────────────────── */}
        {unsettled.length > 0 && (
          <>
            <SectionHeader
              title="Unfinished top-ups"
              subtitle="Nothing was charged for these"
            />
            <div style={{ paddingInline: 'var(--gap-page)' }}>
              {unsettled.map((entry) => (
                <UnsettledRow key={entry.id} entry={entry} onDone={() => void load(true)} />
              ))}
            </div>
          </>
        )}

        {/* ── Recent activity ────────────────────────────────────────── */}
        <SectionHeader
          title="Recent activity"
          actionLabel="See all"
          onAction={() => navigate('/transactions')}
        />

        <div style={{ paddingInline: 'var(--gap-page)' }}>
          {entries === null ? (
            [0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                height={62}
                radius="var(--radius-md)"
                style={{ marginBottom: 'var(--gap-sm)' }}
              />
            ))
          ) : entries.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              message="Top up your wallet and every order, bill and ticket becomes one tap."
              icon={<Wallet size={28} aria-hidden />}
              compact
              actionLabel="Top up"
              onAction={() => setTopUpOpen(true)}
            />
          ) : (
            entries
              .slice(0, 8)
              .map((entry, i) => (
                <FadeSlideIn key={entry.id} delay={staggerFor(i, 5)}>
                  <EntryRow entry={entry} />
                </FadeSlideIn>
              ))
          )}
        </div>
      </ScreenBody>

      <TopUpSheet open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </>
  )
}

export function EntryRow({ entry }: { entry: WalletEntry }) {
  const credit = entryIsCredit(entry)
  const status = entryStatusLabel(entry)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        padding: 'var(--gap-md) 0',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          background: credit ? 'var(--color-success-soft)' : 'var(--color-surface-sunken)',
          color: credit ? 'var(--color-success)' : 'var(--color-ink-muted)',
        }}
      >
        {credit ? <ArrowDownLeft size={19} aria-hidden /> : <ArrowUpRight size={19} aria-hidden />}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {entryTitle(entry)}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {timeAgo(entry.at)}
          {status ? ` · ${status}` : ''}
        </span>
      </span>

      <span
        className="t-price"
        style={{ flexShrink: 0, color: credit ? 'var(--color-success)' : 'var(--color-ink)' }}
      >
        {credit ? '+' : '−'}
        {money(Math.abs(entry.amount))}
      </span>
    </div>
  )
}

function UnsettledRow({ entry, onDone }: { entry: WalletEntry; onDone: () => void }) {
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    try {
      const status = await cancelTopUp(entry.reference)
      // The backend checks with Paystack first, so a payment that actually
      // went through is credited rather than cancelled.
      showToast(
        status === 'completed'
          ? 'That payment did go through — your wallet has been credited.'
          : 'Top-up cancelled. Nothing was charged.',
        status === 'completed' ? 'success' : 'neutral',
      )
      onDone()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        padding: 'var(--gap-md)',
        marginBottom: 'var(--gap-sm)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-warning-soft)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {money(Math.abs(entry.amount))} top-up
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {entryStatusLabel(entry)} · {timeAgo(entry.at)}
        </span>
      </span>

      {entryCanComplete(entry) && (
        <Button
          label="Finish"
          size="sm"
          expand={false}
          onClick={() =>
            goToPaystack(entry.authorizationUrl, {
              kind: 'wallet',
              reference: entry.reference,
              id: '',
              returnTo: '/wallet',
            })
          }
        />
      )}
      <IconButton label="Cancel this top-up" size={36} onClick={() => void cancel()}>
        <RotateCw
          size={16}
          aria-hidden
          style={busy ? { animation: 'blorb-spin 900ms linear infinite' } : undefined}
        />
      </IconButton>
    </div>
  )
}

export function TopUpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBackFromPaystack(() => setBusy(false))

  useEffect(() => {
    if (open) warmUp()
  }, [open])

  const numeric = Number(value.replace(/\D/g, '')) || 0

  const submit = async () => {
    if (numeric < 100) {
      setError('The smallest top-up is ₦100.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await startTopUp(numeric)
      const url = asString(data.authorization_url ?? data.authorizationUrl)
      const reference = asString(data.reference)
      if (!url) throw new Error('Could not open the payment page.')
      goToPaystack(url, { kind: 'wallet', reference, id: '', returnTo: '/wallet' })
    } catch (e) {
      setError(apiErrorMessage(e, 'We could not start that top-up. Try again.'))
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Top up your wallet">
      <p className="t-body-sm" style={{ margin: '0 0 var(--gap-lg)' }}>
        Pay once, then orders and bills go through in a single tap.
      </p>

      {open && <TransferAccountCard onFunded={onClose} />}

      <div
        className="t-overline"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-md)',
          margin: 'var(--gap-xl) 0 var(--gap-lg)',
          color: 'var(--color-ink-faint)',
        }}
      >
        <span style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
        or pay with card
        <span style={{ flex: 1, height: 1, background: 'var(--color-line)' }} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          height: 64,
          paddingInline: 'var(--gap-lg)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-sunken)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-line-strong)'}`,
        }}
      >
        <span className="t-price-lg" style={{ color: 'var(--color-ink-muted)' }}>
          ₦
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          placeholder="0"
          inputMode="numeric"
          aria-label="Top-up amount"
          className="t-price-lg"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 24,
          }}
        />
      </div>

      {error && (
        <p className="t-caption" style={{ margin: '8px 0 0', color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--gap-sm)', margin: 'var(--gap-lg) 0' }}>
        {PRESETS.map((preset) => (
          <PressScale
            key={preset}
            scale={0.95}
            onClick={() => setValue(String(preset))}
            className="t-label"
            style={{
              flex: 1,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background:
                numeric === preset ? 'var(--color-brand-soft)' : 'var(--color-surface)',
              color: numeric === preset ? 'var(--color-brand-ink)' : 'var(--color-ink-body)',
              border: `1px solid ${numeric === preset ? 'var(--color-brand)' : 'var(--color-line)'}`,
            }}
          >
            {money(preset)}
          </PressScale>
        ))}
      </div>

      <Button
        label={numeric > 0 ? `Top up ${money(numeric)}` : 'Continue to payment'}
        busy={busy}
        disabled={numeric < 100}
        glow
        onClick={() => void submit()}
      />
    </Sheet>
  )
}
