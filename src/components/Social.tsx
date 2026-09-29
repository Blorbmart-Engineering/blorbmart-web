/* ═══════════════════════════════════════════════════════════════════════
   Blorb points, joining a group order by code, and rating a delivery.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Star, Users } from 'lucide-react'
import { ratingApi, rewardsApi, type OrderRating, type Rewards } from '../data/social'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/kit'
import { showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'
import { Field } from './AddressSheet'

/* ── Points ───────────────────────────────────────────────────────────── */

/**
 * The points balance, the streak and the cash-in. Loads itself and hides
 * itself if it cannot load: a missing points card is better than a broken one
 * on the screen people check their money on.
 */
export function PointsCard({ style }: { style?: CSSProperties }) {
  const [rewards, setRewards] = useState<Rewards | null>(null)
  const [open, setOpen] = useState(false)
  const [redeeming, setRedeeming] = useState(false)

  const load = () => rewardsApi.get().then(setRewards).catch(() => {})
  useEffect(() => {
    void load()
  }, [])

  if (!rewards) return null
  const { streak, rates } = rewards
  const toGo = Math.max(0, rates.minRedeem - rewards.points)

  const redeem = async () => {
    setRedeeming(true)
    try {
      const result = await rewardsApi.redeem(rewards.points)
      showToast(`${money(result.amount)} added to your wallet`, 'success')
      setOpen(false)
      await load()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <>
      <Card style={style} onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-amber-soft)',
              color: '#8A5D00',
            }}
          >
            <Star size={22} fill="currentColor" aria-hidden />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h3">{rewards.points.toLocaleString()} Blorb points</div>
            <div className="t-caption">
              {rewards.canRedeem ? `Worth ${money(rewards.worth)} — tap to cash in` : `${toGo.toLocaleString()} more to cash in`}
            </div>
          </div>
          {streak.count > 0 && (
            <span
              className="t-label-sm"
              title={`${streak.count}-day streak`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-appetite)' }}
            >
              <Flame size={18} fill="currentColor" aria-hidden />
              {streak.count}
            </span>
          )}
        </div>
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Blorb points">
        <p className="t-body" style={{ margin: '0 0 var(--gap-lg)' }}>
          You earn {rates.pointsPer100} point{rates.pointsPer100 === 1 ? '' : 's'} for every ₦100 of food, when it is
          delivered. Each point is worth {money(rates.pointValue)} in your wallet.
        </p>

        <Card color="var(--color-appetite-soft)" shadow="none">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
            <Flame size={26} fill="var(--color-appetite)" stroke="var(--color-appetite)" aria-hidden />
            <div style={{ flex: 1 }}>
              <div className="t-h4">
                {streak.count > 0 ? `${streak.count}-day streak` : 'No streak yet'}
                {streak.best > streak.count ? ` · best ${streak.best}` : ''}
              </div>
              <div className="t-caption">
                {streak.orderedToday
                  ? `Order again tomorrow to keep it going. Day ${streak.next.at} pays +${streak.next.bonus} points.`
                  : `Get an order delivered today — day ${streak.next.at} of a streak pays +${streak.next.bonus} points.`}
              </div>
            </div>
          </div>
        </Card>

        {rewards.history.length > 0 && (
          <div style={{ marginTop: 'var(--gap-lg)' }}>
            <div className="t-overline" style={{ marginBottom: 6 }}>
              Recent
            </div>
            {rewards.history.slice(0, 6).map((h) => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span className="t-body-sm clamp-1">{h.reason ?? (h.type === 'bonus' ? 'Bonus' : 'Points')}</span>
                <span
                  className="t-label-sm"
                  style={{ color: h.points < 0 ? 'var(--color-ink-muted)' : 'var(--color-success)' }}
                >
                  {h.points > 0 ? '+' : ''}
                  {h.points}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--gap-xl)' }}>
          <Button
            label={rewards.canRedeem ? `Cash in ${rewards.points.toLocaleString()} points · ${money(rewards.worth)}` : `Cash in from ${rates.minRedeem} points`}
            size="lg"
            disabled={!rewards.canRedeem}
            busy={redeeming}
            onClick={() => void redeem()}
          />
        </div>
      </Sheet>
    </>
  )
}

/* ── Join a group ─────────────────────────────────────────────────────── */

export function JoinGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

  return (
    <Sheet open={open} onClose={onClose} title="Join a group order">
      <p className="t-body" style={{ margin: '0 0 var(--gap-lg)' }}>
        Enter the six-character code your friend shared. Or just open the link they sent.
      </p>
      <Field label="Group code" value={code} onChange={setCode} placeholder="e.g. K7M2QX" />
      <Button
        label="Open the group"
        icon={<Users size={18} aria-hidden />}
        disabled={clean.length !== 6}
        onClick={() => {
          onClose()
          navigate(`/group/${clean}`)
        }}
      />
    </Sheet>
  )
}

