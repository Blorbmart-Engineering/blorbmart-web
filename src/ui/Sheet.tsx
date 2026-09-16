/* ═══════════════════════════════════════════════════════════════════════
   Bottom sheets and dialogs — ports of showBlorbSheet / confirmBlorb in
   lib/core/widgets/blorb_ui.dart.

   The app's standard chrome: rounded top, drag handle, safe-area padding, and
   a scrollable body that never exceeds 92% of the viewport.
   ═══════════════════════════════════════════════════════════════════════ */

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { SheetHandle } from './kit'

/**
 * Locks the page behind a modal.
 *
 * `position: fixed` rather than `overflow: hidden`, because iOS Safari
 * ignores the latter on `body` and scrolls the page under the sheet anyway.
 * The scroll offset is restored on close so nobody loses their place in a
 * long menu.
 *
 * ── Why the gutter is held open ────────────────────────────────────────────
 *
 * Fixing the body stops the document scrolling, so a desktop browser takes
 * its scrollbar away — and with it about fifteen pixels of page width. `#root`
 * is a 520px column centred with `margin-inline: auto`, so that width
 * arriving and leaving slides the entire app sideways every time a sheet
 * opens or closes. That is the "page shifts left and right" a customer sees
 * while opening a dish. Padding the body by exactly the width the scrollbar
 * gave up keeps the column where it was.
 *
 * Fixed overlays are laid out against the viewport rather than the padded
 * body, so they are told the same figure through `--scroll-gutter` and pad
 * themselves — otherwise the sheet would centre half a scrollbar to the right
 * of the column it belongs to.
 */
let lockDepth = 0
let release: (() => void) | null = null

function lockBody() {
  if (lockDepth++ > 0) return

  const y = window.scrollY
  const { body } = document
  const root = document.documentElement
  // Measured off the box rather than off clientWidth, which is rounded to a
  // whole pixel: at a fractional device scale a 15.33px scrollbar reads as 15
  // and leaves a third of a pixel of the jump behind.
  const gutter = window.innerWidth - root.getBoundingClientRect().width
  const previous = {
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  }

  body.style.position = 'fixed'
  body.style.top = `-${y}px`
  body.style.width = '100%'
  if (gutter > 0) {
    body.style.paddingRight = `${gutter}px`
    root.style.setProperty('--scroll-gutter', `${gutter}px`)
  }

  release = () => {
    body.style.position = previous.position
    body.style.top = previous.top
    body.style.width = previous.width
    body.style.paddingRight = previous.paddingRight
    root.style.removeProperty('--scroll-gutter')
    window.scrollTo(0, y)
  }
}

/**
 * Counted, because a sheet can open a dialog on top of itself — the basket
 * conflict in the dish customiser does exactly that. An uncounted lock would
 * let the dialog closing unfix the body while the sheet behind it is still
 * open, dropping the customer back to the top of the menu.
 */
function unlockBody() {
  lockDepth = Math.max(0, lockDepth - 1)
  if (lockDepth > 0) return
  release?.()
  release = null
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lockBody()
    return unlockBody
  }, [active])
}

/** Closes on Escape, and keeps focus inside while open. */
function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  showHandle?: boolean
  dismissible?: boolean
  /** Removes the default padding, for sheets that draw their own hero. */
  bare?: boolean
}

export function Sheet({
  open,
  onClose,
  children,
  title,
  showHandle = true,
  dismissible = true,
  bare = false,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    if (dismissible) onClose()
  }, [dismissible, onClose])

  useScrollLock(open)
  useDismiss(open, close)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: 'var(--scroll-gutter, 0px)',
      }}
    >
      <div
        aria-hidden
        onClick={close}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--scrim)',
          animation: 'blorb-fade-in var(--dur-fast) var(--ease-emphasized) both',
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0',
          boxShadow: 'var(--shadow-lg)',
          animation: 'blorb-sheet-up var(--dur-normal) var(--ease-emphasized) both',
          outline: 'none',
        }}
      >
        {showHandle && <SheetHandle />}
        {title && (
          <h2
            className="t-h2"
            style={{
              margin: 0,
              padding: `${showHandle ? '0' : 'var(--gap-xl)'} var(--gap-page) var(--gap-md)`,
            }}
          >
            {title}
          </h2>
        )}
        <div
          style={{
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            padding: bare
              ? undefined
              : '0 var(--gap-page) calc(var(--gap-xxl) + var(--safe-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  icon?: ReactNode
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation dialog in the house style. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  useScrollLock(open)
  useDismiss(open, onCancel)

  if (!open) return null

  const tone = destructive ? 'var(--color-danger)' : 'var(--color-brand)'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gap-xxxl)',
        paddingRight: 'calc(var(--gap-xxxl) + var(--scroll-gutter, 0px))',
      }}
    >
      <div
        aria-hidden
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--scrim)',
          animation: 'blorb-fade-in var(--dur-fast) var(--ease-emphasized) both',
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          padding: 'var(--gap-xxl)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          animation: 'blorb-pop var(--dur-normal) var(--ease-springy) both',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            background: `color-mix(in srgb, ${tone} 10%, transparent)`,
            color: tone,
          }}
        >
          {icon}
        </div>
        <h2 className="t-h2" style={{ margin: 'var(--gap-lg) 0 0' }}>
          {title}
        </h2>
        <p className="t-body" style={{ margin: 'var(--gap-sm) 0 0' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-xxl)' }}>
          <Button label={cancelLabel} kind="outline" size="md" onClick={onCancel} />
          <Button
            label={confirmLabel}
            kind={destructive ? 'danger' : 'brand'}
            size="md"
            busy={busy}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
