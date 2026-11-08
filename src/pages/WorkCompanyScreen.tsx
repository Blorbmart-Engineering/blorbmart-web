/* ═══════════════════════════════════════════════════════════════════════
   A company's Blorbmart for Work dashboard: /work/c/:companyId.

   Owners and managers run staff, offices and reports here; only the owner
   pays. Every figure comes from the backend, which also re-checks every
   permission — this screen only hides what a manager cannot do.
   ═══════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Copy, Download, Pencil, Plus, Share2, Trash2, UserPlus } from 'lucide-react'
import { apiErrorMessage } from '../lib/api'
import { money } from '../lib/format'
import { copyText, openWhatsApp } from '../lib/share'
import * as W from '../data/work'
import { Button } from '../ui/Button'
import { Card, ChipRail, EmptyState, Pill, Skeleton, SummaryRow } from '../ui/kit'
import { AppBar, ScreenBody, showToast } from '../ui/Screen'
import { ConfirmDialog, Sheet } from '../ui/Sheet'
import { Banner, inputClass, NairaInput, ScheduleEditor, sectionTitle, Stat, WField } from '../components/work/WorkParts'

const TABS = ['Overview', 'Staff', 'Billing', 'Report', 'Setup'] as const
type Tab = (typeof TABS)[number]

export default function WorkCompanyScreen() {
  const { companyId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState<W.Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initial = (TABS.find((t) => t.toLowerCase() === params.get('tab')) || 'Overview') as Tab
  const [tab, setTab] = useState<Tab>(initial)

  const load = useCallback(() => {
    W.overview(companyId)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(apiErrorMessage(e, 'We could not load this company.')))
  }, [companyId])
  useEffect(load, [load])

  // Back from Paystack: confirm the invoice with the server, then tidy the URL.
  useEffect(() => {
    const paid = params.get('paid')
    if (!paid) return
    W.verifyInvoice(companyId, paid)
      .then((inv) => {
        showToast(inv.status === 'paid' ? 'Payment received — thank you.' : 'We are still waiting for that payment to clear.', inv.status === 'paid' ? 'success' : 'neutral')
        load()
      })
      .catch((e) => showToast(apiErrorMessage(e), 'danger'))
      .finally(() => setParams({ tab: 'billing' }, { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <>
        <AppBar title="Blorbmart for Work" />
        <EmptyState title="Not available" message={error} actionLabel="Back" onAction={() => navigate('/work')} />
      </>
    )
  }

  return (
    <>
      <AppBar title={data?.company.name || 'Company'} subtitle={data ? `${data.company.planLabel} plan · ${data.role === 'owner' ? 'Owner' : 'Manager'}` : undefined} />
      <ScreenBody padded>
        {!data ? (
          <Skeleton height={200} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
        ) : (
          <>
            <div style={{ marginTop: 'var(--gap-md)' }}>
              <ChipRail options={[...TABS]} selected={tab} onSelect={(t) => { setTab(t as Tab); setParams({ tab: t.toLowerCase() }, { replace: true }) }} />
            </div>
            {tab === 'Overview' && <OverviewTab d={data} go={setTab} />}
            {tab === 'Staff' && <StaffTab d={data} reload={load} />}
            {tab === 'Billing' && <BillingTab d={data} />}
            {tab === 'Report' && <ReportTab d={data} />}
            {tab === 'Setup' && <SetupTab d={data} reload={load} />}
          </>
        )}
      </ScreenBody>
    </>
  )
}

/* ───────────────────────────── Overview ───────────────────────────── */

