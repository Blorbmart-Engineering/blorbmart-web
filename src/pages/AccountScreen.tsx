/* ═══════════════════════════════════════════════════════════════════════
   Your account — a port of lib/features/profile/profile_screen.dart.

   Structurally verbatim: the same title bar, the same gradient identity card
   inset from the page edges, the same three groups in the same order
   (Ordering, Support, Account), the same bare-icon rows under an overline
   caption, the same red sign-out tile rather than a button, and the same
   faded mark and version line at the foot.

   Two things exist here that have no counterpart on a phone, and both are
   folded into that structure rather than bolted beside it: the install prompt
   sits above the first group and appears only while the browser offers one,
   and the notification permission state is the subtitle of the Notifications
   row — which is where the phone already puts a subtitle.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Download,
  FileText,
  Gift,
  GraduationCap,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldAlert,
  Share2,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { APP_VERSION } from '../lib/config'
import { maskPhone } from '../lib/format'
import { addressLabel } from '../models/address'
import { PushToggle } from '../components/PushToggle'
import { SUPPORT_EMAIL, supportEmailUrl, supportUrl } from '../lib/support'
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
import { Card } from '../ui/kit'
import { FadeSlideIn, PressScale } from '../ui/motion'
import { ConfirmDialog } from '../ui/Sheet'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { CampusSheet } from '../components/AuthWidgets'
import { EmergencyContactSheet, SosCard } from '../components/SafetySheet'
import { JoinGroupSheet, PointsCard } from '../components/Social'
import { SmartImage } from '../ui/SmartImage'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { referralApi, type ReferralOverview } from '../data/referral'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

export default function AccountScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const signedIn = isSignedIn(session)

  const [campusOpen, setCampusOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const { canInstall, promptInstall } = useInstallPrompt()
  const [loadedReferral, setReferral] = useState<ReferralOverview | null>(null)

  const uid = session.user?.uid
  useEffect(() => {
    if (!uid) return
    referralApi.me().then(setReferral).catch(() => {})
  }, [uid])
  // Hidden the moment the account signs out, without waiting for a refetch.
  const referral = signedIn ? loadedReferral : null

  const shareInvite = async () => {
    if (!referral) return
    const link = referral.referralLink
    const text = 'Order food, pay bills and buy event tickets on campus with Blorbmart. Join with my link:'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on Blorbmart', text, url: link })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard?.writeText(`${text} ${link}`).catch(() => {})
    showToast('Invite link copied', 'success')
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

  return (
    <>
      <AppBar title="Account" showBack={false} />

      <ScreenBody
        bottomGap="150px"
        padded
        style={{ paddingTop: 'var(--gap-sm)' }}
      >
        {signedIn ? (
          <FadeSlideIn>
            <ProfileHeader session={session} />
            <PointsCard style={{ marginTop: 'var(--gap-lg)' }} />
          </FadeSlideIn>
        ) : (
          <FadeSlideIn>
            <SignedOutCard onSignIn={() => navigate('/login', { state: { from: '/account' } })} />
          </FadeSlideIn>
        )}

        {/* Web-only, and transient: the browser offers this or it does not. */}
        {canInstall && (
          <FadeSlideIn>
            <Card
              color="var(--color-brand-softer)"
              border="var(--color-brand-soft)"
              shadow="none"
              style={{ marginTop: 'var(--gap-xxl)' }}
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

        {/* ── Ordering ───────────────────────────────────────────────── */}
        <Group title="Ordering" style={{ marginTop: 'var(--gap-xxl)' }}>
          <Tile
            icon={<MapPin size={21} aria-hidden />}
            label="Delivery addresses"
            subtitle={addressLabel(session.address)}
            onClick={() => navigate('/addresses')}
          />
          {/* Chosen once and then fixed, so this row is a picker for exactly
              one kind of account — the one that told us at signup that its
              school was not on Blorbmart yet. For that person this is the only
              route into the marketplace on the day we open their campus, so it
              cannot live anywhere less obvious. For everyone else it is a
              padlocked fact. */}
          {campusFixed ? (
            <Tile
              icon={<GraduationCap size={21} aria-hidden />}
              label="My school"
              subtitle={universityName(session)}
              locked
              onClick={() =>
                showToast(
                  'Your school is set for this account. Message support if it needs to change.',
                )
              }
            />
          ) : (
            <Tile
              icon={<GraduationCap size={21} aria-hidden />}
              label="My school"
              subtitle={
                billsOnly
                  ? 'Not listed yet — tap when we reach your campus'
                  : 'Choose your campus'
              }
              onClick={() => setCampusOpen(true)}
            />
          )}
          <Tile
            icon={<Users size={21} aria-hidden />}
            label="Join a group order"
            subtitle="One delivery, everyone pays for their own"
            onClick={() => (signedIn ? setJoinOpen(true) : navigate('/login', { state: { from: '/account' } }))}
          />
          <Tile
            icon={<Receipt size={21} aria-hidden />}
            label="Pay bills"
            subtitle="Airtime, data, power, TV"
            onClick={() => navigate('/bills')}
          />
          <Tile
            icon={<Gift size={21} aria-hidden />}
            label="Gift cards"
            subtitle="Send one, or redeem a code"
            onClick={() => navigate('/gifts')}
          />
          <Tile
            icon={<ShoppingBag size={21} aria-hidden />}
            label="Student marketplace"
            subtitle="Your listings, orders and earnings"
            onClick={() => navigate(signedIn ? '/marketplace/mine' : '/marketplace')}
          />
          {referral && (
            <Tile
              icon={<Share2 size={21} aria-hidden />}
              label="Invite friends"
              subtitle={
                referral.rewardsLive && referral.rewardNaira > 0
                  ? `Earn ₦${referral.rewardNaira.toLocaleString()} for every friend who joins`
                  : referral.referralCount > 0
                    ? `${referral.referralCount} joined with your link · code ${referral.referralCode}`
                    : `Share your link · code ${referral.referralCode}`
              }
              onClick={() => void shareInvite()}
            />
          )}
          <Tile
            icon={<Bell size={21} aria-hidden />}
            label="Notifications"
            subtitle="Your alerts and messages"
            onClick={() => navigate('/notifications')}
          />
          <PushToggle last />
        </Group>

        {/* ── Safety ─────────────────────────────────────────────────── */}
        {signedIn && (
          <>
            <Group title="Safety" style={{ marginTop: 'var(--gap-lg)' }}>
              <Tile
                icon={<ShieldAlert size={21} aria-hidden />}
                label="Emergency contact"
                subtitle="Texted whenever you press SOS"
                onClick={() => setContactOpen(true)}
                last
              />
            </Group>
            {/* Personal safety, with or without an order in progress. */}
            <SosCard style={{ marginTop: 'var(--gap-sm)' }} />
          </>
        )}

        {/* ── Support ────────────────────────────────────────────────── */}
        <Group title="Support" style={{ marginTop: 'var(--gap-lg)' }}>
          <Tile
            icon={<MessageCircle size={21} aria-hidden />}
            label="Chat with support"
            subtitle="We reply on WhatsApp"
            onClick={() => openExternal(supportUrl())}
          />
          <Tile
            icon={<Mail size={21} aria-hidden />}
            label="Email us"
            subtitle={SUPPORT_EMAIL}
            onClick={() => window.location.assign(supportEmailUrl())}
            last
          />
        </Group>

        {/* ── Legal ──────────────────────────────────────────────────── */}
        <Group title="Legal" style={{ marginTop: 'var(--gap-lg)' }}>
          <Tile
            icon={<FileText size={21} aria-hidden />}
            label="Terms and conditions"
            onClick={() => navigate('/legal/terms')}
          />
          <Tile
            icon={<Lock size={21} aria-hidden />}
            label="Privacy policy"
            onClick={() => navigate('/legal/privacy')}
          />
          <Tile
            icon={<Trash2 size={21} aria-hidden />}
            label="Delete my account"
            subtitle="What is removed, and how to ask"
            onClick={() => navigate('/legal/delete-account')}
            last
          />
        </Group>

        {/* ── Account ────────────────────────────────────────────────── */}
        {signedIn && (
          <Group title="Account" style={{ marginTop: 'var(--gap-lg)' }}>
            <Tile
              icon={<LogOut size={21} aria-hidden />}
              label="Sign out"
              danger
              onClick={() => setSignOutOpen(true)}
              last
            />
          </Group>
        )}

        <div style={{ textAlign: 'center', marginTop: 'var(--gap-xxxl)' }}>
          <img
            src="/assets/icon.png"
            alt=""
            width={26}
            height={26}
            style={{ margin: '0 auto', borderRadius: 'var(--radius-xs)', opacity: 0.35 }}
          />
          <p className="t-caption-sm" style={{ marginTop: 8 }}>
            Blorbmart · v{APP_VERSION}
          </p>
        </div>
      </ScreenBody>

      <EmergencyContactSheet open={contactOpen} onClose={() => setContactOpen(false)} />
      <JoinGroupSheet open={joinOpen} onClose={() => setJoinOpen(false)} />

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

/** The gradient identity card. Inset from the page edges, not full-bleed. */
function ProfileHeader({ session }: { session: ReturnType<typeof useSessionStore.getState> }) {
  const name = fullName(session)
  const initials =
    name.trim().length === 0
      ? 'B'
      : name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]!.toUpperCase())
          .join('')
  const phone = sessionPhone(session)

  return (
    <div
      style={{
        padding: 'var(--gap-xl)',
        background: 'var(--gradient-brand)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-brand)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-lg)',
      }}
    >
      <div
        style={{
          width: 'var(--size-avatar-lg)',
          height: 'var(--size-avatar-lg)',
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.22)',
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
            <span className="t-h2" style={{ color: '#fff' }}>
              {initials}
            </span>
          }
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-h2 clamp-1" style={{ color: '#fff' }}>
          {name || 'Your account'}
        </div>
        <div
          className="t-caption-sm clamp-1"
          style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4 }}
        >
          {sessionEmail(session)}
        </div>
        {phone && (
          <div
            className="t-caption-sm clamp-1"
            style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2 }}
          >
            {maskPhone(phone)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A guest still sees the whole page. Everything under Ordering and Support
 * works signed out, and hiding it behind a sign-in wall would be telling
 * somebody they cannot read the FAQ until they have an account.
 */
function SignedOutCard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Card padding="var(--gap-xl)">
      <div className="t-h2">You are browsing as a guest</div>
      <p className="t-body" style={{ margin: 'var(--gap-sm) 0 var(--gap-xl)' }}>
        Sign in to order, track deliveries and keep your addresses.
      </p>
      <Button label="Sign in or create an account" glow onClick={onSignIn} />
    </Card>
  )
}

