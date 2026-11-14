import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check, OptionSelect } from '../../patients/components/parts'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, GROWTH_BRANCHES, GROWTH_TODAY, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { validateCampaign } from '../growthLogic'

export default function CampaignFormPage() {
  const { campaignId } = useParams()
  const { data } = useGrowth()
  const campaign = campaignId ? data.campaigns.find((entry) => entry.id === campaignId) : null
  if (campaignId && !campaign) {
    return (
      <GrowthFrame back={{ to: ROUTES.campaigns, label: 'Back to Campaign Register' }} crumb="Owner Panel / Growth OS / Campaigns" code="GO 09" title="Campaign not found">
        <Banner tone="warning" title="No campaign matches this link">Open the Campaign Register to find the plan.</Banner>
      </GrowthFrame>
    )
  }
  return <CampaignForm key={campaignId ?? 'new'} campaign={campaign} />
}

function CampaignForm({ campaign }) {
  const { data, add, update, newId } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [values, setValues] = useState({
    name: campaign?.name ?? '', objective: campaign?.objective ?? '', segmentId: campaign?.segmentId ?? '', channel: campaign?.channel ?? CAMPAIGN_CHANNELS[0], owner: campaign?.owner ?? OWNERS[0], branch: campaign?.branch ?? GROWTH_BRANCHES[0],
    budget: String(campaign?.budget ?? ''), start: campaign?.start ?? '', end: campaign?.end ?? '', status: campaign?.status ?? 'Draft', cta: campaign?.cta ?? '', landing: campaign?.landing ?? '', reason: '', confirmed: false, roleVerified: false,
  })
  const [attempted, setAttempted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const errors = attempted ? validateCampaign(values) : {}
  const budgetChange = campaign && Number(values.budget) !== campaign.budget && Number(values.budget) > 0 ? Number(values.budget) - campaign.budget : 0
  const needsConfirm = budgetChange !== 0
  const blocked = (needsConfirm && (!values.confirmed || !values.reason.trim())) || (campaign && !values.roleVerified)
  const backPath = campaign ? pathFor(ROUTES.campaign, { campaignId: campaign.id }) : `${ROUTES.campaigns}${state?.search ?? ''}`
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }

  const save = () => {
    setAttempted(true)
    if (Object.keys(validateCampaign(values)).length || blocked) return
    const fields = { name: values.name.trim(), objective: values.objective.trim(), segmentId: values.segmentId, channel: values.channel, owner: values.owner, branch: values.branch, budget: Number(values.budget), start: values.start, end: values.end, status: values.status, cta: values.cta.trim(), landing: values.landing.trim(), updated: GROWTH_TODAY }
    if (campaign) update('campaigns', campaign.id, fields)
    else add('campaigns', { id: newId('CMP', 'campaigns'), headline: fields.name, leadIds: [], ...fields })
    navigate(backPath, { state })
  }

  return (
    <GrowthFrame back={{ to: backPath, label: campaign ? 'Back to Campaign Details · GO08' : 'Back to Campaign Register' }} crumb={`Owner Panel / Growth OS / Campaigns / ${campaign ? `${campaign.id.replace('CMP', 'CMP ')} / Edit` : 'New'}`} code="GO 09" title="Create/Edit Campaign" description={campaign ? `Edit ${campaign.id.replace('CMP', 'CMP ')} · ${campaign.name}. Save an internal plan without publishing or rewriting historical attribution.` : 'Plan a new campaign. Saving creates an internal draft; nothing is published or sent.'} context={['Return to: Aura Health · All locations (3) · 01–22 Oct 2026', campaign ? `Campaign branch: ${campaign.branch}. Return retains the register scope, filters and position.` : 'New campaign · the ID is assigned on save']}>
      {needsConfirm && <Banner tone="warning" title={`Unsaved budget change · ${formatINR(campaign.budget)} → ${formatINR(Number(values.budget))}`} className="mb-6">The saved plan stays {formatINR(campaign.budget)} until you confirm and save.</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Campaign information" aside={campaign ? `${campaign.id.replace('CMP', 'CMP ')} · * Required` : '* Required'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Campaign name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <div className="sm:col-span-2"><TextInput label="Objective" required value={values.objective} onChange={(event) => set('objective', event.target.value)} error={errors.objective} hint="Inquiry interest only. No medical outcome or performance claim." /></div>
              <div className="sm:col-span-2"><OptionSelect label="Audience" value={values.segmentId} onChange={(event) => set('segmentId', event.target.value)} placeholder="No audience selected" options={data.segments.map((segment) => ({ value: segment.id, label: `${segment.name} · ${segment.id}` }))} hint="Consent eligibility is not verified. Select or preview in Audience Management." /></div>
              <SelectInput label="Channel · planned" required value={values.channel} onChange={(event) => set('channel', event.target.value)} options={CAMPAIGN_CHANNELS} hint="Integration dependent · connector not verified" />
              <SelectInput label="Owner" required value={values.owner} onChange={(event) => set('owner', event.target.value)} options={OWNERS} hint="Assignment subject to branch permissions" />
              <SelectInput label="Campaign branch" required value={values.branch} onChange={(event) => set('branch', event.target.value)} options={GROWTH_BRANCHES} hint="Not the all-location register scope" />
              <TextInput label="Planned budget · INR" required inputMode="decimal" prefix="₹" value={values.budget} onChange={(event) => set('budget', event.target.value.replace(/[^\d.]/g, ''))} error={errors.budget} hint="Positive amount · a budget is not spend" />
              <TextInput label="Proposed start · IST" required type="date" value={values.start} onChange={(event) => set('start', event.target.value)} error={errors.start} />
              <TextInput label="Proposed end · IST" required type="date" value={values.end} onChange={(event) => set('end', event.target.value)} error={errors.end} />
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Internal lifecycle *</legend><div className="mt-2 grid gap-2 sm:grid-cols-4">{CAMPAIGN_STATUSES.map((status) => <label key={status} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-md border py-2 text-xs font-medium', values.status === status ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="lifecycle" checked={values.status === status} onChange={() => set('status', status)} className="sr-only" />{status}</label>)}</div><p className="mt-2 text-[11px] text-outline">Internal states only. Scheduled ≠ externally scheduled; Active ≠ ad delivery. Status changes require confirmation and audit.</p></fieldset>
          </Section>
          <Section title="Creative & destination" aside="Draft only">
            <div className="grid gap-4"><TextInput label="Call to action" required value={values.cta} onChange={(event) => set('cta', event.target.value)} error={errors.cta} hint="Copy review required before any activation" /><TextInput label="Landing page" required value={values.landing} onChange={(event) => set('landing', event.target.value)} error={errors.landing} hint="HTTPS format only · domain, destination and connector unverified" /></div>
          </Section>
          {campaign && campaign.leadIds.length > 0 && <Banner tone="warning" title="Historical attribution · preserved separately">{campaign.leadIds.join(', ')} is tagged to this campaign before its proposed schedule. Schedule edits do not change lead records, shared patients or historical timestamps.</Banner>}
        </div>

        <div className="space-y-6">
          <Section title="Validation & readiness" aside="Save is a draft only">
            <p className="text-xs leading-5 text-on-surface-variant">{Object.keys(validateCampaign(values)).length ? 'Required fields are still incomplete.' : 'Required fields are valid. Format validation does not verify a live destination.'}</p>
            <div className="mt-3 space-y-3">{campaign && <Check checked={values.roleVerified} onChange={(event) => set('roleVerified', event.target.checked)} label={`Verify role & branch access for ${campaign.branch}`} />}</div>
            <p className="mt-3 text-[11px] text-outline">Clinical approval, connector verification and consent checks remain pending for activation.</p>
          </Section>
          {needsConfirm && <Section title="Confirm change · preview"><p className="text-xs">Budget · saved → proposed</p><p className="text-[13px] font-semibold">{formatINR(campaign.budget)} → {formatINR(Number(values.budget))} ({budgetChange > 0 ? '+' : '−'}{formatINR(Math.abs(budgetChange))})</p><div className="mt-3"><TextInput label="Change reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} /></div><div className="mt-3"><Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="I confirm the budget change. Save records the reason, actor and timestamp." /></div></Section>}
          <Section title="Integration dependent"><p className="text-xs leading-5 text-on-surface-variant">Schedule / Publish is disabled. No connector is verified, so saves are internal only and cannot publish ads or send messages.</p><StatusPill tone="warning" className="mt-3">INTEGRATION DEPENDENT</StatusPill></Section>
          {leaving && <Banner tone="warning" title="Discard unsaved changes?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Discard changes</ActionButton></div>}>Discard returns with the saved plan unchanged.</Banner>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Ready for review, not ready to save' : 'Ready to save'}</strong>{blocked ? 'Saving needs role verification and a confirmed budget change.' : 'Saving updates the internal plan only.'}</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked} onClick={save}>Save draft</ActionButton>
        <ActionButton disabled title="No connector is verified">Schedule / Publish</ActionButton>
      </div>
      <GrowthFooter code="GO 09" back={{ to: backPath, label: campaign ? 'Back to Campaign Details · GO08' : 'Back to Campaign Register' }} />
    </GrowthFrame>
  )
}
