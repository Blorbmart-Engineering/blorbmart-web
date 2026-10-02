/* ═══════════════════════════════════════════════════════════════════════
   "Not listed? Send your list" — a free-text shopping list at the campus
   market, bought by the rider against a budget the customer sets.

   It goes in the basket as one line (kind 'list'): the note is the list, the
   price is the budget. The customer pays the budget at checkout; the rider
   says what it really cost, and the change comes back to the wallet when
   the order is delivered (backend marketListService).
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { money } from '../lib/format'
import { lineSignature, type CartLine } from '../models/cart'
import { useCartStore } from '../store/cartStore'
import { Button } from '../ui/Button'
import { showToast } from '../ui/Screen'
import { ConfirmDialog, Sheet } from '../ui/Sheet'

/** The same limits the server holds (MARKET_LIST_MIN/MAX_BUDGET). */
const LIST_MIN_BUDGET = 500
const LIST_MAX_BUDGET = 30000
const MAX_LIST = 600

function isListLine(line: CartLine): boolean {
  return line.kind === 'list'
}

export function MarketListSheet({
  open,
  onClose,
  storeId,
  storeName,
  initialList = '',
}: {
  open: boolean
  onClose: () => void
  storeId: string
  storeName: string
  /** Prefilled from the search box when nothing matched it. */
  initialList?: string
}) {
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const existing = lines.find((l) => l.storeId === storeId && isListLine(l))
  const [list, setList] = useState('')
  const [budget, setBudget] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)

  // Opening again edits the list already in the basket rather than adding a
  // second one.
  useEffect(() => {
    if (!open) return
    setList(existing?.note || initialList)
    setBudget(existing ? String(existing.unitPrice) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const amount = Number(budget.replace(/[^\d]/g, ''))
  const problem = !list.trim()
    ? 'Write down what you want.'
    : !amount
      ? 'Set a budget.'
      : amount < LIST_MIN_BUDGET
        ? `The budget needs to be at least ${money(LIST_MIN_BUDGET)}.`
        : amount > LIST_MAX_BUDGET
          ? `The budget can be up to ${money(LIST_MAX_BUDGET)}.`
          : null

  const save = (replaceOtherStore: boolean) => {
    const store = useCartStore.getState()
    if (!replaceOtherStore && store.lines.length && store.lines[0].storeId !== storeId) {
      setConfirmReplace(true)
      return
    }
    if (existing) store.removeLine(lineSignature(existing))
    const line: CartLine = {
      kind: 'list',
      itemId: 'market_list',
      name: 'Shopping list',
      unitPrice: amount,
      quantity: 1,
      storeId,
      storeName,
      image: '',
      addons: [],
      note: list.trim(),
      packagingFee: 0,
      vertical: 'market',
    }
    store.add(line, replaceOtherStore)
    setConfirmReplace(false)
    onClose()
    showToast(existing ? 'List updated' : 'List added to your basket', 'success')
    navigate('/cart')
  }

  return (
    <>
      <Sheet open={open && !confirmReplace} onClose={onClose} title="Send your list">
        <div style={{ display: 'grid', gap: 'var(--gap-md)', paddingBottom: 'var(--gap-lg)' }}>
          <p className="t-body-sm" style={{ margin: 0 }}>
            Not on the list? Write what you want and the most you’ll spend. A rider buys it at the
            market, and whatever is left of your budget comes back to your wallet.
          </p>
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value.slice(0, MAX_LIST))}
            placeholder={'2 congo of garri\n1 derica of beans\nTitus fish, medium'}
            aria-label="Your shopping list"
            rows={5}
            style={{
              width: '100%',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line-strong)',
              resize: 'vertical',
            }}
          />
          <label className="t-label" style={{ display: 'grid', gap: 6 }}>
            Your budget (₦)
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="8000"
              aria-label="Your budget in naira"
              style={{
                height: 'var(--size-button-md)',
                paddingInline: 'var(--gap-lg)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line-strong)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </label>
          <p className="t-caption" style={{ margin: 0 }}>
            The rider never spends more than this. You pay it plus delivery at checkout.
          </p>
          <Button
            label={amount ? `Add list · ${money(amount)} budget` : 'Add list to basket'}
            glow
            icon={<ClipboardList size={18} aria-hidden />}
            disabled={Boolean(problem)}
            onClick={() => save(false)}
          />
          {problem && list.trim() && (
            <p className="t-caption" style={{ margin: 0, textAlign: 'center' }}>
              {problem}
            </p>
          )}
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmReplace}
        title="Start a new basket?"
        message={`Your basket has items from ${lines[0]?.storeName || 'another store'}. Replace them with your market list?`}
        confirmLabel="Replace"
        onConfirm={() => save(true)}
        onCancel={() => setConfirmReplace(false)}
      />
    </>
  )
}
