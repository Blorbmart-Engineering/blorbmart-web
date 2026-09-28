/* ═══════════════════════════════════════════════════════════════════════
   Paying one bill — a port of lib/features/bills/bill_form_screen.dart.

   Which fields appear is decided entirely by the backend's `inputs` array, so
   a new biller with a different shape ships without an app release.

   Built so nobody has to wonder what comes next:

     * three steps across the top — who, what, pay — tick themselves off as
       they are done;
     * the footer always names the next step, and its button goes there: it
       scrolls to the field and puts the cursor in it, rather than sitting
       greyed out with no explanation;
     * once a valid number is in, the keyboard goes away and the plans come
       up, because a keyboard over a list of forty bundles was where people
       got stuck;
     * the footer keeps what was chosen in view, so a long plan list never
       pushes "what am I paying for" off the screen.

   It opens on the catalogue and plans this device already has, and refreshes
   them behind the first frame.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Check, ChevronRight, Info, Wallet } from 'lucide-react'
import { apiErrorMessage, warmUp } from '../lib/api'
import { asString, guessNetwork, money, normaliseNgPhone } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import {
  beneficiaries,
  catalog,
  newIdempotencyKey,
  peekCatalog,
  peekVariations,
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
  ALL_PLANS,
  bundlePeriods,
  bundlesInPeriod,
  type BillVariation,
} from '../models/bills'
import { verifyCustomer } from '../data/bills'
import { Button } from '../ui/Button'
import { ChipRail, EmptyState, Skeleton } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'
import { Spinner } from '../ui/Loader'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'
import { useWalletPin } from '../components/WalletPinSheet'

const METER_TYPES = [
  { id: 'prepaid', label: 'Prepaid' },
  { id: 'postpaid', label: 'Postpaid' },
]

type StepId = 'who' | 'what' | 'pay'

function initialService(serviceKey: string): BillService | null {
  const cached = peekCatalog()
  return cached ? serviceById(cached, serviceKey) : null
}

export default function BillFormScreen() {
  const { serviceKey = '' } = useParams()
  const navigate = useNavigate()

  const [service, setService] = useState<BillService | null>(() => initialService(serviceKey))
  const [missing, setMissing] = useState(false)
  const [bundles, setBundles] = useState<BillVariation[] | null>(() => {
    const s = initialService(serviceKey)
    return s && needsVariation(s) ? peekVariations(s.id) : null
  })
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Beneficiary[]>([])

  const [phone, setPhone] = useState('')
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [variation, setVariation] = useState<BillVariation | null>(null)
  const [period, setPeriod] = useState(ALL_PLANS)
  /** The plan whose full details are open in a sheet. */
  const [details, setDetails] = useState<BillVariation | null>(null)
  const [meterType, setMeterType] = useState('prepaid')

  const [verifying, setVerifying] = useState(false)
  const [verifiedName, setVerifiedName] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [method, setMethod] = useState<PayMethod>('wallet')
  const [walletBalance, setWalletBalance] = useState(0)
  const [balanceKnown, setBalanceKnown] = useState(false)
  /** Whether card was chosen for the customer because the wallet was short. */
  const cardChosenForThem = useRef(false)
  const [paying, setPaying] = useState(false)
  const walletPin = useWalletPin()
  useBackFromPaystack(() => setPaying(false))
  const [error, setError] = useState<string | null>(null)
  /** The section the footer just sent the customer to, briefly lit. */
  const [nudged, setNudged] = useState<StepId | null>(null)

  const whoRef = useRef<HTMLDivElement>(null)
  const whatRef = useRef<HTMLDivElement>(null)
  const payRef = useRef<HTMLDivElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  const accountInput = useRef<HTMLInputElement>(null)
  const amountInput = useRef<HTMLInputElement>(null)

  // Minted once per screen and reused across retries, so a double tap on a
  // slow connection is charged once.
  const idempotencyKey = useRef(newIdempotencyKey())

  useEffect(() => {
    warmUp()
    void balance()
      .then(setWalletBalance)
      .finally(() => setBalanceKnown(true))
    void beneficiaries().then(setSaved)
    // Live, so a top-up finished in another tab is usable here at once.
    return watchLiveBalance(setWalletBalance)
  }, [])

  useEffect(() => {
    catalog()
      .then((data) => {
        const found = serviceById(data, serviceKey)
        if (!found) setMissing(true)
        else setService(found)
      })
      .catch(() => {
        // A stored catalogue already on screen stays usable offline; with
        // nothing stored, there is nothing to pay.
        if (!peekCatalog()) setMissing(true)
      })
  }, [serviceKey])

  // Keyed on the id, not the object: the refreshed catalogue hands back a new
  // object for the same biller, and that must not wipe a chosen plan.
  const serviceId = service?.id ?? null
  const hasPlans = service ? needsVariation(service) : false
  const serviceName = service?.name ?? ''
  useEffect(() => {
    if (!serviceId || !hasPlans) return
    setBundleError(null)
    const cached = peekVariations(serviceId)
    if (cached) setBundles(cached)
    void variations(serviceId)
      .then(setBundles)
      .catch((e) => {
        if (cached) return
        setBundles([])
        // The backend says why when it knows why — a biller the aggregator
        // has not switched on for us reads as "not available yet", which is
        // the truth and is more use than "could not load".
        const message = apiErrorMessage(e, `Could not load bundles for ${serviceName}.`)
        setBundleError(message)
        showToast(message, 'danger')
      })
  }, [serviceId, hasPlans, serviceName])

  /** The value being bought: the bundle price, or the amount typed in. */
  const payable = useMemo(() => {
    if (variation) return variation.amount
    return Number(amount.replace(/\D/g, '')) || 0
  }, [variation, amount])

  /**
   * The transaction fee, and what will actually leave the wallet.
   *
   * Charged on top of the value rather than taken out of it, so ₦500 of
   * airtime is still ₦500 of airtime. Nothing is added to an empty form — a
   * button reading "Pay ₦10" before anything has been chosen would be a lie.
   */
  const fee = service && payable > 0 ? service.fee : 0
  const total = payable + fee

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

  const network = service && needsPhone(service) ? guessNetwork(phone) : null
  const validPhone = normaliseNgPhone(phone)

  /* ── Where the customer is ────────────────────────────────────────────── */

  const whoDone = (() => {
    if (!service) return false
    if (needsPhone(service)) return Boolean(validPhone)
    if (needsAccount(service)) {
      if (account.trim().length < 6) return false
      return isVerifiable(service) ? Boolean(verifiedName) : true
    }
    return true
  })()

  const amountProblem = (() => {
    if (!service || variation || !needsAmount(service)) return null
    if (payable <= 0) return 'empty'
    if (service.min > 0 && payable < service.min) return `The least you can pay is ${money(service.min)}.`
    if (service.max > 0 && payable > service.max) return `The most you can pay is ${money(service.max)}.`
    return null
  })()

  const whatDone = (() => {
    if (!service) return false
    if (needsVariation(service)) return Boolean(variation)
    if (needsAmount(service)) return amountProblem === null
    return payable > 0
  })()

  const ready = whoDone && whatDone && payable > 0
  const walletShort = method === 'wallet' && total > 0 && walletBalance < total

  // A wallet that cannot cover this is not a choice, so card is chosen for
  // the customer rather than leaving a "wallet short" button in their way —
  // and handed back to the wallet if a cheaper plan brings it within reach.
  useEffect(() => {
    if (!balanceKnown || total <= 0) return
    if (method === 'wallet' && walletBalance < total) {
      cardChosenForThem.current = true
      setMethod('paystack')
    } else if (method === 'paystack' && cardChosenForThem.current && walletBalance >= total) {
      cardChosenForThem.current = false
      setMethod('wallet')
    }
  }, [balanceKnown, walletBalance, total, method])

  const whoLabel = service
    ? needsPhone(service)
      ? 'Phone number'
      : needsAccount(service)
        ? service.accountLabel
        : 'Details'
    : 'Details'
  const whatLabel = service && needsVariation(service) ? 'Bundle' : 'Amount'

  const current: StepId = !whoDone ? 'who' : !whatDone ? 'what' : 'pay'

  /** What the footer asks for when the form is not finished. */
  const nextAction = (() => {
    if (!service) return ''
    if (!whoDone) {
      if (needsPhone(service)) return phone ? 'Check the phone number' : 'Enter a phone number'
      if (verifying) return 'Checking the account…'
      if (account.trim().length >= 6 && verifyError) return `Check the ${service.accountLabel.toLowerCase()}`
      return `Enter the ${service.accountLabel.toLowerCase()}`
    }
    if (!whatDone) {
      if (needsVariation(service)) return 'Choose a bundle'
      return amountProblem && amountProblem !== 'empty' ? 'Fix the amount' : 'Enter an amount'
    }
    return ''
  })()

  /** Takes the customer to the step that is holding them up. */
  const goTo = (step: StepId) => {
    const section = step === 'who' ? whoRef.current : step === 'what' ? whatRef.current : payRef.current
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setNudged(step)
    window.setTimeout(() => setNudged(null), 1400)
    if (step === 'who') {
      ;(service && needsPhone(service) ? phoneInput : accountInput).current?.focus({ preventScroll: true })
    } else if (step === 'what' && service && !needsVariation(service)) {
      amountInput.current?.focus({ preventScroll: true })
    }
  }

  // A number that has just become valid: put the keyboard away and bring the
  // plans up, which is the next thing to do and was hidden under the keyboard.
  const wasValid = useRef(Boolean(validPhone))
  useEffect(() => {
    const valid = Boolean(validPhone)
    const becameValid = valid && !wasValid.current
    wasValid.current = valid
    if (!becameValid || !service || !needsVariation(service) || variation) return
    if (phone.replace(/\D/g, '').length < 11) return
    phoneInput.current?.blur()
    const id = window.setTimeout(
      () => whatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      180,
    )
    return () => window.clearTimeout(id)
  }, [validPhone, phone, service, variation])

  const pay = async () => {
    if (!service || paying) return
    if (!ready) {
      goTo(current)
      return
    }

    if (walletShort) {
      goTo('pay')
      showToast(`Your wallet is short by ${money(total - walletBalance)}. Pay by card instead, or top up.`, 'danger')
      return
    }

    // The wallet PIN comes first; backing out of it leaves nothing charged.
    let pin: string | undefined
    if (method === 'wallet') {
      pin = (await walletPin.ask(money(total))) ?? undefined
      if (!pin) return
    }

    setPaying(true)
    setError(null)
    try {
      const result = await purchase({
        pin,
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
          <Skeleton height={44} radius="var(--radius-pill)" style={{ marginTop: 12 }} />
          <Skeleton height={54} radius="var(--radius-md)" style={{ marginTop: 20 }} />
          <Skeleton height={54} radius="var(--radius-md)" style={{ marginTop: 12 }} />
          <Skeleton height={120} radius="var(--radius-md)" style={{ marginTop: 12 }} />
        </ScreenBody>
      </>
    )
  }

  const relevant = saved.filter((b) => b.serviceKey === service.id).slice(0, 4)

  /** What the footer shows was chosen, once anything has been. */
  const summary = [
    variation ? variationHeadline(variation) : payable > 0 ? money(payable) : null,
    needsPhone(service) ? (validPhone ?? null) : account.trim().length >= 6 ? account.trim() : null,
  ]
    .filter(Boolean)
    .join(' → ')

  return (
    <>
      <AppBar title={service.name} subtitle={service.accountLabel} />

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        {/* ── Where you are ──────────────────────────────────────────── */}
        <Steps
          steps={[
            { id: 'who', label: whoLabel, done: whoDone },
            { id: 'what', label: whatLabel, done: whatDone },
            { id: 'pay', label: 'Pay', done: false },
          ]}
          current={current}
          onSelect={goTo}
        />

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

        {/* ── Step 1: who ────────────────────────────────────────────── */}
        <Section refEl={whoRef} number={1} title={whoLabel} done={whoDone} lit={nudged === 'who'}>
          {needsPhone(service) && (
            <>
              <input
                ref={phoneInput}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0801 234 5678"
                inputMode="tel"
                autoComplete="tel"
                aria-label="Phone number"
                style={inputStyle(Boolean(validPhone))}
              />
              {network && (
                <p className="t-caption" style={{ margin: '6px 0 0' }}>
                  Looks like {network}
                </p>
              )}
              {phone.replace(/\D/g, '').length >= 11 && !validPhone && (
                <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>
                  That number does not look right. Check it and try again.
                </p>
              )}
            </>
          )}

          {needsMeterType(service) && (
            <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginBottom: 'var(--gap-md)' }}>
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
                      meterType === type.id ? 'var(--color-brand-ink)' : 'var(--color-ink-body)',
                    border: `1px solid ${meterType === type.id ? 'var(--color-brand)' : 'var(--color-line)'}`,
                  }}
                >
                  {type.label}
                </PressScale>
              ))}
            </div>
          )}

          {needsAccount(service) && (
            <>
              <input
                ref={accountInput}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={service.accountLabel}
                inputMode="numeric"
                aria-label={service.accountLabel}
                style={inputStyle(whoDone)}
              />
              {verifying && (
                <p
                  className="t-caption"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0' }}
                >
                  <Spinner size={14} color="var(--color-brand)" />
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
            </>
          )}
        </Section>

        {/* ── Step 2: what ───────────────────────────────────────────── */}
        {needsVariation(service) && (
          <Section
            refEl={whatRef}
            number={2}
            title="Choose a bundle"
            hint={bundles && bundles.length > 0 ? 'Tap a plan to pick it. The ⓘ shows everything it includes.' : undefined}
            done={whatDone}
            lit={nudged === 'what'}
          >
            {bundles === null ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={84} radius="var(--radius-md)" />
                ))}
              </div>
            ) : bundles.length === 0 ? (
              <EmptyState
                title={bundleError ? 'Not available yet' : 'No bundles available'}
                message={
                  bundleError ??
                  'This operator has no plans listed right now. Try again shortly.'
                }
                compact
              />
            ) : (
              <>
                {bundlePeriods(bundles).length > 0 && (
                  <div style={{ marginBottom: 'var(--gap-md)', marginInline: 'calc(-1 * var(--gap-page))' }}>
                    <ChipRail
                      options={bundlePeriods(bundles)}
                      selected={period}
                      onSelect={setPeriod}
                    />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {bundlesInPeriod(bundles, period).map((bundle) => {
                    const chosen = variation?.code === bundle.code
                    return (
                      // The info button sits beside the tile, not inside it: a
                      // button inside a button is not valid, and screen readers
                      // would announce them as one.
                      <div key={bundle.code} style={{ position: 'relative' }}>
                        <PressScale
                          scale={0.96}
                          onClick={() => setVariation(chosen ? null : bundle)}
                          ariaLabel={`${bundle.name}, ${money(bundle.amount)}${chosen ? ', selected' : ''}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            padding: 'var(--gap-md)',
                            paddingRight: 36,
                            borderRadius: 'var(--radius-md)',
                            background: chosen ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                            border: `1.5px solid ${chosen ? 'var(--color-brand)' : 'var(--color-line)'}`,
                            boxShadow: chosen ? '0 0 0 3px rgba(31, 119, 241, 0.12)' : undefined,
                            textAlign: 'left',
                            transition: 'box-shadow var(--dur-fast) var(--ease-emphasized)',
                          }}
                        >
                          <span className="t-h4 clamp-2" style={{ display: 'block' }}>
                            {variationHeadline(bundle)}
                          </span>
                          {variationDetail(bundle) && (
                            <span className="t-caption-sm clamp-2" style={{ display: 'block' }}>
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
                        {chosen ? (
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              display: 'grid',
                              placeItems: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--color-brand)',
                              color: '#fff',
                              animation: 'blorb-pop var(--dur-normal) var(--ease-springy) both',
                              pointerEvents: 'none',
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Details for ${bundle.name}`}
                            onClick={() => setDetails(bundle)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              display: 'grid',
                              placeItems: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-ink-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            <Info size={17} aria-hidden />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* The chosen plan in full, so nobody pays for a name they
                    could only read the start of. */}
                {variation && (
                  <p
                    className="t-body-sm"
                    style={{
                      margin: 'var(--gap-md) 0 0',
                      padding: 'var(--gap-sm) var(--gap-md)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-brand-softer)',
                      color: 'var(--color-brand-ink)',
                    }}
                  >
                    <strong>Selected:</strong> {variation.name}
                  </p>
                )}
              </>
            )}
          </Section>
        )}

        {needsAmount(service) && !variation && !needsVariation(service) && (
          <Section refEl={whatRef} number={2} title="Amount" done={whatDone} lit={nudged === 'what'}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-sm)',
                height: 'var(--size-input)',
                paddingInline: 'var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: `1.5px solid ${whatDone ? 'var(--color-success)' : 'var(--color-line-strong)'}`,
              }}
            >
              <span className="t-h3" style={{ color: 'var(--color-ink-muted)' }}>
                ₦
              </span>
              <input
                ref={amountInput}
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
            {service.category === 'airtime' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
                {AIRTIME_PRESETS.filter((p) => (!service.min || p >= service.min) && (!service.max || p <= service.max)).map((preset) => (
                  <PressScale
                    key={preset}
                    scale={0.93}
                    onClick={() => setAmount(String(preset))}
                    className="t-label"
                    style={{
                      height: 38,
                      paddingInline: 'var(--gap-lg)',
                      borderRadius: 'var(--radius-pill)',
                      background: payable === preset ? 'var(--color-brand)' : 'var(--color-surface)',
                      color: payable === preset ? '#fff' : 'var(--color-ink-body)',
                      border: `1px solid ${payable === preset ? 'var(--color-brand)' : 'var(--color-line)'}`,
                    }}
                  >
                    {money(preset)}
                  </PressScale>
                ))}
              </div>
            )}
            <p
              className="t-caption"
              style={{
                margin: '6px 0 0',
                color: amountProblem && amountProblem !== 'empty' ? 'var(--color-danger)' : undefined,
              }}
            >
              {amountProblem && amountProblem !== 'empty'
                ? amountProblem
                : service.min > 0 || service.max > 0
                  ? `${money(service.min)} – ${money(service.max)}`
                  : ''}
            </p>
          </Section>
        )}

        {/* ── Step 3: pay ────────────────────────────────────────────── */}
        <Section refEl={payRef} number={3} title="Pay with" done={false} lit={nudged === 'pay'}>
          {/* What this costs, before the payment method, so the fee is read
              on the way in rather than discovered in the wallet ledger. */}
          {fee > 0 && (
            <div
              style={{
                marginBottom: 'var(--gap-md)',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
              }}
            >
              <Line label={service.name} value={money(payable)} />
              <Line label="Transaction fee" value={money(fee)} />
              <div
                style={{
                  marginTop: 'var(--gap-sm)',
                  paddingTop: 'var(--gap-sm)',
                  borderTop: '1px solid var(--color-line)',
                }}
              >
                <Line label="Total" value={money(total)} strong />
              </div>
            </div>
          )}

          <PaymentMethodTile
            method="wallet"
            selected={method === 'wallet'}
            onSelect={() => {
              cardChosenForThem.current = false
              setMethod('wallet')
            }}
            title="Blorbmart wallet"
            subtitle={`Balance ${money(walletBalance)}`}
            disabled={total > 0 && walletBalance < total}
            disabledReason={
              total > 0 && walletBalance < total
                ? `Short by ${money(total - walletBalance)}`
                : undefined
            }
            icon={<Wallet size={20} aria-hidden />}
          />
          <div style={{ height: 'var(--gap-sm)' }} />
          <PaymentMethodTile
            method="paystack"
            selected={method === 'paystack'}
            onSelect={() => {
              cardChosenForThem.current = false
              setMethod('paystack')
            }}
            title="Card or transfer"
            subtitle="Secured by Paystack"
          />

          <p className="t-caption" style={{ marginTop: 'var(--gap-lg)', textAlign: 'center' }}>
            If delivery fails, you are refunded automatically.
          </p>
        </Section>

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

      {/* ── The footer: what you chose, and the next thing to do ───────── */}
      <StickyFooter>
        {summary && (
          <div
            className="blorb-fade-slide-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              marginBottom: 'var(--gap-sm)',
              ['--fs-y' as string]: '6px',
            }}
          >
            <span className="t-caption clamp-1" style={{ flex: 1, minWidth: 0, color: 'var(--color-ink-body)' }}>
              {service.name} · {summary}
            </span>
            {total > 0 && (
              <span className="t-price-sm" style={{ flexShrink: 0 }}>
                {money(total)}
              </span>
            )}
          </div>
        )}
        {ready ? (
          <Button
            key="pay"
            label={
              walletShort
                ? `Wallet short by ${money(total - walletBalance)}`
                : method === 'paystack'
                  ? `Pay ${money(total)} by card or transfer`
                  : `Pay ${money(total)} from wallet`
            }
            busy={paying}
            glow={!walletShort}
            kind={walletShort ? 'soft' : 'brand'}
            className={walletShort ? undefined : 'blorb-cta-ready'}
            onClick={() => void pay()}
          />
        ) : (
          <Button
            key="next"
            label={nextAction}
            kind="soft"
            trailing={<ChevronRight size={18} aria-hidden />}
            onClick={() => goTo(current)}
          />
        )}
      </StickyFooter>

      {/* ── Plan details ─────────────────────────────────────────────── */}
      <Sheet open={details !== null} onClose={() => setDetails(null)} title="Plan details">
        {details && (
          <>
            <div
              style={{
                padding: 'var(--gap-lg)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-brand-softer)',
                border: '1px solid var(--color-brand-soft)',
                marginBottom: 'var(--gap-lg)',
              }}
            >
              <div className="t-display-sm" style={{ color: 'var(--color-brand-ink)' }}>
                {variationHeadline(details)}
              </div>
              {/* The aggregator's own name for the plan, never truncated. */}
              <p className="t-body-sm" style={{ margin: 'var(--gap-xs) 0 0' }}>
                {details.name}
              </p>
            </div>
            <Line label="Network" value={service.name} />
            {details.size && <Line label="Data" value={details.size} />}
            {details.details && details.details !== details.size && (
              <Line label="Includes" value={details.details} />
            )}
            {(details.validity || details.periodLabel) && (
              <Line label="Valid for" value={details.validity || details.periodLabel} />
            )}
            <Line label="Price" value={money(details.amount)} />
            {service.fee > 0 && <Line label="Transaction fee" value={money(service.fee)} />}
            <Line label="You pay" value={money(details.amount + service.fee)} strong />
            <div style={{ marginTop: 'var(--gap-xl)' }}>
              <Button
                label={variation?.code === details.code ? 'Selected' : 'Choose this plan'}
                glow
                onClick={() => {
                  setVariation(details)
                  setDetails(null)
                }}
              />
            </div>
          </>
        )}
      </Sheet>

      {walletPin.sheet}
    </>
  )
}

