import { useEffect, useRef } from 'react'

/**
 * Runs `onBack` when the browser restores this page from its back-forward
 * cache.
 *
 * That is what Cancel on Paystack's page does: it goes back, and the page
 * returns exactly as it was left — mid-redirect, its button still spinning —
 * without remounting, so nothing in React resets it. A refresh got the
 * customer out only because a refresh is a remount.
 */
export function useBackFromPaystack(onBack: () => void): void {
  const latest = useRef(onBack)
  useEffect(() => {
    latest.current = onBack
  })

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) latest.current()
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])
}
