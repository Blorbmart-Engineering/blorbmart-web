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
import { verifyGiftCard } from '../data/giftCards'
import { useCartStore } from '../store/cartStore'
import { auth } from '../lib/firebase'
import { showToast } from '../ui/Screen'
import { PageLoader } from '../ui/Loader'

/** Settles the payment; returns navigation state for the screen it lands on. */
async function settle(pending: PendingPayment, reference: string): Promise<unknown> {
  let state: unknown
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
    case 'gift': {
      // The card's code is minted by this very confirmation, and comes back
      // with it once — handed to the card screen rather than stored.
      const result = await verifyGiftCard(pending.id, reference)
      state = { code: result.code, downloadToken: result.downloadToken, justBought: true }
      break
    }
  }
  invalidateBalance()
  return state
}

export default function PaymentReturn() {
  const navigate = useNavigate()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (running.current) return

    const pending = readPending()
    if (!pending) return

    // A pay-for-me link confirms its own payment (pages/PayScreen). Its
    // reference is in the address the same way, and a payment of this
    // customer's own left unfinished earlier must not be "confirmed" with it.
    if (window.location.pathname.startsWith('/pay/')) return

    // Verification is authenticated. If the session has not restored yet, wait
    // for it rather than failing a real payment on a race.
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || running.current) return
      running.current = true
      unsub()

      const reference = referenceFromUrl() ?? pending.reference
      setBusy(true)

      settle(pending, reference)
        .then((state) => {
          clearPending()
          showToast('Payment confirmed.', 'success')
          navigate(pending.returnTo, { replace: true, state })
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(246, 248, 252, 0.96)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div>
        <PageLoader label="Confirming your payment" fill={false} />
        <p className="t-body-sm" style={{ margin: '-8px auto 0', maxWidth: 280, textAlign: 'center' }}>
          Keep this page open. It usually takes a few seconds.
        </p>
      </div>
    </div>
  )
}
