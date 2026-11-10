/* ═══════════════════════════════════════════════════════════════════════
   Deliver-to — a port of lib/features/profile/address_sheet.dart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Check, LocateFixed, MapPin, MapPinned } from 'lucide-react'
import { auth, db } from '../lib/firebase'
import {
  addressFromJson,
  addressLabel,
  addressToFirestore,
  addressToJson,
  isUnreadableLine,
  type DeliveryAddress,
} from '../models/address'
import PinPicker, { type Pin, type Place } from './PinPicker'
import { sessionPhone, useSessionStore } from '../store/sessionStore'
import { Button } from '../ui/Button'
import { PressScale } from '../ui/motion'
import { Sheet } from '../ui/Sheet'
import { Spinner } from '../ui/Loader'

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
  const [formOpen, setFormOpen] = useState<false | 'locate' | 'search'>(false)

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

  /*
   * Both ways in open the same form with a map on top. "Pin my location"
   * starts by asking for the device's position; "Enter an address" starts on
   * the map unpinned, so someone ordering for a friend can search instead.
   * The pin is what the delivery fee and the rider's route come from, and
   * the backend names it ("Pink Mosque, Station Road, Shasha") so nobody
   * sees "Dropped pin" or a code like "QH9W+RH2" again.
   */
  const current = session.address

  return (
    <>
      <Sheet open={open && !formOpen} onClose={onClose} title="Deliver to">
        <p className="t-body-sm" style={{ margin: '0 0 var(--gap-xl)' }}>
          Put the pin on your exact building. It sets the delivery fee and guides the rider.
        </p>

        <ActionRow
          icon={<LocateFixed size={20} aria-hidden />}
          title="Pin my location on the map"
          subtitle="Fastest, and most accurate for the rider"
          onClick={() => setFormOpen('locate')}
        />
        <div style={{ height: 'var(--gap-md)' }} />
        <ActionRow
          icon={<MapPinned size={20} aria-hidden />}
          title="Enter a new address"
          subtitle="Search a place, then pin it on the map"
          onClick={() => setFormOpen('search')}
        />

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--gap-xxl)' }}>
            <Spinner size={26} color="var(--color-brand)" label="Loading your addresses" />
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
        open={Boolean(formOpen)}
        locate={formOpen === 'locate'}
        isFirst={saved.length === 0}
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
          <Spinner size={20} />
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
          {address.name || addressLabel(address)}
        </span>
        <span className="t-caption clamp-1" style={{ display: 'block' }}>
          {addressLabel(address)}
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
  locate = false,
  isFirst = false,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (address: DeliveryAddress) => void | Promise<void>
  /** Start by asking for the device's position. */
  locate?: boolean
  isFirst?: boolean
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
  const [pin, setPin] = useState<Pin | null>(null)
  // Whether the person has typed the street themselves; until then it follows the pin.
  const [line1Typed, setLine1Typed] = useState(false)

  // A fresh form each time it opens.
  useEffect(() => {
    if (!open) return
    setName(isFirst ? 'Home' : 'Hostel')
    setLine1('')
    setLine2('')
    setCity('')
    setState('')
    setPin(null)
    setLine1Typed(false)
    setError(null)
  }, [open, isFirst])

  const onPin = (next: Pin, place: Place | null) => {
    setPin(next)
    if (!place) return
    if (!line1Typed) setLine1(place.line || place.label)
    if (place.city) setCity(place.city)
    if (place.state) setState(place.state)
  }

  const submit = () => {
    const street = line1.trim()
    if (!pin && street.length < 4) {
      setError('Pin the spot on the map, or type the street or building.')
      return
    }
    if (!pin && !city.trim()) {
      setError('Enter the town or city.')
      return
    }
    setError(null)
    void onSubmit({
      docId: '',
      name: name.trim() || 'Address',
      addressLine1: street && !isUnreadableLine(street) ? street : 'Pinned location',
      addressLine2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: phone.trim(),
      isDefault: isFirst,
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      deliveryZone: zone,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={locate ? 'Pin your location' : 'New address'}>
      {open && (
        <div style={{ marginBottom: 'var(--gap-lg)' }}>
          <PinPicker onChange={onPin} locateOnOpen={locate} height={300} accent="#AFFF00" />
        </div>
      )}
      <Field label="Label" value={name} onChange={setName} placeholder="Home, Hostel, Office" />
      <Field
        label="Street / building"
        value={line1}
        onChange={(v) => {
          setLine1(v)
          setLine1Typed(true)
        }}
        placeholder={pin ? 'Filled from the pin. Edit if it is off.' : '12 Adeyemi Street, Block C'}
      />
      <Field
        label="Directions for the rider"
        value={line2}
        onChange={setLine2}
        placeholder="Room 12, blue gate opposite the mosque"
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
