import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCHES, GROWTH_NOW, GROWTH_TODAY, LEAD_INTERESTS, LEAD_SOURCES, LEAD_STAGES, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { when } from '../format'
import { validateLead } from '../growthLogic'

export default function LeadFormPage() {
  const { leadId } = useParams()
  const { data } = useGrowth()
  const lead = leadId ? data.leads.find((entry) => entry.id === leadId) : null
  if (leadId && !lead) {
    return (
      <GrowthFrame back={{ to: ROUTES.leads, label: 'Back to Lead Register' }} crumb="Owner Panel / Growth OS / Leads" code="GO-04" title="Lead not found">
        <Banner tone="warning" title="No lead matches this link">Open the Lead Register to find the record.</Banner>
      </GrowthFrame>
    )
  }
  return <LeadForm key={leadId ?? 'new'} lead={lead} />
}

function LeadForm({ lead }) {
  const { data, add, update, newId } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [values, setValues] = useState({
    name: lead?.name ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '', interest: lead?.interest ?? LEAD_INTERESTS[0], source: lead?.source ?? LEAD_SOURCES[0],
    branch: lead?.branch ?? GROWTH_BRANCHES[0], owner: lead?.owner ?? OWNERS[0], stage: lead?.stage ?? LEAD_STAGES[0], nextAction: lead?.nextAction ?? '', nextDate: lead?.due?.date ?? '', reviewed: false, confirmed: false,
  })
  const [attempted, setAttempted] = useState(false)
  const errors = attempted ? validateLead(values) : {}
  const digits = values.phone.replace(/\D/g, '')
  const duplicates = digits.length === 10 ? data.leads.filter((entry) => entry.id !== lead?.id && entry.phone.replace(/\D/g, '') === digits) : []
  const consequential = lead && (values.stage !== lead.stage || values.owner !== lead.owner || values.branch !== lead.branch)
  const backPath = lead ? pathFor(ROUTES.lead, { leadId: lead.id }) : `${ROUTES.leads}${state?.search ?? ''}`
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const blocked = (duplicates.length > 0 && !values.reviewed) || (consequential && !values.confirmed)

  const save = () => {
    setAttempted(true)
    if (Object.keys(validateLead(values)).length || blocked) return
    const common = { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim(), interest: values.interest, branch: values.branch, owner: values.owner, stage: values.stage }
    if (lead) {
      const changes = ['name', 'phone', 'email', 'interest', 'branch', 'owner', 'stage'].filter((key) => common[key] !== lead[key]).map((key) => `${key}: ${lead[key] || '—'} → ${common[key] || '—'}`)
      update('leads', lead.id, (current) => ({ ...common, activities: [{ id: `a${current.activities.length + 1}`, at: { date: GROWTH_TODAY, time: GROWTH_NOW }, title: 'Lead updated', text: changes.length ? changes.join('; ') : 'Saved without changes.' }, ...current.activities] }))
      navigate(pathFor(ROUTES.lead, { leadId: lead.id }), { state })
      return
    }
    const id = newId('LD', 'leads')
    const stamp = { date: GROWTH_TODAY, time: GROWTH_NOW }
    add('leads', { id, ...common, source: values.source, campaignId: null, campaign: 'Organic', channel: values.source, created: stamp, lastActivity: stamp, nextAction: values.nextAction.trim(), due: values.nextDate ? { date: values.nextDate, time: '10:00' } : null, summary: values.interest, activities: [{ id: 'a1', at: stamp, title: `${values.source} recorded`, text: `New inquiry about ${values.interest.toLowerCase()}.` }] })
    navigate(pathFor(ROUTES.lead, { leadId: id }), { state })
  }

  return (
    <GrowthFrame back={{ to: backPath, label: lead ? 'Back to Lead Details' : 'Back to Lead Register' }} crumb={`Owner Panel / Growth OS / Leads / ${lead ? `${lead.name} / Edit` : 'New lead'}`} code="GO-04" title="Create/Edit Lead" description={lead ? `Update ${lead.name}’s lead record without changing original attribution or shared patient details.` : 'Record a new inquiry. A lead is not a patient or an appointment.'} badge={lead ? <span className="text-xs text-outline">{lead.id.replace('LD', 'LD ')} · Existing record</span> : null} context={[`Return to: Aura Health · All locations (3) · 01–22 Oct 2026`, lead ? `Lead branch: ${lead.branch}. Return keeps the register’s all-location scope.` : 'New lead · The ID is assigned on save']}>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Section title="Lead information" aside="* Required">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} />
            <TextInput label="Phone" required inputMode="numeric" value={values.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} hint="10-digit number · identity not verified" />
            <TextInput label="Email" type="email" value={values.email} onChange={(event) => set('email', event.target.value)} error={errors.email} hint="Optional" />
            <SelectInput label="Interest" value={values.interest} onChange={(event) => set('interest', event.target.value)} options={LEAD_INTERESTS} />
            <SelectInput label="Branch" required value={values.branch} onChange={(event) => set('branch', event.target.value)} options={GROWTH_BRANCHES} error={errors.branch} hint="Lead branch, not the register’s all-location scope" />
            <SelectInput label="Owner" required value={values.owner} onChange={(event) => set('owner', event.target.value)} options={OWNERS} error={errors.owner} hint="Assignment subject to branch permissions" />
            {!lead && <SelectInput label="Source" value={values.source} onChange={(event) => set('source', event.target.value)} options={LEAD_SOURCES} />}
            <SelectInput label="Stage" value={values.stage} onChange={(event) => set('stage', event.target.value)} options={LEAD_STAGES.filter((stage) => stage !== 'Converted' || lead?.stage === 'Converted')} hint={lead ? 'Current saved stage retained' : 'New inquiries start as New'} />
            {lead ? <TextInput label="Next follow-up · IST" value={lead.due ? when(lead.due) : 'None set'} readOnly disabled hint="Managed in Lead Follow-up" /> : <><TextInput label="Next action" value={values.nextAction} onChange={(event) => set('nextAction', event.target.value)} hint="Optional" /><TextInput label="Next follow-up date" type="date" min={GROWTH_TODAY} value={values.nextDate} onChange={(event) => set('nextDate', event.target.value)} hint="Optional" /></>}
          </div>
          {consequential && <Banner tone="brand" title="Consequential changes require a separate review" className="mt-5">Stage, owner or branch changed. Confirm the old → new values before saving; this does not alter patient data or close the open follow-up.</Banner>}
        </Section>

        <div className="space-y-6">
          <Section title="Validation & duplicate review">
            {duplicates.length > 0 ? <Banner tone="warning" title="Possible duplicate · Review required">{duplicates.map((entry) => `${entry.name} (${entry.id.replace('LD', 'LD ')})`).join(', ')} uses the same phone number. Do not silently merge or create a second shared record.</Banner> : <Banner tone="brand" title="No matching lead found">Matching values alone do not verify identity. Review shared patient and lead records before linking.</Banner>}
            <div className="mt-4 space-y-3">
              <Check checked={values.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label={`Duplicate review completed${duplicates.length ? ' (required)' : ''}`} />
              {consequential && <Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="Confirm consequential changes (stage, owner or branch)" />}
            </div>
          </Section>
          {lead && <Section title="Record continuity"><p className="text-xs leading-5 text-on-surface-variant">Created {when(lead.created)}. Last saved activity {when(lead.lastActivity)}. Editing appends an audit entry; original source and campaign stay immutable.</p>{lead.due && <Banner tone="warning" title="Open follow-up remains" className="mt-3">Editing a lead is not rescheduling. Use Follow-up for an explicit completion or reschedule.</Banner>}</Section>}
        </div>
      </div>

      {lead && <Section title="Original attribution" aside="Read only · Retained across workflows" className="mb-6"><dl className="grid gap-4 text-xs sm:grid-cols-4"><KeyValue label="Source">{lead.source}</KeyValue><KeyValue label="Campaign">{lead.campaign}</KeyValue><KeyValue label="Channel">{lead.channel}</KeyValue><KeyValue label="Landing page">Not captured</KeyValue></dl></Section>}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Ready for review, not ready to save' : 'Ready to save'}</strong>{blocked ? 'Save is blocked until duplicate review and any consequential-change confirmation pass.' : 'Required fields are valid.'}</p>
        <ActionButton onClick={() => navigate(backPath)}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked} onClick={save}>{lead ? 'Save changes' : 'Create lead'}</ActionButton>
      </div>
      <GrowthFooter code="GO-04" back={{ to: backPath, label: lead ? 'Back to Lead Details' : 'Back to Lead Register' }} />
    </GrowthFrame>
  )
}
