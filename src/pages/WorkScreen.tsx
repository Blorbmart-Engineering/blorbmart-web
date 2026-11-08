/* ═══════════════════════════════════════════════════════════════════════
   Blorbmart for Work — the hub at /work.

   One screen for three people: a staff member (their meal cover today), a
   company owner or manager (their company, and the way into its
   dashboard), and an organisation that has not joined yet (what it is,
   and the application).
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, ChevronRight, Clock, MapPin, UtensilsCrossed, Wallet } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { campuses, type University } from '../data/university'
import { applyForWork, COMPANY_KINDS, leaveWork, scheduleSummary, workMe, type Company, type Membership } from '../data/work'
import { Button } from '../ui/Button'
import { Card, EmptyState, Pill, Skeleton } from '../ui/kit'
import { PressScale } from '../ui/motion'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { ConfirmDialog } from '../ui/Sheet'
import { inputClass, sectionTitle, WField } from '../components/work/WorkParts'

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand' }> = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Waiting for approval', tone: 'warning' },
  suspended: { label: 'Paused by Blorbmart', tone: 'danger' },
  closed: { label: 'Closed', tone: 'neutral' },
  rejected: { label: 'Not approved', tone: 'danger' },
}

export default function WorkScreen() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [teams, setTeams] = useState<Company[]>([])
  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const load = () => {
    setLoading(true)
    workMe()
      .then((me) => {
        setMembership(me.membership)
        setTeams(me.teams)
        setError(null)
      })
      .catch((e) => setError(apiErrorMessage(e, 'We could not load Blorbmart for Work.')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const leave = async () => {
    setLeaving(true)
    try {
      await leaveWork()
      showToast('You left the meal plan.', 'success')
      setConfirmLeave(false)
      load()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
      <AppBar title="Blorbmart for Work" subtitle="Staff meals, paid by your employer" />
      <ScreenBody padded>
        {loading ? (
          <>
            <Skeleton height={140} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
            <Skeleton height={90} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-md)' }} />
          </>
        ) : error ? (
          <EmptyState title="Could not load" message={error} actionLabel="Try again" onAction={load} />
        ) : (
          <>
            {membership && <MyMeals m={membership} onLeave={() => setConfirmLeave(true)} />}

            {teams.length > 0 && (
              <>
                <div className="t-overline" style={sectionTitle}>Companies you run</div>
                {teams.map((t) => (
                  <PressScale
                    key={t.id}
                    scale={0.99}
                    onClick={() => (t.status === 'rejected' ? undefined : navigate(`/work/c/${t.id}`))}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', width: '100%', padding: 'var(--gap-lg)', marginBottom: 'var(--gap-sm)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-line)', textAlign: 'left' }}
                  >
                    <Building2 size={22} aria-hidden style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="t-h4 clamp-1" style={{ display: 'block' }}>{t.name}</span>
                      <span className="t-caption clamp-2" style={{ display: 'block' }}>
                        {t.status === 'rejected' && t.rejectReason ? t.rejectReason : `${t.activeMembers} staff · ${t.campusName} · you are ${t.role === 'owner' ? 'the owner' : 'a manager'}`}
                      </span>
                    </span>
                    <Pill label={STATUS[t.status]?.label || t.status} tone={STATUS[t.status]?.tone || 'neutral'} dense />
                    {t.status !== 'rejected' && <ChevronRight size={18} aria-hidden style={{ color: 'var(--color-ink-faint)' }} />}
                  </PressScale>
                ))}
              </>
            )}

            {!membership && (
              <>
                <div className="t-overline" style={sectionTitle}>Got an invitation?</div>
                <Card>
                  <p className="t-body-sm" style={{ margin: 0 }}>Your employer sent you a link or a code. Enter the code to join their meal plan.</p>
                  <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
                    <input
                      className={inputClass}
                      value={code}
                      aria-label="Invitation code"
                      placeholder="e.g. K7M2QPXH4D"
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                      style={{ flex: 1, minWidth: 0, letterSpacing: 1 }}
                    />
                    <Button label="Join" size="md" expand={false} disabled={code.length < 6} onClick={() => navigate(`/work/join/${code}`)} />
                  </div>
                </Card>
              </>
            )}

            {!teams.some((t) => t.status === 'pending' || t.status === 'active' || t.status === 'suspended') && (
              <>
                <Pitch />
                {applying ? (
                  <ApplyForm onDone={() => { setApplying(false); load() }} onCancel={() => setApplying(false)} />
                ) : (
                  <div style={{ marginTop: 'var(--gap-lg)' }}>
                    <Button label="Apply for your organisation" icon={<Briefcase size={18} aria-hidden />} onClick={() => setApplying(true)} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </ScreenBody>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the meal plan?"
        message="Your employer will stop paying for your meals. You can only rejoin with a new invitation."
        confirmLabel="Leave"
        destructive
        busy={leaving}
        onConfirm={() => void leave()}
        onCancel={() => setConfirmLeave(false)}
      />
    </>
  )
}

function MyMeals({ m, onLeave }: { m: Membership; onLeave: () => void }) {
  const navigate = useNavigate()
  return (
    <>
      <div className="t-overline" style={sectionTitle}>Your work meals</div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <Briefcase size={22} aria-hidden style={{ color: 'var(--color-brand)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h4 clamp-1">{m.company.name}</div>
            <div className="t-caption">{m.team || 'Staff'}</div>
          </div>
          <Pill label={m.coverNow ? 'Covered now' : m.status === 'paused' ? 'Paused' : 'Not now'} tone={m.coverNow ? 'success' : 'warning'} dense />
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-lg)', flexWrap: 'wrap' }}>
          <Line icon={<Wallet size={16} aria-hidden />} text={`${money(m.leftToday)} of ${money(m.dailyLimit)} left today${m.monthlyLimit ? ` · ${money(m.monthlyLimit)} a month` : ''}`} />
          <Line icon={<Clock size={16} aria-hidden />} text={scheduleSummary(m.schedule)} />
          <Line icon={<MapPin size={16} aria-hidden />} text={m.office ? `Delivered to ${m.office.name}` : 'Delivered to your own address'} />
          <Line icon={<UtensilsCrossed size={16} aria-hidden />} text={m.coversDelivery ? 'Food and delivery covered' : 'Food covered; you pay delivery'} />
        </div>
        {!m.coverNow && m.reason && <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0', color: 'var(--color-warning-ink, #9A5B00)' }}>{m.reason}</p>}
        <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
          <Button label="Order food" size="md" onClick={() => navigate('/hub/restaurants')} />
          <Button label="Leave plan" size="md" kind="ghost" expand={false} onClick={onLeave} />
        </div>
      </Card>
      <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
        At checkout, choose “Work meal”. Anything above today’s limit comes from your own wallet.
      </p>
    </>
  )
}

const Line = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', color: 'var(--color-ink-body)' }}>
    <span style={{ color: 'var(--color-ink-faint)', display: 'grid' }}>{icon}</span>
    <span className="t-body-sm">{text}</span>
  </div>
)

function Pitch() {
  return (
    <>
      <div className="t-overline" style={sectionTitle}>Feed your staff</div>
      <Card>
        <div className="t-h3">Meals for your team, one invoice a month</div>
        <ul className="t-body-sm" style={{ margin: 'var(--gap-md) 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Staff order from any restaurant near campus, in the Blorbmart app.</li>
          <li>You set a daily limit and the hours it works — weekdays, weekends, night shifts.</li>
          <li>Office staff get their food at the office; remote staff at their own address.</li>
          <li>Pay before the month starts. Unused budget rolls over to next month.</li>
          <li>See who ate, where and how much, any time.</li>
        </ul>
        <p className="t-caption" style={{ margin: 'var(--gap-md) 0 0' }}>For hospitals, university departments, schools and businesses around campus.</p>
      </Card>
    </>
  )
}

function ApplyForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [list, setList] = useState<University[]>([])
  const [form, setForm] = useState({ name: '', kind: 'hospital', campusId: '', contactName: '', contactPhone: '', contactEmail: '', staffEstimate: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void campuses().then(setList).catch(() => setList([]))
  }, [])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await applyForWork({ ...form, staffEstimate: Number(form.staffEstimate) || null })
      showToast('Application sent. We will be in touch within two working days.', 'success')
      onDone()
    } catch (e) {
      setError(apiErrorMessage(e, 'We could not send that. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ marginTop: 'var(--gap-lg)' }}>
      <div className="t-h3">Apply for Blorbmart for Work</div>
      <p className="t-caption" style={{ margin: '6px 0 0' }}>You become the account owner. We check every organisation before it goes live.</p>
      <WField label="Organisation name"><input className={inputClass} value={form.name} onChange={set('name')} maxLength={80} placeholder="St Mary Hospital" /></WField>
      <WField label="What kind of organisation">
        <select className={inputClass} value={form.kind} onChange={set('kind')}>
          {COMPANY_KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </WField>
      <WField label="Nearest campus" hint="Staff order from restaurants on this campus.">
        <select className={inputClass} value={form.campusId} onChange={set('campusId')}>
          <option value="">Choose a campus</option>
          {list.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </WField>
      <WField label="Contact person"><input className={inputClass} value={form.contactName} onChange={set('contactName')} maxLength={80} /></WField>
      <WField label="Phone"><input className={inputClass} value={form.contactPhone} onChange={set('contactPhone')} inputMode="tel" maxLength={20} placeholder="0803 000 0000" /></WField>
      <WField label="Email for invoices"><input className={inputClass} value={form.contactEmail} onChange={set('contactEmail')} inputMode="email" maxLength={120} /></WField>
      <WField label="About how many staff?"><input className={inputClass} value={form.staffEstimate} onChange={(e) => setForm({ ...form, staffEstimate: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" /></WField>
      <WField label="Anything we should know (optional)"><textarea className={inputClass} value={form.notes} onChange={set('notes')} maxLength={500} /></WField>
      {error && <p className="t-body-sm" role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
        <Button label="Send application" busy={busy} disabled={form.name.trim().length < 3 || !form.campusId || form.contactPhone.replace(/\D/g, '').length < 10} onClick={() => void submit()} />
        <Button label="Cancel" kind="ghost" expand={false} onClick={onCancel} />
      </div>
    </Card>
  )
}
