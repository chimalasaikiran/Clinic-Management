import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const { state } = useLocation()
  const { data } = useGrowth()
  const campaign = data.campaigns.find((entry) => entry.id === campaignId)
  const registerPath = `${ROUTES.campaigns}${state?.search ?? ''}`

  if (!campaign) {
    return (
      <GrowthFrame back={{ to: registerPath, label: 'Back to Campaign Register' }} crumb="Owner Panel / Growth OS / Campaigns" code="GO 08" title="Campaign not found">
        <Banner tone="warning" title="No campaign matches this link">Open the Campaign Register to find the plan.</Banner>
      </GrowthFrame>
    )
  }

  const segment = data.segments.find((entry) => entry.id === campaign.segmentId)
  const leads = data.leads.filter((lead) => campaign.leadIds.includes(lead.id))
  const early = leads.find((lead) => lead.created.date < campaign.start)
  const here = { search: state?.search }
  const funnel = [['Campaign', `${campaign.id.replace('CMP', 'CMP ')} · ${campaign.status}`, `${day(campaign.start)} – ${day(campaign.end)} proposed; delivery unverified`, false], ['Lead', `${leads.length} historical tag${leads.length === 1 ? '' : 's'}`, leads[0] ? `${leads[0].id.replace('LD', 'LD')} · ${day(leads[0].created.date)} · Association unverified` : 'No linked lead', true], ['Appointment', 'Not attributed', 'No verified linkage', false], ['Consultation', 'Not attributed', 'No verified consultation linkage', false], ['Revenue', 'Not attributed', 'No verified revenue linkage', false]]

  return (
    <GrowthFrame back={{ to: registerPath, label: 'Back to Campaign Register · GO07' }} crumb={`Owner Panel / Growth OS / Campaigns / ${campaign.id.replace('CMP', 'CMP ')}`} code="GO 08" title="Campaign Details & Performance" description={`${campaign.id.replace('CMP', 'CMP ')} · ${campaign.name} · A ${campaign.status.toLowerCase()} plan with ${leads.length} historical, unverified lead association${leads.length === 1 ? '' : 's'}.`} actions={<><ActionButton variant="brand" to={pathFor(ROUTES.campaignEdit, { campaignId })} state={here}>Edit Campaign · GO09</ActionButton><ActionButton to={ROUTES.audiences}>Manage audience · GO10</ActionButton></>} context={['Return to: Aura Health · All locations (3) · 01–22 Oct 2026', `Campaign branch: ${campaign.branch}. Return retains the all-location scope, filters and position.`]}>
      {early && <Banner tone="warning" title="Historical tag predates proposed schedule · verification required" className="mb-6">{early.id} was tagged on {day(early.created.date)}; this plan proposes {day(campaign.start)} – {day(campaign.end)}. The association is not proof this campaign delivered or acquired the lead. Preserve the original tag and append verification evidence.</Banner>}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Overview" aside={`${campaign.id.replace('CMP', 'CMP ')} · Saved plan`}>
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">{campaign.name}<StatusPill>{campaign.status} · internal</StatusPill>{early && <StatusPill tone="warning">Attribution unverified</StatusPill>}</p>
          <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2"><KeyValue label="Objective" className="sm:col-span-2">{campaign.objective}</KeyValue><KeyValue label="Campaign branch">{campaign.branch}</KeyValue><KeyValue label="Owner">{campaign.owner}</KeyValue><KeyValue label="Proposed window · IST">{day(campaign.start)} – {day(campaign.end)}</KeyValue><KeyValue label="Planned channel" hint="Connector not verified">{campaign.channel}</KeyValue></dl>
          <p className="mt-4 text-[11px] text-outline">Internal {campaign.status} does not imply external delivery. No campaign integration is verified.</p>
        </Section>
        <Section title="Budget vs spend" aside="INR">
          <p className="text-xs text-on-surface-variant">Saved planned budget</p><p className="mt-1 text-[32px] font-semibold">{formatINR(campaign.budget)}</p><p className="text-[11px] text-outline">Plan reference only · No utilization or pacing calculated</p>
          <p className="mt-4 text-xs text-on-surface-variant">Actual spend</p><p className="mt-1 text-[13px] font-semibold">Unavailable · connector not verified</p><StatusPill tone="warning" className="mt-3">INTEGRATION DEPENDENT</StatusPill>
          <p className="mt-3 text-[11px] text-outline">No spend, cost per lead or return on ad spend can be inferred from a planned budget.</p>
        </Section>
      </div>

      <h2 className="mb-3 flex items-baseline justify-between text-[17px] font-semibold">Performance <span className="text-xs font-normal text-outline">Proposed {day(campaign.start)} – {day(campaign.end)}</span></h2>
      <dl className="mb-2 grid gap-4 sm:grid-cols-3">{[['Reach', 'Unavailable', 'Connector not verified'], ['Clicks', 'Unavailable', 'Connector not verified'], ['Verified attributed leads', 'Unavailable', 'Attribution unverified · Not a zero total'], ['Appointments', 'Not attributed', 'No verified linkage'], ['Consultations', 'Not attributed', 'No verified linkage'], ['Revenue', 'Not attributed', 'No verified linkage · No amount supplied']].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-xs">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd><p className="mt-1 text-[11px] text-outline">{hint}</p></div>)}</dl>
      <p className="mb-6 text-[11px] text-outline">Unavailable is not zero. A historical tag is a known association count, not a verified attributed lead or a campaign result.</p>

      <Section title="Attribution funnel" aside="Evidence states · No conversion rates" className="mb-6">
        <ol className="grid gap-3 sm:grid-cols-5">{funnel.map(([stage, name, note, flagged]) => <li key={stage} className={`rounded-md border p-3 text-xs ${flagged ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-surface-lowest'}`}><p className="font-semibold">{stage}</p><p className="mt-1">{name}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
        <Link to={pathFor(ROUTES.campaignAttribution, { campaignId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Trace attribution in detail →</Link>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Proposed audience" aside={segment ? `${segment.id.replace('SEG', 'SEG')} · Definition ${segment.status.toLowerCase()}` : undefined}>
          {segment ? <><Link to={ROUTES.audiences} className="text-[13px] font-semibold text-brand hover:underline">{segment.name} ↗</Link><p className="mt-2 text-xs leading-5 text-on-surface-variant">{segment.criteria}. {segment.branch}.</p><dl className="mt-4 grid gap-3 text-xs"><KeyValue label="Audience size">Not calculated · authorized query required</KeyValue><KeyValue label="Consent eligibility">Not verified · Unknown consent is not eligible</KeyValue></dl></> : <p className="text-xs text-outline">No audience selected for this plan.</p>}
          <ActionButton className="mt-4" to={ROUTES.audiences}>Manage audience · GO10</ActionButton>
        </Section>
        <Section title="Historical association" aside={<StatusPill tone="warning">UNVERIFIED</StatusPill>}>
          {leads.length ? leads.map((lead) => <div key={lead.id} className="text-xs"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="text-[13px] font-semibold text-brand hover:underline">{lead.id.replace('LD', 'LD')} · {lead.name} ↗</Link><dl className="mt-3 grid grid-cols-2 gap-3"><KeyValue label="Recorded association">{day(lead.created.date)}</KeyValue><KeyValue label="Source">{lead.source}</KeyValue></dl><p className="mt-3 text-on-surface-variant">Original campaign / channel: {lead.campaign} / {lead.channel}</p></div>) : <p className="text-xs text-outline">No historical lead association is recorded for this plan.</p>}
          <p className="mt-3 text-[11px] text-outline">Authorization required. Keep the original tag immutable.</p>
        </Section>
      </div>

      <Section title="History & verification record" aside="No live changes made" className="mb-6">
        <ul className="divide-y divide-slate-100 text-xs">
          {leads.map((lead) => <li key={lead.id} className="grid gap-2 py-4 sm:grid-cols-[160px_1fr]"><span><strong>{day(lead.created.date)}</strong><br /><span className="text-outline">Known sample tag</span></span><span><strong>Website inquiry recorded with “{campaign.name}”</strong><br /><span className="text-on-surface-variant">{lead.id} original association preserved; the exact tag actor and timestamp are not supplied; no verified attribution is implied.</span></span></li>)}
          <li className="grid gap-2 py-4 sm:grid-cols-[160px_1fr]"><span><strong>{day(campaign.start)} – {day(campaign.end)}</strong><br /><span className="text-outline">Proposed plan, not event</span></span><span><strong>Draft campaign schedule remains distinct from the historical tag.</strong><br /><span className="text-on-surface-variant">Authorized verification and future edits append actor, timestamp, reason, evidence and old → new values. The original source and campaign tag are never altered.</span></span></li>
        </ul>
      </Section>
      <GrowthFooter code="GO 08" back={{ to: registerPath, label: 'Back to Campaign Register · Origin context retained' }} />
    </GrowthFrame>
  )
}
