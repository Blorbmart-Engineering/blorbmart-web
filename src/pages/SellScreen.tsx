/* ═══════════════════════════════════════════════════════════════════════
   Sell something — or edit something already up (/marketplace/sell?edit=id).

   Photos first, because they decide whether anybody taps. Each one uploads
   the moment it is picked, so by the time the form is filled in they are
   already there and "List it" is instant.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import {
  CATEGORIES,
  CONDITIONS,
  MAX_PHOTOS,
  createListing,
  getListing,
  parseNaira,
  sellerStatus,
  updateListing,
  uploadPhoto,
} from '../data/marketplace'
import { Button } from '../ui/Button'
import { AppBar, ScreenBody, StickyFooter, showToast } from '../ui/Screen'
import { Skeleton } from '../ui/kit'
import { Field, ListingPhoto } from '../components/marketplace/MarketParts'

type Slot = { key: string; url: string | null; preview: string; failed?: boolean }

export default function SellScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const fileInput = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<Slot[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [saving, setSaving] = useState(false)

  // Only verified sellers list. Everyone else is sent to get verified first.
  useEffect(() => {
    if (editId) return
    sellerStatus()
      .then((s) => (s.status === 'verified' ? setLoading(false) : navigate('/marketplace/verify', { replace: true })))
      .catch((e) => {
        showToast(apiErrorMessage(e, 'Could not check your seller status.'), 'danger')
        navigate('/marketplace', { replace: true })
      })
  }, [editId, navigate])

  useEffect(() => {
    if (!editId) return
    getListing(editId)
      .then((l) => {
        if (!l.mine) throw new Error('That is not your listing.')
        setPhotos(l.photos.map((url) => ({ key: url, url, preview: url })))
        setTitle(l.title)
        setDescription(l.description)
        setPrice(String(l.price))
        setCategory(l.category)
        setCondition(l.condition)
      })
      .catch((e) => {
        showToast(apiErrorMessage(e, 'Could not open that listing.'), 'danger')
        navigate('/marketplace/mine', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [editId, navigate])

  // A local preview holds the picked file in memory until it is let go: when
  // its photo is removed, or when the screen closes.
  const previews = useRef(new Set<string>())
  useEffect(() => {
    const held = previews.current
    return () => held.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const removePhoto = (key: string) =>
    setPhotos((all) => {
      const gone = all.find((s) => s.key === key)
      if (gone && previews.current.delete(gone.preview)) URL.revokeObjectURL(gone.preview)
      return all.filter((s) => s.key !== key)
    })

  const pick = (files: FileList | null) => {
    const room = MAX_PHOTOS - photos.length
    const chosen = Array.from(files ?? []).slice(0, room)
    if (!chosen.length) return
    const added: Slot[] = chosen.map((file) => ({ key: `${file.name}-${Date.now()}-${Math.random()}`, url: null, preview: URL.createObjectURL(file) }))
    added.forEach((s) => previews.current.add(s.preview))
    setPhotos((p) => [...p, ...added])
    chosen.forEach((file, i) => {
      const key = added[i].key
      uploadPhoto(file)
        .then((url) => setPhotos((p) => p.map((s) => (s.key === key ? { ...s, url } : s))))
        .catch((e) => {
          setPhotos((p) => p.map((s) => (s.key === key ? { ...s, failed: true } : s)))
          showToast(apiErrorMessage(e, 'A photo did not upload.'), 'danger')
        })
    })
  }

  const uploading = photos.some((p) => !p.url && !p.failed)
  const ready = photos.filter((p) => p.url).map((p) => p.url as string)
  const amount = parseNaira(price)
  const complete = ready.length > 0 && title.trim().length >= 3 && amount >= 100 && category && condition

  const save = async () => {
    setSaving(true)
    const input = { title: title.trim(), description: description.trim(), price: Math.round(amount), category, condition, photos: ready }
    try {
      const listing = editId ? await updateListing(editId, input) : await createListing(input)
      showToast(editId ? 'Saved.' : 'Your item is up 🎉', 'success')
      navigate(`/marketplace/item/${listing.id}`, { replace: true })
    } catch (e) {
      showToast(apiErrorMessage(e, 'Could not list your item.'), 'danger')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <AppBar title={editId ? 'Edit listing' : 'Sell something'} />
        <ScreenBody padded>
          <Skeleton height={100} style={{ marginTop: 'var(--gap-xl)' }} />
          <Skeleton height={52} style={{ marginTop: 'var(--gap-xl)' }} />
        </ScreenBody>
      </>
    )
  }

  return (
    <>
      <AppBar title={editId ? 'Edit listing' : 'Sell something'} subtitle="Only students on your campus see it" />

      <ScreenBody padded bottomGap="var(--gap-xxl)">
        <span className="t-label mkt-label">Photos</span>
        <div className="mkt-photo-grid">
          {photos.map((p) => (
            <div key={p.key} className="mkt-photo-slot">
              {p.preview.startsWith('blob:') ? (
                <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.url ? 1 : 0.55 }} />
              ) : (
                <ListingPhoto src={p.url} alt="" width={200} />
              )}
              {!p.url && !p.failed && (
                <Loader2 size={22} aria-label="Uploading" style={{ position: 'absolute', inset: 0, margin: 'auto', color: '#fff', animation: 'blorb-spin 0.9s linear infinite' }} />
              )}
              {p.failed && (
                <span className="t-caption-sm" style={{ position: 'absolute', inset: 'auto 0 0', padding: 4, background: 'var(--color-danger)', color: '#fff', textAlign: 'center' }}>
                  Failed
                </span>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => removePhoto(p.key)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 26,
                  height: 26,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className="mkt-photo-add" onClick={() => fileInput.current?.click()}>
              <span style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <ImagePlus size={24} aria-hidden />
                <span className="t-caption">Add photo</span>
              </span>
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
          Up to {MAX_PHOTOS}. Clear photos in daylight sell fastest — show any scratches.
        </p>

        <Field label="Title">
          <input className="mkt-input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HP laptop charger, 65W" />
        </Field>

        <Field label="Price" hint={amount >= 100 ? `Buyers pay ${money(amount)}. It reaches you when they get the item.` : 'At least ₦100.'}>
          <input
            className="mkt-input"
            value={price}
            inputMode="numeric"
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="₦"
          />
        </Field>

        <Field label="Category">
          <select className="mkt-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>
              Pick one
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <span className="t-label mkt-label">Condition</span>
        <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
          {CONDITIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCondition(c.id)}
              aria-pressed={condition === c.id}
              className="t-label press"
              style={{
                height: 40,
                padding: '0 var(--gap-lg)',
                borderRadius: 'var(--radius-pill)',
                border: `1.5px solid ${condition === c.id ? 'var(--color-ink)' : 'var(--color-line)'}`,
                background: condition === c.id ? 'var(--color-ink)' : 'var(--color-surface)',
                color: condition === c.id ? '#fff' : 'var(--color-ink-body)',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <Field label="Description" hint="What it is, how old, what is wrong with it if anything, and where on campus you are.">
          <textarea className="mkt-input" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </ScreenBody>

      <StickyFooter>
        <Button
          label={uploading ? 'Uploading photos…' : editId ? 'Save changes' : 'List it'}
          glow={Boolean(complete) && !uploading}
          disabled={!complete || uploading}
          busy={saving}
          onClick={() => void save()}
        />
      </StickyFooter>
    </>
  )
}
