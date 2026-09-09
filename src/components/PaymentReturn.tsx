/* ═══════════════════════════════════════════════════════════════════════
   Picks a Paystack transaction back up after the redirect.

   Mounted once, above the router, so it runs whichever route the customer
   lands back on — Paystack's redirect, the back button, or the installed app
   icon. Until it settles it holds a blocking overlay, because a half-verified
   payment is the one moment where letting somebody wander off costs real
   money.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import {
  clearPending,
  readPending,
  referenceFromUrl,
  type PendingPayment,
} from '../lib/payment'
import { verifyPaystack } from '../data/orders'
import { verifyTopUp, invalidateBalance } from '../data/wallet'
import { verify as verifyBill } from '../data/bills'
import { verifyTicketOrder } from '../data/events'
import { useCartStore } from '../store/cartStore'
import { auth } from '../lib/firebase'
import { showToast } from '../ui/Screen'

async function settle(pending: PendingPayment, reference: string): Promise<void> {
  switch (pending.kind) {
    case 'order':
      await verifyPaystack(reference, pending.id)
      // The basket only clears once the money is confirmed — a failed
      // verification must leave the customer their order to retry.
      useCartStore.getState().clear()
      break
    case 'wallet':
      await verifyTopUp(reference)
      break
    case 'bill':
      await verifyBill(pending.id, reference)
      break
    case 'ticket':
      await verifyTicketOrder(pending.id, reference)
      break
  }
  invalidateBalance()
}

export default function PaymentReturn() {
  const navigate = useNavigate()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (running.current) return

    const pending = readPending()
    if (!pending) return

    // Verification is authenticated. If the session has not restored yet, wait
    // for it rather than failing a real payment on a race.
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || running.current) return
      running.current = true
      unsub()

      const reference = referenceFromUrl() ?? pending.reference
      setBusy(true)

      settle(pending, reference)
        .then(() => {
          clearPending()
          showToast('Payment confirmed.', 'success')
          navigate(pending.returnTo, { replace: true })
        })
        .catch((e) => {
          clearPending()
          showToast(
            apiErrorMessage(e, 'We could not confirm that payment. Check your history.'),
            'danger',
          )
        })
        .finally(() => setBusy(false))
    })

    return unsub
  }, [navigate])

  if (!busy) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(246, 248, 252, 0.94)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ textAlign: 'center', padding: 'var(--gap-page)' }}>
        <LoaderCircle
          size={34}
          aria-hidden
          style={{
            color: 'var(--color-brand)',
            animation: 'blorb-spin 900ms linear infinite',
          }}
        />
        <h2 className="t-h3" style={{ margin: 'var(--gap-lg) 0 var(--gap-xs)' }}>
          Confirming your payment
        </h2>
        <p className="t-body-sm" style={{ margin: 0, maxWidth: 280 }}>
          Do not close this page. This usually takes a few seconds.
        </p>
      </div>
    </div>
  )
}