/** An overline caption over a clipped card of rows. */
function Group({
  title,
  children,
  style,
}: {
  title: string
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <div
        className="t-overline"
        style={{ paddingLeft: 'var(--gap-xs)', marginBottom: 'var(--gap-sm)' }}
      >
        {title.toUpperCase()}
      </div>
      <Card padding="0" clip>
        {children}
      </Card>
    </div>
  )
}

/**
 * A row. Bare icon rather than a tinted tile, matching the phone — the icons
 * are there to be scanned down a column, and forty pixels of brand-soft square
 * behind each one turns a list into a grid of badges.
 */
function Tile({
  icon,
  label,
  subtitle,
  onClick,
  danger = false,
  locked = false,
  last = false,
}: {
  icon: ReactNode
  label: string
  subtitle?: string
  onClick: () => void
  danger?: boolean
  /**
   * A setting that is deliberately fixed. Still shown, because the value
   * matters, but it wears a padlock instead of a chevron so nobody taps it
   * expecting a picker.
   */
  locked?: boolean
  last?: boolean
}) {
  const color = danger ? 'var(--color-danger)' : 'var(--color-ink-strong)'

  return (
    <PressScale
      scale={0.99}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-lg)',
        width: '100%',
        padding: 'var(--gap-lg)',
        textAlign: 'left',
        // Indented past the icon, the way a Flutter Divider(indent: 60) is.
        borderBottom: last ? 'none' : '1px solid transparent',
        backgroundImage: last
          ? undefined
          : 'linear-gradient(var(--color-line), var(--color-line))',
        backgroundSize: 'calc(100% - 60px) 1px',
        backgroundPosition: 'right bottom',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <span style={{ color, flexShrink: 0, display: 'grid', placeItems: 'center' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block', color }}>
          {label}
        </span>
        {subtitle && (
          <span className="t-caption-sm clamp-1" style={{ display: 'block', marginTop: 2 }}>
            {subtitle}
          </span>
        )}
      </span>
      {locked ? (
        <Lock size={18} aria-hidden style={{ color: 'var(--color-ink-faint)', flexShrink: 0 }} />
      ) : danger ? null : (
        <ChevronRight
          size={20}
          aria-hidden
          style={{ color: 'var(--color-ink-faint)', flexShrink: 0 }}
        />
      )}
    </PressScale>
  )
}
