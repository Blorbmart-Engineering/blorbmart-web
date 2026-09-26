/* The way into gift cards from the wallet: send one, or redeem one. */

import { useNavigate } from 'react-router-dom'
import { Gift, TicketCheck } from 'lucide-react'
import { GiftCardView } from './GiftCardView'

export function GiftCardsPromo() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--gap-lg)',
        background:
          'radial-gradient(120% 120% at 100% 0%, rgba(255,79,184,0.45), transparent 55%), linear-gradient(140deg, #140b3a 0%, #2a0f68 60%, #0b3e86 100%)',
        color: '#fff',
        boxShadow: '0 14px 30px -18px rgba(42, 15, 104, 0.8)',
      }}
    >
      <div
        aria-hidden
        onClick={() => navigate('/gifts')}
        style={{ position: 'absolute', right: -18, top: 14, width: 150, transform: 'rotate(10deg)', cursor: 'pointer' }}
      >
        <GiftCardView glow={false} input={{ design: { theme: 'birthday' }, amount: 5000 }} />
      </div>
      <div
        aria-hidden
        style={{ position: 'absolute', right: 58, top: 46, width: 132, transform: 'rotate(-8deg)', pointerEvents: 'none' }}
      >
        <GiftCardView glow={false} input={{ design: { theme: 'love' }, amount: 10000 }} />
      </div>

      <div style={{ position: 'relative', maxWidth: '58%' }}>
        <div className="t-overline" style={{ color: '#FFD27A' }}>
          New
        </div>
        <div style={{ font: '600 22px/1.15 Fraunces, Georgia, serif', margin: '4px 0 6px' }}>Gift cards</div>
        <p className="t-caption" style={{ margin: 0, color: 'rgba(255,255,255,0.78)' }}>
          Beautiful cards from ₦2,000 that land in their wallet.
        </p>
      </div>

      <div style={{ position: 'relative', display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
        <PromoButton icon={<Gift size={16} aria-hidden />} label="Send one" solid onClick={() => navigate('/gifts')} />
        <PromoButton icon={<TicketCheck size={16} aria-hidden />} label="Redeem a code" onClick={() => navigate('/gift')} />
      </div>
    </div>
  )
}

function PromoButton({
  icon,
  label,
  onClick,
  solid = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  solid?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press t-label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '0 var(--gap-lg)',
        borderRadius: 'var(--radius-pill)',
        border: solid ? 'none' : '1px solid rgba(255,255,255,0.4)',
        background: solid ? '#fff' : 'rgba(255,255,255,0.08)',
        color: solid ? '#2a0f68' : '#fff',
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
