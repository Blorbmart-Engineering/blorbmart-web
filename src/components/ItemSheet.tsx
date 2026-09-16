/* ═══════════════════════════════════════════════════════════════════════
   The dish customiser — a port of lib/features/vendor/item_sheet.dart.

   Add-on groups drive their own validation: a required group blocks the CTA
   and names itself in the button label, so the customer is never left hunting
   for what is missing.
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState, type CSSProperties } from 'react'
import { Clock, Flame, Minus, Plus } from 'lucide-react'
import { compactCount, money } from '../lib/format'
import {
  addonOptionLabel,
  discountPercent,
  effectivePrice,
  groupRule,
  hasDiscount,
  isGroupRequired,
  isMultiSelect,
  itemImage,
  type MenuItem,
} from '../models/catalog'
import {
  addonUnits,
  cartLineFrom,
  MAX_ADDON_QUANTITY,
  type SelectedAddon,
} from '../models/cart'
import {
  cartBelongsToOtherStore,
  cartStoreName,
  useCartStore,
} from '../store/cartStore'
import { Button } from '../ui/Button'
import { Pill } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { ConfirmDialog, Sheet } from '../ui/Sheet'
import { SmartImage } from '../ui/SmartImage'
import { showToast } from '../ui/Screen'

/**
 * More than one of the same add-on.
 *
 * Two Cokes with one plate of rice was previously impossible: every option
 * was a single tick, so the only way to ask for a second drink was to order
 * the whole dish twice (QA, 15 Sep 2026, item 2). It appears only once the
 * option is ticked, so an untouched list still reads as a plain set of
 * choices.
 */
function AddonStepper({
  name,
  quantity,
  canAdd,
  onStep,
}: {
  name: string
  quantity: number
  canAdd: boolean
  onStep: (by: number) => void
}) {
  const round = (enabled: boolean): CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: '50%',
    background: 'var(--color-surface)',
    color: enabled ? 'var(--color-brand)' : 'var(--color-ink-disabled)',
  })

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        padding: 3,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface-sunken)',
      }}
    >
      <button
        type="button"
        className="press"
        aria-label={`One less ${name}`}
        onClick={() => onStep(-1)}
        style={round(true)}
      >
        <Minus size={14} aria-hidden />
      </button>
      <span className="t-h4 tnum" style={{ minWidth: 18, textAlign: 'center' }} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="press"
        aria-label={`One more ${name}`}
        disabled={!canAdd}
        onClick={() => onStep(1)}
        style={round(canAdd)}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  )
}

