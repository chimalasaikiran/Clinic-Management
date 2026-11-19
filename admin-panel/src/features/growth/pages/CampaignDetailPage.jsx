import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check, OptionSelect } from '../../patients/components/parts'
import { formatINR, localToday } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { BROADCAST_CHANNELS, BROADCAST_STATUSES, BROADCAST_TONE, CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, CAMPAIGN_TONE, MESSAGE_STATUSES, percent } from '../campaignsView'
import { day, when } from '../format'
import { templateVariables } from '../growthLogic'
import { SOURCES, STAGES, stampOf } from '../leadsView'
import { messagingApi } from '../messagingApi'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

const AUTOMATIC = ['preferred_name', 'clinic_name']

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const { state } = useLocation()
  const { can } = useAuth()
  const context = useLeadContext()
  const resource = useApiResource(() => campaignsApi.campaign(campaignId), `campaign:${campaignId}`)
  const campaign = resource.data
  const registerPath = `${ROUTES.campaigns}${state?.search ?? ''}`
  const frame = { back: { to: registerPath, label: 'Back to Campaign Register · GO07' }, code: 'GO 08', context: [context.line, 'Return retains the register filters'], today: context.today, sample: 'Live records · Spend is entered by hand · Leads count when recorded against this campaign' }

  if (resource.error?.status === 404) {
    return (
      <GrowthFrame {...frame} crumb="Owner Panel / Growth OS / Campaigns" title="Campaign not found">
        <Banner tone="warning" title="No campaign matches this link">Open the Campaign Register to find the plan.</Banner>
      </GrowthFrame>
    )
  }
  if (!campaign) {
    return (
      <GrowthFrame {...frame} crumb="Owner Panel / Growth OS / Campaigns" title="Campaign Details & Performance">
        <LoadingState label="Loading the campaign…" error={resource.error} onRetry={resource.reload} />
      </GrowthFrame>
    )
  }

  const manage = can('growth.manage')
  const here = { search: state?.search }
  const { attribution } = campaign
  const funnel = [['Leads recorded', attribution.leads, null], ['Converted to patients', attribution.converted, attribution.leads], ['Booked after converting', attribution.booked, attribution.converted], ['Completed a visit', attribution.consulted, attribution.booked]]

  return (
    <GrowthFrame {...frame} crumb={`Owner Panel / Growth OS / Campaigns / ${campaign.code}`} title="Campaign Details & Performance" description={`${campaign.code} · ${campaign.name} · ${CAMPAIGN_STATUSES[campaign.status]} · ${attribution.leads} lead${attribution.leads === 1 ? '' : 's'} recorded`} actions={<>{manage && <ActionButton variant="brand" to={pathFor(ROUTES.campaignEdit, { campaignId })} state={here}>Edit Campaign · GO09</ActionButton>}<ActionButton to={ROUTES.audiences}>Manage audience · GO10</ActionButton></>}>
      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Overview" aside={campaign.code}>
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">{campaign.name}<StatusPill tone={CAMPAIGN_TONE[campaign.status]}>{CAMPAIGN_STATUSES[campaign.status]}</StatusPill></p>
          <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2"><KeyValue label="Objective" className="sm:col-span-2">{campaign.objective}</KeyValue><KeyValue label="Campaign branch">{campaign.branch.name}</KeyValue><KeyValue label="Owner">{campaign.owner.name}</KeyValue><KeyValue label="Dates · IST">{day(campaign.startDate)} – {day(campaign.endDate)}</KeyValue><KeyValue label="Channel">{CAMPAIGN_CHANNELS[campaign.channel]}</KeyValue><KeyValue label="Call to action">{campaign.cta}</KeyValue><KeyValue label="Landing page"><span className="break-all">{campaign.landingUrl}</span></KeyValue></dl>
        </Section>
        <Section title="Budget vs spend" aside="INR">
          <p className="text-xs text-on-surface-variant">Planned budget</p><p className="mt-1 text-[32px] font-semibold">{formatINR(campaign.budget)}</p>
          <p className="mt-4 text-xs text-on-surface-variant">Spent so far · entered by the team</p><p className="mt-1 text-[17px] font-semibold">{formatINR(campaign.spent)} <span className="text-xs font-normal text-outline">({percent(campaign.spent, campaign.budget)} of budget)</span></p>
          <p className="mt-2 text-[11px] text-outline">{attribution.leads && campaign.spent ? `${formatINR(Math.round(campaign.spent / attribution.leads))} per recorded lead` : 'Cost per lead appears once spend and leads are recorded.'}</p>
          {manage && <SpendForm campaignId={campaignId} onSaved={resource.reload} />}
          {campaign.spendEntries.length > 0 && <ul className="mt-4 divide-y divide-slate-100 text-xs">{campaign.spendEntries.map((entry) => <li key={entry.id} className="flex justify-between gap-3 py-2"><span>{day(entry.spentOn)} · {entry.note}<br /><span className="text-outline">{entry.recordedBy}</span></span><strong>{formatINR(entry.amount)}</strong></li>)}</ul>}
        </Section>
      </div>

      <h2 className="mb-3 flex items-baseline justify-between text-[17px] font-semibold">Performance <span className="text-xs font-normal text-outline">From leads recorded against this campaign</span></h2>
      <dl className="mb-2 grid gap-4 sm:grid-cols-3">{[['Leads recorded', String(attribution.leads), 'Recorded with this campaign as their source'], ['Converted', String(attribution.converted), `${percent(attribution.converted, attribution.leads)} of recorded leads`], ['Revenue billed', attribution.revenue === null ? 'Restricted' : formatINR(attribution.revenue), attribution.revenue === null ? 'Needs the revenue permission' : 'Invoices to converted patients since converting']].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd><p className="mt-1 text-[11px] text-outline">{hint}</p></div>)}</dl>
      <p className="mb-6 text-[11px] text-outline">Reach and clicks from ad platforms are not connected. Leads count only when staff record them against the campaign.</p>

      <Section title="Attribution funnel" aside="Counted from records" className="mb-6">
        <ol className="grid gap-3 sm:grid-cols-4">{funnel.map(([stage, count, of]) => <li key={stage} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs"><p className="font-semibold">{stage}</p><p className="mt-1 text-[17px] font-semibold">{count}</p><p className="mt-1 text-outline">{of === null ? 'Starting point' : `${percent(count, of)} of the step before`}</p></li>)}</ol>
        <Link to={pathFor(ROUTES.campaignAttribution, { campaignId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Trace attribution in detail →</Link>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Audience" aside={campaign.audience ? `${campaign.audience.code} · ${campaign.audience.status}` : undefined}>
          {campaign.audience ? <Link to={ROUTES.audiences} className="text-[13px] font-semibold text-brand hover:underline">{campaign.audience.name} ↗</Link> : <p className="text-xs text-outline">No audience chosen for this campaign.</p>}
          <p className="mt-2 text-xs leading-5 text-on-surface-variant">{campaign.audience ? 'Its size and reach per channel are counted live in Audience Management.' : 'Choose one on the campaign to send a broadcast.'}</p>
        </Section>
        <Section title="Recorded leads" aside={`${attribution.leads} total`}>
          {attribution.recent.length ? <ul className="divide-y divide-slate-100 text-xs">{attribution.recent.slice(0, 8).map((lead) => <li key={lead.id} className="flex justify-between gap-3 py-2"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.number} · {lead.fullName}</Link><span className="text-outline">{SOURCES[lead.source]} · {STAGES[lead.stage]} · {day(stampOf(lead.createdAt).date)}</span></li>)}</ul> : <p className="text-xs text-outline">No lead has been recorded against this campaign yet. Choose it as the campaign when adding a lead.</p>}
        </Section>
      </div>

      {BROADCAST_CHANNELS.includes(campaign.channel) && <Broadcasts campaign={campaign} manage={manage} onChange={resource.reload} />}

      <Section title="History" aside="Append only" className="mb-6">
        <ul className="divide-y divide-slate-100 text-xs">{campaign.events.map((event) => <li key={event.id} className="grid gap-2 py-3 sm:grid-cols-[180px_1fr]"><span><strong>{when(stampOf(event.createdAt))}</strong><br /><span className="text-outline">{event.actor ?? 'ClinicOS'}</span></span><span>{event.text}</span></li>)}</ul>
      </Section>
      <GrowthFooter code="GO 08" back={{ to: registerPath, label: 'Back to Campaign Register · Origin context retained' }} />
    </GrowthFrame>
  )
}

function SpendForm({ campaignId, onSaved }) {
  const [values, setValues] = useState({ spentOn: localToday(), amount: '', note: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await campaignsApi.addSpend(campaignId, { spentOn: values.spentOn, amount: Number(values.amount), note: values.note.trim() })
      setValues((current) => ({ ...current, amount: '', note: '' }))
      onSaved()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="mt-4 rounded-md bg-surface-low p-3">
      <p className="mb-2 text-xs font-semibold">Record spend</p>
      <div className="grid gap-3 sm:grid-cols-2"><TextInput label="Date" type="date" value={values.spentOn} onChange={(event) => set('spentOn', event.target.value)} /><TextInput label="Amount · INR" inputMode="decimal" prefix="₹" value={values.amount} onChange={(event) => set('amount', event.target.value.replace(/[^\d.-]/g, ''))} hint="Negative to correct an entry" /></div>
      <div className="mt-3"><TextInput label="Source of the figure" value={values.note} onChange={(event) => set('note', event.target.value)} hint="For example: Meta invoice 1182" /></div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
      <ActionButton className="mt-3" disabled={saving || !values.amount || Number(values.amount) === 0 || !values.note.trim()} onClick={save}>{saving ? 'Saving…' : 'Add spend'}</ActionButton>
    </div>
  )
}

function Broadcasts({ campaign, manage, onChange }) {
  const [message, setMessage] = useState(null)
  const cancel = async (broadcast) => {
    setMessage(null)
    try {
      await campaignsApi.cancelBroadcast(campaign.id, broadcast.id)
      setMessage({ tone: 'brand', text: 'Broadcast cancelled. Messages already queued are still sent.' })
      onChange()
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message })
    }
  }
  return (
    <Section title="Broadcasts" aside={`${CHANNELS[campaign.channel]} · ${campaign.broadcasts.length} sent or scheduled`} className="mb-6">
      {message && <Banner tone={message.tone} title={message.text} className="mb-4" />}
      {campaign.broadcasts.length > 0 && (
        <div className="-mx-6 mb-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Template / audience', 'Status', 'People', 'Messages', 'Skipped', ''].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{campaign.broadcasts.map((broadcast) => <tr key={broadcast.id} className="border-t border-slate-100 align-top">
            <td className="px-6 py-3"><strong>{broadcast.template.code} · {broadcast.template.name}</strong> v{broadcast.templateVersion}<br /><span className="text-outline">{broadcast.audience.code} · {broadcast.audience.name} · by {broadcast.createdBy}</span></td>
            <td className="px-6 py-3"><StatusPill tone={BROADCAST_TONE[broadcast.status]}>{BROADCAST_STATUSES[broadcast.status]}</StatusPill><br /><span className="text-outline">{broadcast.status === 'scheduled' ? `From ${when(stampOf(broadcast.scheduledAt))}` : broadcast.completedAt ? when(stampOf(broadcast.completedAt)) : ''}</span></td>
            <td className="px-6 py-3">{broadcast.status === 'completed' ? `${broadcast.queuedCount} queued` : `${broadcast.expectedRecipients} confirmed`}</td>
            <td className="px-6 py-3">{Object.entries(broadcast.messages).map(([status, count]) => <span key={status} className="block">{MESSAGE_STATUSES[status] ?? status}: {count}</span>)}{!Object.keys(broadcast.messages).length && <span className="text-outline">None yet</span>}</td>
            <td className="px-6 py-3">{broadcast.skipped.map((entry) => <span key={entry.reason} className="block">{entry.label}: {entry.count}</span>)}{!broadcast.skipped.length && <span className="text-outline">None</span>}</td>
            <td className="px-6 py-3">{manage && ['scheduled', 'sending'].includes(broadcast.status) && <ActionButton onClick={() => cancel(broadcast)}>Cancel</ActionButton>}</td>
          </tr>)}</tbody></table></div>
      )}
      {manage ? <BroadcastComposer campaign={campaign} onSent={(text) => { setMessage({ tone: 'brand', text }); onChange() }} /> : <p className="text-xs text-outline">Sending broadcasts needs “Run campaigns & patient messaging”.</p>}
    </Section>
  )
}