/* ── Rating ───────────────────────────────────────────────────────────── */

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', lineHeight: 0 }}
        >
          <Star
            size={32}
            fill={n <= value ? 'var(--color-amber)' : 'none'}
            stroke={n <= value ? 'var(--color-amber)' : 'var(--color-ink-faint)'}
          />
        </button>
      ))}
    </div>
  )
}

function Tags({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--gap-sm)' }}>
      {options.map((t) => {
        const on = selected.includes(t)
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className="t-label-sm"
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${on ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
              background: on ? 'var(--color-brand-soft)' : 'var(--color-surface)',
              color: on ? 'var(--color-brand-ink)' : 'var(--color-ink-body)',
            }}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}

const toggle = (list: string[], t: string) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t])

/**
 * "How was it?" on a delivered order. Five seconds: stars for the food, stars
 * for the rider, an optional tap on a tag. Once sent it collapses to a thank
 * you, and it never asks twice.
 */
export function RatingCard({ orderDocId, hasRider, riderName }: { orderDocId: string; hasRider: boolean; riderName: string }) {
  const [existing, setExisting] = useState<OrderRating | null | undefined>(undefined)
  const [tags, setTags] = useState<{ food: string[]; rider: string[] }>({ food: [], rider: [] })
  const [food, setFood] = useState(0)
  const [rider, setRider] = useState(0)
  const [foodTags, setFoodTags] = useState<string[]>([])
  const [riderTags, setRiderTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ratingApi.get(orderDocId).then((r) => !cancelled && setExisting(r)).catch(() => !cancelled && setExisting(null))
    ratingApi.tags().then((t) => !cancelled && setTags(t)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orderDocId])

  if (existing === undefined) return null

  if (existing) {
    return (
      <Card style={{ marginTop: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <Star size={20} fill="var(--color-amber)" stroke="var(--color-amber)" aria-hidden />
          <span className="t-body-sm">
            You rated the food {existing.food}★{existing.rider ? ` and ${riderName || 'your rider'} ${existing.rider}★` : ''}. Thank you.
          </span>
        </div>
      </Card>
    )
  }

  const send = async () => {
    setSending(true)
    try {
      await ratingApi.submit({
        orderDocId,
        food,
        rider: hasRider && rider ? rider : null,
        foodTags,
        riderTags: hasRider && rider ? riderTags : [],
        comment: comment.trim() || undefined,
      })
      setExisting({ orderDocId, food, rider: hasRider && rider ? rider : null, foodTags, riderTags, comment: comment || null })
      showToast('Thanks — you earned a few Blorb points', 'success')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setSending(false)
    }
  }

  // Positive tags for a good score, the complaints for a poor one.
  const foodOptions = tags.food.filter((_, i) => (food && food <= 3 ? i >= 4 : i < 4))
  const riderOptions = tags.rider.filter((_, i) => (rider && rider <= 3 ? i >= 3 : i < 3))

  return (
    <Card style={{ marginTop: 'var(--gap-lg)' }} border="var(--color-amber)">
      <div className="t-h3">How was it?</div>
      <div className="t-caption" style={{ marginBottom: 'var(--gap-md)' }}>
        Five seconds, and a few Blorb points for you.
      </div>

      <div className="t-label-sm">The food</div>
      <Stars value={food} onChange={setFood} label="Rate the food" />
      {food > 0 && <Tags options={foodOptions} selected={foodTags} onToggle={(t) => setFoodTags((l) => toggle(l, t))} />}

      {hasRider && (
        <div style={{ marginTop: 'var(--gap-lg)' }}>
          <div className="t-label-sm">{riderName || 'Your rider'}</div>
          <Stars value={rider} onChange={setRider} label="Rate the rider" />
          {rider > 0 && (
            <Tags options={riderOptions} selected={riderTags} onToggle={(t) => setRiderTags((l) => toggle(l, t))} />
          )}
        </div>
      )}

      {food > 0 && (
        <div style={{ marginTop: 'var(--gap-lg)' }}>
          <Field label="Anything else? (optional)" value={comment} onChange={setComment} />
          <Button label="Send rating" busy={sending} onClick={() => void send()} />
        </div>
      )}
    </Card>
  )
}
