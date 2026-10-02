/* ═══════════════════════════════════════════════════════════════════════
   Marketplace earnings — what a student made selling, and where it goes.

   Two ways out: to a bank account (Paystack transfer, same as vendor and
   rider payouts), or into the Blorbmart wallet to spend on food and bills.
   Only sale money lives here, which is why it can go to a bank and the
   spending wallet cannot.

   Both moves, and changing the bank account, ask for the wallet PIN.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Building2, Landmark, Wallet } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { asDate, dayAndTime, money } from '../lib/format'
import {
  getEarnings,
  listBanks,
  moveEarnings,
  parseNaira,
  saveBank,
  verifyBank,
  withdrawEarnings,
  type Earnings,
} from '../data/marketplace'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'
import { Card, EmptyState, SectionHeader, Skeleton } from '../ui/kit'
import { useWalletPin } from '../components/WalletPinSheet'
import { Field } from '../components/marketplace/MarketParts'

type Open = 'withdraw' | 'move' | 'bank' | null

export default function MarketEarningsScreen() {
  const navigate = useNavigate()
  const walletPin = useWalletPin()
  const [data, setData] = useState<Earnings | null | undefined>(undefined)
  const [open, setOpen] = useState<Open>(null)

  const load = useCallback(async () => {
    try {
      setData(await getEarnings())
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (data === undefined) {
    return (
      <>
        <AppBar title="Earnings" />
        <ScreenBody padded>
          <Skeleton height={150} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-xl)' }} />
        </ScreenBody>
      </>
    )
  }

  if (data === null) {
    return (
      <>
        <AppBar title="Earnings" />
        <EmptyState title="Could not load your earnings" message="Check your connection and try again." actionLabel="Try again" onAction={() => void load()} />
      </>
    )
  }

  const canWithdraw = data.balance >= data.minWithdrawal

  return (
    <>
      <AppBar title="Marketplace earnings" />
      <ScreenBody padded bottomGap="var(--gap-giant)">
        <Card style={{ marginTop: 'var(--gap-xl)' }} color="var(--color-ink)" shadow="var(--shadow-md)" padding="var(--gap-xl)">
          <div className="t-caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Ready to withdraw
          </div>
          <div style={{ font: '800 34px/1.1 var(--font-sans)', color: '#fff', marginTop: 4 }}>{money(data.balance)}</div>
          <div className="t-caption" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            {money(data.totalEarned)} earned from sales so far
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
            <Button
              label="To my bank"
              size="md"
              icon={<Landmark size={16} aria-hidden />}
              disabled={data.balance <= 0}
              onClick={() => setOpen(data.bankAccount ? 'withdraw' : 'bank')}
            />
            <Button label="To my wallet" size="md" kind="soft" icon={<Wallet size={16} aria-hidden />} disabled={data.balance <= 0} onClick={() => setOpen('move')} />
          </div>
          {data.balance > 0 && !canWithdraw && (
            <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0', color: 'rgba(255,255,255,0.7)' }}>
              Bank withdrawals start at {money(data.minWithdrawal)}. You can move any amount to your wallet.
            </p>
          )}
        </Card>

        <Card style={{ marginTop: 'var(--gap-lg)' }} onClick={() => setOpen('bank')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
            <Building2 size={20} aria-hidden style={{ color: 'var(--color-ink-muted)' }} />
            <div style={{ flex: 1 }}>
              <div className="t-label">{data.bankAccount ? data.bankAccount.accountName : 'Add your bank account'}</div>
              <div className="t-caption">
                {data.bankAccount ? `${data.bankAccount.bankName} · ${data.bankAccount.accountMasked}` : 'Where your withdrawals go'}
              </div>
            </div>
            <span className="t-label" style={{ color: 'var(--color-brand)' }}>
              {data.bankAccount ? 'Change' : 'Add'}
            </span>
          </div>
        </Card>

        <SectionHeader title="History" padding="var(--gap-xxl) 0 var(--gap-md)" />
        {data.transactions.length === 0 ? (
          <EmptyState
            compact
            title="No sales yet"
            message="When something you listed sells, the money lands here."
            actionLabel="Sell something"
            onAction={() => navigate('/marketplace/sell')}
          />
        ) : (
          <Card padding="0 var(--gap-lg)">
            {data.transactions.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  padding: 'var(--gap-md) 0',
                  borderTop: i ? '1px solid var(--color-line)' : undefined,
                }}
              >
                {t.direction === 'in' ? (
                  <ArrowDownLeft size={18} aria-hidden style={{ color: 'var(--color-success)' }} />
                ) : (
                  <ArrowUpRight size={18} aria-hidden style={{ color: 'var(--color-ink-muted)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || (t.direction === 'in' ? 'Sale' : 'Withdrawal')}
                  </div>
                  <div className="t-caption-sm">{dayAndTime(asDate(t.createdAt))}</div>
                </div>
                <span className="t-price-sm" style={{ color: t.direction === 'in' ? 'var(--color-success)' : undefined }}>
                  {t.direction === 'in' ? '+' : '−'}
                  {money(t.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </ScreenBody>

      <AmountSheet
        open={open === 'withdraw'}
        title="Withdraw to your bank"
        note={data.bankAccount ? `To ${data.bankAccount.accountName}, ${data.bankAccount.bankName} ${data.bankAccount.accountMasked}. Most transfers land within minutes.` : ''}
        max={data.balance}
        min={data.minWithdrawal}
        cta="Withdraw"
        onClose={() => setOpen(null)}
        onSubmit={async (amount) => {
          const pin = await walletPin.ask(money(amount))
          if (!pin) return false
          await withdrawEarnings(amount, pin)
          showToast(`${money(amount)} is on its way to your bank.`, 'success')
          await load()
          return true
        }}
      />

      <AmountSheet
        open={open === 'move'}
        title="Move to your Blorbmart wallet"
        note="Spend it on food, bills and anything else on Blorbmart. Money in your wallet cannot be withdrawn to a bank."
        max={data.balance}
        min={1}
        cta="Move"
        onClose={() => setOpen(null)}
        onSubmit={async (amount) => {
          const pin = await walletPin.ask(money(amount))
          if (!pin) return false
          setData(await moveEarnings(amount, pin))
          showToast(`${money(amount)} moved to your wallet.`, 'success')
          return true
        }}
      />

      <BankSheet
        open={open === 'bank'}
        onClose={() => setOpen(null)}
        askPin={() => walletPin.ask()}
        onSaved={async () => {
          await load()
          setOpen(null)
        }}
      />

      {walletPin.sheet}
    </>
  )
}

function AmountSheet({
  open,
  title,
  note,
  max,
  min,
  cta,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  note: string
  max: number
  min: number
  cta: string
  onClose: () => void
  onSubmit: (amount: number) => Promise<boolean>
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const amount = parseNaira(typed)
  const problem = amount > max ? `You have ${money(max)}.` : amount > 0 && amount < min ? `The least is ${money(min)}.` : ''

  const submit = async () => {
    setBusy(true)
    try {
      if (await onSubmit(amount)) {
        setTyped('')
        onClose()
      }
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="t-body-sm" style={{ margin: 0 }}>
        {note}
      </p>
      <Field label="Amount" hint={problem || `Up to ${money(max)}`}>
        <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
          <input
            className="mkt-input"
            value={typed}
            inputMode="numeric"
            onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="₦"
          />
          <Button label="All" kind="soft" expand={false} onClick={() => setTyped(String(Math.floor(max)))} />
        </div>
      </Field>
      <Button
        label={amount > 0 ? `${cta} ${money(amount)}` : cta}
        style={{ marginTop: 'var(--gap-lg)' }}
        disabled={!(amount > 0) || Boolean(problem)}
        busy={busy}
        onClick={() => void submit()}
      />
    </Sheet>
  )
}

function BankSheet({
  open,
  onClose,
  askPin,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  askPin: () => Promise<string | null>
  onSaved: () => Promise<void>
}) {
  const [banks, setBanks] = useState<{ name: string; code: string }[] | null>(null)
  const [bankCode, setBankCode] = useState('')
  const [account, setAccount] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'verify' | 'save' | null>(null)

  useEffect(() => {
    if (!open || banks) return
    listBanks()
      .then((list) => setBanks(list.filter((b) => b.active !== false).sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => showToast(apiErrorMessage(e, 'Could not load the bank list.'), 'danger'))
  }, [open, banks])

  // A changed bank or number means the name shown no longer matches it.
  const resetName = () => setName('')
  const sorted = useMemo(() => banks ?? [], [banks])

  const verify = async () => {
    setBusy('verify')
    try {
      setName((await verifyBank(bankCode, account)).accountName)
    } catch (e) {
      showToast(apiErrorMessage(e, 'We could not find that account.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    const pin = await askPin()
    if (!pin) return
    setBusy('save')
    try {
      await saveBank(bankCode, account, pin)
      showToast('Bank account saved.', 'success')
      setAccount('')
      setName('')
      await onSaved()
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not save that account.'), 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your bank account">
      <p className="t-body-sm" style={{ margin: 0 }}>
        Withdrawals go here. It must be in your own name.
      </p>
      <Field label="Bank">
        <select
          className="mkt-input"
          value={bankCode}
          onChange={(e) => {
            setBankCode(e.target.value)
            resetName()
          }}
        >
          <option value="" disabled>
            {banks ? 'Choose your bank' : 'Loading banks…'}
          </option>
          {sorted.map((b) => (
            <option key={`${b.code}-${b.name}`} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Account number">
        <input
          className="mkt-input"
          value={account}
          inputMode="numeric"
          maxLength={10}
          onChange={(e) => {
            setAccount(e.target.value.replace(/\D/g, '').slice(0, 10))
            resetName()
          }}
          placeholder="10 digits"
        />
      </Field>
      {name && (
        <Card style={{ marginTop: 'var(--gap-md)' }} color="var(--color-success-soft)" shadow="none">
          <div className="t-caption">Account name</div>
          <div className="t-label-lg">{name}</div>
        </Card>
      )}
      <Button
        label={name ? 'Save this account' : 'Check account'}
        style={{ marginTop: 'var(--gap-lg)' }}
        disabled={!bankCode || account.length !== 10}
        busy={busy !== null}
        onClick={() => void (name ? save() : verify())}
      />
    </Sheet>
  )
}
