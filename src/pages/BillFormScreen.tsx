/* ═══════════════════════════════════════════════════════════════════════
   Paying one bill — a port of lib/features/bills/bill_form_screen.dart.

   Which fields appear is decided entirely by the backend's `inputs` array, so
   a new biller with a different shape ships without an app release.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, LoaderCircle, Wallet } from 'lucide-react'
import { apiErrorMessage, warmUp } from '../lib/api'
import { asString, guessNetwork, money, normaliseNgPhone } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import {
  beneficiaries,
  catalog,
  newIdempotencyKey,
  purchase,
  serviceById,
  variations,
} from '../data/bills'
import { balance, watchLiveBalance } from '../data/wallet'
import {
  isVerifiable,
  needsAccount,
  needsAmount,
  needsMeterType,
  needsPhone,
  needsVariation,
  variationDetail,
  variationHeadline,
  type Beneficiary,
  type BillService,
  type BillVariation,
} from '../models/bills'
import { verifyCustomer } from '../data/bills'
import { Button } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'

const METER_TYPES = [
  { id: 'prepaid', label: 'Prepaid' },
  { id: 'postpaid', label: 'Postpaid' },
]

export default function BillFormScreen() {
  const { serviceKey = '' } = useParams()
  const navigate = useNavigate()

  const [service, setService] = useState<BillService | null>(null)
  const [missing, setMissing] = useState(false)
  const [bundles, setBundles] = useState<BillVariation[] | null>(null)
  const [saved, setSaved] = useState<Beneficiary[]>([])

  const [phone, setPhone] = useState('')
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [variation, setVariation] = useState<BillVariation | null>(null)
  const [meterType, setMeterType] = useState('prepaid')

  const [verifying, setVerifying] = useState(false)
  const [verifiedName, setVerifiedName] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [method, setMethod] = useState<PayMethod>('wallet')
  const [walletBalance, setWalletBalance] = useState(0)
  const [paying, setPaying] = useState(false)
  useBackFromPaystack(() => setPaying(false))
  const [error, setError] = useState<string | null>(null)

  // Minted once per screen and reused across retries, so a double tap on a
  // slow connection is charged once.
  const idempotencyKey = useRef(newIdempotencyKey())

  useEffect(() => {
    warmUp()
    void balance().then(setWalletBalance)
    void beneficiaries().then(setSaved)
    // Live, so a top-up finished in another tab is usable here at once.
    return watchLiveBalance(setWalletBalance)
  }, [])

  useEffect(() => {
    void catalog().then((data) => {
      const found = serviceById(data, serviceKey)
      if (!found) setMissing(true)
      else setService(found)
    })
  }, [serviceKey])

  useEffect(() => {
    if (!service || !needsVariation(service)) return
    setBundles(null)
    void variations(service.id)
      .then(setBundles)
      .catch(() => {
        setBundles([])
        showToast(`Could not load bundles for ${service.name}.`, 'danger')
      })
  }, [service])

  const payable = useMemo(() => {
    if (variation) return variation.amount
    return Number(amount.replace(/\D/g, '')) || 0
  }, [variation, amount])

  /** Confirms a meter or smartcard belongs to a real customer. */
  const runVerify = useCallback(async () => {
    if (!service || !isVerifiable(service)) return
    const target = account.trim()
    if (target.length < 6) return

    setVerifying(true)
    setVerifiedName(null)
    setVerifyError(null)
    try {
      const data = await verifyCustomer({
        serviceKey: service.id,
        accountNumber: target,
        meterType: needsMeterType(service) ? meterType : undefined,
      })
      const name = asString(data.customerName ?? data.name)
      if (name) setVerifiedName(name)
      else setVerifyError('We could not confirm that account.')
    } catch (e) {
      setVerifyError(apiErrorMessage(e, 'We could not confirm that account.'))
    } finally {
      setVerifying(false)
    }
  }, [service, account, meterType])

  // Debounced so typing a meter number does not fire a request per keystroke.
  useEffect(() => {
    if (!service || !isVerifiable(service)) return
    const id = setTimeout(() => void runVerify(), 700)
    return () => clearTimeout(id)
  }, [service, account, meterType, runVerify])

  const applyBeneficiary = (b: Beneficiary) => {
    if (service && needsPhone(service)) setPhone(b.target)
    else setAccount(b.target)
    if (b.lastAmount > 0) setAmount(String(b.lastAmount))
  }

  const network = needsPhone(service ?? ({ inputs: [] } as unknown as BillService))
    ? guessNetwork(phone)
    : null

  const ready = (() => {
    if (!service) return false
    if (needsPhone(service) && !normaliseNgPhone(phone)) return false
    if (needsAccount(service) && account.trim().length < 6) return false
    if (isVerifiable(service) && !verifiedName) return false
    if (needsVariation(service) && !variation) return false
    if (needsAmount(service) && !variation) {
      if (payable <= 0) return false
      if (service.min > 0 && payable < service.min) return false
      if (service.max > 0 && payable > service.max) return false
    }
    return payable > 0
  })()

  const pay = async () => {
    if (!service || !ready || paying) return

    if (method === 'wallet' && walletBalance < payable) {
      showToast(`Your wallet is short by ${money(payable - walletBalance)}.`, 'danger')
      return
    }

    setPaying(true)
    setError(null)
    try {
      const result = await purchase({
        serviceKey: service.id,
        paymentMethod: method,
        amount: needsAmount(service) && !variation ? payable : undefined,
        phone: needsPhone(service) ? (normaliseNgPhone(phone) ?? phone) : undefined,
        accountNumber: needsAccount(service) ? account.trim() : undefined,
        variationCode: variation?.code,
        meterType: needsMeterType(service) ? meterType : undefined,
        idempotencyKey: idempotencyKey.current,
      })

      if (result.authorizationUrl) {
        goToPaystack(result.authorizationUrl, {
          kind: 'bill',
          reference: result.reference,
          id: result.id,
          returnTo: `/bills/receipt/${result.id}`,
        })
        return
      }

      navigate(`/bills/receipt/${result.id}`, { replace: true })
    } catch (e) {
      setPaying(false)
      setError(
        apiErrorMessage(e, 'That purchase did not go through. You have not been charged.'),
      )
    }
  }

  if (missing) {
    return (
      <>
        <AppBar title="Not found" />
        <EmptyState
          title="That biller is gone"
          message="It may have been removed. Pick another from the bills screen."
          actionLabel="Back to bills"
          onAction={() => navigate('/bills')}
        />
      </>
    )
  }

  if (!service) {
    return (
      <>
        <AppBar title="Loading" />
        <ScreenBody padded>
          <Skeleton height={54} radius="var(--radius-md)" />
          <Skeleton height={54} radius="var(--radius-md)" style={{ marginTop: 12 }} />
          <Skeleton height={120} radius="var(--radius-md)" style={{ marginTop: 12 }} />
        </ScreenBody>
      </>
    )
  }

  const relevant = saved.filter((b) => b.serviceKey === service.id).slice(0, 4)

  return (
    <>
      <AppBar title={service.name} subtitle={service.accountLabel} />

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        {/* ── Saved numbers ──────────────────────────────────────────── */}
        {relevant.length > 0 && (
          <>
            <div className="t-overline" style={{ margin: 'var(--gap-md) 0 var(--gap-sm)' }}>
              Recent
            </div>
            <div
              style={{
                display: 'flex',
                gap: 'var(--gap-sm)',
                overflowX: 'auto',
                marginBottom: 'var(--gap-lg)',
              }}
              className="no-scrollbar"
            >
              {relevant.map((b) => (
                <PressScale
                  key={`${b.serviceKey}-${b.target}`}
                  scale={0.95}
                  onClick={() => applyBeneficiary(b)}
                  className="t-label"
                  style={{
                    flexShrink: 0,
                    height: 38,
                    paddingInline: 'var(--gap-lg)',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    color: 'var(--color-ink-body)',
                  }}
                >
                  {b.target}
                </PressScale>
              ))}
            </div>
          </>
        )}

        {/* ── Phone ──────────────────────────────────────────────────── */}
        {needsPhone(service) && (
          <Field label="Phone number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter number"
              inputMode="tel"
              aria-label="Phone number"
              style={inputStyle}
            />
            {network && (
              <p className="t-caption" style={{ margin: '6px 0 0' }}>
                Looks like {network}
              </p>
            )}
            {phone.length > 3 && !normaliseNgPhone(phone) && (
              <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>
                Enter a valid number
              </p>
            )}
          </Field>
        )}

        {/* ── Meter type ─────────────────────────────────────────────── */}
        {needsMeterType(service) && (
          <Field label="Meter type">
            <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
              {METER_TYPES.map((type) => (
                <PressScale
                  key={type.id}
                  scale={0.96}
                  onClick={() => setMeterType(type.id)}
                  className="t-label"
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 'var(--radius-md)',
                    background:
                      meterType === type.id ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                    color:
                      meterType === type.id
                        ? 'var(--color-brand-ink)'
                        : 'var(--color-ink-body)',
                    border: `1px solid ${meterType === type.id ? 'var(--color-brand)' : 'var(--color-line)'}`,
                  }}
                >
                  {type.label}
                </PressScale>
              ))}
            </div>
          </Field>
        )}

        {/* ── Account ────────────────────────────────────────────────── */}
        {needsAccount(service) && (
          <Field label={service.accountLabel}>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={service.accountLabel}
              inputMode="numeric"
              aria-label={service.accountLabel}
              style={inputStyle}
            />
            {verifying && (
              <p
                className="t-caption"
                style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0' }}
              >
                <LoaderCircle
                  size={13}
                  aria-hidden
                  style={{ animation: 'blorb-spin 900ms linear infinite' }}
                />
                Checking that account…
              </p>
            )}
            {verifiedName && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                  marginTop: 'var(--gap-sm)',
                  padding: 'var(--gap-sm) var(--gap-md)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-success-soft)',
                }}
              >
                <BadgeCheck size={16} aria-hidden style={{ color: 'var(--color-success)' }} />
                <span style={{ minWidth: 0 }}>
                  <span
                    className="t-caption-sm"
                    style={{ display: 'block', color: 'var(--color-success)' }}
                  >
                    ACCOUNT CONFIRMED
                  </span>
                  <span className="t-label clamp-1" style={{ display: 'block' }}>
                    {verifiedName}
                  </span>
                </span>
              </div>
            )}
            {verifyError && (
              <p className="t-caption" style={{ margin: '8px 0 0', color: 'var(--color-danger)' }}>
                {verifyError}
              </p>
            )}
          </Field>
        )}

        {/* ── Bundles ────────────────────────────────────────────────── */}
        {needsVariation(service) && (
          <Field label="Choose a bundle">
            {bundles === null ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={72} radius="var(--radius-md)" />
                ))}
              </div>
            ) : bundles.length === 0 ? (
              <EmptyState
                title="No bundles available"
                message="This operator has no plans listed right now. Try again shortly."
                compact
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {bundles.map((bundle) => {
                  const chosen = variation?.code === bundle.code
                  return (
                    <PressScale
                      key={bundle.code}
                      scale={0.96}
                      onClick={() => setVariation(bundle)}
                      style={{
                        display: 'block',
                        padding: 'var(--gap-md)',
                        borderRadius: 'var(--radius-md)',
                        background: chosen ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                        border: `1px solid ${chosen ? 'var(--color-brand)' : 'var(--color-line)'}`,
                        textAlign: 'left',
                      }}
                    >
                      <span className="t-h4 clamp-1" style={{ display: 'block' }}>
                        {variationHeadline(bundle)}
                      </span>
                      {variationDetail(bundle) && (
                        <span className="t-caption-sm clamp-1" style={{ display: 'block' }}>
                          {variationDetail(bundle)}
                        </span>
                      )}
                      <span
                        className="t-price-sm"
                        style={{ display: 'block', marginTop: 6, color: 'var(--color-brand)' }}
                      >
                        {money(bundle.amount)}
                      </span>
                    </PressScale>
                  )
                })}
              </div>
            )}
          </Field>
        )}

        {/* ── Amount ─────────────────────────────────────────────────── */}
        {needsAmount(service) && !variation && (
          <Field label="Amount">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-sm)',
                height: 'var(--size-input)',
                paddingInline: 'var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line-strong)',
              }}
            >
              <span className="t-h3" style={{ color: 'var(--color-ink-muted)' }}>
                ₦
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter an amount"
                inputMode="numeric"
                aria-label="Amount"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                }}
              />
            </div>
            {(service.min > 0 || service.max > 0) && (
              <p className="t-caption" style={{ margin: '6px 0 0' }}>
                {money(service.min)} – {money(service.max)}
              </p>
            )}
          </Field>
        )}

        {/* ── Payment ────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          Pay with
        </div>
        <PaymentMethodTile
          method="wallet"
          selected={method === 'wallet'}
          onSelect={() => setMethod('wallet')}
          title="Blorbmart wallet"
          subtitle={`Balance ${money(walletBalance)}`}
          disabled={payable > 0 && walletBalance < payable}
          disabledReason={
            payable > 0 && walletBalance < payable
              ? `Short by ${money(payable - walletBalance)}`
              : undefined
          }
          icon={<Wallet size={20} aria-hidden />}
        />
        <div style={{ height: 'var(--gap-sm)' }} />
        <PaymentMethodTile
          method="paystack"
          selected={method === 'paystack'}
          onSelect={() => setMethod('paystack')}
          title="Card or transfer"
          subtitle="Secured by Paystack"
        />

        <p className="t-caption" style={{ marginTop: 'var(--gap-lg)', textAlign: 'center' }}>
          If delivery fails, you are refunded automatically.
        </p>

        {error && (
          <p
            role="alert"
            className="t-body-sm"
            style={{
              margin: 'var(--gap-lg) 0 0',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}
      </ScreenBody>

      <StickyFooter>
        <Button
          label={payable > 0 ? `Pay ${money(payable)}` : 'Enter an amount'}
          disabled={!ready}
          busy={paying}
          glow
          onClick={() => void pay()}
        />
      </StickyFooter>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 'var(--size-input)',
  paddingInline: 'var(--gap-lg)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line-strong)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--gap-lg)' }}>
      <div className="t-label-sm" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
