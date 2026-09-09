/* ═══════════════════════════════════════════════════════════════════════
   A payment option — a port of lib/core/widgets/payment_method_tile.dart.

   Used by checkout, the bill form and ticket checkout, so "pay with" looks
   and behaves identically wherever money leaves the account.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { PressScale } from '../ui/motion'

export type PayMethod = 'wallet' | 'paystack'

export function PaymentMethodTile({
  method,
  selected,
  onSelect,
  title,
  subtitle,
  disabled = false,
  disabledReason,
  icon,
}: {
  method: PayMethod
  selected: boolean
  onSelect: () => void
  title: string
  subtitle: string
  disabled?: boolean
  disabledReason?: string
  icon?: ReactNode
}) {
  return (
    <PressScale
      scale={0.99}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        width: '100%',
        padding: 'var(--gap-md) var(--gap-lg)',
        borderRadius: 'var(--radius-md)',
        background: selected ? 'var(--color-brand-soft)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-brand)' : 'var(--color-line)'}`,
        opacity: disabled ? 0.55 : 1,
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          color: 'var(--color-brand)',
          overflow: 'hidden',
        }}
      >
        {method === 'paystack' && !icon ? (
          <img
            src="/assets/paystack.png"
            alt=""
            width={40}
            height={40}
            style={{ objectFit: 'contain' }}
            onError={(e) => {
              // The logo is decoration; a card glyph says the same thing.
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          (icon ?? <CreditCard size={20} aria-hidden />)
        )}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {title}
        </span>
        <span
          className="t-caption clamp-1"
          style={{
            display: 'block',
            color: disabled && disabledReason ? 'var(--color-danger)' : undefined,
          }}
        >
          {disabled && disabledReason ? disabledReason : subtitle}
        </span>
      </span>

      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          border: `2px solid ${selected ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
          background: selected ? 'var(--color-brand)' : 'transparent',
          boxShadow: selected ? 'inset 0 0 0 3.5px var(--color-surface)' : undefined,
          transition: 'background var(--dur-fast) var(--ease-emphasized)',
        }}
      />
    </PressScale>
  )
}