export function ItemSheet({
  item,
  open,
  onClose,
}: {
  item: MenuItem | null
  open: boolean
  onClose: () => void
}) {
  const lines = useCartStore((s) => s.lines)
  const add = useCartStore((s) => s.add)

  const [quantity, setQuantity] = useState(1)
  const [selected, setSelected] = useState<Record<string, SelectedAddon[]>>({})
  const [note, setNote] = useState('')
  const [conflict, setConflict] = useState(false)

  // Re-seeded whenever a different dish opens: defaults ticked, quantity back
  // to one, note cleared.
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (item && seededFor !== item.id) {
    const defaults: Record<string, SelectedAddon[]> = {}
    for (const group of item.addonGroups) {
      const chosen = group.options
        .filter((o) => o.isDefault && o.available)
        .slice(0, Math.max(group.max, 1))
        .map((o) => ({ group: group.name, name: o.name, price: o.price, quantity: 1 }))
      if (chosen.length) defaults[group.id] = chosen
    }
    setSelected(defaults)
    setQuantity(1)
    setNote('')
    setSeededFor(item.id)
  }

  const addons = useMemo(() => Object.values(selected).flat(), [selected])

  const unsatisfied = useMemo(() => {
    if (!item) return []
    // Counted in units: a group asking for two is satisfied by two of one
    // option just as well as by one of each.
    return item.addonGroups.filter(
      (g) => isGroupRequired(g) && addonUnits(selected[g.id] ?? []) < g.min,
    )
  }, [item, selected])

  if (!item) return null

  const addonTotal = addons.reduce((sum, a) => sum + a.price * a.quantity, 0)
  const unitTotal = effectivePrice(item) + addonTotal + item.packagingFee
  const total = unitTotal * quantity

  const toggle = (groupId: string, option: SelectedAddon, multi: boolean, max: number) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? []
      const already = current.some((a) => a.name === option.name)

      if (!multi) {
        // Single-choice: tapping the chosen one again clears it only when the
        // group is optional, so a required group can never end up empty by a
        // stray tap.
        const group = item.addonGroups.find((g) => g.id === groupId)
        if (already && group && !isGroupRequired(group)) {
          return { ...prev, [groupId]: [] }
        }
        return { ...prev, [groupId]: [option] }
      }

      if (already) {
        return { ...prev, [groupId]: current.filter((a) => a.name !== option.name) }
      }
      if (addonUnits(current) >= max) return prev
      return { ...prev, [groupId]: [...current, option] }
    })
  }

  /**
   * More, or fewer, of one add-on.
   *
   * A group's `max` is spent in units rather than in distinct options, so two
   * Cokes fill an "up to 2" group exactly as one Coke and one water would.
   * Stepping the last one down to zero is how an add-on is removed, which
   * keeps the tick and the stepper telling the same story.
   */
  const step = (groupId: string, name: string, by: number, max: number) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? []
      const chosen = current.find((a) => a.name === name)
      if (!chosen) return prev

      // Stepping the last one down is the same as unticking it, and is
      // allowed on a required group for the same reason unticking is: the
      // shortfall shows up in the button label rather than in a tap that
      // does nothing.
      const next = chosen.quantity + by
      if (next < 1) return { ...prev, [groupId]: current.filter((a) => a.name !== name) }
      if (by > 0 && (addonUnits(current) >= max || next > MAX_ADDON_QUANTITY)) return prev

      return {
        ...prev,
        [groupId]: current.map((a) => (a.name === name ? { ...a, quantity: next } : a)),
      }
    })
  }

  const commit = (replaceOtherStore: boolean) => {
    const line = cartLineFrom(item, { quantity, addons, note: note.trim() })
    const ok = add(line, replaceOtherStore)
    if (!ok) {
      setConflict(true)
      return
    }
    setConflict(false)
    showToast(`${quantity} × ${item.name} added`, 'success')
    onClose()
  }

  const submit = () => {
    if (unsatisfied.length > 0) return
    if (cartBelongsToOtherStore(lines, item.storeId)) {
      setConflict(true)
      return
    }
    commit(false)
  }

  const ctaLabel =
    unsatisfied.length > 0
      ? `Choose your ${unsatisfied[0].name.toLowerCase()}`
      : `Add to basket · ${money(total)}`

  return (
    <>
      <Sheet open={open} onClose={onClose} bare showHandle={false}>
        <div style={{ position: 'relative' }}>
          <SmartImage
            src={itemImage(item)}
            alt={item.name}
            height={220}
            renderWidth={520}
            eager
            fallback={
              <span className="t-h3" style={{ color: 'var(--color-ink-faint)' }}>
                {item.name}
              </span>
            }
          />
          {hasDiscount(item) && (
            <div style={{ position: 'absolute', top: 'var(--gap-md)', left: 'var(--gap-md)' }}>
              <Pill label={`Save ${discountPercent(item)}%`} tone="appetite" solid />
            </div>
          )}
        </div>

        <div style={{ padding: 'var(--gap-xl) var(--gap-page) 0' }}>
          <h2 className="t-h1" style={{ margin: 0 }}>
            {item.name}
          </h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-md)',
              margin: 'var(--gap-sm) 0',
              flexWrap: 'wrap',
            }}
          >
            <span className="t-price-lg">{money(effectivePrice(item))}</span>
            {hasDiscount(item) && <span className="t-price-struck">{money(item.price)}</span>}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-lg)',
              marginBottom: 'var(--gap-md)',
              flexWrap: 'wrap',
            }}
          >
            <span
              className="t-caption"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Clock size={14} aria-hidden />
              {item.prepMinutes} min to make
            </span>
            {item.totalSold > 0 && (
              <span
                className="t-caption"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Flame size={14} aria-hidden style={{ color: 'var(--color-appetite)' }} />
                {compactCount(item.totalSold)} ordered
              </span>
            )}
          </div>

          {item.description && (
            <p className="t-body" style={{ margin: '0 0 var(--gap-xl)' }}>
              {item.description}
            </p>
          )}

          {/* ── Add-on groups ─────────────────────────────────────────── */}
          {item.addonGroups.map((group) => {
            const chosen = selected[group.id] ?? []
            const multi = isMultiSelect(group)
            // Counts are spent against the group's maximum, so a group can
            // now be filled by three of one option rather than only by three
            // different ones. A tap that lands on a full group says so
            // instead of doing nothing.
            const full = multi && addonUnits(chosen) >= group.max
            return (
              <div key={group.id} style={{ marginBottom: 'var(--gap-xl)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-sm)',
                    marginBottom: 'var(--gap-md)',
                  }}
                >
                  <h3 className="t-h3" style={{ margin: 0, flex: 1 }}>
                    {group.name}
                  </h3>
                  <Pill
                    label={groupRule(group)}
                    tone={isGroupRequired(group) ? 'brand' : 'neutral'}
                    dense
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
                  {group.options.map((option) => {
                    const picked = chosen.find((a) => a.name === option.name)
                    const isChosen = Boolean(picked)
                    const disabled = !option.available
                    // A stepper only where repeating is allowed. On a
                    // single-choice group it would contradict the rule
                    // printed on the pill beside the heading.
                    const repeatable = multi && isChosen && !disabled
                    return (
                      <div
                        key={option.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--gap-sm)',
                          borderRadius: 'var(--radius-md)',
                          background: isChosen
                            ? 'var(--color-brand-soft)'
                            : 'var(--color-surface)',
                          border: `1px solid ${isChosen ? 'var(--color-brand)' : 'var(--color-line)'}`,
                          opacity: disabled ? 0.5 : 1,
                          paddingRight: repeatable ? 'var(--gap-sm)' : undefined,
                        }}
                      >
                        <PressScale
                          scale={0.99}
                          disabled={disabled}
                          onClick={() => {
                            if (full && !isChosen) {
                              showToast(
                                `Up to ${group.max} in ${group.name.toLowerCase()} — take one off first.`,
                              )
                              return
                            }
                            toggle(
                              group.id,
                              {
                                group: group.name,
                                name: option.name,
                                price: option.price,
                                quantity: 1,
                              },
                              multi,
                              group.max,
                            )
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--gap-md)',
                            flex: 1,
                            minWidth: 0,
                            padding: 'var(--gap-md)',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 20,
                              height: 20,
                              flexShrink: 0,
                              borderRadius: multi ? 'var(--radius-xs)' : '50%',
                              border: `2px solid ${isChosen ? 'var(--color-brand)' : 'var(--color-line-strong)'}`,
                              background: isChosen ? 'var(--color-brand)' : 'transparent',
                              boxShadow: isChosen ? 'inset 0 0 0 3px var(--color-surface)' : undefined,
                            }}
                          />
                          <span className="t-body clamp-1" style={{ flex: 1, minWidth: 0 }}>
                            {disabled ? `${option.name} · unavailable` : addonOptionLabel(option)}
                          </span>
                        </PressScale>

                        {repeatable && (
                          <AddonStepper
                            name={option.name}
                            quantity={picked!.quantity}
                            canAdd={addonUnits(chosen) < group.max && picked!.quantity < MAX_ADDON_QUANTITY}
                            onStep={(by) => step(group.id, option.name, by, group.max)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* ── Note ──────────────────────────────────────────────────── */}
          <h3 className="t-h3" style={{ margin: '0 0 var(--gap-xs)' }}>
            Anything for the kitchen?
          </h3>
          <p className="t-body-sm" style={{ margin: '0 0 var(--gap-md)' }}>
            Allergies, less pepper, extra sachet. They will see it.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 180))}
            placeholder="No pepper please"
            rows={2}
            aria-label="Note for the kitchen"
            style={{
              width: '100%',
              padding: 'var(--gap-md) var(--gap-lg)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-line-strong)',
              resize: 'none',
              outlineOffset: 2,
            }}
          />
        </div>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-md)',
            padding:
              'var(--gap-md) var(--gap-page) calc(var(--gap-md) + var(--safe-bottom))',
            marginTop: 'var(--gap-lg)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-line)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              height: 'var(--size-button-lg)',
              paddingInline: 'var(--gap-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="press"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                color: quantity <= 1 ? 'var(--color-ink-disabled)' : 'var(--color-brand)',
              }}
            >
              <Minus size={16} aria-hidden />
            </button>
            <span className="t-h4" style={{ minWidth: 20, textAlign: 'center' }}>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
              className="press"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                color: 'var(--color-brand)',
              }}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>

          <Button
            label={ctaLabel}
            onClick={submit}
            disabled={unsatisfied.length > 0}
            glow
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={conflict}
        title="Start a new basket?"
        message={`Your basket has items from ${cartStoreName(lines)}. One delivery comes from one kitchen, so adding this will clear what is there.`}
        confirmLabel="Start new basket"
        cancelLabel="Keep my basket"
        destructive
        onCancel={() => setConflict(false)}
        onConfirm={() => {
          setConflict(false)
          commit(true)
        }}
      />
    </>
  )
}
