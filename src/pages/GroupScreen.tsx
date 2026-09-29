/* ═══════════════════════════════════════════════════════════════════════
   A group order: one store, one delivery, everyone pays for their own food.

   The same screen for the host and for everyone they share it with. Items
   come from the ordinary basket — "Add from the menu" opens the store, and
   "Put my basket in" moves what is there into the group — so there is no
   second menu to build or keep in step.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Copy, Share2, ShoppingBasket, Users, UtensilsCrossed } from 'lucide-react'
import { groupApi, groupLink, type Group, type GroupMember, type GroupPreview } from '../data/social'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { cartSubtotal, useCartStore } from '../store/cartStore'
import { useWalletPin } from '../components/WalletPinSheet'
import { Button } from '../ui/Button'
import { Card, EmptyState, Pill, Skeleton, type PillTone } from '../ui/kit'
import { FadeSlideIn, LivePulse } from '../ui/motion'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'

const STATUS_PILL: Record<GroupMember['status'], { label: string; tone: PillTone }> = {
  editing: { label: 'Choosing', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'success' },
  ordered: { label: 'In the order', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  left: { label: 'Left', tone: 'neutral' },
}

const ORDER_STAGE: Record<string, string> = {
  placed: 'Waiting for the kitchen',
  scheduled: 'Scheduled',
  confirmed: 'The kitchen accepted it',
  preparing: 'Being prepared',
  ready: 'Packed and waiting for a rider',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function useCountdown(to: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!to) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [to])
  if (!to) return null
  const left = Math.max(0, Math.floor((to - now) / 1000))
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
}

export default function GroupScreen() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const walletPin = useWalletPin()
  const lines = useCartStore((s) => s.lines)
  const clearCart = useCartStore((s) => s.clear)

  const [group, setGroup] = useState<Group | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<GroupPreview | null>(null)

  // The first load decides between "not found" and a group; after that a
  // failed background refresh just keeps what is on screen.
  const loaded = useRef(false)
  const load = useCallback(async () => {
    try {
      setGroup(await groupApi.get(code))
      loaded.current = true
    } catch {
      if (!loaded.current) setGroup(null)
    }
  }, [code])

  // Others join and pay while this is open, so it keeps itself fresh.
  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 8000)
    return () => clearInterval(id)
  }, [load])

  const countdown = useCountdown(group?.joinOpen ? group.closesAt : null)

  const act = async (key: string, fn: () => Promise<Group | void>, success?: string) => {
    setBusy(key)
    try {
      const next = await fn()
      if (next) setGroup(next)
      else await load()
      if (success) showToast(success, 'success')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  if (group === undefined) {
    return (
      <>
        <AppBar title="Group order" />
        <ScreenBody padded>
          <Skeleton height={150} radius="var(--radius-lg)" />
          <Skeleton height={220} radius="var(--radius-lg)" style={{ marginTop: 16 }} />
        </ScreenBody>
      </>
    )
  }

  if (group === null) {
    return (
      <>
        <AppBar title="Group order" />
        <EmptyState
          title="That group order does not exist"
          message="Check the code with whoever shared it. Codes are six letters and numbers."
          icon={<Users size={30} aria-hidden />}
          actionLabel="Back to home"
          onAction={() => navigate('/home')}
        />
      </>
    )
  }

  const open = group.status === 'open'
  const you = group.you
  const basket = lines.filter((l) => l.storeId === group.storeId)
  const basketOther = lines.length > 0 && basket.length === 0
  const link = groupLink(group.code)

  const share = async () => {
    const text = `Join my ${group.storeName} order on Blorbmart — one delivery, everyone pays for their own. Code ${group.code}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Blorbmart group order', text, url: link })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard?.writeText(`${text}\n${link}`).catch(() => {})
    showToast('Link copied — paste it in your group chat', 'success')
  }

  const putBasketIn = () =>
    act('basket', async () => {
      const next = await groupApi.setLines(group.code, basket)
      clearCart()
      return next
    }, 'Your items are in the group')

  const payShare = async () => {
    if (!you) return
    const pin = await walletPin.ask(money(you.subtotal))
    if (!pin) return
    await act('pay', () => groupApi.pay(group.code, pin), 'You are in. Your share is held until the order goes.')
  }

  const openPreview = async () => {
    setBusy('preview')
    try {
      setPreview(await groupApi.preview(group.code))
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  const place = async () => {
    if (!preview) return
    const pin = await walletPin.ask(money(preview.hostPays))
    if (!pin) return
    setBusy('place')
    try {
      const result = await groupApi.place(group.code, pin)
      setPreview(null)
      showToast('Group order placed 🎉', 'success')
      navigate(`/track/${result.orderId}`, { replace: true })
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(null)
      void load()
    }
  }

  return (
    <>
      <AppBar title={group.storeName || 'Group order'} subtitle={`Group order · ${group.code}`} />

      <ScreenBody bottomGap="190px" padded>
        {/* ── Status ───────────────────────────────────────────────────── */}
        <FadeSlideIn>
          <div
            style={{
              padding: 'var(--gap-xl)',
              borderRadius: 'var(--radius-xl)',
              background: open ? 'var(--gradient-brand)' : 'var(--color-surface-sunken)',
              color: open ? '#fff' : 'var(--color-ink)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {open && <LivePulse color="#fff" size={7} />}
              <span className="t-overline" style={{ color: 'inherit', opacity: 0.9 }}>
                {open
                  ? group.joinOpen
                    ? `Joining closes in ${countdown ?? ''}`
                    : 'Joining closed — waiting for the host'
                  : group.status === 'placed'
                    ? 'Order placed'
                    : group.status === 'delivered'
                      ? 'Delivered'
                      : group.status === 'placing'
                        ? 'Placing now…'
                        : 'Closed'}
              </span>
            </div>
            <div className="t-h1" style={{ color: 'inherit', margin: '8px 0 4px' }}>
              {group.totals.people} {group.totals.people === 1 ? 'person' : 'people'} · {money(group.totals.items)}
            </div>
            <div className="t-body-sm" style={{ color: 'inherit', opacity: 0.9 }}>
              {group.isHost ? 'You are hosting' : `Hosted by ${group.hostName}`}
              {group.dropoff ? ` · to ${group.dropoff}` : ''}
            </div>
            {!open && group.status !== 'placing' && (
              <p className="t-body-sm" style={{ margin: '10px 0 0' }}>
                {group.status === 'placed' || group.status === 'delivered'
                  ? ORDER_STAGE[group.orderStatus ?? ''] ?? 'In progress'
                  : 'This group was not placed. Anything paid into it is back in your wallet.'}
              </p>
            )}
          </div>
        </FadeSlideIn>

        {/* ── Invite ───────────────────────────────────────────────────── */}
        {open && group.joinOpen && (
          <FadeSlideIn delay={40}>
            <Card style={{ marginTop: 'var(--gap-lg)' }}>
              <div className="t-overline">Invite friends</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', marginTop: 8 }}>
                <span className="t-pin" style={{ letterSpacing: '0.2em', flex: 1 }}>
                  {group.code}
                </span>
                <Button label="Share" size="sm" expand={false} icon={<Share2 size={16} aria-hidden />} onClick={() => void share()} />
                <Button
                  label="Copy"
                  size="sm"
                  kind="outline"
                  expand={false}
                  icon={<Copy size={16} aria-hidden />}
                  onClick={() =>
                    void navigator.clipboard?.writeText(link).then(() => showToast('Link copied', 'success'))
                  }
                />
              </div>
              <p className="t-caption" style={{ margin: '8px 0 0' }}>
                Everyone pays for their own food from their wallet. The delivery fee is split between everyone who pays.
              </p>
            </Card>
          </FadeSlideIn>
        )}

        {/* ── People ───────────────────────────────────────────────────── */}
        <div className="t-overline" style={{ margin: 'var(--gap-xl) 0 var(--gap-sm)' }}>
          Who is in
        </div>
        {group.members.map((m, i) => (
          <FadeSlideIn key={m.uid} delay={60 + i * 30}>
            <Card style={{ marginBottom: 'var(--gap-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                <span
                  className="t-h4"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: m.isYou ? 'var(--color-brand)' : 'var(--color-brand-soft)',
                    color: m.isYou ? '#fff' : 'var(--color-brand-ink)',
                  }}
                >
                  {m.name.trim()[0]?.toUpperCase() ?? '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-h4 clamp-1">
                    {m.name}
                    {m.isYou ? ' (you)' : ''}
                  </div>
                  <div className="t-caption">
                    {m.itemCount ? `${m.itemCount} item${m.itemCount === 1 ? '' : 's'} · ${money(m.subtotal)}` : 'Nothing yet'}
                  </div>
                </div>
                {m.isHost ? <Pill label="Host" tone="brand" dense /> : <Pill {...STATUS_PILL[m.status]} dense />}
              </div>
              {m.lines.length > 0 && (
                <div style={{ marginTop: 'var(--gap-sm)', paddingLeft: 50 }}>
                  {m.lines.map((l, j) => (
                    <div key={j} className="t-body-sm" style={{ display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{l.quantity}×</span>
                      <span className="clamp-1" style={{ flex: 1 }}>
                        {l.name}
                        {l.addons.length ? ` · ${l.addons.join(', ')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </FadeSlideIn>
        ))}

        {/* ── Your part ────────────────────────────────────────────────── */}
        {open && group.joinOpen && you?.status !== 'paid' && (
          <FadeSlideIn delay={120}>
            <Card style={{ marginTop: 'var(--gap-lg)' }}>
              <div className="t-overline">Your food</div>
              {basket.length > 0 ? (
                <>
                  <p className="t-body-sm" style={{ margin: '6px 0 var(--gap-md)' }}>
                    Your basket has {basket.reduce((n, l) => n + l.quantity, 0)} item(s) from {group.storeName} ·{' '}
                    {money(cartSubtotal(basket))}.
                  </p>
                  <Button
                    label={you?.lines.length ? 'Replace my items with my basket' : 'Put my basket in'}
                    icon={<ShoppingBasket size={18} aria-hidden />}
                    busy={busy === 'basket'}
                    onClick={() => void putBasketIn()}
                  />
                </>
              ) : (
                <p className="t-body-sm" style={{ margin: '6px 0 var(--gap-md)' }}>
                  {basketOther
                    ? `Your basket has food from another store. Add from ${group.storeName} instead — it replaces your basket.`
                    : `Pick what you want from ${group.storeName}, then come back here.`}
                </p>
              )}
              <div style={{ marginTop: 'var(--gap-sm)' }}>
                <Button
                  label={`Add from ${group.storeName || 'the menu'}`}
                  kind="outline"
                  icon={<UtensilsCrossed size={18} aria-hidden />}
                  onClick={() => navigate(`/r/${group.storeId}?group=${group.code}`)}
                />
              </div>
            </Card>
          </FadeSlideIn>
        )}

        {open && you?.status === 'paid' && !group.isHost && (
          <Card style={{ marginTop: 'var(--gap-lg)' }} color="var(--color-success-soft)" border="var(--color-success)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
              <CheckCircle2 size={22} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="t-h4">You are in · {money(you.holdAmount)} held</div>
                <div className="t-caption">Your share of delivery is taken when {group.hostName} places the order.</div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--gap-md)' }}>
              <Button
                label="Take my money back"
                kind="ghost"
                busy={busy === 'unpay'}
                onClick={() => void act('unpay', () => groupApi.unpay(group.code), 'Your money is back in your wallet')}
              />
            </div>
          </Card>
        )}

        {open && !group.isHost && you && you.status !== 'paid' && (
          <div style={{ marginTop: 'var(--gap-lg)' }}>
            <Button
              label="Leave this group"
              kind="ghost"
              busy={busy === 'leave'}
              onClick={() =>
                void act('leave', async () => {
                  await groupApi.leave(group.code)
                  navigate('/home', { replace: true })
                })
              }
            />
          </div>
        )}

        {open && group.isHost && (
          <div style={{ marginTop: 'var(--gap-lg)' }}>
            <Button
              label="Cancel the group"
              kind="ghost"
              busy={busy === 'cancel'}
              onClick={() => void act('cancel', () => groupApi.cancel(group.code), 'Group cancelled. Everyone has been refunded.')}
            />
          </div>
        )}
      </ScreenBody>

      {/* ── The one action ─────────────────────────────────────────────── */}
      {open && group.isHost && (
        <StickyFooter>
          <Button
            label="Review and place the order"
            size="lg"
            glow
            busy={busy === 'preview'}
            disabled={group.totals.items <= 0}
            onClick={() => void openPreview()}
          />
        </StickyFooter>
      )}
      {open && !group.isHost && group.joinOpen && you && you.status === 'editing' && you.lines.length > 0 && (
        <StickyFooter>
          <Button label={`Pay my share · ${money(you.subtotal)}`} size="lg" glow busy={busy === 'pay'} onClick={() => void payShare()} />
        </StickyFooter>
      )}
      {(group.status === 'placed' || group.status === 'delivered') && group.isHost && group.orderDocId && (
        <StickyFooter>
          <Button label="Track the order" size="lg" onClick={() => navigate(`/track/${group.orderDocId}`)} />
        </StickyFooter>
      )}

      <Sheet open={preview != null} onClose={() => setPreview(null)} title="Place the group order">
        {preview && (
          <>
            {preview.people.map((p) => (
              <Row key={p.uid} label={p.name} value={`${money(p.items)} + ${money(p.feeShare)} delivery`} />
            ))}
            <Row label={`${preview.host.name} (you)`} value={`${money(preview.host.items)} + ${money(preview.host.feeShare)} delivery`} />
            <div style={{ borderTop: '1px dashed var(--color-line-strong)', margin: 'var(--gap-md) 0' }} />
            <Row label="Food" value={money(preview.itemsTotal)} />
            <Row label="Delivery and service" value={money(preview.fees)} />
            <Row label="Order total" value={money(preview.total)} strong />

            {preview.leftOut.length > 0 && (
              <p className="t-body-sm" style={{ color: 'var(--color-danger)', margin: 'var(--gap-md) 0 0' }}>
                {preview.leftOut.map((m) => m.name).join(', ')} {preview.leftOut.length === 1 ? 'has' : 'have'} not paid
                and will be left out.
              </p>
            )}
            <p className="t-caption" style={{ margin: 'var(--gap-md) 0' }}>
              If anyone’s wallet is short of their delivery share, you cover it — you will see it on your receipt.
            </p>
            <Button label={`Place and pay ${money(preview.hostPays)}`} size="lg" glow busy={busy === 'place'} onClick={() => void place()} />
          </>
        )}
      </Sheet>

      {walletPin.sheet}
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--gap-md)', padding: '5px 0' }}>
      <span className={strong ? 't-h4' : 't-body-sm'}>{label}</span>
      <span className={strong ? 't-price' : 't-body-sm'} style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