function OverviewTab({ d, go }: { d: W.Overview; go: (t: Tab) => void }) {
  const c = d.company
  const dayOfMonth = new Date().getDate()
  return (
    <>
      {c.status === 'pending' && <Banner tone="warning">We are checking your application. You can set up offices meanwhile; staff and payments open once you are approved.</Banner>}
      {c.status === 'suspended' && <Banner tone="danger">Blorbmart paused this account: {c.suspendReason || 'contact support'}. Staff cannot use work meals until it is back on.</Banner>}
      {c.status === 'active' && !d.paidThisMonth && <Banner tone="danger">{W.monthLabel(d.month)} is not paid yet, so staff cannot use work meals. Pay in Billing.</Banner>}
      {c.status === 'active' && d.paidThisMonth && !d.paidNextMonth && dayOfMonth >= 20 && <Banner tone="warning">Pay for {W.monthLabel(d.nextMonth)} before the 1st so meals do not stop.</Banner>}
      {c.status === 'active' && d.paidThisMonth && c.activeMembers > d.seatsThisMonth && <Banner tone="danger">More staff than paid seats — meals are paused until you add {c.activeMembers - d.seatsThisMonth} seat(s).</Banner>}
      {c.status === 'active' && d.balance < c.lowBalanceAlert && <Banner tone="warning">The meal budget is low ({money(d.balance)}). Top up so staff are not turned away.</Banner>}

      <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap', marginTop: 'var(--gap-lg)' }}>
        <Stat label="Meal budget" value={money(d.balance)} />
        <Stat label={`Spent in ${W.monthLabel(d.month)}`} value={money(d.spentThisMonth)} />
        <Stat label="Meals this month" value={String(d.mealsThisMonth)} />
        <Stat label="Staff / seats" value={`${c.activeMembers} / ${d.seatsThisMonth || '—'}`} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)', flexWrap: 'wrap' }}>
        <Button label="Invite staff" icon={<UserPlus size={18} aria-hidden />} size="md" expand={false} disabled={c.status !== 'active'} onClick={() => go('Staff')} />
        {d.role === 'owner' && <Button label="Pay or top up" kind="soft" size="md" expand={false} onClick={() => go('Billing')} />}
        <Button label="See the report" kind="ghost" size="md" expand={false} onClick={() => go('Report')} />
      </div>

      <div className="t-overline" style={sectionTitle}>How it works</div>
      <Card>
        <ol className="t-body-sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>Add your office address in Setup (for staff who eat at work).</li>
          <li>Pay for the month: a seat per staff member, plus a meal budget.</li>
          <li>Invite staff by email or phone, with their daily limit and meal hours.</li>
          <li>Staff choose “Work meal” at checkout. The budget pays up to their limit; anything over comes from their own wallet.</li>
          <li>Unused budget stays and rolls into next month.</li>
        </ol>
      </Card>
    </>
  )
}

/* ───────────────────────────── Staff ───────────────────────────── */

type Draft = {
  team: string
  dailyLimit: string
  monthlyLimit: string
  scheduleTemplate: string
  schedule: W.Schedule
  deliveryMode: 'office' | 'remote'
  officeId: string
  coversDelivery: boolean
}

const draftFrom = (d: W.Overview, m?: W.Member): Draft => {
  const tpl = m?.scheduleTemplate || d.company.defaults.scheduleTemplate || 'weekday_lunch'
  return {
    team: m?.team || '',
    dailyLimit: String(m?.dailyLimit || d.company.defaults.dailyLimit || 2500),
    monthlyLimit: m?.monthlyLimit ? String(m.monthlyLimit) : '',
    scheduleTemplate: tpl,
    schedule: m?.schedule || d.templates.find((t) => t.id === tpl)?.schedule || {},
    deliveryMode: m?.deliveryMode || (d.company.offices.length ? 'office' : 'remote'),
    officeId: m?.officeId || d.company.offices[0]?.id || '',
    coversDelivery: m?.coversDelivery ?? d.company.defaults.coversDelivery ?? true,
  }
}

const draftBody = (x: Draft) => ({
  team: x.team,
  dailyLimit: Number(x.dailyLimit),
  monthlyLimit: x.monthlyLimit ? Number(x.monthlyLimit) : null,
  schedule: x.scheduleTemplate === 'custom' ? { schedule: x.schedule } : x.scheduleTemplate,
  deliveryMode: x.deliveryMode,
  officeId: x.deliveryMode === 'office' ? x.officeId : null,
  coversDelivery: x.coversDelivery,
})

