import { Link, useParams } from 'react-router-dom'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import LoadingState from '../../patients/components/LoadingState'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, CAMPAIGN_TONE, percent } from '../campaignsView'
import { day, when } from '../format'
import { SOURCES, STAGES, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

export default function CampaignAttributionPage() {
  const { campaignId } = useParams()
  const context = useLeadContext()
  const resource = useApiResource(() => campaignsApi.campaign(campaignId), `campaign:${campaignId}`)
  const campaign = resource.data
  const frame = { back: { to: ROUTES.growthPerformance, label: 'Growth performance' }, crumb: 'Owner Panel / Growth OS / Campaign Attribution', context: [context.line, 'Leads recorded against the campaign, followed through conversion, booking, visit and billing'], today: context.today, sample: 'Live records · Only leads recorded against this campaign are credited to it' }

  if (resource.error?.status === 404) {
    return (
      <GrowthFrame {...frame} title="Campaign not found">
        <Banner tone="warning" title="No campaign matches this link">Open Growth performance to choose a campaign.</Banner>
      </GrowthFrame>
    )
  }
  if (!campaign) {
    return (
      <GrowthFrame {...frame} title="Campaign Attribution Details">
        <LoadingState label="Loading attribution…" error={resource.error} onRetry={resource.reload} />
      </GrowthFrame>
    )
  }

  const { attribution } = campaign
  const stages = [
    ['Campaign', campaign.code, `${day(campaign.startDate)} – ${day(campaign.endDate)}`],
    ['Lead', `${attribution.leads} recorded`, 'Recorded with this campaign as their source'],
    ['Patient', `${attribution.converted} converted`, `${percent(attribution.converted, attribution.leads)} of leads`],
    ['Appointment', `${attribution.booked} booked`, 'On or after converting, not cancelled'],
    ['Revenue', attribution.revenue === null ? 'Restricted' : formatINR(attribution.revenue), attribution.revenue === null ? 'Needs the revenue permission' : `${attribution.consulted} completed a visit`],
  ]

  return (
    <GrowthFrame {...frame} title="Campaign Attribution Details" description={`Trace ${campaign.code} from the leads recorded against it to patients, appointments and billed revenue.`}>
      <Section title={campaign.name} aside={campaign.code} className="mb-6">
        <p className="mb-4 flex flex-wrap gap-2"><StatusPill tone={CAMPAIGN_TONE[campaign.status]}>{CAMPAIGN_STATUSES[campaign.status]}</StatusPill><StatusPill>{CAMPAIGN_CHANNELS[campaign.channel]}</StatusPill></p>
        <dl className="grid gap-4 text-xs sm:grid-cols-3"><KeyValue label="Branch / owner">{campaign.branch.name} · {campaign.owner.name}</KeyValue><KeyValue label="Budget · spent">{formatINR(campaign.budget)} · {formatINR(campaign.spent)}</KeyValue><KeyValue label="Cost per converted patient">{attribution.converted && campaign.spent ? formatINR(Math.round(campaign.spent / attribution.converted)) : '—'}</KeyValue></dl>
        <Link to={pathFor(ROUTES.campaign, { campaignId })} className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">Campaign details →</Link>
      </Section>

      <Section title="Campaign → lead → patient → appointment → revenue" aside="Counted from records" className="mb-6">
        <ol className="grid gap-3 sm:grid-cols-5">{stages.map(([stage, value, note]) => <li key={stage} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs"><p className="font-semibold">{stage} →</p><p className="mt-1 text-[13px] font-semibold">{value}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
        <Banner className="mt-4" title="How credit is given">A lead is credited to this campaign only when staff record it against the campaign. Its later appointments count from the day it converted; revenue counts invoices to that patient from the same day.</Banner>
      </Section>

      <Section title="Recorded leads" aside={`${attribution.leads} lead${attribution.leads === 1 ? '' : 's'}`} className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead', 'Recorded · IST', 'Source', 'Stage', 'Converted'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {attribution.recent.map((lead) => <tr key={lead.id} className="border-t border-slate-100 align-top"><td className="px-6 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.number} · {lead.fullName}</Link></td><td className="px-6 py-4">{when(stampOf(lead.createdAt))}</td><td className="px-6 py-4">{SOURCES[lead.source]}</td><td className="px-6 py-4">{STAGES[lead.stage]}</td><td className="px-6 py-4">{lead.convertedAt ? when(stampOf(lead.convertedAt)) : '—'}</td></tr>)}
            {attribution.recent.length === 0 && <tr className="border-t border-slate-100"><td colSpan={5} className="px-6 py-6 text-center text-outline">No lead is recorded against this campaign.</td></tr>}
          </tbody></table></div>
        {attribution.leads > attribution.recent.length && <p className="mt-3 text-[11px] text-outline">Showing the latest {attribution.recent.length} of {attribution.leads}.</p>}
      </Section>
      <GrowthFooter back={{ to: ROUTES.growthPerformance, label: 'Growth performance' }} />
    </GrowthFrame>
  )
}
