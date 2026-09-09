/* ═══════════════════════════════════════════════════════════════════════
   Checkout — a port of lib/features/checkout/checkout_screen.dart.

   The order document is created the moment this screen opens, because the
   backend needs something to price against. That is also why leaving without
   paying marks the draft abandoned on the way out.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Tag, Wallet, X } from 'lucide-react'
import { ApiError, apiErrorMessage, warmUp } from '../lib/api'
import { asDouble, asString, money } from '../lib/format'
import { goToPaystack } from '../lib/payment'
import {
  abandonDraft,
  calculatePricing,
  createOrder,
  notifyVendor,
  payWithWallet,
  startPaystack,
} from '../data/orders'
import { balance, invalidateBalance } from '../data/wallet'
import { addressToFirestore, addressLabel } from '../models/address'
import { cartSubtotal, cartVertical, useCartStore } from '../store/cartStore'
import { useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, DashedDivider, EmptyState, SummaryRow } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { AddressSheet } from '../components/AddressSheet'
import { PaymentMethodTile, type PayMethod } from '../components/PaymentMethodTile'

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
  const [total, setTotal] = useState(cartSubtotal(lines))

  const [walletBalance, setWalletBalance] = useState(0)
  const [method, setMethod] = useState<PayMethod>('paystack')

  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)

  const [note, setNote] = useState('')
  const [pricing, setPricing] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)

  const paidRef = useRef(false)
  const orderIdRef = useRef<string | null>(null)
  const createdRef = useRef(false)

  const address = session.address

  /**
   * The backend sleeps, and its first request costs about twenty seconds.
   * Waking it while the customer reads the summary moves that cost out of the
   * tap that is supposed to open Paystack.
   */
  useEffect(() => {
    warmUp()
    void balance().then(setWalletBalance)
  }, [])

  const refreshPricing = useCallback(
    async (id: string, code: string | null) => {
      setPricing(true)
      setPromoError(null)
      try {
        const data = await calculatePricing(id, code ?? undefined)
        const nextSubtotal = asDouble(data.subtotal, subtotal)
        const nextDelivery = asDouble(data.deliveryFee)
        const nextService = asDouble(data.serviceFee)
        const nextDiscount = asDouble(data.discountAmount ?? data.discount)

        setSubtotal(nextSubtotal)
        setDeliveryFee(nextDelivery)
        setServiceFee(nextService)
        setDiscount(nextDiscount)
        setTotal(
          asDouble(
            data.totalAmount ?? data.total,
            nextSubtotal - nextDiscount + nextDelivery + nextService,
          ),
        )

        if (code) {
          setPromoApplied(nextDiscount > 0 ? code.toUpperCase() : null)
          if (nextDiscount <= 0) setPromoError('That code did not apply.')
        }
      } catch (e) {
        if (code) setPromoError(apiErrorMessage(e, 'We could not apply that code.'))
        else setError(apiErrorMessage(e, 'We could not price this order. Try again.'))
      } finally {
        setPricing(false)
      }
    },
    [subtotal],
  )

  // Create the draft once, then price it.
  useEffect(() => {
    if (createdRef.current) return
    if (!lines.length || !address) return
    createdRef.current = true

    const run = async () => {
      try {
        const id = await createOrder({
          lines,
          address: addressToFirestore(address),
          subtotal: cartSubtotal(lines),
          deliveryFee: 0,
          serviceFee: 0,
          vertical: cartVertical(lines),
        })
        setOrderId(id)
        orderIdRef.current = id
        await refreshPricing(id, null)
      } catch (e) {
        setError(apiErrorMessage(e, 'We could not start your order. Try again.'))
        setPricing(false)
      }
    }
    void run()
  }, [lines, address, refreshPricing])

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

  const pay = async () => {
    if (!orderId || paying) return

    if (method === 'wallet' && walletBalance < total) {
      showToast(`Your wallet is short by ${money(total - walletBalance)}.`, 'danger')
      return
    }

    setPaying(true)
    setError(null)

    try {
      if (method === 'wallet') {
        await payWithWallet(orderId, promoApplied ?? undefined)
        await onPaid(orderId)
        return
      }

      const data = await startPaystack(orderId, promoApplied ?? undefined)
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
              {promoApplied} · you saved {money(discount)}
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
        <Button
          label={pricing ? 'Working out the total…' : `Pay ${money(total)}`}
          busy={paying}
          disabled={pricing || !orderId || !address}
          glow
          onClick={() => void pay()}
        />
      </StickyFooter>

      <AddressSheet
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        onChanged={() => {
          // A new address changes the delivery fee, so the order is re-priced.
          if (orderId) void refreshPricing(orderId, promoApplied)
        }}
      />
    </>
  )
}
