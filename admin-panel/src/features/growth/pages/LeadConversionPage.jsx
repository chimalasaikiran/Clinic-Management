import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { addDays } from '../../appointments/logic'
import { patientsApi } from '../../patients/api'
import { Check, OptionSelect } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import LeadGate from '../components/LeadGate'
import { TONES, when } from '../format'
import { leadsApi } from '../leadsApi'
import { clinicNow, DISPOSITIONS, dispositionId, LIVE_NOTE, ownerOptions, STAGES } from '../leadsView'
import { useLeadContext, useLeadOwners } from '../useLeads'

const PATHS = [['existing', 'Link existing patient'], ['new', 'Create new patient']]

export default function LeadConversionPage() {
  const { leadId } = useParams()
  return <LeadGate leadId={leadId} code="GO-06">{(lead) => <Conversion key={lead.id} lead={lead} />}</LeadGate>
}

function Conversion({ lead }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { can } = useAuth()
  const context = useLeadContext()
  const eligible = ownerOptions(useLeadOwners(), lead.branchId)
  const owners = eligible.some((option) => option.value === lead.ownerId) ? eligible : [{ value: lead.ownerId, label: lead.owner }, ...eligible]
  const detailPath = pathFor(ROUTES.lead, { leadId: lead.id })
  const [today] = useState(() => clinicNow().date)

  const duplicateLeads = useApiResource(() => leadsApi.duplicates(lead.mobile, lead.id), `lead-duplicates:${lead.mobile}`).data ?? []
  // Registered patients with the lead's mobile number, plus any found by name or MRN below.
  const matches = useApiResource(() => patientsApi.list({ query: lead.mobile, pageSize: 5 }), `patients:${lead.mobile}`).data?.data ?? []
  const [search, setSearch] = useState('')
  const term = search.trim()
  const found = useApiResource(() => (term.length >= 2 ? patientsApi.list({ query: term, pageSize: 5 }) : Promise.resolve(null)), term).data?.data ?? []
  const candidates = [...matches, ...found.filter((patient) => !matches.some((match) => match.id === patient.id))]
  const duplicates = duplicateLeads.length + matches.length

  const [form, setForm] = useState({ reviewed: false, path: '', patientId: '', noMatch: false, identity: false, pathConfirmed: false, conversion: false, branchAccess: false })
  const [plan, setPlan] = useState({ date: addDays(today, 7), time: '11:00', owner: lead.ownerId, disposition: '', action: '', reason: '', consent: false, confirmed: false })
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const converted = lead.stage === STAGES.converted
  const closed = lead.stage === STAGES.closed
  const chosen = candidates.find((patient) => patient.id === form.patientId)
  const canRegister = can('patients.create')
  const pathReady = form.path === 'existing' ? Boolean(chosen) : form.path === 'new' ? form.noMatch && canRegister : false
  const checks = [form.reviewed || duplicates === 0, pathReady, form.identity, form.pathConfirmed, form.conversion, form.branchAccess]
  const ready = !converted && !closed && checks.every(Boolean)
  const planReady = plan.disposition && plan.action.trim() && (plan.disposition !== DISPOSITIONS.defer || (plan.reason.trim() && plan.date)) && plan.consent && plan.confirmed
  const steps = [['1. Review lead', 'Saved context'], ['2. Duplicate checks', duplicates ? 'Review required' : 'No match found'], ['3. Patient identity', pathReady ? 'Path chosen' : 'Verification pending'], ['4. Confirm conversion', ready ? 'Ready' : 'Locked'], ['5. Next steps', 'After conversion']]

  const run = async (call) => {
    setSaving(true)
    setFailure('')
    try {
      await call()
      navigate(detailPath, { state })
    } catch (error) {
      setSaving(false)
      setFailure(error.message)
    }
  }

  // Linking happens here; a new patient is registered on the registration form, which converts the lead when saved.
  const convert = () => {
    if (form.path === 'new') {
      navigate(`${ROUTES.patientNew}?fromLead=${lead.id}`, { state })
      return
    }
    run(() => leadsApi.convert(lead.id, { patientId: form.patientId, version: lead.version }))
  }

  const applyPlan = () => run(() => leadsApi.setDisposition(lead.id, {
    disposition: dispositionId(plan.disposition), nextAction: plan.action.trim(), nextDueDate: plan.disposition === DISPOSITIONS.defer ? plan.date : undefined, nextDueTime: plan.time,
    ownerMembershipId: plan.owner, reason: plan.reason.trim(), version: lead.version,
  }))

  return (
    <GrowthFrame back={{ to: detailPath, label: 'Back to Lead Details' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name} / Lead Conversion & Re-engagement`} code="GO-06" title="Lead Conversion & Re-engagement" description="Resolve identity first. Link one shared patient record or create a new one only after a no-match review." context={[context.line, `Lead branch: ${lead.branch}.`]} today={context.today} sample={LIVE_NOTE}>
      {failure && <Banner tone="danger" title="Not saved" className="mb-4">{failure}</Banner>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 text-xs"><p className="flex flex-wrap items-center gap-2"><strong className="text-base">{lead.name}</strong><StatusPill tone="success">{lead.stage}</StatusPill>{lead.dueState !== 'None' && <StatusPill tone={TONES[lead.dueState]}>{lead.dueState} · Open</StatusPill>}<span className="text-outline">{lead.number} · {lead.phone} · {lead.summary}</span></p><span className="text-outline">{lead.branch} · Owner {lead.owner}</span></div>
      <ol className="mb-5 grid gap-3 sm:grid-cols-5">{steps.map(([title, note], index) => <li key={title} className={cn('rounded-md border p-3 text-xs', index === 1 ? 'border-brand bg-teal-50' : 'border-slate-200 bg-white')}><p className="font-semibold">{title}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
      <Banner tone={converted ? 'brand' : 'warning'} title={converted ? 'Converted' : closed ? 'Closed lead' : 'Not converted · Identity review required'} className="mb-6">{converted ? 'This lead is converted. No appointment is booked; continue in the patient workflow.' : closed ? 'Reopen this lead (change its stage on Edit Lead) before converting or re-engaging it.' : 'No patient link is verified, no new patient is created and no appointment is booked. Conversion stays locked while required checks are pending.'}</Banner>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="1. Review lead & shared records" aside="Saved source record">
            <dl className="grid gap-4 text-xs sm:grid-cols-3"><div><dt className="text-outline">Full name</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.name}</dd></div><div><dt className="text-outline">Phone</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.phone}</dd></div><div><dt className="text-outline">Lead branch</dt><dd className="mt-1 rounded border border-slate-200 bg-surface-lowest px-3 py-2 text-[13px]">{lead.branch}</dd></div></dl>
            <Banner tone={duplicates ? 'warning' : 'neutral'} title={duplicates ? 'Possible duplicate · Review required' : '2. No duplicate detected'} className="mt-4">{duplicates ? [...duplicateLeads.map((entry) => `${entry.fullName} (${entry.number})`), ...matches.map((patient) => `${patient.fullName} (${patient.mrn})`)].join(', ') + ' shares this mobile number. Do not silently merge records.' : 'No shared lead or patient record matches the mobile number. This is a detection state, not identity verification.'}</Banner>
            <div className="mt-3"><Check checked={form.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label="Duplicate review completed" /></div>
          </Section>

          <Section title="3. Resolve patient identity" aside="Choose exactly one path">
            <div className="grid gap-4 sm:grid-cols-2">{PATHS.map(([id, label]) => <label key={id} className={cn('cursor-pointer rounded-md border p-4 text-xs', form.path === id ? 'border-brand bg-teal-50' : 'border-slate-200')}><span className="flex items-center gap-2 text-[13px] font-semibold"><input type="radio" name="path" checked={form.path === id} onChange={() => set('path', id)} className="accent-[#006a61]" />{label}</span><span className="mt-2 block leading-5 text-on-surface-variant">{id === 'existing' ? 'Select and verify a shared patient record. Linking does not edit patient details.' : 'Only after duplicate review and an explicit no-match confirmation. Opens patient registration with the lead’s details; saving it converts the lead.'}</span></label>)}</div>
            {form.path === 'existing' && <div className="mt-4 grid max-w-xl gap-3"><OptionSelect label="Select verified match" value={form.patientId} onChange={(event) => set('patientId', event.target.value)} placeholder={candidates.length ? 'Choose a shared patient' : 'No patient found yet'} options={candidates.map((patient) => ({ value: patient.id, label: `${patient.fullName} · ${patient.mrn} · ${patient.mobile}` }))} /><SearchBox value={search} onChange={setSearch} label="Find another patient" placeholder="Find another patient by name, MRN or mobile" /></div>}
            {form.path === 'new' && <div className="mt-4">{canRegister ? <Check checked={form.noMatch} onChange={(event) => set('noMatch', event.target.checked)} label="I confirm no matching shared patient exists after duplicate review." /> : <Banner tone="warning" title="Registration needs patient access">Your role cannot register patients. Ask someone who can, or link an existing patient.</Banner>}</div>}
            <div className="mt-4 space-y-3"><Check checked={form.identity} onChange={(event) => set('identity', event.target.checked)} label="Verify identity and document permission to proceed" /><Check checked={form.pathConfirmed} onChange={(event) => set('pathConfirmed', event.target.checked)} label="Confirm the chosen path" /></div>
          </Section>

          <Section title="Re-engagement proposal" aside="Does not change stage until applied">
            <div className="grid gap-4 sm:grid-cols-3"><TextInput label="Proposed contact date" type="date" min={today} value={plan.date} onChange={(event) => setPlan((current) => ({ ...current, date: event.target.value }))} /><TextInput label="Time · IST" type="time" value={plan.time} onChange={(event) => setPlan((current) => ({ ...current, time: event.target.value }))} /><SelectInput label="Responsible owner" value={plan.owner} onChange={(event) => setPlan((current) => ({ ...current, owner: event.target.value }))} options={owners} /></div>
            <div className="mt-4"><TextInput label="Proposed next action" value={plan.action} onChange={(event) => setPlan((current) => ({ ...current, action: event.target.value }))} /></div>
            <div role="radiogroup" aria-label="Disposition" className="mt-4 flex flex-wrap gap-2">{Object.values(DISPOSITIONS).map((disposition) => <label key={disposition} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs', plan.disposition === disposition ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="disposition" checked={plan.disposition === disposition} onChange={() => setPlan((current) => ({ ...current, disposition }))} className="accent-[#006a61]" />{disposition}</label>)}</div>
            {plan.disposition === DISPOSITIONS.defer && <div className="mt-4"><TextInput label="Reason for deferring" value={plan.reason} onChange={(event) => setPlan((current) => ({ ...current, reason: event.target.value }))} /></div>}
            {plan.disposition && plan.disposition !== DISPOSITIONS.defer && <p className="mt-3 text-[11px] text-outline">{plan.disposition} closes the lead and its open follow-up. The date and time above are not used.</p>}
            <div className="mt-4 space-y-3"><Check checked={plan.consent} onChange={(event) => setPlan((current) => ({ ...current, consent: event.target.checked }))} label="Verify contact preference before any outreach" /><Check checked={plan.confirmed} onChange={(event) => setPlan((current) => ({ ...current, confirmed: event.target.checked }))} label="Confirm the re-engagement disposition before applying" /></div>
            <ActionButton className="mt-4" disabled={!planReady || converted || closed || saving} onClick={applyPlan}>Apply re-engagement plan</ActionButton>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="4. Conversion confirmation" aside={converted ? 'Converted' : 'Not converted'}>
            <p className="text-[13px] font-semibold">{lead.name} · {lead.number}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-on-surface-variant"><li>{lead.stage} → Converted · proposed only</li><li className={form.path ? '' : 'text-amber-700'}>Patient: {form.path === 'existing' ? chosen ? `${chosen.fullName} (${chosen.mrn})` : 'select a match' : form.path === 'new' ? 'new record, registered next' : 'verification pending'}</li><li>Appointment: not booked</li>{lead.due && <li>Open follow-up {when(lead.due)} closes on conversion</li>}</ul>
            <div className="mt-4 space-y-3"><Check checked={form.pathConfirmed && pathReady} disabled readOnly label="Confirm verified link or authorized creation" /><Check checked={form.branchAccess} onChange={(event) => set('branchAccess', event.target.checked)} label={`Verify conversion & branch permissions for ${lead.branch}`} /><Check checked={form.conversion} onChange={(event) => set('conversion', event.target.checked)} label="Confirm conversion separately" /></div>
            {!ready && !converted && <Banner tone="warning" title="Conversion action locked" className="mt-4">Identity review, path, access and confirmations are incomplete. No conversion has occurred.</Banner>}
          </Section>
          <Section title="5. After conversion"><p className="text-xs leading-5 text-on-surface-variant">On conversion the lead records who converted it, when, and the linked patient, alongside its original source and stage history.</p><Banner tone="brand" title="Conversion is not a booking" className="mt-4">The appointment remains unbooked. Continue through the appointment workflow after confirming details.</Banner>{converted && lead.patient && <ActionButton className="mt-4" to={pathFor(ROUTES.patientHub, { patientId: lead.patient.id })}>Open patient record →</ActionButton>}</Section>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{converted ? 'Converted' : 'Not converted · Complete identity review first'}</strong>{form.path === 'new' ? 'The new patient is registered on the next screen; the lead converts when it is saved.' : 'No patient record is created or changed by this screen.'}</p>
        <ActionButton onClick={() => navigate(detailPath)}>{converted ? 'Back' : 'Cancel'}</ActionButton>
        <ActionButton variant="brand" disabled={!ready || saving} onClick={convert}>{form.path === 'new' ? 'Continue to registration' : 'Confirm conversion'}</ActionButton>
      </div>
      <GrowthFooter code="GO-06" back={{ to: detailPath, label: 'Back to Lead Details' }} />
    </GrowthFrame>
  )
}