function BroadcastComposer({ campaign, onSent }) {
  const templates = useApiResource(() => messagingApi.templates(), 'templates').data ?? []
  const usable = templates.filter((template) => template.channel === campaign.channel && template.status === 'approved')
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState({})
  const [preview, setPreview] = useState(null)
  const [sendAt, setSendAt] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const template = usable.find((entry) => entry.id === templateId)
  const needed = template ? templateVariables(template.body).filter((name) => !AUTOMATIC.includes(name)) : []
  const running = campaign.status === 'scheduled' || campaign.status === 'active'
  const reset = () => { setPreview(null); setConfirmed(false) }

  const check = async () => {
    setBusy(true)
    setError(null)
    try {
      setPreview(await campaignsApi.previewBroadcast(campaign.id, { templateId, variables }))
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await campaignsApi.launchBroadcast(campaign.id, { templateId, variables, expectedRecipients: preview.reachable, sendAt: sendAt ? `${sendAt}:00+05:30` : null, confirm: true })
      setTemplateId('')
      setVariables({})
      reset()
      onSent(`Broadcast confirmed for ${preview.reachable} ${preview.reachable === 1 ? 'person' : 'people'}. It starts ${sendAt ? 'at the chosen time' : 'within a minute'} (never between 9 pm and 9 am).`)
    } catch (failure) {
      setError(failure.message)
      if (failure.code === 'AUDIENCE_CHANGED') reset()
    } finally {
      setBusy(false)
    }
  }

  if (!campaign.audience) return <p className="text-xs text-outline">Choose an audience on the campaign before sending a broadcast.</p>
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="mb-3 text-[13px] font-semibold">New broadcast</p>
      {!running && <Banner tone="warning" title="Set the campaign to Scheduled or Active to send" className="mb-3" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionSelect label="Approved template" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setVariables({}); reset() }} placeholder={usable.length ? 'Choose a template' : `No approved ${CHANNELS[campaign.channel]} template`} options={usable.map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` }))} />
        {needed.map((name) => <TextInput key={name} label={name.replace(/_/g, ' ')} value={variables[name] ?? ''} onChange={(event) => { setVariables((current) => ({ ...current, [name]: event.target.value })); reset() }} hint="The same for everyone" />)}
      </div>
      <ActionButton className="mt-4" disabled={!template || busy || needed.some((name) => !variables[name]?.trim())} onClick={check}>{busy && !preview ? 'Checking…' : 'Check who it reaches'}</ActionButton>
      {error && <Banner tone="danger" title={error} className="mt-4" />}
      {preview && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="text-xs">
            <p className="text-[17px] font-semibold text-brand">{preview.reachable} of {preview.members} will receive it</p>
            <ul className="mt-2 space-y-1">{preview.skipped.map((entry) => <li key={entry.reason}>{entry.label}: {entry.count}</li>)}{preview.noAddress > 0 && <li>No {campaign.channel === 'email' ? 'email address' : 'mobile number'}: {preview.noAddress}</li>}</ul>
            {!preview.channelConnected && <Banner tone="danger" title={`${CHANNELS[campaign.channel]} is not connected`} className="mt-3">An administrator can connect it on the Channels screen.</Banner>}
            {preview.quietHoursNow && <p className="mt-2 text-amber-700">It is quiet hours now: sending starts at 9 am.</p>}
          </div>
          <div>
            <p className="rounded-md bg-teal-50 p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-brand">Example message</strong>{preview.sample}</p>
            <div className="mt-3"><TextInput label="Send from · IST" type="datetime-local" value={sendAt} onChange={(event) => setSendAt(event.target.value)} hint="Empty to send now" /></div>
            <div className="mt-3"><Check checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} label={`I confirm sending ${preview.template.code} to ${preview.reachable} ${preview.reachable === 1 ? 'person' : 'people'} in ${preview.audience.code}.`} /></div>
            <ActionButton variant="brand" className="mt-3" disabled={!confirmed || busy || !preview.reachable || !preview.channelConnected || !running} onClick={send}>{busy ? 'Sending…' : 'Send broadcast'}</ActionButton>
          </div>
        </div>
      )}
    </div>
  )
}
