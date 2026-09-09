/* ═══════════════════════════════════════════════════════════════════════
   Add to Home Screen.

   Two very different platforms behind one hook:

   * Android / Chromium fires `beforeinstallprompt`, which can be stashed and
     replayed from a tap of our own. That is a real one-tap install.

   * iOS Safari fires nothing and exposes no API. The only route is Share →
     Add to Home Screen, done by hand, so all we can do is say so — and only
     on iOS, only in Safari, and only when the app is not already installed.
     Showing those instructions anywhere else is noise.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { isStandalone } from '../lib/push'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'blorb_install_dismissed_v1'

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Safari is the only iOS browser that can install a web app. */
export function isIosSafari(): boolean {
  if (!isIos()) return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Chromium shows its own mini-infobar unless this is prevented; we want
      // the install offered where it makes sense, not over the menu.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event is single-use — Chromium will fire a fresh one if the customer
    // declines and becomes eligible again.
    setDeferred(null)
    return outcome === 'accepted'
  }, [deferred])

  return {
    /** A real one-tap install is available. */
    canInstall: !installed && deferred !== null,
    /** Installing is possible, but only by hand through the Share sheet. */
    needsIosInstructions: !installed && isIosSafari(),
    installed,
    promptInstall,
  }
}

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
  } catch {
    /* nothing to do */
  }
}
