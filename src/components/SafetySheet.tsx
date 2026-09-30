/* ═══════════════════════════════════════════════════════════════════════
   SOS on the tracking screen, and the emergency contact on Account.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, type CSSProperties } from 'react'
import { CheckCircle2, MapPin, Phone, ShieldAlert } from 'lucide-react'
import {
  emergencyContact,
  markSafe,
  mySos,
  raiseSos,
  saveEmergencyContact,
  type EmergencyContact,
  type SosState,
} from '../data/safety'
import { apiErrorMessage } from '../lib/api'
import { Button, IconButton } from '../ui/Button'
import { Card } from '../ui/kit'
import { showToast } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'
import { Field } from './AddressSheet'

const call = (phone: string) => window.location.assign(`tel:${phone.replace(/\s+/g, '')}`)

/**
 * "Feel unsafe?" — on an order in progress, and on its own on the Account
 * screen for personal safety with no order at all. Without an order the alert
 * still carries who and where; it just has no rider or kitchen attached.
 *
 * Two taps, not one: the card opens a sheet and the sheet sends. A single tap
 * on a card this close to the rider's Call button would page campus ops by
 * accident — and false alarms are how a real one gets ignored. The sheet puts
 * 112 right beside it, because a message to ops is not an ambulance.
 */
export function SosCard({
  orderDocId = null,
  style,
}: {
  orderDocId?: string | null
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<SosState | null>(null)

  // A customer who pressed SOS and then reloaded must still see it is live.
  useEffect(() => {
    let cancelled = false
    void mySos().then((s) => {
      if (!cancelled && s && s.status !== 'resolved') setState(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const live = state != null && state.status !== 'resolved'

  return (
    <>
      <Card
        style={style ?? { marginTop: 'var(--gap-lg)' }}
        color={live ? 'var(--color-danger-soft)' : undefined}
        border={live ? 'var(--color-danger)' : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <ShieldAlert size={22} aria-hidden style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h4">{live ? 'Your SOS is active' : 'Feel unsafe?'}</div>
            <div className="t-caption">
              {live
                ? state.status === 'acknowledged'
                  ? 'Campus ops has seen it and is on it.'
                  : 'Campus ops is being alerted.'
                : orderDocId
                  ? 'Alert campus ops with your location.'
                  : 'Anywhere on campus — alert ops and your emergency contact.'}
            </div>
          </div>
          <Button
            label={live ? 'Open' : 'Get help'}
            kind="danger"
            size="sm"
            expand={false}
            onClick={() => setOpen(true)}
          />
        </div>
      </Card>

      <SosSheet
        open={open}
        onClose={() => setOpen(false)}
        orderDocId={orderDocId}
        state={state}
        onState={setState}
      />
    </>
  )
}

/**
 * The shield beside the notification bell on Home: SOS one tap from the first
 * screen, for anyone on campus, with or without an order. Solid red while an
 * alert is live, so it doubles as the way back to it.
 */
export function SosShortcut() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<SosState | null>(null)

  useEffect(() => {
    let cancelled = false
    void mySos().then((s) => {
      if (!cancelled && s && s.status !== 'resolved') setState(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const live = state != null && state.status !== 'resolved'

  return (
    <>
      <IconButton
        label={live ? 'Your SOS is active' : 'SOS — get help'}
        onClick={() => setOpen(true)}
        background={live ? 'var(--color-danger)' : 'rgba(255,255,255,0.2)'}
        color="#fff"
      >
        <ShieldAlert size={20} aria-hidden />
      </IconButton>
      <SosSheet open={open} onClose={() => setOpen(false)} orderDocId={null} state={state} onState={setState} />
    </>
  )
}

function SosSheet({
  open,
  onClose,
  orderDocId,
  state,
  onState,
}: {
  open: boolean
  onClose: () => void
  orderDocId: string | null
  state: SosState | null
  onState: (s: SosState | null) => void
}) {
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const [note, setNote] = useState('')
  const live = state != null && state.status !== 'resolved'

  // While the sheet is open on a live alert, pick up "acknowledged" without
  // making a frightened person pull to refresh.
  useEffect(() => {
    if (!open || !live) return
    const id = setInterval(() => {
      void mySos().then((s) => {
        if (s) onState(s)
      })
    }, 20_000)
    return () => clearInterval(id)
  }, [open, live, onState])

  const send = async () => {
    setSending(true)
    try {
      const next = await raiseSos(orderDocId, note.trim())
      onState(next)
      if (navigator.vibrate) navigator.vibrate([80, 60, 80])
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not send your alert. Call 112 if you are in danger.'), 'danger')
    } finally {
      setSending(false)
    }
  }

  const safe = async () => {
    if (!state) return
    setClosing(true)
    try {
      await markSafe(state.alertId)
      onState(null)
      setNote('')
      showToast('Glad you are safe. Campus ops has been told.', 'success')
      onClose()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setClosing(false)
    }
  }

  const emergency = state?.call.emergency ?? '112'

  return (
    <Sheet open={open} onClose={onClose} title={live ? 'Help is being alerted' : 'Get help now'}>
      {live && state ? (
        <>
          <p className="t-body" style={{ margin: '0 0 var(--gap-lg)' }}>
            {state.status === 'acknowledged'
              ? 'Campus operations has your alert and is on it. Stay somewhere public and keep your phone on.'
              : `Campus operations and the Blorbmart team have your location${orderDocId ? ', your order and your rider’s details' : ''}. Stay somewhere public and keep your phone on.`}
          </p>

          <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
            {state.call.campusOps && (
              <Button
                label={`Call ${state.call.campusOps.name}`}
                kind="brand"
                icon={<Phone size={18} aria-hidden />}
                onClick={() => call(state.call.campusOps!.phone)}
              />
            )}
            {state.call.hotline && (
              <Button
                label="Call Blorbmart"
                kind="outline"
                icon={<Phone size={18} aria-hidden />}
                onClick={() => call(state.call.hotline!)}
              />
            )}
            <Button
              label={`Call ${emergency} — emergency`}
              kind="danger"
              icon={<Phone size={18} aria-hidden />}
              onClick={() => call(emergency)}
            />
            <Button
              label="Send my location again"
              kind="ghost"
              icon={<MapPin size={18} aria-hidden />}
              busy={sending}
              onClick={() => void send()}
            />
          </div>

          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <Button
              label="I’m safe now"
              kind="soft"
              icon={<CheckCircle2 size={18} aria-hidden />}
              busy={closing}
              onClick={() => void safe()}
            />
          </div>
        </>
      ) : (
        <>
          <p className="t-body" style={{ margin: '0 0 var(--gap-lg)' }}>
            This alerts your campus operations team and Blorbmart right away with where you are
            {orderDocId ? ', this order and your rider’s details' : ''}, and texts your emergency contact if you have
            one. If you are in immediate danger, call {emergency} first.
          </p>

          <Field label="What’s happening? (optional)" value={note} onChange={setNote} placeholder={orderDocId ? 'e.g. Rider is being aggressive' : 'e.g. Someone is following me near Jaja Hall'} />

          <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
            <Button
              label="Send SOS"
              kind="danger"
              size="lg"
              glow
              icon={<ShieldAlert size={20} aria-hidden />}
              busy={sending}
              onClick={() => void send()}
            />
            <Button
              label={`Call ${emergency}`}
              kind="outline"
              icon={<Phone size={18} aria-hidden />}
              onClick={() => call(emergency)}
            />
          </div>
          <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0', textAlign: 'center' }}>
            Your browser may ask to share your location. Allow it so help can find you.
          </p>
        </>
      )}
    </Sheet>
  )
}

/**
 * Who we text when this person presses SOS. Loaded when opened, so the
 * account screen does not spend a request on a row most people never tap.
 */
export function EmergencyContactSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (contact: EmergencyContact | null) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoaded(false)
    emergencyContact()
      .then((c) => {
        if (cancelled) return
        setName(c?.name ?? '')
        setPhone(c?.phone ?? '')
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const save = async (clear = false) => {
    setSaving(true)
    try {
      const saved = await saveEmergencyContact(clear ? '' : name.trim(), clear ? '' : phone.trim())
      onSaved?.(saved)
      showToast(saved ? 'Emergency contact saved' : 'Emergency contact removed', 'success')
      onClose()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Emergency contact">
      <p className="t-body" style={{ margin: '0 0 var(--gap-lg)' }}>
        If you ever press SOS during a delivery, we text this person your location along with alerting campus ops.
        Pick someone who will pick up.
      </p>
      <Field label="Their name" value={name} onChange={setName} placeholder="e.g. Mum" />
      <Field label="Their phone number" value={phone} onChange={setPhone} inputMode="tel" type="tel" placeholder="0803 123 4567" />
      <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
        <Button label="Save" busy={saving} disabled={!loaded || !phone.trim()} onClick={() => void save()} />
        {loaded && phone && (
          <Button label="Remove" kind="ghost" disabled={saving} onClick={() => void save(true)} />
        )}
      </div>
    </Sheet>
  )
}
