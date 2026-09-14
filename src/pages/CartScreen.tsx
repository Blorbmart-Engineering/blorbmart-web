/* ═══════════════════════════════════════════════════════════════════════
   The basket — a port of lib/features/cart/cart_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBasket, Trash2 } from 'lucide-react'
import { money } from '../lib/format'
import { cachedVendor } from '../data/catalog'
import { lineSignature, lineTotal, addonSummary, type CartLine } from '../models/cart'
import {
  cartItemCount,
  cartStoreId,
  cartStoreName,
  cartSubtotal,
  useCartStore,
} from '../store/cartStore'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { DashedDivider, EmptyState, Stepper, SummaryRow } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { ConfirmDialog } from '../ui/Sheet'
import { AppBar, ScreenBody, StickyFooter } from '../ui/Screen'
import { SmartImage } from '../ui/SmartImage'

export default function CartScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)

  const lines = useCartStore((s) => s.lines)
  const increment = useCartStore((s) => s.increment)
  const decrement = useCartStore((s) => s.decrement)
  const removeLine = useCartStore((s) => s.removeLine)
  const clear = useCartStore((s) => s.clear)

  const [confirmClear, setConfirmClear] = useState(false)

  const subtotal = cartSubtotal(lines)
  const storeId = cartStoreId(lines)
  const store = storeId ? cachedVendor(storeId) : null
  const minOrder = store?.minOrder ?? 0
  const belowMinimum = minOrder > 0 && subtotal < minOrder

  if (lines.length === 0) {
    return (
      <>
        <AppBar title="Your basket" />
        <EmptyState
          title="Your basket is empty"
          message="Once you add something, it waits here for you — even if you close the app."
          icon={<ShoppingBasket size={30} aria-hidden />}
          actionLabel="Find something to eat"
          onAction={() => navigate('/home')}
        />
      </>
    )
  }

  return (
    <>
      <AppBar
        title="Your basket"
        subtitle={`${cartItemCount(lines)} item${cartItemCount(lines) === 1 ? '' : 's'} from ${cartStoreName(lines)}`}
        trailing={
          <IconButton label="Empty the basket" onClick={() => setConfirmClear(true)}>
            <Trash2 size={19} aria-hidden style={{ color: 'var(--color-danger)' }} />
          </IconButton>
        }
      />

      <ScreenBody bottomGap="var(--gap-xxl)" padded>
        {lines.map((line, i) => (
          <FadeSlideIn key={lineSignature(line)} delay={staggerFor(i, 5)}>
            <CartRow
              line={line}
              onIncrement={() => increment(lineSignature(line))}
              onDecrement={() => decrement(lineSignature(line))}
              onRemove={() => removeLine(lineSignature(line))}
            />
          </FadeSlideIn>
        ))}

        <div style={{ margin: 'var(--gap-xl) 0 var(--gap-md)' }}>
          <DashedDivider />
        </div>

        <SummaryRow label="Subtotal" value={money(subtotal)} />
        <SummaryRow
          label="Delivery and fees"
          value="At checkout"
          hint="Calculated from your address"
        />

        {belowMinimum && (
          <p
            className="t-body-sm"
            style={{
              margin: 'var(--gap-md) 0 0',
              padding: 'var(--gap-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-warning-soft)',
              color: '#9A5B00',
              fontWeight: 600,
            }}
          >
            {cartStoreName(lines)} has a {money(minOrder)} minimum. Add{' '}
            {money(minOrder - subtotal)} more to check out.
          </p>
        )}
      </ScreenBody>

      <StickyFooter>
        <Button
          label={belowMinimum ? `Minimum ${money(minOrder)}` : `Checkout · ${money(subtotal)}`}
          disabled={belowMinimum}
          glow
          onClick={() =>
            signedIn
              ? navigate('/checkout')
              : navigate('/login', { state: { from: '/checkout' } })
          }
        />
      </StickyFooter>

      <ConfirmDialog
        open={confirmClear}
        title="Empty your basket?"
        message="Everything in it will be removed. This cannot be undone."
        confirmLabel="Empty basket"
        destructive
        icon={<Trash2 size={26} aria-hidden />}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clear()
          setConfirmClear(false)
        }}
      />
    </>
  )
}

function CartRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: CartLine
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
}) {
  const addons = addonSummary(line)

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--gap-md)',
        padding: 'var(--gap-md) 0',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <SmartImage
        src={line.image}
        alt={line.name}
        width={72}
        height={72}
        renderWidth={72}
        radius="var(--radius-md)"
        fallback={
          <span className="t-caption-sm" style={{ padding: 4, textAlign: 'center' }}>
            {line.name.slice(0, 10)}
          </span>
        }
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-h4 clamp-1">{line.name}</div>
        {addons && (
          <div className="t-caption clamp-1" style={{ marginTop: 2 }}>
            {addons}
          </div>
        )}
        {line.note && (
          <div
            className="t-caption-sm clamp-1"
            style={{ marginTop: 2, color: 'var(--color-brand)' }}
          >
            “{line.note}”
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-md)',
            marginTop: 'var(--gap-sm)',
          }}
        >
          <span className="t-price">{money(lineTotal(line))}</span>
          <div style={{ flex: 1 }} />
          {/* At every quantity: stepping a line of five down to one just to
              reach the bin is five taps for what should be one. */}
          <IconButton label={`Remove ${line.name}`} size={32} onClick={onRemove}>
            <Trash2 size={16} aria-hidden style={{ color: 'var(--color-danger)' }} />
          </IconButton>
          <Stepper
            quantity={line.quantity}
            compact
            min={1}
            label={line.name}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
        </div>
      </div>
    </div>
  )
}
