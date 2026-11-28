import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { Check, OptionSelect } from '../../patients/components/parts'
import { digitsOf } from '../../patients/format'
import { campaignsApi } from '../campaignsApi'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import LeadGate from '../components/LeadGate'
import { when } from '../format'
import { leadsApi } from '../leadsApi'
import { clinicNow, LIVE_NOTE, leadPayload, ownerOptions, SOURCES, sourceId, STAGES, stageId, validateLead } from '../leadsView'
import { useLeadContext, useLeadOwners } from '../useLeads'

// API field names to form field names, so server validation errors appear under the right input.
const FORM_FIELDS = { fullName: 'name', mobile: 'phone', branchId: 'branch', ownerMembershipId: 'owner', nextDueDate: 'nextDate' }

export default function LeadFormPage() {
  const { leadId } = useParams()
  if (!leadId) return <LeadForm key="new" lead={null} />
  return <LeadGate leadId={leadId}>{(lead) => <LeadForm key={lead.id} lead={lead} />}</LeadGate>
}

function LeadForm({ lead }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { organisation } = useAuth()
  const context = useLeadContext()
  const owners = useLeadOwners()
  const campaigns = useApiResource(() => campaignsApi.campaignOptions(), 'campaign-options').data ?? []
  const [values, setValues] = useState({
    name: lead?.name ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '', interest: lead?.interest ?? '', source: SOURCES.phone,
    branchId: lead?.branchId ?? '', ownerId: lead?.ownerId ?? '', campaignId: lead?.campaign?.id ?? '', stage: lead?.stage ?? STAGES.new, nextAction: '', nextDate: '', reviewed: false, confirmed: false,
  })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')

  // Until someone picks them, the working location and the person recording the lead are the defaults.
  const branchId = values.branchId || context.branchId || context.branches[0]?.id || ''
  const choices = ownerOptions(owners, branchId)
  const ownerId = choices.some((option) => option.value === values.ownerId) ? values.ownerId : choices.find((option) => option.value === organisation?.membershipId)?.value ?? choices[0]?.value ?? ''
  const form = { ...values, branchId, ownerId }

  const digits = digitsOf(values.phone).slice(-10)
  const checkMobile = digits.length === 10 && digits !== lead?.mobile
  const matches = useApiResource(() => (checkMobile ? leadsApi.duplicates(digits, lead?.id) : Promise.resolve([])), checkMobile ? digits : '')
  const duplicates = checkMobile ? matches.data ?? [] : []
  const errors = attempted ? { ...validateLead(form), ...serverErrors } : {}
  const branchName = (id) => context.branches.find((branch) => branch.id === id)?.name ?? lead?.branch ?? '—'
  const ownerName = (id) => choices.find((option) => option.value === id)?.label ?? lead?.owner ?? '—'
  const consequential = lead && (values.stage !== lead.stage || ownerId !== lead.ownerId || branchId !== lead.branchId)
  const backPath = lead ? pathFor(ROUTES.lead, { leadId: lead.id }) : `${ROUTES.leads}${state?.search ?? ''}`
  const set = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setServerErrors((current) => ({ ...current, [FORM_FIELDS[name] ?? name]: undefined }))
  }
  const blocked = (duplicates.length > 0 && !values.reviewed) || (consequential && !values.confirmed)
  const stages = Object.values(STAGES).filter((stage) => (lead?.stage === STAGES.converted ? stage === STAGES.converted : stage !== STAGES.converted && (lead || stage !== STAGES.closed)))

  const save = async () => {
    setAttempted(true)
    setFormError('')
    if (Object.keys(validateLead(form)).length || blocked) return
    setSaving(true)
    const body = { ...leadPayload({ ...form, reviewed: values.reviewed && duplicates.length > 0 }), stage: stageId(values.stage) }
    try {
      const saved = lead
        ? await leadsApi.update(lead.id, { ...body, version: lead.version })
        : await leadsApi.create({ ...body, source: sourceId(values.source), nextAction: values.nextAction.trim(), nextDueDate: values.nextDate || undefined })
      navigate(pathFor(ROUTES.lead, { leadId: saved.id }), { state })
    } catch (error) {
      setSaving(false)
      if (error.code === 'POSSIBLE_DUPLICATE') matches.reload()
      if (error.code === 'VALIDATION_FAILED') setServerErrors(Object.fromEntries(Object.entries(error.fieldErrors()).map(([field, message]) => [FORM_FIELDS[field] ?? field, message])))
      setFormError(error.code === 'VALIDATION_FAILED' ? 'Some fields need attention.' : error.message)
    }
  }

  return (
    <GrowthFrame back={{ to: backPath, label: lead ? 'Back to Lead Details' : 'Back to Lead Register' }} crumb={`Owner Panel / Growth OS / Leads / ${lead ? `${lead.name} / Edit` : 'New lead'}`} title="Create/Edit Lead" description={lead ? `Update ${lead.name}’s lead record without changing its original source or shared patient details.` : 'Record a new inquiry. A lead is not a patient or an appointment.'} badge={lead ? <span className="text-xs text-outline">{lead.number} · Existing record</span> : null} context={[context.line, lead ? `Lead branch: ${lead.branch}.` : 'New lead · The lead number is assigned on save']} today={context.today} sample={LIVE_NOTE}>
      {formError && <Banner tone="danger" title="Not saved" className="mb-6">{formError}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Section title="Lead information" aside="* Required">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} />
            <TextInput label="Phone" required inputMode="numeric" value={values.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} hint="10-digit mobile · identity not verified" />
            <TextInput label="Email" type="email" value={values.email} onChange={(event) => set('email', event.target.value)} error={errors.email} hint="Optional" />
            <TextInput label="Interest" value={values.interest} onChange={(event) => set('interest', event.target.value)} error={errors.interest} hint="Optional · what they asked about, without health detail" />
            <SelectInput label="Branch" required value={branchId} onChange={(event) => set('branchId', event.target.value)} options={context.branches.map((branch) => ({ value: branch.id, label: branch.name }))} error={errors.branch} hint="Lead branch, from the locations your role covers" />
            <SelectInput label="Owner" required value={ownerId} onChange={(event) => set('ownerId', event.target.value)} options={choices} error={errors.owner} hint={choices.length ? 'Team members who can work leads at this branch' : 'No one with lead access covers this branch'} />
            <OptionSelect label="Campaign" value={values.campaignId} onChange={(event) => set('campaignId', event.target.value)} disabled={Boolean(lead?.campaign)} placeholder="No campaign" options={[...campaigns, ...(lead?.campaign && !campaigns.some((entry) => entry.id === lead.campaign.id) ? [lead.campaign] : [])].map((campaign) => ({ value: campaign.id, label: `${campaign.code} · ${campaign.name}` }))} hint={lead?.campaign ? 'Part of the original source · cannot be changed' : 'The campaign the enquiry came from, if any · cannot be changed later'} />
            {!lead && <SelectInput label="Source" value={values.source} onChange={(event) => set('source', event.target.value)} options={Object.values(SOURCES)} />}
            <SelectInput label="Stage" value={values.stage} onChange={(event) => set('stage', event.target.value)} options={stages} hint={lead ? 'Converted is reached only through Convert Lead' : 'New inquiries usually start as New'} />
            {lead ? <TextInput label="Next follow-up · IST" value={lead.due ? when(lead.due) : 'None set'} readOnly disabled hint="Managed in Lead Follow-up" /> : <><TextInput label="Next action" value={values.nextAction} onChange={(event) => set('nextAction', event.target.value)} error={errors.nextAction} hint="Needed when a follow-up date is set" /><TextInput label="Next follow-up date" type="date" min={clinicNow().date} value={values.nextDate} onChange={(event) => set('nextDate', event.target.value)} error={errors.nextDate} hint="Optional · due at 10:00 IST" /></>}
          </div>
          {consequential && <Banner tone="brand" title="Consequential changes require a separate review" className="mt-5">{[values.stage !== lead.stage && `Stage ${lead.stage} → ${values.stage}`, ownerId !== lead.ownerId && `Owner ${lead.owner} → ${ownerName(ownerId)}`, branchId !== lead.branchId && `Branch ${lead.branch} → ${branchName(branchId)}`].filter(Boolean).join(' · ')}. Confirm before saving; this does not alter patient data{values.stage === STAGES.closed && lead.due ? ' and it closes the open follow-up' : ''}.</Banner>}
        </Section>

        <div className="space-y-6">
          <Section title="Validation & duplicate review">
            {duplicates.length > 0 ? <Banner tone="warning" title="Possible duplicate · Review required">{duplicates.map((entry) => `${entry.fullName} (${entry.number})`).join(', ')} uses the same mobile number. Do not silently merge or create a second shared record.</Banner> : <Banner tone="brand" title="No matching lead found">Matching values alone do not verify identity. Review shared patient and lead records before linking.</Banner>}
            <div className="mt-4 space-y-3">
              <Check checked={values.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label={`Duplicate review completed${duplicates.length ? ' (required)' : ''}`} />
              {consequential && <Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="Confirm consequential changes (stage, owner or branch)" />}
            </div>
          </Section>
          {lead && <Section title="Record continuity"><p className="text-xs leading-5 text-on-surface-variant">Created {when(lead.created)}. Last activity {when(lead.lastActivity)}. Saving adds an entry to the activity history; the original source stays as recorded.</p>{lead.due && <Banner tone="warning" title="Open follow-up remains" className="mt-3">Editing a lead is not rescheduling. Use Follow-up for an explicit completion or reschedule.</Banner>}</Section>}
        </div>
      </div>

      {lead && <Section title="Original source" aside="Read only · Kept through edits and conversion" className="mb-6"><dl className="grid gap-4 text-xs sm:grid-cols-3"><KeyValue label="Source">{lead.source}</KeyValue><KeyValue label="Campaign">{lead.campaign ? `${lead.campaign.code} · ${lead.campaign.name}` : 'No campaign'}</KeyValue><KeyValue label="Recorded">{when(lead.created)}</KeyValue></dl></Section>}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Ready for review, not ready to save' : 'Ready to save'}</strong>{blocked ? 'Save is blocked until duplicate review and any consequential-change confirmation pass.' : 'Required fields are checked again when you save.'}</p>
        <ActionButton onClick={() => navigate(backPath)}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked || saving} onClick={save}>{saving ? 'Saving…' : lead ? 'Save changes' : 'Create lead'}</ActionButton>
      </div>
      <GrowthFooter back={{ to: backPath, label: lead ? 'Back to Lead Details' : 'Back to Lead Register' }} />
    </GrowthFrame>
  )
}
