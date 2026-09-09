/* ═══════════════════════════════════════════════════════════════════════
   Add to Home Screen.

   Two platforms, two very different offers:

   * Android / Chromium gets a real one-tap install.
   * iOS Safari gets instructions, because Apple exposes no API — and on iOS
     this matters more than anywhere else, since push notifications only work
     at all once the app is on the Home Screen.

   Shown once the customer has actually used the app rather than on the first
   paint: an install prompt over a screen somebody has not read yet is the
   fastest way to a permanent dismissal.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import {
  dismissInstall,
  installDismissed,
  useInstallPrompt,
} from '../hooks/useInstallPrompt'
import { Button, IconButton } from '../ui/Button'
import { Sheet } from '../ui/Sheet'

/** Routes where an install nudge would be in the way of something important. */
const QUIET_ROUTES = ['/checkout', '/verify', '/login', '/signup', '/onboarding', '/']

export function InstallBanner() {
  const { pathname } = useLocation()
  const { canInstall, needsIosInstructions, promptInstall } = useInstallPrompt()
  const [visible, setVisible] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  useEffect(() => {
    if (installDismissed()) return
    if (!canInstall && !needsIosInstructions) return
    if (QUIET_ROUTES.includes(pathname)) return

    // A short delay so it arrives after the screen has settled, not during
    // the entrance animation.
    const timer = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(timer)
  }, [canInstall, needsIosInstructions, pathname])

  const close = () => {
    setVisible(false)
    dismissInstall()
  }

  if (!visible) return null

  return (
    <>
      <div
        role="complementary"
        aria-label="Install Blorbmart"
        className="blorb-fade-slide-in"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(var(--size-nav-bar) + var(--safe-bottom) + var(--gap-md))',
          zIndex: 40,
          width: 'min(calc(100% - 24px), 496px)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-md)',
          padding: 'var(--gap-md)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-line)',
          ['--fs-y' as string]: '12px',
        }}
      >
        <img
          src="/assets/icon.png"
          alt=""
          width={40}
          height={40}
          style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h4 clamp-1">Install Blorbmart</div>
          <div className="t-caption clamp-1">
            {needsIosInstructions
              ? 'Get order alerts and open it like an app'
              : 'Opens like an app, works offline'}
          </div>
        </div>

        <Button
          label="Install"
          size="sm"
          expand={false}
          icon={<Download size={15} aria-hidden />}
          onClick={() => {
            if (needsIosInstructions) setIosOpen(true)
            else void promptInstall().then(() => setVisible(false))
          }}
        />
        <IconButton label="Not now" size={32} onClick={close}>
          <X size={16} aria-hidden />
        </IconButton>
      </div>

      <Sheet open={iosOpen} onClose={() => setIosOpen(false)} title="Add to your Home Screen">
        <p className="t-body" style={{ margin: '0 0 var(--gap-xl)' }}>
          iPhone only allows this by hand, and it is what turns on order alerts.
        </p>

        <Step
          number={1}
          icon={<Share size={20} aria-hidden />}
          title="Tap the Share button"
          body="It is in the Safari toolbar — the square with an arrow pointing up."
        />
        <Step
          number={2}
          icon={<SquarePlus size={20} aria-hidden />}
          title="Choose Add to Home Screen"
          body="Scroll down the share sheet until you see it."
        />
        <Step
          number={3}
          icon={<Download size={20} aria-hidden />}
          title="Tap Add"
          body="Blorbmart lands on your Home Screen and opens full-screen from then on."
          last
        />

        <div style={{ marginTop: 'var(--gap-xl)' }}>
          <Button label="Got it" onClick={() => setIosOpen(false)} />
        </div>
      </Sheet>
    </>
  )
}

function Step({
  number,
  icon,
  title,
  body,
  last = false,
}: {
  number: number
  icon: React.ReactNode
  title: string
  body: string
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--gap-md)',
        paddingBottom: last ? 0 : 'var(--gap-lg)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-brand-soft)',
          color: 'var(--color-brand)',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4" style={{ display: 'block' }}>
          {number}. {title}
        </span>
        <span className="t-body-sm" style={{ display: 'block' }}>
          {body}
        </span>
      </span>
    </div>
  )
}
