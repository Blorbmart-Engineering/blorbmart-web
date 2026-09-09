/* ═══════════════════════════════════════════════════════════════════════
   The persistent frame — a port of lib/features/shell/blorb_shell.dart.

   Four tabs, plus a cart bar that rises above the navigation whenever there
   is something in the basket.
   ═══════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  House,
  Receipt,
  ReceiptText,
  User,
  Wallet,
} from 'lucide-react'
import { useCartStore, cartItemCount, cartStoreName, cartSubtotal } from '../store/cartStore'
import { useSessionStore, isBillsOnly } from '../store/sessionStore'
import { money } from '../lib/format'
import { useAnimatedNumber } from '../ui/motion'

interface TabSpec {
  label: string
  to: string
  icon: typeof House
}

/** The ordinary shell: browse, orders, wallet, account. */
const MARKET_TABS: TabSpec[] = [
  { label: 'Home', to: '/home', icon: House },
  { label: 'Orders', to: '/orders', icon: ReceiptText },
  { label: 'Wallet', to: '/wallet', icon: Wallet },
  { label: 'Account', to: '/account', icon: User },
]

/**
 * The shell for somebody whose school we have not reached yet.
 *
 * Three tabs, not four. There is no marketplace on this account, so there is
 * nothing to order and no order history to keep — an Orders tab here could
 * only ever say "no orders yet" to somebody who has no way to place one,
 * which reads as a broken app rather than a narrower one. What they actually
 * have is bills, the wallet that pays for them, and their account. Past bill
 * payments live behind History on the Bills screen, where the thing they are
 * a history of is.
 */
const BILLS_TABS: TabSpec[] = [
  { label: 'Bills', to: '/bills', icon: Receipt },
  { label: 'Wallet', to: '/wallet', icon: Wallet },
  { label: 'Account', to: '/account', icon: User },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const billsOnly = useSessionStore(isBillsOnly)
  const tabs = billsOnly ? BILLS_TABS : MARKET_TABS

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>{children}</main>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          maxWidth: 520,
          margin: '0 auto',
          pointerEvents: 'none',
        }}
      >
        {/* Nothing can be in a basket without a marketplace to fill it from. */}
        {!billsOnly && <CartBar />}
        <NavBar tabs={tabs} />
      </div>
    </div>
  )
}

/**
 * Custom navigation bar.
 *
 * Built by hand rather than with a stock component because that cannot do the
 * two things that make this feel considered: an icon that swaps from outline
 * to filled, and a soft brand-tinted pill that slides under the active tab.
 */
function NavBar({ tabs }: { tabs: TabSpec[] }) {
  return (
    <nav
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        height: 'var(--size-nav-bar)',
        paddingBottom: 'var(--safe-bottom)',
        boxSizing: 'content-box',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        boxShadow: 'var(--shadow-lift)',
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="press"
          style={{ ['--press-scale' as string]: '0.9', flex: 1 }}
        >
          {({ isActive }) => (
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 'var(--size-nav-bar)',
                gap: 3,
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                  width: isActive ? 52 : 30,
                  height: 30,
                  borderRadius: 'var(--radius-pill)',
                  background: isActive ? 'var(--color-brand-soft)' : 'transparent',
                  transition: 'width var(--dur-normal) var(--ease-emphasized), background var(--dur-normal) var(--ease-emphasized)',
                }}
              >
                <tab.icon
                  size={22}
                  aria-hidden
                  fill={isActive ? 'currentColor' : 'none'}
                  strokeWidth={isActive ? 2 : 1.9}
                  style={{
                    color: isActive ? 'var(--color-brand)' : 'var(--color-ink-faint)',
                    transition: 'color var(--dur-fast) var(--ease-emphasized)',
                  }}
                />
              </span>
              <span
                className="t-caption-sm"
                style={{
                  color: isActive ? 'var(--color-brand)' : 'var(--color-ink-faint)',
                  fontWeight: isActive ? 800 : 600,
                  transition: 'color var(--dur-fast) var(--ease-emphasized)',
                }}
              >
                {tab.label}
              </span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * The floating basket bar.
 *
 * Present on every tab the moment anything is added, because the single
 * biggest cause of abandoned food orders is people forgetting they have a
 * basket open.
 */
export function CartBar() {
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const subtotal = cartSubtotal(lines)
  const animated = useAnimatedNumber(subtotal)

  if (!lines.length) return null

  return (
    <div style={{ pointerEvents: 'auto', padding: '0 var(--gap-md) var(--gap-sm)' }}>
      <button
        type="button"
        onClick={() => navigate('/cart')}
        className="press blorb-fade-slide-in"
        style={{
          ['--press-scale' as string]: '0.98',
          ['--fs-y' as string]: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-md)',
          width: '100%',
          height: 'var(--size-cart-bar)',
          paddingInline: 'var(--gap-lg)',
          background: 'var(--gradient-brand)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-brand)',
          color: '#fff',
        }}
      >
        <span
          className="t-label"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.22)',
            color: '#fff',
          }}
        >
          {cartItemCount(lines)}
        </span>

        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span className="t-label" style={{ display: 'block', color: '#fff' }}>
            View basket
          </span>
          <span
            className="t-caption-sm clamp-1"
            style={{ display: 'block', color: 'rgba(255,255,255,0.85)' }}
          >
            {cartStoreName(lines)}
          </span>
        </span>

        <span className="t-price" style={{ color: '#fff', fontSize: 16 }}>
          {money(animated)}
        </span>
        <ArrowRight size={20} aria-hidden />
      </button>
    </div>
  )
}
