/* ═══════════════════════════════════════════════════════════════════════
   Checkout — a port of lib/features/checkout/checkout_screen.dart.

   The order document is created the moment this screen opens, because the
   backend needs something to price against. That is also why leaving without
   paying marks the draft abandoned on the way out.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, HandCoins, MapPin, Tag, Wallet, X } from 'lucide-react'
import { ApiError, apiErrorMessage, warmUp } from '../lib/api'
import { asDouble, asString, money } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import { supportUrl } from '../lib/support'
import { useBackFromPaystack } from '../hooks/useBackFromPaystack'
import {
  abandonDraft,
  calculatePricing,
  createOrder,
  notifyVendor,
  payWithWallet,
  saveOrderNote,
  startPaystack,
  type DeliveryTime,
} from '../data/orders'
import { askSomeoneToPay } from '../data/payRequests'
import { clearTreat, saveTreat, treatProblem } from '../data/treats'
import { balance, invalidateBalance, watchLiveBalance } from '../data/wallet'
import { addressToFirestore, addressLabel } from '../models/address'
import { cartSubtotal, cartVertical, useCartStore } from '../store/cartStore'
import { sessionEmail, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, SummaryRow } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { AddressSheet } from '../components/AddressSheet'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'
import { useWalletPin } from '../components/WalletPinSheet'
import { SchedulePicker } from '../components/SchedulePicker'

export default function CheckoutScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const lines = useCartStore((s) => s.lines)
  const clearCart = useCartStore((s) => s.clear)

  const [orderId, setOrderId] = useState<string | null>(null)
  const [subtotal, setSubtotal] = useState(cartSubtotal(lines))
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [serviceFee, setServiceFee] = useState(0)
  const [discount, setDiscount] = useState(0)
  // A free-delivery promo. Separate from `discount` because the fee itself
  // is unchanged — the rider is still paid it — and only what the customer
  // is charged comes down. See orderPricingService.applyDeliveryWaiver.
  const [deliveryDiscount, setDeliveryDiscount] = useState(0)
  const [total, setTotal] = useState(cartSubtotal(lines))

  const [walletBalance, setWalletBalance] = useState(0)
  // 'friend' is not a way of paying so much as a way of not paying: the
  // order is parked and a link goes to whoever will. See data/payRequests.
  const [method, setMethod] = useState<PayMethod | 'friend'>('paystack')
  const [askNote, setAskNote] = useState('')

  // Sending the order to somebody else. Saved onto the draft at the moment
  // of paying, because the draft may be replaced any time the basket changes.
  const [treatOn, setTreatOn] = useState(false)
  const [treatName, setTreatName] = useState('')
  const [treatPhone, setTreatPhone] = useState('')
  const [treatMessage, setTreatMessage] = useState('')
  /** The draft the server currently holds treat details for, if any. */
  const treatSavedFor = useRef<string | null>(null)

  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)

  // When to deliver: null is as soon as possible. Sent with the payment, and
  // checked against the store's hours by the server at that moment.
  const [when, setWhen] = useState<DeliveryTime>(null)
  const [whenLabel, setWhenLabel] = useState<string | null>(null)
  const [wantsLater, setWantsLater] = useState(false)
  const pickWhen = useCallback((value: DeliveryTime, label: string | null) => {
    setWhen(value)
    setWhenLabel(label)
  }, [])

  const [note, setNote] = useState('')
  /** The draft the server holds a note for, and the note it holds. */
  const noteSaved = useRef<{ id: string; note: string } | null>(null)
  const [pricing, setPricing] = useState(true)
  const [paying, setPaying] = useState(false)
  const walletPin = useWalletPin()
  const [error, setError] = useState<string | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
  // Set when the draft could not be started. The footer then offers the one
  // thing that helps, instead of a Pay button that can do nothing.
  const [blocked, setBlocked] = useState<DraftFailure['kind'] | null>(null)
  const [draftAttempt, setDraftAttempt] = useState(0)

  const paidRef = useRef(false)
  const orderIdRef = useRef<string | null>(null)
  // The basket the current draft was written from. A draft describes one
  // basket; when the basket changes, the draft is replaced rather than paid.
  const draftBasketRef = useRef<string | null>(null)
  const draftSeqRef = useRef(0)

  // Back from Cancel on Paystack. The draft already carries the payment
  // reference sent to Paystack, which the backend would reuse, so a retry
  // gets a fresh draft — what the refresh that used to be the only way out
  // did.
  useBackFromPaystack(() => {
    paidRef.current = false
    draftBasketRef.current = null
    setPaying(false)
  })

  const address = session.address
  const profile = session.profile
  const basketKey = JSON.stringify(lines)
  const storeIdsKey = [...new Set(lines.map((l) => l.storeId))].join(',')
  const storeIds = useMemo(() => (storeIdsKey ? storeIdsKey.split(',') : []), [storeIdsKey])

  /**
   * The backend sleeps, and its first request costs about twenty seconds.
   * Waking it while the customer reads the summary moves that cost out of the
   * tap that is supposed to open Paystack.
   */
  useEffect(() => {
    warmUp()
    void balance().then(setWalletBalance)
    // Live, so a top-up finished in another tab is usable here at once.
    return watchLiveBalance(setWalletBalance)
  }, [])

  const refreshPricing = useCallback(
    async (id: string, code: string | null) => {
      setPricing(true)
      setPromoError(null)
      try {
        const data = await calculatePricing(id, code ?? undefined)
        // The basket may have changed while the server answered, replacing
        // this draft; its figures would price a basket that no longer exists.
        if (orderIdRef.current !== id) return
        const nextSubtotal = asDouble(data.subtotal, subtotal)
        const nextDelivery = asDouble(data.deliveryFee)
        const nextService = asDouble(data.serviceFee)
        const nextDiscount = asDouble(data.discountAmount ?? data.discount)
        const nextDeliveryDiscount = asDouble(data.deliveryDiscount)

        setSubtotal(nextSubtotal)
        setDeliveryFee(nextDelivery)
        setServiceFee(nextService)
        setDiscount(nextDiscount)
        setDeliveryDiscount(nextDeliveryDiscount)
        setTotal(
          asDouble(
            data.totalAmount ?? data.total,
            nextSubtotal - nextDiscount + nextDelivery + nextService - nextDeliveryDiscount,
          ),
        )

        if (code) {
          // A free-delivery code is applied even though it takes nothing off
          // the goods, so "did it work" cannot be "is the discount above
          // zero" any more.
          const worked = nextDiscount > 0 || nextDeliveryDiscount > 0
          setPromoApplied(worked ? code.toUpperCase() : null)
          if (!worked) setPromoError('That code did not apply.')
        }
      } catch (e) {
        if (orderIdRef.current !== id) return
        if (code) setPromoError(apiErrorMessage(e, 'We could not apply that code.'))
        else setError(apiErrorMessage(e, 'We could not price this order. Try again.'))
      } finally {
        if (orderIdRef.current === id) setPricing(false)
      }
    },
    [subtotal],
  )

  // Write a draft for the basket as it stands, and a new one whenever the
  // basket changes — a line removed in the basket or in another tab — so the
  // total here is always the total of what is actually in it. This used to
  // run once, and a basket edited afterwards kept its old price.
  useEffect(() => {
    if (paidRef.current || paying || !address) return
    if (draftBasketRef.current === basketKey) return

    // Said up front, instead of letting Firestore refuse the write with
    // "Missing or insufficient permissions".
    const blocker = orderBlocker(profile)
    if (lines.length && blocker) {
      setError(blocker)
      setBlocked('account')
      setPricing(false)
      return
    }

    const stale = orderIdRef.current
    if (stale) {
      orderIdRef.current = null
      setOrderId(null)
      void abandonDraft(stale)
    }
    draftBasketRef.current = basketKey
    if (!lines.length) return

    const seq = ++draftSeqRef.current
    // The basket's own figure at once; the server's replaces it when priced.
    const basketTotal = cartSubtotal(lines)
    setSubtotal(basketTotal)
    setTotal(basketTotal)
    setPricing(true)
    setError(null)
    setBlocked(null)

    const run = async () => {
      try {
        const id = await createOrder({
          lines,
          address: addressToFirestore(address),
          vertical: cartVertical(lines),
        })
        if (seq !== draftSeqRef.current || paidRef.current) {
          // Overtaken by a newer basket while this one was being written.
          void abandonDraft(id)
          return
        }
        setOrderId(id)
        orderIdRef.current = id
        await refreshPricing(id, promoApplied)
      } catch (e) {
        if (seq !== draftSeqRef.current) return
        const failure = draftFailure(e)
        setError(failure.message)
        setBlocked(failure.kind)
        setPricing(false)
      }
    }
    void run()
  }, [basketKey, lines, address, profile, paying, promoApplied, refreshPricing, draftAttempt])

  /** Writes the draft again for the same basket, after a failure worth retrying. */
  const retryDraft = () => {
    draftBasketRef.current = null
    setDraftAttempt((n) => n + 1)
  }

  /**
   * Leaving without paying marks the draft abandoned, so unpaid documents stop
   * accumulating in the collection — and in the admin dashboard, which counts
   * them.
   */
  useEffect(() => {
    return () => {
      const id = orderIdRef.current
      if (id && !paidRef.current) void abandonDraft(id)
    }
  }, [])

  const applyPromo = async () => {
    const code = promo.trim()
    if (!code || !orderId) return
    setPromoBusy(true)
    await refreshPricing(orderId, code)
    setPromoBusy(false)
  }

  const removePromo = async () => {
    setPromo('')
    setPromoApplied(null)
    setPromoError(null)
    if (orderId) await refreshPricing(orderId, null)
  }

  const onPaid = async (id: string) => {
    paidRef.current = true
    clearCart()
    void notifyVendor(id)
    invalidateBalance()
    navigate(`/order-placed/${id}`, { replace: true })
  }

  /**
   * Puts the treat details on the draft, or takes them off one that had
   * them. Throws the server's own sentence when it refuses.
   */
  const syncTreat = async (id: string) => {
    if (treatOn) {
      await saveTreat(id, { recipientName: treatName, recipientPhone: treatPhone, message: treatMessage })
      treatSavedFor.current = id
    } else if (treatSavedFor.current === id) {
      await clearTreat(id)
      treatSavedFor.current = null
    }
  }

  /**
   * Puts the rider's note on the draft. Like the treat, it is saved at the
   * moment of paying: the draft is written before anything is typed, and may
   * be replaced any time the basket changes.
   */
  const syncNote = async (id: string) => {
    const text = note.trim()
    const held = noteSaved.current?.id === id ? noteSaved.current.note : ''
    if (text === held) return
    await saveOrderNote(id, text)
    noteSaved.current = { id, note: text }
  }

  const pay = async () => {
    if (!orderId || paying) return

    const treatIssue = treatOn
      ? treatProblem({ recipientName: treatName, recipientPhone: treatPhone, message: treatMessage })
      : null
    if (treatIssue) {
      showToast(treatIssue, 'danger')
      return
    }

    if (method !== 'friend' && wantsLater && !when) {
      showToast('Pick a delivery time, or choose as soon as possible.', 'danger')
      return
    }
    // A pay link places the order whenever it is paid, so it never carries a time.
    const deliverAt = method === 'friend' ? null : when

    if (method === 'wallet' && walletBalance < total) {
      showToast(`Your wallet is short by ${money(total - walletBalance)}.`, 'danger')
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
      await syncTreat(orderId)
      await syncNote(orderId)

      if (method === 'friend') {
        const request = await askSomeoneToPay(orderId, {
          promoCode: promoApplied ?? undefined,
          message: askNote.trim(),
        })
        // The order now waits on somebody else. It must survive this screen
        // closing, and the basket it was made from is spoken for.
        paidRef.current = true
        clearCart()
        navigate(`/pay-request/${orderId}`, { replace: true, state: { request } })
        return
      }

      if (method === 'wallet') {
        await payWithWallet(orderId, promoApplied ?? undefined, pin, deliverAt)
        await onPaid(orderId)
        return
      }

      const data = await startPaystack(orderId, promoApplied ?? undefined, deliverAt)
      const url = asString(data.authorization_url ?? data.authorizationUrl)
      const reference = asString(data.reference)
      if (!url) throw new ApiError('Could not open the payment page.')

      // A full-page redirect. `paidRef` is set so the unmount cleanup does not
      // abandon an order that is about to be paid for.
      paidRef.current = true
      goToPaystack(url, {
        kind: 'order',
        reference,
        id: orderId,
        returnTo: `/order-placed/${orderId}`,
      })
    } catch (e) {
      paidRef.current = false
      setPaying(false)
      setError(
        e instanceof ApiError
          ? e.message
          : 'That payment did not go through. Nothing was charged.',
      )
    }
  }

  if (!lines.length) {
    return (
      <>
        <AppBar title="Checkout" />
        <EmptyState
          title="Your basket is empty"
          message="Add something before checking out."
          actionLabel="Browse"
          onAction={() => navigate('/home')}
        />
      </>
    )
  }

  return (
    <>
      <AppBar title="Checkout" subtitle={`${lines.length} item${lines.length === 1 ? '' : 's'}`} />

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        {/* ── Address ────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-md) 0 var(--gap-sm)' }}>
          Delivering to
        </div>
        <PressScale
          scale={0.99}
          onClick={() => setAddressOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-md)',
            width: '100%',
            padding: 'var(--gap-lg)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-surface)',
            border: `1px solid ${address ? 'var(--color-line)' : 'var(--color-danger)'}`,
            boxShadow: 'var(--shadow-sm)',
            textAlign: 'left',
          }}
        >
          <MapPin
            size={20}
            aria-hidden
            style={{
              flexShrink: 0,
              color: address ? 'var(--color-brand)' : 'var(--color-danger)',
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="t-h4 clamp-1" style={{ display: 'block' }}>
              {address ? address.name || 'Delivery address' : 'Add a delivery address'}
            </span>
            <span className="t-caption clamp-1" style={{ display: 'block' }}>
              {addressLabel(address)}
            </span>
          </span>
          <span className="t-label" style={{ color: 'var(--color-brand)', flexShrink: 0 }}>
            Change
          </span>
        </PressScale>

        {/* ── When ───────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          When
        </div>
        <SchedulePicker
          storeIds={storeIds}
          value={when}
          onChange={pickWhen}
          onModeChange={(mode) => setWantsLater(mode === 'later')}
          disabledReason={
            method === 'friend'
              ? 'A pay link places the order the moment it is paid, so it cannot be scheduled.'
              : null
          }
        />

        {/* ── Treat ──────────────────────────────────────────────────── */}
        <button
          type="button"
          role="switch"
          aria-checked={treatOn}
          className="press"
          onClick={() => setTreatOn((on) => !on)}
          style={{
            ['--press-scale' as string]: '0.99',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-md)',
            width: '100%',
            marginTop: 'var(--gap-md)',
            padding: 'var(--gap-md) var(--gap-lg)',
            borderRadius: 'var(--radius-md)',
            background: treatOn ? 'var(--color-appetite-soft)' : 'var(--color-surface)',
            border: `1px solid ${treatOn ? 'var(--color-appetite)' : 'var(--color-line)'}`,
            textAlign: 'left',
          }}
        >
          <Gift size={20} aria-hidden style={{ flexShrink: 0, color: 'var(--color-appetite-deep)' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="t-h4" style={{ display: 'block' }}>
              Send this to a friend
            </span>
            <span className="t-caption" style={{ display: 'block' }}>
              You pay, they get a link to track it and the delivery PIN
            </span>
          </span>
          <Toggle on={treatOn} />
        </button>

        {treatOn && (
          <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-sm)' }}>
            <input
              value={treatName}
              onChange={(e) => setTreatName(e.target.value.slice(0, 60))}
              placeholder="Their name"
              aria-label="Their name"
              autoComplete="off"
              style={fieldStyle}
            />
            <input
              value={treatPhone}
              onChange={(e) => setTreatPhone(e.target.value.replace(/[^\d+\s]/g, '').slice(0, 18))}
              placeholder="Their phone number"
              aria-label="Their phone number"
              inputMode="tel"
              autoComplete="off"
              style={fieldStyle}
            />
            <textarea
              value={treatMessage}
              onChange={(e) => setTreatMessage(e.target.value.slice(0, 200))}
              placeholder="A message for them (optional)"
              aria-label="A message for them"
              rows={2}
              style={{ ...fieldStyle, height: 'auto', padding: 'var(--gap-md) var(--gap-lg)', resize: 'none' }}
            />
            <p className="t-caption" style={{ margin: 0 }}>
              Check the address above is where {treatName.trim() || 'your friend'} is. The rider
              calls their number, and they give the rider the PIN.
            </p>
          </div>
        )}

        {/* ── Note ───────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          Note for the rider
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 180))}
          placeholder="Gate code, which floor, where to wait"
          rows={2}
          aria-label="Note for the rider"
          style={{
            width: '100%',
            padding: 'var(--gap-md) var(--gap-lg)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-line-strong)',
            resize: 'none',
          }}
        />

        {/* ── Promo ──────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          Promo code
        </div>
        {promoApplied ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-md)',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-success-soft)',
            }}
          >
            <Tag size={18} aria-hidden style={{ color: 'var(--color-success)' }} />
            <span className="t-label" style={{ flex: 1, color: 'var(--color-success)' }}>
              {promoApplied} ·{' '}
              {discount > 0 && deliveryDiscount > 0
                ? `you saved ${money(discount + deliveryDiscount)}`
                : deliveryDiscount > 0
                  ? 'delivery is on us'
                  : `you saved ${money(discount)}`}
            </span>
            <button
              type="button"
              onClick={() => void removePromo()}
              aria-label="Remove promo code"
              style={{ color: 'var(--color-success)' }}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              placeholder="Enter a code"
              aria-label="Promo code"
              style={{
                flex: 1,
                minWidth: 0,
                height: 'var(--size-button-md)',
                paddingInline: 'var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: `1px solid ${promoError ? 'var(--color-danger)' : 'var(--color-line-strong)'}`,
              }}
            />
            <Button
              label="Apply"
              kind="soft"
              size="md"
              expand={false}
              busy={promoBusy}
              disabled={!promo.trim() || !orderId}
              onClick={() => void applyPromo()}
            />
          </div>
        )}
        {promoError && (
          <p className="t-caption" style={{ margin: '6px 0 0', color: 'var(--color-danger)' }}>
            {promoError}
          </p>
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
          disabled={walletBalance < total}
          disabledReason={
            walletBalance < total ? `Short by ${money(total - walletBalance)}` : undefined
          }
          icon={<Wallet size={20} aria-hidden />}
        />
        <div style={{ height: 'var(--gap-sm)' }} />
        <PaymentMethodTile
          method="paystack"
          selected={method === 'paystack'}
          onSelect={() => setMethod('paystack')}
          title="Card, transfer or USSD"
          subtitle="Secured by Paystack"
        />
        <div style={{ height: 'var(--gap-sm)' }} />
        <PaymentMethodTile
          method="wallet"
          selected={method === 'friend'}
          onSelect={() => setMethod('friend')}
          title="Ask someone to pay"
          subtitle="Send a link to a parent or a friend"
          icon={<HandCoins size={20} aria-hidden />}
        />
        {method === 'friend' && (
          <div style={{ marginTop: 'var(--gap-sm)' }}>
            <input
              value={askNote}
              onChange={(e) => setAskNote(e.target.value.slice(0, 160))}
              placeholder="Add a note for them (optional)"
              aria-label="A note for the person paying"
              style={fieldStyle}
            />
            <p className="t-caption" style={{ margin: '6px 0 0' }}>
              They see your first name, what you ordered and the total. They need no account,
              and the order is placed the moment they pay.
            </p>
          </div>
        )}

        {/* ── Summary ────────────────────────────────────────────────── */}
        <Card style={{ marginTop: 'var(--gap-xl)' }}>
          <SummaryRow label="Subtotal" value={money(subtotal)} />
          <SummaryRow
            label="Delivery"
            value={pricing ? '…' : deliveryFee <= 0 ? 'Free' : money(deliveryFee)}
            valueColor={!pricing && deliveryFee <= 0 ? 'var(--color-success)' : undefined}
          />
          {serviceFee > 0 && <SummaryRow label="Service fee" value={money(serviceFee)} />}
          {discount > 0 && (
            <SummaryRow
              label="Discount"
              value={`−${money(discount)}`}
              valueColor="var(--color-success)"
            />
          )}
          {deliveryDiscount > 0 && (
            <SummaryRow
              label="Delivery waived"
              value={`−${money(deliveryDiscount)}`}
              valueColor="var(--color-success)"
            />
          )}
          <div style={{ margin: 'var(--gap-sm) 0' }}>
            <DashedDivider />
          </div>
          <SummaryRow label="Total" value={pricing ? '…' : money(total)} emphasise />
        </Card>

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
        {blocked === 'account' ? (
          // Only support can fix an account, so that is what the button does,
          // with the account's email already in the message.
          <Button label="Message support" glow onClick={() => openSupport(sessionEmail(session))} />
        ) : blocked === 'retry' ? (
          <Button label="Try again" glow onClick={retryDraft} />
        ) : (
          <Button
            label={
              pricing
                ? 'Working out the total…'
                : method === 'friend'
                  ? `Get a link for ${money(total)}`
                  : when && whenLabel
                    ? `Pay ${money(total)} · ${whenLabel}`
                    : `Pay ${money(total)}`
            }
            busy={paying}
            disabled={pricing || !orderId || !address}
            glow
            onClick={() => void pay()}
          />
        )}
      </StickyFooter>

      <AddressSheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        onChanged={() => {
          // A new address changes the delivery fee, so the order is re-priced.
          if (orderId) void refreshPricing(orderId, promoApplied)
        }}
      />

      {walletPin.sheet}
    </>
  )
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 'var(--size-button-md)',
  paddingInline: 'var(--gap-lg)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line-strong)',
}

