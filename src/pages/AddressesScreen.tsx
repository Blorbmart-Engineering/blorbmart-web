/* ═══════════════════════════════════════════════════════════════════════
   Saved delivery addresses.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { Check, MapPin, Plus, Trash2 } from 'lucide-react'
import { auth, db } from '../lib/firebase'
import {
  addressFromJson,
  addressToFirestore,
  addressToJson,
  type DeliveryAddress,
} from '../models/address'
import { useSessionStore } from '../store/sessionStore'
import { Button, IconButton } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/kit'
import { FadeSlideIn, PressScale, staggerFor } from '../ui/motion'
import { ConfirmDialog } from '../ui/Sheet'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { AddressForm } from '../components/AddressSheet'

export default function AddressesScreen() {
  const session = useSessionStore()
  const [addresses, setAddresses] = useState<DeliveryAddress[] | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DeliveryAddress | null>(null)

  const load = useCallback(async () => {
    const list = await useSessionStore.getState().loadAddresses()
    setAddresses(list)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (address: DeliveryAddress) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    try {
      const ref = await addDoc(collection(db, 'users', uid, 'addresses'), {
        ...addressToFirestore(address),
        createdAt: serverTimestamp(),
      })
      const stored = addressFromJson({ ...addressToJson(address), docId: ref.id })
      setFormOpen(false)
      await useSessionStore.getState().setAddress(stored)
      await load()
      showToast('Address saved.', 'success')
    } catch {
      showToast('We could not save that address. Try again.', 'danger')
    }
  }

  const remove = async (address: DeliveryAddress) => {
    const uid = auth.currentUser?.uid
    if (!uid || !address.docId) return
    try {
      await deleteDoc(doc(db, 'users', uid, 'addresses', address.docId))
      // The selected address cannot point at something that no longer exists.
      if (session.address?.docId === address.docId) {
        await useSessionStore.getState().setAddress(null)
      }
      await load()
      showToast('Address removed.', 'neutral')
    } catch {
      showToast('We could not remove that address.', 'danger')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <>
      <AppBar
        title="Delivery addresses"
        subtitle="Riders use these exactly as written"
        trailing={
          <IconButton label="Add an address" onClick={() => setFormOpen(true)}>
            <Plus size={20} aria-hidden />
          </IconButton>
        }
      />

      <ScreenBody bottomGap="150px" padded>
        {addresses === null ? (
          [0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              height={76}
              radius="var(--radius-md)"
              style={{ marginBottom: 'var(--gap-sm)' }}
            />
          ))
        ) : addresses.length === 0 ? (
          <EmptyState
            title="No addresses saved"
            message="Add one and it will be ready at every checkout."
            icon={<MapPin size={30} aria-hidden />}
            actionLabel="Add an address"
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <>
            {addresses.map((address, i) => {
              const selected =
                !!address.docId && session.address?.docId === address.docId
              return (
                <FadeSlideIn key={address.docId || i} delay={staggerFor(i, 5)}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--gap-md)',
                      marginBottom: 'var(--gap-sm)',
                      padding: 'var(--gap-md)',
                      borderRadius: 'var(--radius-md)',
                      background: selected
                        ? 'var(--color-brand-soft)'
                        : 'var(--color-surface)',
                      border: `1px solid ${selected ? 'var(--color-brand)' : 'var(--color-line)'}`,
                    }}
                  >
                    <PressScale
                      scale={0.99}
                      onClick={() => void useSessionStore.getState().setAddress(address)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--gap-md)',
                        flex: 1,
                        minWidth: 0,
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
                        <span className="t-caption clamp-2" style={{ display: 'block' }}>
                          {[address.addressLine1, address.addressLine2, address.city]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          size={18}
                          aria-hidden
                          style={{ color: 'var(--color-brand)', flexShrink: 0 }}
                        />
                      )}
                    </PressScale>

                    <IconButton
                      label={`Remove ${address.name || 'address'}`}
                      size={36}
                      onClick={() => setPendingDelete(address)}
                    >
                      <Trash2 size={16} aria-hidden style={{ color: 'var(--color-danger)' }} />
                    </IconButton>
                  </div>
                </FadeSlideIn>
              )
            })}

            <div style={{ marginTop: 'var(--gap-lg)' }}>
              <Button
                label="Add another address"
                kind="outline"
                icon={<Plus size={18} aria-hidden />}
                onClick={() => setFormOpen(true)}
              />
            </div>
          </>
        )}
      </ScreenBody>

      <AddressForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(address) => void save(address)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this address?"
        message="You can always add it again later."
        confirmLabel="Remove"
        destructive
        icon={<Trash2 size={26} aria-hidden />}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />
    </>
  )
}
