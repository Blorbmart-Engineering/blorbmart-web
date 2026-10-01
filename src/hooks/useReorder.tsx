/* ═══════════════════════════════════════════════════════════════════════
   "Order again": a past order back in the basket in one tap.

   The server rebuilds the lines from today's menu (GET /:orderId/reorder),
   so the basket shows today's prices from the start. Whatever could not come
   back, and whatever costs something different now, is listed before the
   customer reaches the basket rather than discovered there.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { reorder, type Reorder } from '../data/orders'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { useCartStore } from '../store/cartStore'
import { Button } from '../ui/Button'
import { showToast } from '../ui/Screen'
import { ConfirmDialog, Sheet } from '../ui/Sheet'

type Review = { result: Reorder; stage: 'empty' | 'replace' | 'notes' }

export function useReorder() {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [review, setReview] = useState<Review | null>(null)

  const apply = (result: Reorder, replace: boolean) => {
    const add = useCartStore.getState().add
    result.lines.forEach((line, i) => add(line, replace && i === 0))
    if (result.unavailable.length || result.changed.length) {
      setReview({ result, stage: 'notes' })
      return
    }
    setReview(null)
    showToast('Added to your basket', 'success')
    navigate('/cart')
  }

  const start = async (orderId: string) => {
    if (busyId) return
    setBusyId(orderId)
    try {
      const result = await reorder(orderId)
      if (!result.lines.length) {
        setReview({ result, stage: 'empty' })
        return
      }
      const basket = useCartStore.getState().lines
      if (basket.length && basket[0].storeId !== result.storeId) {
        setReview({ result, stage: 'replace' })
        return
      }
      apply(result, false)
    } catch (e) {
      showToast(apiErrorMessage(e, 'We could not load that order.'), 'danger')
    } finally {
      setBusyId(null)
    }
  }

  const basketStore = useCartStore((s) => s.lines[0]?.storeName ?? '')

  const ui = (
    <>
      <ConfirmDialog
        open={review?.stage === 'replace'}
        title="Start a new basket?"
        message={`Your basket has items from ${basketStore || 'another store'}. Replace them with this order from ${review?.result.storeName || 'this store'}?`}
        confirmLabel="Replace"
        icon={<RotateCcw size={26} aria-hidden />}
        onConfirm={() => review && apply(review.result, true)}
        onCancel={() => setReview(null)}
      />

      <Sheet
        open={review?.stage === 'empty' || review?.stage === 'notes'}
        onClose={() => setReview(null)}
        title={review?.stage === 'empty' ? 'Nothing to add right now' : 'Added to your basket'}
      >
        {review && (
          <div style={{ display: 'grid', gap: 'var(--gap-lg)', paddingBottom: 'var(--gap-md)' }}>
            {review.stage === 'notes' && !review.result.storeOpen && (
              <p className="t-body-sm" style={{ margin: 0 }}>
                {review.result.storeName} is closed right now. You can schedule it for later at checkout.
              </p>
            )}
            {review.result.unavailable.length > 0 && (
              <div>
                <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
                  {review.stage === 'empty' ? 'Not available' : 'Left out'}
                </div>
                {review.result.unavailable.map((u, i) => (
                  <Row key={`u${i}`} name={u.name} detail={u.reason} />
                ))}
              </div>
            )}
            {review.result.changed.length > 0 && (
              <div>
                <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
                  New prices
                </div>
                {review.result.changed.map((c, i) => (
                  <Row key={`c${i}`} name={c.name} detail={`${money(c.was)} → ${money(c.now)} each`} />
                ))}
              </div>
            )}
            {review.stage === 'notes' ? (
              <Button
                label="Go to basket"
                glow
                onClick={() => {
                  setReview(null)
                  navigate('/cart')
                }}
              />
            ) : (
              <Button
                label={`Browse ${review.result.storeName || 'the menu'}`}
                kind="outline"
                onClick={() => {
                  setReview(null)
                  navigate(`/r/${review.result.storeId}`)
                }}
              />
            )}
          </div>
        )}
      </Sheet>
    </>
  )

  return { start, busyId, ui }
}

function Row({ name, detail }: { name: string; detail: string }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--gap-md)', padding: '6px 0', alignItems: 'baseline' }}>
      <span className="t-label clamp-1" style={{ flex: 1, minWidth: 0 }}>
        {name}
      </span>
      <span className="t-caption" style={{ textAlign: 'right' }}>
        {detail}
      </span>
    </div>
  )
}
