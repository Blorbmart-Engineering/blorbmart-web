/* ═══════════════════════════════════════════════════════════════════════
   Get verified to sell.

   Only students the Blorbmart team has checked can list on the student
   marketplace — it is what lets a buyer trust a stranger from another hall.
   One form: name as on the student ID, matric number, a photo of the ID and
   a selfie. The campus team (or an admin) approves it, usually within a day.

   Anybody can still buy without this. The screen also tells someone where
   their application stands: waiting, turned down (and why), or paused.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Camera, Clock, IdCard, Loader2, ShieldOff } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { applyToSell, sellerStatus, uploadPhoto, type SellerState } from '../data/marketplace'
import { fullName, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { Card, EmptyState, Skeleton } from '../ui/kit'
import { Field } from '../components/marketplace/MarketParts'

type Shot = { url: string | null; preview: string | null; busy: boolean }
const EMPTY: Shot = { url: null, preview: null, busy: false }

export default function SellerVerifyScreen() {
  const navigate = useNavigate()
  const session = useSessionStore()
  const [state, setState] = useState<SellerState | null>(null)
  const [name, setName] = useState(() => fullName(session))
  const [matric, setMatric] = useState('')
  const [idShot, setIdShot] = useState<Shot>(EMPTY)
  const [selfie, setSelfie] = useState<Shot>(EMPTY)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    sellerStatus()
      .then((s) => {
        if (s.status === 'verified') {
          navigate('/marketplace/sell', { replace: true })
          return
        }
        setState(s)
        if (s.fullName) setName(s.fullName)
        if (s.matricNumber) setMatric(s.matricNumber)
      })
      .catch((e) => {
        showToast(apiErrorMessage(e, 'Could not check your seller status.'), 'danger')
        navigate('/marketplace', { replace: true })
      })
  }, [navigate])

  const take = (set: (s: Shot) => void) => (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    set({ url: null, preview, busy: true })
    uploadPhoto(file, 'blorbmart/marketplace-sellers')
      .then((url) => set({ url, preview, busy: false }))
      .catch((e) => {
        set(EMPTY)
        URL.revokeObjectURL(preview)
        showToast(apiErrorMessage(e, 'That photo did not upload.'), 'danger')
      })
  }

  const send = async () => {
    if (!idShot.url || !selfie.url) return
    setSending(true)
    try {
      setState(await applyToSell({ fullName: name.trim(), matricNumber: matric.trim(), idPhotoUrl: idShot.url, selfieUrl: selfie.url }))
      showToast('Sent — the campus team will check it.', 'success')
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not send your details.'), 'danger')
    } finally {
      setSending(false)
    }
  }

  if (!state) {
    return (
      <>
        <AppBar title="Become a seller" />
        <ScreenBody padded>
          <Skeleton height={160} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-xl)' }} />
        </ScreenBody>
      </>
    )
  }

  if (state.status === 'pending') {
    return (
      <>
        <AppBar title="Become a seller" />
        <EmptyState
          icon={<Clock size={32} aria-hidden />}
          title="We are checking your details"
          message="The campus team is matching your selfie to your student ID. You will get a notification as soon as you can list — usually within a day."
          actionLabel="Browse the marketplace"
          onAction={() => navigate('/marketplace')}
        />
      </>
    )
  }

  if (state.status === 'suspended') {
    return (
      <>
        <AppBar title="Selling paused" />
        <EmptyState
          icon={<ShieldOff size={32} aria-hidden />}
          tone="var(--color-danger)"
          title="Your selling is paused"
          message={`${state.reason ? `${state.reason}. ` : ''}You can still buy. If you think this is a mistake, contact support.`}
          actionLabel="Browse the marketplace"
          onAction={() => navigate('/marketplace')}
        />
      </>
    )
  }

  const ready = name.trim().length >= 3 && matric.trim().length >= 4 && idShot.url && selfie.url

  return (
    <>
      <AppBar title="Become a seller" />
      <ScreenBody padded bottomGap="var(--gap-xxl)">
        <Card style={{ marginTop: 'var(--gap-xl)' }} color="var(--color-brand-soft)" shadow="none">
          <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
            <BadgeCheck size={22} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
            <p className="t-body-sm" style={{ margin: 0, color: 'var(--color-ink-body)' }}>
              Every seller on the student marketplace is checked by the Blorbmart team, so buyers know they are dealing with a
              real student. Your ID and matric number are only seen by the campus team — never by buyers.
            </p>
          </div>
        </Card>

        {state.status === 'rejected' && (
          <Card style={{ marginTop: 'var(--gap-md)' }} color="var(--color-danger-soft)" shadow="none">
            <div className="t-label" style={{ color: 'var(--color-danger)' }}>
              Not approved last time
            </div>
            <p className="t-body-sm" style={{ margin: '4px 0 0' }}>
              {state.reason || 'Something did not match.'} Fix it and send again.
            </p>
          </Card>
        )}

        <Field label="Full name, as on your student ID">
          <input className="mkt-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>

        <Field label="Matric or registration number">
          <input
            className="mkt-input"
            value={matric}
            maxLength={24}
            onChange={(e) => setMatric(e.target.value.toUpperCase())}
            placeholder="e.g. 190401023"
            autoCapitalize="characters"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-md)', marginTop: 'var(--gap-xl)' }}>
          <PhotoPicker label="Student ID" hint="Front, all corners in view" icon={<IdCard size={26} aria-hidden />} shot={idShot} onPick={take(setIdShot)} />
          <PhotoPicker label="Selfie" hint="Your face, in good light" icon={<Camera size={26} aria-hidden />} shot={selfie} onPick={take(setSelfie)} capture="user" />
        </div>
      </ScreenBody>

      <StickyFooter>
        <Button label="Send for checking" glow={Boolean(ready)} disabled={!ready} busy={sending} onClick={() => void send()} />
      </StickyFooter>
    </>
  )
}

function PhotoPicker({
  label,
  hint,
  icon,
  shot,
  onPick,
  capture,
}: {
  label: string
  hint: string
  icon: React.ReactNode
  shot: Shot
  onPick: (file: File | undefined) => void
  capture?: 'user' | 'environment'
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div>
      <span className="t-label" style={{ display: 'block', marginBottom: 'var(--gap-sm)' }}>
        {label}
      </span>
      <button
        type="button"
        className="mkt-photo-add"
        onClick={() => input.current?.click()}
        style={{ width: '100%', position: 'relative', overflow: 'hidden', padding: 0 }}
      >
        {shot.preview ? (
          <img src={shot.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: shot.busy ? 0.55 : 1 }} />
        ) : (
          <span style={{ display: 'grid', justifyItems: 'center', gap: 4, padding: 'var(--gap-sm)' }}>
            {icon}
            <span className="t-caption" style={{ textAlign: 'center' }}>
              {hint}
            </span>
          </span>
        )}
        {shot.busy && (
          <Loader2
            size={22}
            aria-label="Uploading"
            style={{ position: 'absolute', inset: 0, margin: 'auto', color: '#fff', animation: 'blorb-spin 0.9s linear infinite' }}
          />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={capture}
        hidden
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