/** The amounts people actually top up with, as one-tap chips. */
const AIRTIME_PRESETS = [100, 200, 500, 1000, 2000, 5000]

const inputStyle = (done: boolean): React.CSSProperties => ({
  width: '100%',
  height: 'var(--size-input)',
  paddingInline: 'var(--gap-lg)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  border: `1.5px solid ${done ? 'var(--color-success)' : 'var(--color-line-strong)'}`,
  transition: 'border-color var(--dur-fast) var(--ease-emphasized)',
})

/* ── The step tracker ──────────────────────────────────────────────────── */

function Steps({
  steps,
  current,
  onSelect,
}: {
  steps: Array<{ id: StepId; label: string; done: boolean }>
  current: StepId
  onSelect: (step: StepId) => void
}) {
  return (
    <ol
      aria-label="Steps"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        listStyle: 'none',
        margin: 'var(--gap-lg) 0 var(--gap-md)',
        padding: 0,
      }}
    >
      {steps.map((step, i) => {
        const active = step.id === current
        const tone = step.done ? 'var(--color-success)' : active ? 'var(--color-brand)' : 'var(--color-ink-faint)'
        return (
          <li key={step.id} style={{ display: 'contents' }}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  flex: 1,
                  minWidth: 10,
                  height: 2,
                  borderRadius: 2,
                  background: steps[i - 1].done ? 'var(--color-success)' : 'var(--color-line-strong)',
                  transition: 'background var(--dur-normal) var(--ease-emphasized)',
                }}
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={active ? 'step' : undefined}
              className="press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                maxWidth: '40%',
                padding: '5px 10px 5px 5px',
                borderRadius: 'var(--radius-pill)',
                background: active ? 'var(--color-brand-soft)' : step.done ? 'var(--color-success-soft)' : 'var(--color-surface)',
                border: `1px solid ${active ? 'var(--color-brand)' : step.done ? 'transparent' : 'var(--color-line)'}`,
                transition: 'background var(--dur-normal) var(--ease-emphasized)',
              }}
            >
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: step.done || active ? tone : 'var(--color-surface-sunken)',
                  color: step.done || active ? '#fff' : 'var(--color-ink-muted)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {step.done ? <Check size={12} strokeWidth={3.2} aria-hidden /> : i + 1}
              </span>
              <span className="t-label-sm clamp-1" style={{ color: step.done ? 'var(--color-success)' : active ? 'var(--color-brand-ink)' : 'var(--color-ink-muted)' }}>
                {step.label}
              </span>
              {step.done && <span className="sr-only">(done)</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** One numbered section of the form, lit briefly when the footer sends you. */
function Section({
  refEl,
  number,
  title,
  hint,
  done,
  lit,
  children,
}: {
  refEl: React.RefObject<HTMLDivElement | null>
  number: number
  title: string
  hint?: string
  done: boolean
  lit: boolean
  children: ReactNode
}) {
  return (
    <section
      ref={refEl}
      className={lit ? 'blorb-section-lit' : undefined}
      style={{
        marginTop: 'var(--gap-lg)',
        padding: 'var(--gap-md)',
        marginInline: 'calc(-1 * var(--gap-md))',
        borderRadius: 'var(--radius-lg)',
        scrollMarginTop: 'calc(var(--safe-top) + 84px)',
        scrollMarginBottom: 160,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hint ? 2 : 'var(--gap-sm)' }}>
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: done ? 'var(--color-success)' : 'var(--color-ink)',
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 800,
            transition: 'background var(--dur-normal) var(--ease-emphasized)',
          }}
        >
          {done ? <Check size={13} strokeWidth={3.2} /> : number}
        </span>
        <h2 className="t-h4" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      {hint && (
        <p className="t-caption" style={{ margin: '0 0 var(--gap-sm) 30px' }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  )
}

/** One row of the cost breakdown. */
function Line({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--gap-md)',
        padding: '3px 0',
      }}
    >
      <span className={strong ? 't-label' : 't-body-sm'} style={{ minWidth: 0 }}>
        {label}
      </span>
      <span className={strong ? 't-price-sm' : 't-body-sm'} style={{ flexShrink: 0 }}>
        {value}
      </span>
    </div>
  )
}
