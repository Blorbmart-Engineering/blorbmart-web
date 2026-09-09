/* ═══════════════════════════════════════════════════════════════════════
   Your account — a port of lib/features/profile/profile_screen.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Download,
  ExternalLink,
  GraduationCap,
  LogOut,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldCheck,
  User,
} from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { APP_VERSION } from '../lib/config'
import { canPromptForPush, isStandalone, pushState, requestPush } from '../lib/push'
import type { University } from '../data/university'
import {
  canChooseCampus,
  fullName,
  isBillsOnly,
  isSignedIn,
  photoUrl,
  sessionEmail,
  sessionPhone,
  universityName,
  useSessionStore,
} from '../store/sessionStore'
import { Button } from '../ui/Button'
import { Card, EmptyState, Pill } from '../ui/kit'
import { FadeSlideIn, PressScale } from '../ui/motion'
import { ConfirmDialog } from '../ui/Sheet'
import { ScreenBody, showToast } from '../ui/Screen'
import { CampusSheet } from '../components/AuthWidgets'
import { SmartImage } from '../ui/SmartImage'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const SUPPORT_URL =
  'https://wa.me/2349022594853?text=' + encodeURIComponent('Hello Blorbmart, I need help')

export default function AccountScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const signedIn = isSignedIn(session)

  const [campusOpen, setCampusOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [pushLabel, setPushLabel] = useState('Order and payment alerts')
  const [canAskPush, setCanAskPush] = useState(false)
  const { canInstall, promptInstall } = useInstallPrompt()

  useEffect(() => {
    void pushState().then((state) => {
      setPushLabel(
        state === 'granted'
          ? 'On — order and payment alerts'
          : state === 'denied'
            ? 'Blocked in your browser settings'
            : state === 'unsupported'
              ? isStandalone()
                ? 'Not supported on this browser'
                : 'Add Blorbmart to your Home Screen first'
              : 'Order and payment alerts',
      )
    })
    void canPromptForPush().then(setCanAskPush)
  }, [])

  if (!signedIn) {
    return (
      <ScreenBody bottomGap="150px">
        <div style={{ paddingTop: 'calc(var(--safe-top) + var(--gap-xl))' }}>
          <EmptyState
            title="You are browsing as a guest"
            message="Sign in to order, track deliveries and keep your addresses."
            icon={<User size={30} aria-hidden />}
            actionLabel="Sign in or create an account"
            onAction={() => navigate('/login', { state: { from: '/account' } })}
          />
        </div>
      </ScreenBody>
    )
  }

  const campusFixed = !canChooseCampus(session)
  const billsOnly = isBillsOnly(session)

  const chooseCampus = async (campus: University) => {
    try {
      await useSessionStore.getState().setUniversity(campus)
      setCampusOpen(false)
      showToast(`You are now shopping on ${campus.name}.`, 'success')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    }
  }

  const enablePush = async () => {
    const result = await requestPush()
    if (result === 'granted') {
      setPushLabel('On — order and payment alerts')
      setCanAskPush(false)
      showToast('Alerts are on.', 'success')
    } else if (result === 'unsupported') {
      showToast('Add Blorbmart to your Home Screen to get alerts.', 'neutral')
    } else {
      showToast('Alerts are blocked in your browser settings.', 'danger')
    }
  }

  return (
    <>
      <ScreenBody bottomGap="150px">
        {/* ── Identity ───────────────────────────────────────────────── */}
        <div
          style={{
            padding:
              'calc(var(--safe-top) + var(--gap-xxl)) var(--gap-page) var(--gap-xxl)',
            background: 'var(--gradient-brand)',
            borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)' }}>
            <div
              style={{
                width: 'var(--size-avatar-lg)',
                height: 'var(--size-avatar-lg)',
                flexShrink: 0,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.5)',
              }}
            >
              <SmartImage
                src={photoUrl(session)}
                alt=""
                width="100%"
                height="100%"
                renderWidth={64}
                fallback={
                  <span className="t-h2" style={{ color: 'var(--color-ink-faint)' }}>
                    {(fullName(session).trim()[0] ?? 'B').toUpperCase()}
                  </span>
                }
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h2 clamp-1" style={{ color: '#fff' }}>
                {fullName(session) || 'Your account'}
              </div>
              <div
                className="t-caption clamp-1"
                style={{ color: 'rgba(255,255,255,0.82)', marginTop: 2 }}
              >
                {sessionEmail(session)}
              </div>
              {sessionPhone(session) && (
                <div
                  className="t-caption clamp-1"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  {sessionPhone(session)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: 'var(--gap-xl) var(--gap-page) 0' }}>
          {/* ── Install ──────────────────────────────────────────────── */}
          {canInstall && (
            <FadeSlideIn>
              <Card
                color="var(--color-brand-softer)"
                border="var(--color-brand-soft)"
                shadow="none"
                style={{ marginBottom: 'var(--gap-lg)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                  <Download
                    size={22}
                    aria-hidden
                    style={{ color: 'var(--color-brand)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-h4">Install Blorbmart</div>
                    <div className="t-caption">Opens like an app, works offline</div>
                  </div>
                  <Button
                    label="Install"
                    size="sm"
                    expand={false}
                    onClick={() => void promptInstall()}
                  />
                </div>
              </Card>
            </FadeSlideIn>
          )}

          {/* ── Campus ───────────────────────────────────────────────── */}
          <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
            Your campus
          </div>
          <Card padding="0" style={{ marginBottom: 'var(--gap-xl)' }}>
            <Row
              icon={<GraduationCap size={20} aria-hidden />}
              title={
                billsOnly
                  ? 'Not listed yet — tap when we reach your campus'
                  : universityName(session) || 'Choose your campus'
              }
              subtitle={
                campusFixed
                  ? 'Your school is set for this account. Message support if it needs to change.'
                  : 'Choose your school'
              }
              onClick={campusFixed ? undefined : () => setCampusOpen(true)}
              trailing={campusFixed ? <Pill label="Locked" tone="neutral" dense /> : undefined}
            />
          </Card>

          {/* ── Ordering ─────────────────────────────────────────────── */}
          <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
            Ordering
          </div>
          <Card padding="0" style={{ marginBottom: 'var(--gap-xl)' }}>
            <Row
              icon={<MapPin size={20} aria-hidden />}
              title="Delivery addresses"
              subtitle="Where your orders go"
              onClick={() => navigate('/addresses')}
            />
            <Row
              icon={<Receipt size={20} aria-hidden />}
              title="Bill payments"
              subtitle="Airtime, data, power, TV"
              onClick={() => navigate('/bills')}
            />
            <Row
              icon={<Bell size={20} aria-hidden />}
              title="Notifications"
              subtitle={pushLabel}
              onClick={canAskPush ? () => void enablePush() : () => navigate('/notifications')}
              last
            />
          </Card>

          {/* ── Help ─────────────────────────────────────────────────── */}
          <div className="t-overline" style={{ marginBottom: 'var(--gap-sm)' }}>
            Help
          </div>
          <Card padding="0" style={{ marginBottom: 'var(--gap-xl)' }}>
            <Row
              icon={<MessageCircle size={20} aria-hidden />}
              title="Chat with support"
              subtitle="We reply on WhatsApp"
              external
              onClick={() => window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer')}
            />
            <Row
              icon={<ShieldCheck size={20} aria-hidden />}
              title="Terms and privacy"
              external
              onClick={() =>
                window.open('https://blorbmart.com/terms', '_blank', 'noopener,noreferrer')
              }
              last
            />
          </Card>

          <Button
            label="Sign out"
            kind="outline"
            icon={<LogOut size={18} aria-hidden />}
            onClick={() => setSignOutOpen(true)}
          />

          <div style={{ textAlign: 'center', marginTop: 'var(--gap-xxl)' }}>
            <img
              src="/assets/icon.png"
              alt=""
              width={36}
              height={36}
              style={{ margin: '0 auto', borderRadius: 'var(--radius-sm)', opacity: 0.6 }}
            />
            <p className="t-caption-sm" style={{ marginTop: 8 }}>
              Blorbmart · v{APP_VERSION}
            </p>
          </div>
        </div>
      </ScreenBody>

      <CampusSheet
        open={campusOpen}
        onClose={() => setCampusOpen(false)}
        selectedId={null}
        includeBillsOnly={false}
        title="Choose your campus"
        onSelect={(campus) => void chooseCampus(campus)}
      />

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="Your basket is saved and will be here when you come back."
        confirmLabel="Sign out"
        icon={<LogOut size={26} aria-hidden />}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false)
          void useSessionStore.getState().signOut().then(() => navigate('/welcome'))
        }}
      />
    </>
  )
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
  trailing,
  external = false,
  last = false,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  onClick?: () => void
  trailing?: ReactNode
  external?: boolean
  last?: boolean
}) {
  const content = (
    <>
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
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {title}
        </span>
        {subtitle && (
          <span className="t-caption clamp-2" style={{ display: 'block' }}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing ??
        (onClick ? (
          external ? (
            <ExternalLink size={17} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
          ) : (
            <ChevronRight size={19} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />
          )
        ) : null)}
    </>
  )

  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--gap-md)',
    width: '100%',
    padding: 'var(--gap-md) var(--gap-lg)',
    borderBottom: last ? 'none' : '1px solid var(--color-line)',
    textAlign: 'left' as const,
  }

  if (!onClick) return <div style={style}>{content}</div>
  return (
    <PressScale scale={0.99} onClick={onClick} style={style}>
      {content}
    </PressScale>
  )
}