/** A switch, drawn only: the row it sits in is the button. */
function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        width: 44,
        height: 26,
        flexShrink: 0,
        borderRadius: 'var(--radius-pill)',
        background: on ? 'var(--color-appetite)' : 'var(--color-line-strong)',
        transition: 'background var(--dur-fast) var(--ease-emphasized)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: 'var(--shadow-xs)',
          transition: 'left var(--dur-fast) var(--ease-emphasized)',
        }}
      />
    </span>
  )
}

/**
 * Why this account cannot place an order, or null — said before a round trip
 * that would only be refused. Mirrors the server's account check
 * (buyerAccountService). An empty profile, still loading or missing the
 * fields, is no reason to refuse: the server repairs those.
 */
function orderBlocker(profile: object): string | null {
  const p = profile as Record<string, unknown>
  const role = asString(p.role)
  const status = asString(p.accountStatus)
  if (role && role !== 'buyer') {
    return `You are signed in with a ${role} account, and only customer accounts can place orders. Sign in with your customer account to check out.`
  }
  if (status && status !== 'active') {
    return `This account is ${status}, so it cannot place orders. Message support to sort it out.`
  }
  return null
}

/** The server's codes for an account that cannot order (buyerAccountService.ACCOUNT_CODES). */
const ACCOUNT_CODES = ['WRONG_ACCOUNT_TYPE', 'ACCOUNT_NOT_ACTIVE']

interface DraftFailure {
  message: string
  /** 'account': only support can fix it. 'retry': worth another go. */
  kind: 'account' | 'retry'
}

/**
 * Why the draft could not be started, and the one useful next step. The
 * server's refusals are already written for the customer, so they are shown
 * as they come.
 */
function draftFailure(e: unknown): DraftFailure {
  if (e instanceof ApiError && e.code && ACCOUNT_CODES.includes(e.code)) {
    return { message: e.message, kind: 'account' }
  }
  return { message: apiErrorMessage(e, 'We could not start your order. Try again.'), kind: 'retry' }
}

function openSupport(email: string) {
  const message = email
    ? `Hello Blorbmart, I cannot place an order. My account email is ${email}.`
    : 'Hello Blorbmart, I cannot place an order.'
  window.open(supportUrl(message), '_blank', 'noopener,noreferrer')
}