function SettingsFields({ d, x, set }: { d: W.Overview; x: Draft; set: (x: Draft) => void }) {
  return (
    <>
      <WField label="Team or role (optional)"><input className={inputClass} value={x.team} maxLength={40} placeholder="Nurses, night shift" onChange={(e) => set({ ...x, team: e.target.value })} /></WField>
      <WField label="Daily limit" hint="The most the company pays in one day. Anything over comes from their wallet.">
        <NairaInput value={x.dailyLimit} onChange={(v) => set({ ...x, dailyLimit: v })} ariaLabel="Daily limit" />
      </WField>
      <WField label="Monthly limit (optional)"><NairaInput value={x.monthlyLimit} onChange={(v) => set({ ...x, monthlyLimit: v })} placeholder="No monthly limit" ariaLabel="Monthly limit" /></WField>
      <WField label="When meals are covered">
        <ScheduleEditor templates={d.templates} template={x.scheduleTemplate} schedule={x.schedule} onChange={(t, s) => set({ ...x, scheduleTemplate: t, schedule: s })} />
      </WField>
      <WField label="Where meals go">
        <select className={inputClass} value={x.deliveryMode} onChange={(e) => set({ ...x, deliveryMode: e.target.value as Draft['deliveryMode'] })}>
          <option value="office" disabled={!d.company.offices.length}>To an office{!d.company.offices.length ? ' (add one in Setup)' : ''}</option>
          <option value="remote">To their own address (remote staff)</option>
        </select>
      </WField>
      {x.deliveryMode === 'office' && (
        <WField label="Office">
          <select className={inputClass} value={x.officeId} onChange={(e) => set({ ...x, officeId: e.target.value })}>
            {d.company.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </WField>
      )}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'var(--gap-lg)' }}>
        <input type="checkbox" checked={x.coversDelivery} onChange={(e) => set({ ...x, coversDelivery: e.target.checked })} />
        <span className="t-body-sm">Company also pays delivery and service fees</span>
      </label>
    </>
  )
}

function StaffTab({ d, reload }: { d: W.Overview; reload: () => void }) {
  const [list, setList] = useState<W.Member[] | null>(null)
  const [pending, setPending] = useState<W.Invite[]>([])
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<W.Member | null>(null)
  const [query, setQuery] = useState('')
  const id = d.company.id

  const load = useCallback(() => {
    Promise.all([W.members(id), W.invites(id)])
      .then(([m, i]) => { setList(m); setPending(i.filter((v) => v.status === 'pending')) })
      .catch((e) => showToast(apiErrorMessage(e), 'danger'))
  }, [id])
  useEffect(load, [load])

  const shown = useMemo(() => (list || []).filter((m) => `${m.name} ${m.email} ${m.phone} ${m.team}`.toLowerCase().includes(query.trim().toLowerCase())), [list, query])
  const office = (oid: string | null) => d.company.offices.find((o) => o.id === oid)?.name

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
        <input className={inputClass} placeholder="Search staff" aria-label="Search staff" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <Button label="Invite" icon={<Plus size={18} aria-hidden />} size="md" expand={false} disabled={d.company.status !== 'active'} onClick={() => setInviting(true)} />
      </div>
      {d.company.status !== 'active' && <Banner tone="warning">You can invite staff once the account is approved.</Banner>}

      {!list ? (
        <Skeleton height={120} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} />
      ) : shown.length === 0 ? (
        <EmptyState compact title={list.length ? 'No match' : 'No staff yet'} message={list.length ? 'Try another name.' : 'Invite your first staff member.'} />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
          {shown.map((m) => (
            <Card key={m.uid} padding="var(--gap-md) var(--gap-lg)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-h4 clamp-1">{m.name || m.email || m.phone}</div>
                  <div className="t-caption clamp-2">
                    {[m.team, `${money(m.dailyLimit)}/day`, W.scheduleSummary(m.schedule), m.deliveryMode === 'office' ? office(m.officeId) || 'Office' : 'Remote'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {m.status === 'paused' && <Pill label="Paused" tone="warning" dense />}
                <Button label="Edit" icon={<Pencil size={16} aria-hidden />} size="sm" kind="ghost" expand={false} onClick={() => setEditing(m)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div className="t-overline" style={sectionTitle}>Waiting to join ({pending.length})</div>
          <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
            {pending.map((v) => <InviteRow key={v.code} companyId={id} companyName={d.company.name} v={v} onChange={load} />)}
          </div>
        </>
      )}

      <InviteSheet open={inviting} d={d} onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); reload() }} />
      {editing && <EditSheet d={d} m={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); reload() }} />}
    </>
  )
}

const joinLink = (code: string) => `${window.location.origin}/work/join/${code}`
const inviteMessage = (companyName: string, code: string) =>
  `${companyName} now pays for your meals on Blorbmart. Join here: ${joinLink(code)} (code ${code}). Sign in with the email or phone this invite was sent to.`

