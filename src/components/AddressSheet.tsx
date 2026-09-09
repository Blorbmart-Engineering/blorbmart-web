/* ═══════════════════════════════════════════════════════════════════════
   Deliver-to — a port of lib/features/profile/address_sheet.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Check, LoaderCircle, LocateFixed, MapPin, MapPinned } from 'lucide-react'
import { auth, db } from '../lib/firebase'
import {
  addressFromJson,
  addressToFirestore,
  addressToJson,
  type DeliveryAddress,
} from '../models/address'
import { sessionPhone, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { PressScale } from '../ui/motion'
import { Sheet } from '../ui/Sheet'
import { showToast } from '../ui/Screen'

export function AddressSheet({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const session = useSessionStore()
  const [saved, setSaved] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await useSessionStore.getState().loadAddresses()
    setSaved(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  /**
   * A save failure must not block the order — the address is still used for
   * this session even if it was not stored.
   */
  const persist = async (address: DeliveryAddress): Promise<DeliveryAddress> => {
    const uid = auth.currentUser?.uid
    if (!uid) return address
    try {
      const ref = await addDoc(collection(db, 'users', uid, 'addresses'), {
        ...addressToFirestore(address),
        createdAt: serverTimestamp(),
      })
      return addressFromJson({ ...addressToJson(address), docId: ref.id })
    } catch {
      return address
    }
  }

  const select = async (address: DeliveryAddress) => {
    await useSessionStore.getState().setAddress(address)
    onChanged?.()
    onClose()
  }

  /**
   * Uses the browser's geolocation. Permission failures are explained rather
   * than swallowed, because "nothing happened" is the worst outcome here.
   *
   * There is no reverse-geocode step on the web — the phone build has a
   * platform geocoder and the browser does not, and paying a third party to
   * turn a pin into a street name is not worth it when the rider gets exact
   * coordinates either way. The customer names the pin instead.
   */
  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      showToast('This browser cannot share your location.', 'danger')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const address: DeliveryAddress = {
          docId: '',
          name: 'Current location',
          addressLine1: 'Dropped pin',
          addressLine2: '',
          city: '',
          state: '',
          phone: sessionPhone(session),
          isDefault: saved.length === 0,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          deliveryZone: 'off_campus',
        }
        const stored = await persist(address)
        setLocating(false)
        await select(stored)
      },
      (error) => {
        setLocating(false)
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is needed to find your address.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Could not get your location. Enter your address instead.'
              : 'That took too long. Enter your address instead.'
        showToast(message, 'danger')
      },
      { enableHighAccuracy: true, timeout: 18_000, maximumAge: 60_000 },
    )
  }

  const current = session.address

  return (
    <>
      <Sheet open={open && !formOpen} onClose={onClose} title="Deliver to">
        <p className="t-body-sm" style={{ margin: '0 0 var(--gap-xl)' }}>
          Riders use this exactly as written, so be specific.
        </p>

        <ActionRow
          icon={<LocateFixed size={20} aria-hidden />}
          title="Use my current location"
          subtitle="Fastest, and most accurate for the rider"
          busy={locating}
          onClick={locating ? undefined : useCurrentLocation}
        />
        <div style={{ height: 'var(--gap-md)' }} />
        <ActionRow
          icon={<MapPinned size={20} aria-hidden />}
          title="Enter a new address"
          subtitle="Type a street, area and landmark"
          onClick={() => setFormOpen(true)}
        />

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--gap-xxl)' }}>
            <LoaderCircle
              size={24}
              aria-hidden
              style={{ animation: 'blorb-spin 900ms linear infinite', color: 'var(--color-brand)' }}
            />
          </div>
        ) : saved.length > 0 ? (
          <>
            <div className="t-overline" style={{ margin: 'var(--gap-xxl) 0 var(--gap-sm)' }}>
              Saved addresses
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
              {saved.map((address, i) => (
                <SavedRow
                  key={address.docId || i}
                  address={address}
                  selected={!!address.docId && current?.docId === address.docId}
                  onClick={() => void select(address)}
                />
              ))}
            </div>
          </>
        ) : null}
      </Sheet>

      <AddressForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (address) => {
          setFormOpen(false)
          const stored = await persist(address)
          await select(stored)
        }}
      />
    </>
  )
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  busy = false,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClick?: () => void
  busy?: boolean
}) {
  return (
    <PressScale
      scale={0.985}
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        width: '100%',
        padding: 'var(--gap-md) var(--gap-lg)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-brand-softer)',
        border: '1px solid var(--color-brand-soft)',
        textAlign: 'left',
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
        {busy ? (
          <LoaderCircle
            size={20}
            aria-hidden
            style={{ animation: 'blorb-spin 900ms linear infinite' }}
          />
        ) : (
          icon
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {subtitle}
        </span>
      </span>
    </PressScale>
  )
}

function SavedRow({
  address,
  selected,
  onClick,
}: {
  address: DeliveryAddress
  selected: boolean
  onClick: () => void
}) {
  return (
    <PressScale
      scale={0.985}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
        width: '100%',
        padding: 'var(--gap-md)',
        borderRadius: 'var(--radius-md)',
        background: selected ? 'var(--color-brand-soft)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-brand)' : 'var(--color-line)'}`,
        textAlign: 'left',
      }}
    >
      <MapPin
        size={18}
        aria-hidden
        style={{
          flexShrink: 0,
          color: selected ? 'var(--color-brand)' : 'var(--color-ink-faint)',
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="t-h4 clamp-1" style={{ display: 'block' }}>
          {address.name || address.addressLine1}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {[address.addressLine1, address.city].filter(Boolean).join(', ')}
        </span>
      </span>
      {selected && (
        <Check size={18} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
      )}
    </PressScale>
  )
}

/* ── The form ──────────────────────────────────────────────────────────── */

export function AddressForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (address: DeliveryAddress) => void | Promise<void>
}) {
  const session = useSessionStore()
  const [name, setName] = useState('Home')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState(sessionPhone(session))
  const [zone, setZone] = useState('off_campus')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (line1.trim().length < 4) {
      setError('Enter the street or building, so a rider can find it.')
      return
    }
    if (!city.trim()) {
      setError('Enter the town or city.')
      return
    }
    setError(null)
    void onSubmit({
      docId: '',
      name: name.trim() || 'Address',
      addressLine1: line1.trim(),
      addressLine2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: phone.trim(),
      isDefault: false,
      lat: null,
      lng: null,
      deliveryZone: zone,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="New address">
      <Field label="Label" value={name} onChange={setName} placeholder="Home, Hostel, Office" />
      <Field
        label="Street / building"
        value={line1}
        onChange={setLine1}
        placeholder="12 Adeyemi Street, Block C"
      />
      <Field
        label="Landmark (optional)"
        value={line2}
        onChange={setLine2}
        placeholder="Opposite the main gate"
      />
      <div style={{ display: 'flex', gap: 'var(--gap-md)' }}>
        <Field label="City" value={city} onChange={setCity} placeholder="Osogbo" />
        <Field label="State" value={state} onChange={setState} placeholder="Osun" />
      </div>
      <Field
        label="Phone for the rider"
        value={phone}
        onChange={setPhone}
        placeholder="0801 234 5678"
        inputMode="tel"
      />

      <div className="t-overline" style={{ margin: 'var(--gap-lg) 0 var(--gap-sm)' }}>
        Delivery zone
      </div>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
        {[
          { id: 'campus', label: 'On campus' },
          { id: 'off_campus', label: 'Off campus' },
        ].map((option) => (
          <PressScale
            key={option.id}
            scale={0.96}
            onClick={() => setZone(option.id)}
            className="t-label"
            style={{
              flex: 1,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: zone === option.id ? 'var(--color-brand-soft)' : 'var(--color-surface)',
              color: zone === option.id ? 'var(--color-brand-ink)' : 'var(--color-ink-body)',
              border: `1px solid ${zone === option.id ? 'var(--color-brand)' : 'var(--color-line)'}`,
            }}
          >
            {option.label}
          </PressScale>
        ))}
      </div>

      {error && (
        <p className="t-caption" style={{ color: 'var(--color-danger)', marginTop: 'var(--gap-md)' }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 'var(--gap-xl)' }}>
        <Button label="Save address" onClick={submit} />
      </div>
    </Sheet>
  )
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'numeric' | 'email' | 'decimal'
  type?: string
}) {
  return (
    <label style={{ display: 'block', flex: 1, marginBottom: 'var(--gap-md)' }}>
      <span className="t-label-sm" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
        style={{
          width: '100%',
          height: 'var(--size-input)',
          paddingInline: 'var(--gap-lg)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-sunken)',
          border: '1px solid var(--color-line-strong)',
          outlineOffset: 2,
        }}
      />
    </label>
  )
}
