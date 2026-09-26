/* ═══════════════════════════════════════════════════════════════════════
   Gift cards — the hub.

   Opens on the cards themselves, fanned out like a hand of them, because a
   gift card is bought on how it looks. Below: every occasion drawn for
   real, the cards you have sent (and whether they have been used), and the
   ones you have been given.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, PenLine, Send, Sparkles, TicketCheck, WalletCards } from 'lucide-react'
import GiftCardArt from '../lib/giftCardArt'
import { money, timeAgo } from '../lib/format'
import { warmUp } from '../lib/api'
import { giftStatusLabel, giftStatusTone, myGiftCards, type GiftCard } from '../data/giftCards'
import { isSignedIn, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody } from '../ui/Screen'
import { Card, Pill, SectionHeader, Skeleton } from '../ui/kit'
import { FadeSlideIn, staggerFor } from '../ui/motion'
import { GiftCardView } from '../components/gifts/GiftCardView'

const FAN = [
  { theme: 'love', amount: 10000, to: 'Zainab' },
  { theme: 'congrats', amount: 20000, to: 'Chidi' },
  { theme: 'birthday', amount: 5000, to: 'Ada' },
]

const SPARKLES = [
  { top: '18%', left: '8%', delay: '0s' },
  { top: '30%', left: '88%', delay: '0.8s' },
  { top: '62%', left: '4%', delay: '1.6s' },
  { top: '12%', left: '64%', delay: '2.1s' },
  { top: '74%', left: '92%', delay: '0.4s' },
]

export default function GiftCardsScreen() {
  const navigate = useNavigate()
  const signedIn = useSessionStore(isSignedIn)
  const [mine, setCards] = useState<{ sent: GiftCard[]; received: GiftCard[] } | null>(null)
  const cards = signedIn ? mine : { sent: [], received: [] }

  useEffect(() => {
    warmUp()
    if (!signedIn) return
    let cancelled = false
    myGiftCards()
      .then((c) => !cancelled && setCards(c))
      .catch(() => !cancelled && setCards({ sent: [], received: [] }))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  const start = (theme?: string) => navigate(theme ? `/gifts/new?theme=${theme}` : '/gifts/new')

  return (
    <>
      <ScreenBody bottomGap="150px">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="gift-hero">
          {SPARKLES.map((s, i) => (
            <span key={i} className="gift-hero__sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
          ))}
          <AppBar transparent onImage title="" />
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div className="t-overline" style={{ color: '#FFD27A', letterSpacing: '0.2em' }}>
              Blorbmart gift cards
            </div>
            <h1
              style={{
                margin: 'var(--gap-sm) 0 var(--gap-xs)',
                font: "600 clamp(30px, 8vw, 40px)/1.08 Fraunces, Georgia, serif",
                letterSpacing: '-0.01em',
              }}
            >
              Send a little <em style={{ fontWeight: 500, color: '#FFD27A' }}>joy</em>
            </h1>
            <p className="t-body-sm" style={{ margin: '0 auto', maxWidth: 320, color: 'rgba(255,255,255,0.78)' }}>
              A card that lands straight in their wallet — for food, groceries, bills and tickets.
            </p>
          </div>

          <div className="gift-fan" style={{ marginTop: 'var(--gap-xl)' }} onClick={() => start()}>
            {FAN.map((c) => (
              <GiftCardView key={c.theme} input={{ design: { theme: c.theme }, amount: c.amount, to: c.to }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-xl)', position: 'relative' }}>
            <Button label="Send a gift card" icon={<Gift size={18} aria-hidden />} glow onClick={() => start()} />
            <Button
              label="Redeem"
              kind="outline"
              expand={false}
              icon={<TicketCheck size={18} aria-hidden />}
              onClick={() => navigate('/gift')}
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', paddingInline: 'var(--gap-xl)' }}
            />
          </div>
        </section>

        {/* ── Occasions ────────────────────────────────────────────────── */}
        <SectionHeader title="Pick an occasion" subtitle="Every card is yours to reword and recolour" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 'var(--gap-lg) var(--gap-md)',
            padding: '0 var(--gap-page)',
          }}
        >
          {GiftCardArt.THEMES.map((theme, i) => (
            <FadeSlideIn key={theme.id} delay={staggerFor(i, 6)}>
              <button
                type="button"
                className="press"
                onClick={() => start(theme.id)}
                style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
              >
                <GiftCardView input={{ design: { theme: theme.id }, amount: 5000 }} />
                <span className="t-h4" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'var(--gap-sm)' }}>
                  {theme.custom && <PenLine size={15} aria-hidden style={{ color: 'var(--color-brand)' }} />}
                  {theme.name}
                </span>
                <span className="t-caption clamp-1" style={{ display: 'block' }}>
                  {theme.blurb}
                </span>
              </button>
            </FadeSlideIn>
          ))}
        </div>

        {/* ── Yours ────────────────────────────────────────────────────── */}
        {signedIn && (
          <>
            <SectionHeader title="Cards you have sent" subtitle="Tap one to show its code or share it again" />
            <div style={{ padding: '0 var(--gap-page)' }}>
              {cards === null ? (
                [0, 1].map((i) => (
                  <Skeleton key={i} height={84} radius="var(--radius-md)" style={{ marginBottom: 'var(--gap-sm)' }} />
                ))
              ) : cards.sent.length === 0 ? (
                <Card color="var(--color-brand-softer)" shadow="none" border="var(--color-brand-soft)">
                  <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center' }}>
                    <Sparkles size={22} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                    <p className="t-body-sm" style={{ margin: 0 }}>
                      Nothing sent yet. Your first card takes about a minute — and the code works the moment you pay.
                    </p>
                  </div>
                </Card>
              ) : (
                cards.sent.map((card, i) => (
                  <FadeSlideIn key={card.id} delay={staggerFor(i, 5)}>
                    <CardRow card={card} onClick={() => navigate(`/gifts/${card.id}`)} />
                  </FadeSlideIn>
                ))
              )}
            </div>

            {cards && cards.received.length > 0 && (
              <>
                <SectionHeader title="Gifts you have received" />
                <div style={{ padding: '0 var(--gap-page)' }}>
                  {cards.received.map((card) => (
                    <CardRow key={card.id} card={card} onClick={() => navigate(`/gifts/${card.id}`)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── How it works ─────────────────────────────────────────────── */}
        <SectionHeader title="How it works" />
        <div style={{ padding: '0 var(--gap-page)', display: 'grid', gap: 'var(--gap-sm)' }}>
          <Step
            icon={<PenLine size={19} aria-hidden />}
            title="Make it theirs"
            body="Choose an occasion, an amount from ₦2,000, and write them a note in your own hand."
          />
          <Step
            icon={<Send size={19} aria-hidden />}
            title="Send it however you like"
            body="Download the card, share it on WhatsApp, or have us email it to them."
          />
          <Step
            icon={<WalletCards size={19} aria-hidden />}
            title="They redeem it in seconds"
            body="They enter the code — or scan the QR on the card — and the money is in their wallet."
          />
        </div>
      </ScreenBody>
    </>
  )
}

function CardRow({ card, onClick }: { card: GiftCard; onClick: () => void }) {
  const theme = GiftCardArt.THEMES.find((t) => t.id === card.design.theme)
  const headline = card.design.headline || theme?.headline || 'Gift card'
  const when = card.role === 'received' ? card.redeemedAt : card.createdAt
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        width: '100%',
        padding: 'var(--gap-md) 0',
        border: 'none',
        borderBottom: '1px solid var(--color-line)',
        background: 'none',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ width: 92, flexShrink: 0 }}>
        <GiftCardView
          glow={false}
          input={{
            design: card.design,
            amount: card.amount,
            to: card.to,
            from: card.from,
            maskedCode: card.codeMasked ?? '••••-••••-••••-••••',
            note: card.role === 'received' ? 'In your wallet' : undefined,
          }}
        />
      </div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {headline}
          {card.role === 'sent' && card.to ? ` · ${card.to}` : ''}
          {card.role === 'received' && card.from ? ` · from ${card.from}` : ''}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block', margin: '2px 0 6px' }}>
          {timeAgo(when)}
        </span>
        <Pill dense tone={giftStatusTone(card.status)} label={card.role === 'received' ? 'Added to your wallet' : giftStatusLabel(card.status)} />
      </span>
      <span className="t-price" style={{ flexShrink: 0 }}>
        {money(card.amount)}
      </span>
    </button>
  )
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'flex-start', padding: 'var(--gap-md) 0' }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-brand-soft)',
          color: 'var(--color-brand)',
        }}
      >
        {icon}
      </span>
      <span>
        <span className="t-h4" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="t-body-sm" style={{ display: 'block' }}>
          {body}
        </span>
      </span>
    </div>
  )
}