function InviteRow({ companyId, companyName, v, onChange }: { companyId: string; companyName: string; v: W.Invite; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const revoke = async () => {
    setBusy(true)
    try {
      await W.revokeInvite(companyId, v.code)
      onChange()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card padding="var(--gap-md) var(--gap-lg)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h4 clamp-1">{v.name || v.email || v.phone}</div>
          <div className="t-caption">{v.email || v.phone} · code {v.code}</div>
        </div>
        <Button label="Copy" icon={<Copy size={15} aria-hidden />} size="sm" kind="ghost" expand={false} onClick={() => void copyText(inviteMessage(companyName, v.code)).then((ok) => showToast(ok ? 'Invitation copied' : 'Could not copy', ok ? 'success' : 'danger'))} />
        <Button label="WhatsApp" icon={<Share2 size={15} aria-hidden />} size="sm" kind="ghost" expand={false} onClick={() => openWhatsApp(inviteMessage(companyName, v.code), v.phone || '')} />
        <Button label="Revoke" icon={<Trash2 size={15} aria-hidden />} size="sm" kind="ghost" expand={false} busy={busy} onClick={() => void revoke()} />
      </div>
    </Card>
  )
}

/**
 * One person, or many pasted from a spreadsheet: one per line,
 * "name, email or phone[, daily limit]". Everyone gets the settings below.
 */
function InviteSheet({ open, d, onClose, onDone }: { open: boolean; d: W.Overview; onClose: () => void; onDone: () => void }) {
  const [people, setPeople] = useState('')
  const [x, setX] = useState<Draft>(() => draftFrom(d))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof W.sendInvites>> | null>(null)
  useEffect(() => { if (open) { setX(draftFrom(d)); setResult(null) } }, [open, d])

  const parsed = people.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[,\t;]/).map((p) => p.trim())
    const contact = parts.find((p) => p.includes('@') || p.replace(/\D/g, '').length >= 10) || ''
    const name = parts.find((p) => p && p !== contact && !/^\d+$/.test(p.replace(/[₦,]/g, ''))) || ''
    const limit = parts.find((p) => p !== contact && /^₦?\d{3,6}$/.test(p.replace(/,/g, '')))
    return { name, ...(contact.includes('@') ? { email: contact } : { phone: contact }), ...(limit ? { dailyLimit: Number(limit.replace(/[^\d]/g, '')) } : {}) }
  })

  const send = async () => {
    setBusy(true)
    try {
      const base = draftBody(x)
      const r = await W.sendInvites(d.company.id, parsed.map((p) => ({ ...base, ...p })))
      setResult(r)
      if (r.created.length) showToast(`${r.created.length} invitation${r.created.length === 1 ? '' : 's'} ready to share`, 'success')
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Invite staff">
      {result ? (
        <div>
          <p className="t-body-sm">Share each link with the person it is for. It works only for their email or phone, for {14} days.</p>
          {result.created.map((r) => (
            <Card key={r.code} padding="var(--gap-md)" style={{ marginTop: 'var(--gap-sm)' }}>
              <div className="t-h4">{r.name || r.email || r.phone}</div>
              <div className="t-caption">Code {r.code}</div>
              <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-sm)' }}>
                <Button label="Copy message" size="sm" kind="soft" expand={false} onClick={() => void copyText(inviteMessage(d.company.name, r.code)).then((ok) => showToast(ok ? 'Copied' : 'Could not copy'))} />
                <Button label="WhatsApp" size="sm" kind="soft" expand={false} onClick={() => openWhatsApp(inviteMessage(d.company.name, r.code), r.phone || '')} />
              </div>
            </Card>
          ))}
          {result.refused.length > 0 && (
            <Banner tone="danger">
              Not sent:
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.refused.map((r) => <li key={r.line}>Line {r.line}{r.name ? ` (${r.name})` : ''}: {r.reason}</li>)}</ul>
            </Banner>
          )}
          <div style={{ marginTop: 'var(--gap-lg)' }}><Button label="Done" onClick={onDone} /></div>
        </div>
      ) : (
        <div>
          <WField label="Who" hint="One person per line: name, then email or phone, then a daily limit if different. You can paste straight from a spreadsheet.">
            <textarea className={inputClass} value={people} onChange={(e) => setPeople(e.target.value)} placeholder={'Ngozi Okafor, ngozi@yourcompany.ng\nTunde Bello, 0803 000 0000, 3000'} />
          </WField>
          {parsed.length > 0 && <p className="t-caption" style={{ margin: '6px 0 0' }}>{parsed.length} {parsed.length === 1 ? 'person' : 'people'}</p>}
          <div className="t-overline" style={sectionTitle}>Their meal settings</div>
          <SettingsFields d={d} x={x} set={setX} />
          <div style={{ marginTop: 'var(--gap-xl)' }}>
            <Button label={`Create ${parsed.length || ''} invitation${parsed.length === 1 ? '' : 's'}`} busy={busy} disabled={!parsed.length || !x.dailyLimit} onClick={() => void send()} />
          </div>
        </div>
      )}
    </Sheet>
  )
}

