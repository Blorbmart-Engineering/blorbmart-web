/* ═══════════════════════════════════════════════════════════════════════
   Splash and boot — a port of lib/features/splash/splash_screen.dart.

   Starts the session, decides where the customer lands, and warms the caches
   the home screen is about to ask for.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { vendors } from '../data/catalog'
import { useCartStore } from '../store/cartStore'
import { useSessionStore } from '../store/sessionStore'
import { hasOnboarded } from './OnboardingScreen'
import { SplashVisual } from '../components/SplashVisual'

/** Resolves once Firebase has told us whether anybody is signed in. */
function authReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((user) => {
      unsub()
      resolve(!!user)
    })
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export default function SplashScreen() {
  const navigate = useNavigate()
  const booted = useRef(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true

    // Tells the customer something is happening if boot outlives the splash
    // animation, rather than leaving a logo sitting there.
    const slowTimer = setTimeout(() => setSlow(true), 4000)

    const boot = async () => {
      // The animation floor keeps the splash from flashing past on a fast
      // connection, which reads as a glitch rather than as speed.
      const floor = new Promise((resolve) => setTimeout(resolve, 1200))

      let destination = '/home'
      try {
        useSessionStore.getState().start()
        const signedIn = await authReady()

        if (!hasOnboarded()) {
          destination = '/onboarding'
        } else if (!signedIn) {
          destination = '/welcome'
        } else {
          // Warm the caches home is about to need. Failures are fine — home
          // retries and shows its own error state — so each warm-up is
          // swallowed independently and the whole set is capped so a slow
          // network cannot hold the splash open.
          await withTimeout(
            Promise.all([
              vendors().catch(() => []),
              useCartStore.getState().load().catch(() => undefined),
              useSessionStore.getState().loadAddresses().catch(() => []),
            ]),
            6000,
          )
        }
      } catch (e) {
        console.warn('[splash] boot failed', e)
        destination = auth.currentUser ? '/home' : '/welcome'
      }

      await floor
      clearTimeout(slowTimer)
      navigate(destination, { replace: true })
    }

    void boot()
    return () => clearTimeout(slowTimer)
  }, [navigate])

  return <SplashVisual slow={slow} />
}
