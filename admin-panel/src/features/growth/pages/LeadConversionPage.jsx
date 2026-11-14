import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { PATIENTS } from '../../patients/data/patients'
import { Check, OptionSelect } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_NOW, GROWTH_TODAY, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { TONES, when } from '../format'
import { dueState } from '../growthLogic'

const PATHS = [['existing', 'Link existing patient'], ['new', 'Create new patient']]
const DISPOSITIONS = ['Defer', 'Unresponsive', 'Not interested']

export default function LeadConversionPage() {
  const { leadId } = useParams()
  const { data } = useGrowth()
  const lead = data.leads.find((entry) => entry.id === leadId)
  if (!lead) {
    return (
      <GrowthFrame back={{ to: ROUTES.leads, label: 'Back to Lead Register' }} crumb="Owner Panel / Growth OS / Leads" code="GO-06" title="Lead not found">
        <Banner tone="warning" title="No lead matches this link">Open the Lead Register to find the record.</Banner>
      </GrowthFrame>
    )
  }
  return <Conversion key={leadId} lead={lead} />
}

function Conversion({ lead }) {
  const { data, update } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const detailPath = pathFor(ROUTES.lead, { leadId: lead.id })
  const digits = lead.phone.replace(/\D/g, '')
  const duplicateLeads = data.leads.filter((entry) => entry.id !== lead.id && entry.phone.replace(/\D/g, '') === digits)
  const duplicatePatients = PATIENTS.filter((patient) => patient.mobile.replace(/\D/g, '').endsWith(digits))
  const duplicates = duplicateLeads.length + duplicatePatients.length
  const [form, setForm] = useState({ reviewed: false, path: '', patientId: '', noMatch: false, identity: false, pathConfirmed: false, conversion: false, branchAccess: false })
  const [plan, setPlan] = useState({ date: '2026-10-29', time: '11:00', owner: lead.owner, disposition: '', action: '', reason: '', consent: false, confirmed: false })
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const converted = lead.stage === 'Converted'
  const pathReady = form.path === 'existing' ? Boolean(form.patientId) : form.path === 'new' ? form.noMatch : false
  const checks = [form.reviewed || duplicates === 0, pathReady, form.identity, form.pathConfirmed, form.conversion, form.branchAccess]
  const ready = !converted && checks.every(Boolean)
  const planReady = plan.disposition && plan.action.trim() && (plan.disposition !== 'Defer' || plan.reason.trim()) && plan.consent && plan.confirmed
  const steps = [['1. Review lead', 'Saved context'], ['2. Duplicate checks', duplicates ? 'Review required' : 'No match found'], ['3. Patient identity', pathReady ? 'Path chosen' : 'Verification pending'], ['4. Confirm conversion', ready ? 'Ready' : 'Locked'], ['5. Next steps', 'After conversion']]

  const convert = () => {
    update('leads', lead.id, (current) => ({ stage: 'Converted', patientId: form.path === 'existing' ? form.patientId : null, patientPath: form.path, due: null, nextAction: '', activities: [{ id: `a${current.activities.length + 1}`, at: { date: GROWTH_TODAY, time: GROWTH_NOW }, title: 'Lead converted', text: `Qualified → Converted. ${form.path === 'existing' ? `Linked to patient ${PATIENTS.find((patient) => patient.id === form.patientId)?.name}.` : 'New patient to be registered after an explicit no-match review.'} Original attribution preserved; no appointment booked.` }, ...current.activities] }))
    navigate(detailPath, { state })
  }

  const applyPlan = () => {
    const stamp = { date: GROWTH_TODAY, time: GROWTH_NOW }
    const text = plan.disposition === 'Defer' ? `Deferred to ${when({ date: plan.date, time: plan.time })}. Reason: ${plan.reason.trim()}` : `${plan.disposition}. Lead closed from re-engagement.`
    update('leads', lead.id, (current) => ({ ...(plan.disposition === 'Defer' ? { due: { date: plan.date, time: plan.time }, nextAction: plan.action.trim(), owner: plan.owner } : { stage: 'Closed', due: null, nextAction: '' }), activities: [{ id: `a${current.activities.length + 1}`, at: stamp, title: `Re-engagement · ${plan.disposition}`, text }, ...current.activities] }))
    navigate(detailPath, { state })
  }

  return (
    <GrowthFrame back={{ to: detailPath, label: 'Back to Lead Details' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name} / Lead Conversion & Re-engagement`} code="GO-06" title="Lead Conversion & Re-engagement" description="Resolve identity first. Link one shared patient record or create a new one only after an authorized no-match review." context={['Return to: Aura Health · All locations (3) · 01–22 Oct 2026', `Lead branch: ${lead.branch}. Return keeps the register’s all-location scope.`]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs"><p className="flex flex-wrap items-center gap-2"><strong className="text-base">{lead.name}</strong><StatusPill tone="success">{lead.stage}</StatusPill>{dueState(lead) !== 'None' && <StatusPill tone={TONES[dueState(lead)]}>{dueState(lead)} · Open</StatusPill>}<span className="text-outline">{lead.id.replace('LD', 'LD ')} · {lead.phone} · {lead.interest}</span></p><span className="text-outline">{lead.branch} · Owner {lead.owner}</span></div>
      <ol className="mb-5 grid gap-3 sm:grid-cols-5">{steps.map(([title, note], index) => <li key={title} className={cn('rounded-md border p-3 text-xs', index === 1 ? 'border-brand bg-teal-50' : 'border-slate-200 bg-white')}><p className="font-semibold">{title}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
      <Banner tone={converted ? 'brand' : 'warning'} title={converted ? 'Converted' : 'Not converted · Identity review required'} className="mb-6">{converted ? 'This lead is converted. No appointment is booked; continue in the patient workflow.' : 'No patient link is verified, no new patient is created and no appointment is booked. Conversion stays locked while required checks are pending.'}</Banner>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="1. Review lead & shared records" aside="Saved source record">
            <dl className="grid gap-4 text-xs sm:grid-cols-3"><div><dt className="text-outline">Full name</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.name}</dd></div><div><dt className="text-outline">Phone</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.phone}</dd></div><div><dt className="text-outline">Lead branch</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.branch}</dd></div></dl>
            <Banner tone={duplicates ? 'warning' : 'neutral'} title={duplicates ? 'Possible duplicate · Review required' : '2. No duplicate detected'} className="mt-4">{duplicates ? [...duplicateLeads.map((entry) => `${entry.name} (${entry.id.replace('LD', 'LD ')})`), ...duplicatePatients.map((patient) => `${patient.name} (${patient.mrn})`)].join(', ') + ' shares this phone number. Do not silently merge records.' : 'No shared lead or patient record matches the phone number. This is a detection state, not identity verification.'}</Banner>
            <div className="mt-3"><Check checked={form.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label="Duplicate review completed" /></div>
          </Section>

          <Section title="3. Resolve patient identity" aside="Choose exactly one path">
            <div className="grid gap-4 sm:grid-cols-2">{PATHS.map(([id, label]) => <label key={id} className={cn('cursor-pointer rounded-md border p-4 text-xs', form.path === id ? 'border-brand bg-teal-50' : 'border-slate-200')}><span className="flex items-center gap-2 text-[13px] font-semibold"><input type="radio" name="path" checked={form.path === id} onChange={() => set('path', id)} className="accent-[#006a61]" />{label}</span><span className="mt-2 block leading-5 text-on-surface-variant">{id === 'existing' ? 'Select and verify a permitted shared patient record. Linking must not silently edit patient details.' : 'Available only after duplicate review and an explicit no-match confirmation. Create one shared patient record, then link the lead.'}</span></label>)}</div>
            {form.path === 'existing' && <div className="mt-4 max-w-md"><OptionSelect label="Select verified match" value={form.patientId} onChange={(event) => set('patientId', event.target.value)} placeholder="Choose a shared patient" options={PATIENTS.map((patient) => ({ value: patient.id, label: `${patient.name} · ${patient.mrn}` }))} /></div>}
            {form.path === 'new' && <div className="mt-4"><Check checked={form.noMatch} onChange={(event) => set('noMatch', event.target.checked)} label="I confirm no matching shared patient exists after duplicate review." /></div>}
            <div className="mt-4 space-y-3"><Check checked={form.identity} onChange={(event) => set('identity', event.target.checked)} label="Verify identity and document permission to proceed" /><Check checked={form.pathConfirmed} onChange={(event) => set('pathConfirmed', event.target.checked)} label="Confirm the chosen path" /></div>
          </Section>

          <Section title="Re-engagement proposal" aside="Does not change stage until applied">
            <div className="grid gap-4 sm:grid-cols-3"><TextInput label="Proposed contact date" type="date" min={GROWTH_TODAY} value={plan.date} onChange={(event) => setPlan((current) => ({ ...current, date: event.target.value }))} /><TextInput label="Time · IST" type="time" value={plan.time} onChange={(event) => setPlan((current) => ({ ...current, time: event.target.value }))} /><SelectInput label="Responsible owner" value={plan.owner} onChange={(event) => setPlan((current) => ({ ...current, owner: event.target.value }))} options={OWNERS} /></div>
            <div className="mt-4"><TextInput label="Proposed next action" value={plan.action} onChange={(event) => setPlan((current) => ({ ...current, action: event.target.value }))} /></div>
            <div role="radiogroup" aria-label="Disposition" className="mt-4 flex flex-wrap gap-2">{DISPOSITIONS.map((disposition) => <label key={disposition} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs', plan.disposition === disposition ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="disposition" checked={plan.disposition === disposition} onChange={() => setPlan((current) => ({ ...current, disposition }))} className="accent-[#006a61]" />{disposition}</label>)}</div>
            {plan.disposition === 'Defer' && <div className="mt-4"><TextInput label="Reason for deferring" value={plan.reason} onChange={(event) => setPlan((current) => ({ ...current, reason: event.target.value }))} /></div>}
            <div className="mt-4 space-y-3"><Check checked={plan.consent} onChange={(event) => setPlan((current) => ({ ...current, consent: event.target.checked }))} label="Verify contact preference before any outreach" /><Check checked={plan.confirmed} onChange={(event) => setPlan((current) => ({ ...current, confirmed: event.target.checked }))} label="Confirm the re-engagement disposition before applying" /></div>
            <ActionButton className="mt-4" disabled={!planReady || converted} onClick={applyPlan}>Apply re-engagement plan</ActionButton>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="4. Conversion confirmation" aside={converted ? 'Converted' : 'Not converted'}>
            <p className="text-[13px] font-semibold">{lead.name} · {lead.id.replace('LD', 'LD ')}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-on-surface-variant"><li>{lead.stage} → Converted · proposed only</li><li className={form.path ? '' : 'text-amber-700'}>Patient: {form.path === 'existing' ? PATIENTS.find((patient) => patient.id === form.patientId)?.name ?? 'select a match' : form.path === 'new' ? 'new record after no-match review' : 'verification pending'}</li><li>Appointment: not booked</li></ul>
            <div className="mt-4 space-y-3"><Check checked={form.pathConfirmed && pathReady} disabled readOnly label="Confirm verified link or authorized creation" /><Check checked={form.branchAccess} onChange={(event) => set('branchAccess', event.target.checked)} label={`Verify conversion & branch permissions for ${lead.branch}`} /><Check checked={form.conversion} onChange={(event) => set('conversion', event.target.checked)} label="Confirm conversion separately" /></div>
            {!ready && !converted && <Banner tone="warning" title="Conversion action locked" className="mt-4">Identity review, path, access and confirmations are incomplete. No conversion has occurred.</Banner>}
          </Section>
          <Section title="5. After conversion"><p className="text-xs leading-5 text-on-surface-variant">Only after a successful confirmation: the actor, timestamp and verified link are recorded with the original attribution and stage history.</p><Banner tone="brand" title="Conversion is not a booking" className="mt-4">The appointment remains unbooked. Continue through the appointment workflow after confirming details.</Banner>{converted && <ActionButton className="mt-4" to={lead.patientId ? pathFor(ROUTES.patientHub, { patientId: lead.patientId }) : ROUTES.patientNew}>{lead.patientId ? 'Open patient record →' : 'Register new patient →'}</ActionButton>}</Section>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{converted ? 'Converted' : 'Not converted · Complete identity review first'}</strong>No patient record is created or changed by this screen until the checks pass.</p>
        <ActionButton onClick={() => navigate(detailPath)}>{converted ? 'Back' : 'Cancel'}</ActionButton>
        <ActionButton variant="brand" disabled={!ready} onClick={convert}>Confirm conversion</ActionButton>
      </div>
      <GrowthFooter code="GO-06" back={{ to: detailPath, label: 'Back to Lead Details' }} />
    </GrowthFrame>
  )
}
