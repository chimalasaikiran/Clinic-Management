import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import LoadingState from '../../patients/components/LoadingState'
import { Check, OptionSelect } from '../../patients/components/parts'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { BROADCAST_CHANNELS, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '../campaignsView'
import { useLeadContext } from '../useLeads'

const validate = (values) => {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter a campaign name.'
  if (!values.objective.trim()) errors.objective = 'Enter the objective.'
  if (!(Number(values.budget) > 0)) errors.budget = 'Enter a positive planned budget.'
  if (!values.startDate) errors.startDate = 'Choose a start date.'
  if (!values.endDate) errors.endDate = 'Choose an end date.'
  else if (values.startDate && values.endDate < values.startDate) errors.endDate = 'The end date must not be before the start date.'
  if (!values.cta.trim()) errors.cta = 'Enter the call to action.'
  if (!/^https:\/\/\S+\.\S+$/.test(values.landingUrl.trim())) errors.landingUrl = 'Enter an https:// landing page URL.'
  if (!values.ownerMembershipId) errors.ownerMembershipId = 'Choose an owner.'
  if (!values.branchId) errors.branchId = 'Choose a branch.'
  return errors
}

export default function CampaignFormPage() {
  const { campaignId } = useParams()
  const campaign = useApiResource(() => (campaignId ? campaignsApi.campaign(campaignId) : Promise.resolve(null)), `campaign-form:${campaignId ?? 'new'}`)
  if (campaignId && campaign.error?.status === 404) {
    return (
      <GrowthFrame back={{ to: ROUTES.campaigns, label: 'Back to Campaign Register' }} crumb="Owner Panel / Growth OS / Campaigns" title="Campaign not found" sample="Live records">
        <Banner tone="warning" title="No campaign matches this link">Open the Campaign Register to find the plan.</Banner>
      </GrowthFrame>
    )
  }
  if (campaignId && !campaign.data) {
    return (
      <GrowthFrame back={{ to: ROUTES.campaigns, label: 'Back to Campaign Register' }} crumb="Owner Panel / Growth OS / Campaigns" title="Create/Edit Campaign" sample="Live records">
        <LoadingState label="Loading the campaign…" error={campaign.error} onRetry={campaign.reload} />
      </GrowthFrame>
    )
  }
  return <CampaignForm key={campaignId ?? 'new'} campaign={campaign.data} />
}

function CampaignForm({ campaign }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const context = useLeadContext()
  const owners = useApiResource(() => campaignsApi.owners(), 'campaign-owners').data ?? []
  const audiences = useApiResource(() => campaignsApi.audiences({ pageSize: 100 }), 'campaign-audiences').data?.data ?? []
  const [values, setValues] = useState({
    name: campaign?.name ?? '', objective: campaign?.objective ?? '', audienceId: campaign?.audience?.id ?? '', channel: campaign?.channel ?? 'whatsapp', ownerMembershipId: campaign?.owner.membershipId ?? '', branchId: campaign?.branch.id ?? (context.branchId || context.branches[0]?.id || ''),
    budget: campaign ? String(campaign.budget) : '', startDate: campaign?.startDate ?? '', endDate: campaign?.endDate ?? '', status: campaign?.status ?? 'draft', cta: campaign?.cta ?? '', landingUrl: campaign?.landingUrl ?? '', reason: '', confirmed: false,
  })
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const errors = { ...(attempted ? validate(values) : {}), ...serverErrors }
  const owner = values.ownerMembershipId || owners[0]?.membershipId || ''
  const budgetChange = campaign && Number(values.budget) > 0 && Number(values.budget) !== campaign.budget ? Number(values.budget) - campaign.budget : 0
  const statusChange = campaign && values.status !== campaign.status
  const needsConfirm = budgetChange !== 0 || statusChange
  const blocked = needsConfirm && (!values.confirmed || !values.reason.trim())
  const backPath = campaign ? pathFor(ROUTES.campaign, { campaignId: campaign.id }) : `${ROUTES.campaigns}${state?.search ?? ''}`
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }

  const save = async () => {
    setAttempted(true)
    const filled = { ...values, ownerMembershipId: owner }
    if (Object.keys(validate(filled)).length || blocked) return
    setSaving(true)
    setMessage(null)
    setServerErrors({})
    const body = {
      name: values.name.trim(), objective: values.objective.trim(), channel: values.channel, status: values.status, branchId: values.branchId, ownerMembershipId: owner, audienceId: values.audienceId || null,
      budget: Number(values.budget), startDate: values.startDate, endDate: values.endDate, cta: values.cta.trim(), landingUrl: values.landingUrl.trim(), changeNote: needsConfirm ? values.reason.trim() : null,
    }
    try {
      const saved = campaign ? await campaignsApi.updateCampaign(campaign.id, { ...body, version: campaign.version }) : await campaignsApi.createCampaign(body)
      navigate(pathFor(ROUTES.campaign, { campaignId: saved.id }), { state })
    } catch (error) {
      setServerErrors(error.fieldErrors?.() ?? {})
      setMessage(error.message)
      setSaving(false)
    }
  }

  return (
    <GrowthFrame back={{ to: backPath, label: campaign ? 'Back to Campaign Details' : 'Back to Campaign Register' }} crumb={`Owner Panel / Growth OS / Campaigns / ${campaign ? `${campaign.code} / Edit` : 'New'}`} title="Create/Edit Campaign" description={campaign ? `Edit ${campaign.code} · ${campaign.name}. Changes are kept in the campaign history; leads already recorded keep their campaign.` : 'Plan a new campaign. Saving sends nothing.'} context={[context.line, campaign ? `Campaign branch: ${campaign.branch.name}` : 'New campaign · the code is assigned on save']} today={context.today} sample="Live records · Every change is kept in the campaign history">
      {message && <Banner tone="danger" title="Not saved" className="mb-6">{message}</Banner>}
      {budgetChange !== 0 && <Banner tone="warning" title={`Unsaved budget change · ${formatINR(campaign.budget)} → ${formatINR(Number(values.budget))}`} className="mb-6">The saved plan stays {formatINR(campaign.budget)} until you confirm and save.</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Campaign information" aside={campaign ? `${campaign.code} · * Required` : '* Required'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Campaign name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <div className="sm:col-span-2"><TextInput label="Objective" required value={values.objective} onChange={(event) => set('objective', event.target.value)} error={errors.objective} hint="What enquiries you want. No medical outcome or performance claim." /></div>
              <div className="sm:col-span-2"><OptionSelect label="Audience" value={values.audienceId} onChange={(event) => set('audienceId', event.target.value)} placeholder="No audience selected" options={audiences.map((audience) => ({ value: audience.id, label: `${audience.name} · ${audience.code}` }))} error={errors.audienceId} hint="Needed only to send a broadcast. Preview the size in Audience Management." /></div>
              <SelectInput label="Channel" required value={values.channel} onChange={(event) => set('channel', event.target.value)} options={Object.entries(CAMPAIGN_CHANNELS).map(([value, label]) => ({ value, label }))} hint={BROADCAST_CHANNELS.includes(values.channel) ? 'Can send broadcasts through the connected channel' : 'Planning and lead recording only'} />
              <SelectInput label="Owner" required value={owner} onChange={(event) => set('ownerMembershipId', event.target.value)} options={owners.map((entry) => ({ value: entry.membershipId, label: entry.name }))} error={errors.ownerMembershipId} hint="Members who can run campaigns" />
              <SelectInput label="Campaign branch" required value={values.branchId} onChange={(event) => set('branchId', event.target.value)} options={context.branches.map((branch) => ({ value: branch.id, label: branch.name }))} error={errors.branchId} />
              <TextInput label="Planned budget · INR" required inputMode="decimal" prefix="₹" value={values.budget} onChange={(event) => set('budget', event.target.value.replace(/[^\d.]/g, ''))} error={errors.budget} hint="A budget is a plan; record actual spend on the campaign" />
              <TextInput label="Start · IST" required type="date" value={values.startDate} onChange={(event) => set('startDate', event.target.value)} error={errors.startDate} />
              <TextInput label="End · IST" required type="date" value={values.endDate} onChange={(event) => set('endDate', event.target.value)} error={errors.endDate} />
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Status *</legend><div className="mt-2 grid gap-2 sm:grid-cols-5">{Object.entries(CAMPAIGN_STATUSES).map(([status, label]) => <label key={status} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-md border py-2 text-xs font-medium', values.status === status ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="lifecycle" checked={values.status === status} onChange={() => set('status', status)} className="sr-only" />{label}</label>)}</div><p className="mt-2 text-[11px] text-outline">Broadcasts can be sent while a campaign is Scheduled or Active. Changing the status needs a reason.</p></fieldset>
          </Section>
          <Section title="Creative & destination" aside="For your team and ads">
            <div className="grid gap-4"><TextInput label="Call to action" required value={values.cta} onChange={(event) => set('cta', event.target.value)} error={errors.cta} /><TextInput label="Landing page" required value={values.landingUrl} onChange={(event) => set('landingUrl', event.target.value)} error={errors.landingUrl} hint="https:// address of the page the campaign points to" /></div>
          </Section>
          {campaign && campaign.leadCount > 0 && <Banner tone="brand" title="Recorded leads are kept">{campaign.leadCount} lead{campaign.leadCount === 1 ? ' is' : 's are'} recorded against this campaign. Editing the plan never changes them.</Banner>}
        </div>

        <div className="space-y-6">
          <Section title="Validation & readiness" aside="Save sends nothing">
            <p className="text-xs leading-5 text-on-surface-variant">{Object.keys(validate({ ...values, ownerMembershipId: owner })).length ? 'Required fields are still incomplete.' : 'Required fields are valid.'}</p>
            <p className="mt-3 text-[11px] text-outline">Broadcasts are sent from the campaign page after a confirmation that shows who will be reached.</p>
          </Section>
          {needsConfirm && <Section title="Confirm change · preview">
            {budgetChange !== 0 && <><p className="text-xs">Budget · saved → proposed</p><p className="text-[13px] font-semibold">{formatINR(campaign.budget)} → {formatINR(Number(values.budget))} ({budgetChange > 0 ? '+' : '−'}{formatINR(Math.abs(budgetChange))})</p></>}
            {statusChange && <><p className="mt-2 text-xs">Status · saved → proposed</p><p className="text-[13px] font-semibold">{CAMPAIGN_STATUSES[campaign.status]} → {CAMPAIGN_STATUSES[values.status]}</p></>}
            <div className="mt-3"><TextInput label="Change reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.changeNote} /></div>
            <div className="mt-3"><Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="I confirm this change. Save records the reason, who made it and when." /></div>
          </Section>}
          <Section title="Sending"><p className="text-xs leading-5 text-on-surface-variant">{BROADCAST_CHANNELS.includes(values.channel) ? 'Once saved with an audience, send a broadcast from the campaign page.' : 'This channel does not send messages from ClinicOS. Record leads against the campaign as they come in.'}</p><StatusPill tone={BROADCAST_CHANNELS.includes(values.channel) ? 'success' : 'neutral'} className="mt-3">{BROADCAST_CHANNELS.includes(values.channel) ? 'BROADCASTS AVAILABLE' : 'PLANNING ONLY'}</StatusPill></Section>
          {leaving && <Banner tone="warning" title="Discard unsaved changes?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Discard changes</ActionButton></div>}>Discard returns with the saved plan unchanged.</Banner>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Ready for review, not ready to save' : 'Ready to save'}</strong>{blocked ? 'A budget or status change needs a reason and confirmation.' : 'Saving updates the plan and its history.'}</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked || saving} onClick={save}>{saving ? 'Saving…' : 'Save campaign'}</ActionButton>
      </div>
      <GrowthFooter back={{ to: backPath, label: campaign ? 'Back to Campaign Details' : 'Back to Campaign Register' }} />
    </GrowthFrame>
  )
}