function EditSheet({ d, m, onClose, onDone }: { d: W.Overview; m: W.Member; onClose: () => void; onDone: () => void }) {
  const [x, setX] = useState<Draft>(() => draftFrom(d, m))
  const [paused, setPaused] = useState(m.status === 'paused')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await W.updateMember(d.company.id, m.uid, { ...draftBody(x), status: paused ? 'paused' : 'active' })
      showToast('Saved', 'success')
      onDone()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await W.removeMember(d.company.id, m.uid)
      showToast('Removed from the plan', 'success')
      onDone()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={m.name || 'Staff member'}>
      <p className="t-caption" style={{ margin: 0 }}>{[m.email, m.phone].filter(Boolean).join(' · ')}</p>
      <SettingsFields d={d} x={x} set={setX} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'var(--gap-lg)' }}>
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
        <span className="t-body-sm">Pause their work meals for now (leave, suspension)</span>
      </label>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xl)' }}>
        <Button label="Save" busy={busy} onClick={() => void save()} />
        <Button label="Remove" kind="danger" expand={false} disabled={busy} onClick={() => setConfirmRemove(true)} />
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${m.name || 'this person'}?`}
        message="They stop getting work meals at once, and their seat is free for someone else. Seats already paid are not refunded."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmRemove(false)}
      />
    </Sheet>
  )
}

/* ───────────────────────────── Billing ───────────────────────────── */

function BillingTab({ d }: { d: W.Overview }) {
  const [list, setList] = useState<W.Invoice[] | null>(null)
  const [kind, setKind] = useState<'subscription' | 'seats' | 'topup'>(d.paidThisMonth ? (d.paidNextMonth ? 'topup' : 'subscription') : 'subscription')
  const [month, setMonth] = useState(d.paidThisMonth ? d.nextMonth : d.month)
  const [seats, setSeats] = useState(String(Math.max(1, d.company.activeMembers, d.seatsThisMonth)))
  const [addSeats, setAddSeats] = useState('1')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const owner = d.role === 'owner'
  const id = d.company.id

  const load = useCallback(() => { W.invoices(id).then(setList).catch(() => setList([])) }, [id])
  useEffect(load, [load])

  // A payment changes which choices exist (paying next month removes "Pay for
  // a month"); keep the form on one that is still offered, or the browser shows
  // a different option from the one that would be sent.
  useEffect(() => {
    if (kind === 'subscription' && d.paidThisMonth && d.paidNextMonth) setKind('topup')
    else if (kind === 'seats' && !d.paidThisMonth) setKind('subscription')
    if (month === d.month && d.paidThisMonth) setMonth(d.nextMonth)
    else if (month === d.nextMonth && d.paidNextMonth && !d.paidThisMonth) setMonth(d.month)
    // Only when what is paid changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.paidThisMonth, d.paidNextMonth])

  const pay = async (invoiceId: string) => {
    setBusy(invoiceId)
    try {
      const r = await W.payInvoice(id, invoiceId)
      window.location.assign(r.authorizationUrl)
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(null)
      load()
    }
  }

  const create = async () => {
    setBusy('new')
    try {
      const inv = await W.createInvoice(id, {
        kind,
        ...(kind === 'subscription' ? { month, seats: Number(seats) } : {}),
        ...(kind === 'seats' ? { addSeats: Number(addSeats) } : {}),
        budgetAmount: Number(budget) || 0,
      })
      await pay(inv.id)
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(null)
    }
  }

  const fee = d.company.seatFee
  // The rest of this month, the way the server rounds it: up to the next ₦50.
  const prorated = (() => {
    const now = new Date()
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return Math.ceil((fee * (days - now.getDate() + 1)) / days / 50) * 50
  })()
  const estimate = kind === 'subscription'
    ? Number(seats || 0) * (month === d.month ? prorated : fee) + (Number(budget) || 0)
    : kind === 'seats'
      ? Number(addSeats || 0) * (prorated + (d.paidNextMonth ? fee : 0)) + (Number(budget) || 0)
      : Number(budget) || 0

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap', marginTop: 'var(--gap-lg)' }}>
        <Stat label={W.monthLabel(d.month)} value={d.paidThisMonth ? `Paid · ${d.seatsThisMonth} seats` : 'Not paid'} tone={d.paidThisMonth ? 'var(--color-success)' : 'var(--color-danger)'} />
        <Stat label={W.monthLabel(d.nextMonth)} value={d.paidNextMonth ? `Paid · ${d.seatsNextMonth} seats` : 'Not paid'} tone={d.paidNextMonth ? 'var(--color-success)' : undefined} />
        <Stat label="Meal budget" value={money(d.balance)} />
      </div>
      <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>
        {money(fee)} per staff member a month ({d.company.planLabel}, up to {d.company.maxSeats} staff). The first month is charged for the days left. Budget you do not use rolls over.
      </p>

      {owner && d.company.status === 'active' && (
        <Card style={{ marginTop: 'var(--gap-lg)' }}>
          <div className="t-h3">Make a payment</div>
          <WField label="What for">
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {(!d.paidThisMonth || !d.paidNextMonth) && <option value="subscription">Pay for a month (seats + budget)</option>}
              {d.paidThisMonth && <option value="seats">Add seats this month</option>}
              <option value="topup">Top up the meal budget</option>
            </select>
          </WField>
          {kind === 'subscription' && (
            <>
              <WField label="Month">
                <select className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)}>
                  {!d.paidThisMonth && <option value={d.month}>{W.monthLabel(d.month)} (rest of the month)</option>}
                  {!d.paidNextMonth && <option value={d.nextMonth}>{W.monthLabel(d.nextMonth)}</option>}
                </select>
              </WField>
              <WField label="Seats" hint={`At least ${Math.max(1, d.company.activeMembers)} — one for each staff member on the plan.`}>
                <input className={inputClass} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </WField>
            </>
          )}
          {kind === 'seats' && (
            <WField label="Seats to add"><input className={inputClass} inputMode="numeric" value={addSeats} onChange={(e) => setAddSeats(e.target.value.replace(/\D/g, '').slice(0, 4))} /></WField>
          )}
          <WField label={kind === 'topup' ? 'Amount for meals' : 'Meal budget to add (optional)'} hint={kind === 'topup' ? 'At least ₦5,000.' : 'You can also top up any time.'}>
            <NairaInput value={budget} onChange={setBudget} ariaLabel="Meal budget" />
          </WField>
          <SummaryRow label="About" value={money(estimate)} hint="The exact total, with any proration, is on the invoice." />
          <div style={{ marginTop: 'var(--gap-lg)' }}>
            <Button label="Create invoice and pay" busy={busy === 'new'} onClick={() => void create()} />
          </div>
          <p className="t-caption" style={{ margin: 'var(--gap-sm) 0 0' }}>Card, bank transfer or USSD through Paystack. For a large transfer to our account instead, contact us with the invoice number.</p>
        </Card>
      )}

      <div className="t-overline" style={sectionTitle}>Invoices</div>
      {!list ? <Skeleton height={80} /> : list.length === 0 ? <p className="t-caption">No invoices yet.</p> : (
        <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
          {list.map((inv) => (
            <Card key={inv.id} padding="var(--gap-md) var(--gap-lg)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-h4">
                    {inv.kind === 'topup' ? 'Budget top-up' : inv.kind === 'seats' ? `${inv.addSeats} extra seat${inv.addSeats === 1 ? '' : 's'}` : `${inv.month ? W.monthLabel(inv.month) : ''} · ${inv.seats} seats`}
                  </div>
                  <div className="t-caption">
                    {money(inv.total)}{inv.feeAmount ? ` (fees ${money(inv.feeAmount)}, meals ${money(inv.budgetAmount)})` : ''} · #{inv.id.slice(0, 8)}
                    {inv.cancelReason ? ` · ${inv.cancelReason}` : ''}
                  </div>
                </div>
                <Pill label={inv.status === 'paid' ? 'Paid' : inv.status === 'unpaid' ? 'Unpaid' : 'Cancelled'} tone={inv.status === 'paid' ? 'success' : inv.status === 'unpaid' ? 'warning' : 'neutral'} dense />
                {owner && inv.status === 'unpaid' && <Button label="Pay" size="sm" expand={false} busy={busy === inv.id} onClick={() => void pay(inv.id)} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

/* ───────────────────────────── Report ───────────────────────────── */

const lastMonths = (from: string, n: number) => {
  const out = [from]
  let [y, m] = from.split('-').map(Number)
  for (let i = 1; i < n; i += 1) {
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

function ReportTab({ d }: { d: W.Overview }) {
  const [month, setMonth] = useState(d.month)
  const [r, setR] = useState<W.Report | null>(null)
  useEffect(() => {
    setR(null)
    W.report(d.company.id, month).then(setR).catch((e) => showToast(apiErrorMessage(e), 'danger'))
  }, [d.company.id, month])

  const csv = () => {
    if (!r) return
    const rows = [['Date', 'Staff', 'Restaurant', 'Order', 'Type', 'Amount (NGN)'], ...r.lines.map((l) => [
      l.at ? new Date(l.at).toLocaleString('en-NG') : '', l.name, l.storeName, l.orderId || '', l.type === 'meal' ? 'Meal' : 'Refund', String(l.amount),
    ])]
    const text = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${d.company.name.replace(/[^\w]+/g, '-')}-meals-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-lg)' }}>
        <select className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: 1 }}>
          {lastMonths(d.month, 12).map((m) => <option key={m} value={m}>{W.monthLabel(m)}</option>)}
        </select>
        <Button label="CSV" icon={<Download size={16} aria-hidden />} size="md" kind="soft" expand={false} disabled={!r?.lines.length} onClick={csv} />
      </div>
      {!r ? <Skeleton height={160} radius="var(--radius-lg)" style={{ marginTop: 'var(--gap-lg)' }} /> : (
        <>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap', marginTop: 'var(--gap-lg)' }}>
            <Stat label="Spent on meals" value={money(r.total)} />
            <Stat label="Budget added" value={money(r.funded)} />
            <Stat label="Staff who ate" value={String(r.staff.filter((s) => s.meals > 0).length)} />
          </div>
          <div className="t-overline" style={sectionTitle}>By staff member</div>
          {r.staff.length === 0 ? <p className="t-caption">No meals this month.</p> : (
            <Card>{r.staff.map((s) => <SummaryRow key={s.uid} label={`${s.name || 'Staff'} · ${s.meals} meal${s.meals === 1 ? '' : 's'}`} value={money(s.total)} />)}</Card>
          )}
          <div className="t-overline" style={sectionTitle}>By restaurant</div>
          {r.stores.length === 0 ? <p className="t-caption">—</p> : (
            <Card>{r.stores.map((s) => <SummaryRow key={s.storeId || s.name} label={`${s.name} · ${s.meals}`} value={money(s.total)} />)}</Card>
          )}
        </>
      )}
    </>
  )
}

/* ───────────────────────────── Setup ───────────────────────────── */

function SetupTab({ d, reload }: { d: W.Overview; reload: () => void }) {
  const c = d.company
  const [editing, setEditing] = useState<W.Office | 'new' | null>(null)
  const [defaults, setDefaults] = useState({
    dailyLimit: String(c.defaults.dailyLimit || 2500),
    scheduleTemplate: c.defaults.scheduleTemplate || 'weekday_lunch',
    coversDelivery: c.defaults.coversDelivery !== false,
    lowBalanceAlert: String(c.lowBalanceAlert),
  })
  const [managerEmail, setManagerEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    try {
      await fn()
      showToast(ok, 'success')
      reload()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="t-overline" style={sectionTitle}>Offices ({c.offices.length}/{c.maxOffices})</div>
      {c.offices.length === 0 && <p className="t-caption">Add the address riders bring office meals to.</p>}
      <div style={{ display: 'grid', gap: 'var(--gap-sm)' }}>
        {c.offices.map((o) => (
          <Card key={o.id} padding="var(--gap-md) var(--gap-lg)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-h4">{o.name}</div>
                <div className="t-caption clamp-2">{o.address.addressLine1}{o.dropTimes.length ? ` · drops ${o.dropTimes.join(', ')}` : ''}</div>
              </div>
              <Button label="Edit" size="sm" kind="ghost" expand={false} onClick={() => setEditing(o)} />
            </div>
          </Card>
        ))}
      </div>
      {c.offices.length < c.maxOffices && <div style={{ marginTop: 'var(--gap-sm)' }}><Button label="Add an office" kind="soft" size="md" icon={<Plus size={16} aria-hidden />} onClick={() => setEditing('new')} /></div>}

      <div className="t-overline" style={sectionTitle}>Defaults for new staff</div>
      <Card>
        <WField label="Daily limit"><NairaInput value={defaults.dailyLimit} onChange={(v) => setDefaults({ ...defaults, dailyLimit: v })} /></WField>
        <WField label="Meal times">
          <select className={inputClass} value={defaults.scheduleTemplate} onChange={(e) => setDefaults({ ...defaults, scheduleTemplate: e.target.value })}>
            {d.templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </WField>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'var(--gap-lg)' }}>
          <input type="checkbox" checked={defaults.coversDelivery} onChange={(e) => setDefaults({ ...defaults, coversDelivery: e.target.checked })} />
          <span className="t-body-sm">Company pays delivery and service fees</span>
        </label>
        <WField label="Warn me when the budget falls below"><NairaInput value={defaults.lowBalanceAlert} onChange={(v) => setDefaults({ ...defaults, lowBalanceAlert: v })} /></WField>
        <div style={{ marginTop: 'var(--gap-lg)' }}>
          <Button label="Save defaults" size="md" busy={busy === 'defaults'} onClick={() => void run('defaults', () => W.saveSettings(c.id, { ...defaults, dailyLimit: Number(defaults.dailyLimit), lowBalanceAlert: Number(defaults.lowBalanceAlert) }), 'Saved')} />
        </div>
      </Card>

      <div className="t-overline" style={sectionTitle}>Team</div>
      <Card>
        {c.team.map((t) => (
          <div key={t.uid} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)', padding: '6px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h4 clamp-1">{t.name || t.email}</div>
              <div className="t-caption">{t.role === 'owner' ? 'Owner — pays and manages' : 'Manager — staff, offices, reports'}</div>
            </div>
            {d.role === 'owner' && t.role === 'manager' && (
              <Button label="Remove" size="sm" kind="ghost" expand={false} busy={busy === t.uid} onClick={() => void run(t.uid, () => W.removeManager(c.id, t.uid), 'Manager removed')} />
            )}
          </div>
        ))}
        {d.role === 'owner' && (
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-md)' }}>
            <input className={inputClass} placeholder="Manager’s Blorbmart email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            <Button label="Add" size="md" expand={false} busy={busy === 'mgr'} disabled={!managerEmail.includes('@')} onClick={() => void run('mgr', async () => { await W.addManager(c.id, managerEmail); setManagerEmail('') }, 'Manager added')} />
          </div>
        )}
      </Card>

      {editing && <OfficeSheet companyId={c.id} office={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload() }} />}
    </>
  )
}

function OfficeSheet({ companyId, office, onClose, onDone }: { companyId: string; office: W.Office | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: office?.name || '',
    addressLine1: office?.address.addressLine1 || '',
    landmark: office?.address.landmark || '',
    deliveryInstructions: office?.address.deliveryInstructions || '',
    dropTimes: (office?.dropTimes || []).join(', '),
  })
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await W.saveOffice(companyId, {
        ...(office ? { id: office.id } : {}),
        name: f.name,
        addressLine1: f.addressLine1,
        landmark: f.landmark,
        deliveryInstructions: f.deliveryInstructions,
        dropTimes: f.dropTimes.split(/[,\s]+/).filter(Boolean),
      })
      showToast('Office saved', 'success')
      onDone()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!office) return
    setBusy(true)
    try {
      await W.removeOffice(companyId, office.id)
      showToast('Office removed', 'success')
      onDone()
    } catch (e) {
      showToast(apiErrorMessage(e), 'danger')
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={office ? 'Edit office' : 'Add an office'}>
      <WField label="Name"><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Main hospital, ward block" maxLength={60} /></WField>
      <WField label="Address" hint="Riders come here. Be as exact as you can."><input className={inputClass} value={f.addressLine1} onChange={(e) => setF({ ...f, addressLine1: e.target.value })} maxLength={160} /></WField>
      <WField label="Landmark (optional)"><input className={inputClass} value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} maxLength={120} /></WField>
      <WField label="Instructions for riders (optional)"><input className={inputClass} value={f.deliveryInstructions} onChange={(e) => setF({ ...f, deliveryInstructions: e.target.value })} maxLength={200} placeholder="Ask at the front desk" /></WField>
      <WField label="Drop times (optional)" hint="Usual lunch or shift-change times, like 12:30, 19:00. Staff are offered these as delivery times.">
        <input className={inputClass} value={f.dropTimes} onChange={(e) => setF({ ...f, dropTimes: e.target.value })} placeholder="12:30, 19:00" />
      </WField>
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', marginTop: 'var(--gap-xl)' }}>
        <Button label="Save office" busy={busy} disabled={f.name.trim().length < 2 || f.addressLine1.trim().length < 4} onClick={() => void save()} />
        {office && <Button label="Remove" kind="danger" expand={false} disabled={busy} onClick={() => setConfirm(true)} />}
      </div>
      <ConfirmDialog open={confirm} title="Remove this office?" message="Only possible when no staff get meals here." confirmLabel="Remove" destructive busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirm(false)} />
    </Sheet>
  )
}
