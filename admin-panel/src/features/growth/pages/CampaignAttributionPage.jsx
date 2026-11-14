import { Link, useParams } from 'react-router-dom'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day, when } from '../format'

export default function CampaignAttributionPage() {
  const { campaignId } = useParams()
  const { data } = useGrowth()
  const campaign = data.campaigns.find((entry) => entry.id === campaignId)

  if (!campaign) {
    return (
      <GrowthFrame back={{ to: ROUTES.growthPerformance, label: 'Growth performance · GO30' }} crumb="Owner Panel / Growth OS / Campaign Attribution" code="GO-31" title="Campaign not found">
        <Banner tone="warning" title="No campaign matches this link">Open Growth performance to choose a campaign.</Banner>
      </GrowthFrame>
    )
  }

  const leads = data.leads.filter((lead) => campaign.leadIds.includes(lead.id))
  const early = leads.find((lead) => lead.created.date < campaign.start)
  const stages = [['Campaign', `${campaign.id} · ${campaign.status}`, `${campaign.name} ${day(campaign.start)} – ${day(campaign.end)}`, false], ['Lead', `${leads.length} historical tag${leads.length === 1 ? '' : 's'}`, leads[0] ? `${leads[0].id} · ${day(leads[0].created.date)} · unknown attribution` : 'No linked lead', true], ['Appointment', 'No linked record', 'Not booked · live feed not verified', false], ['Consultation', 'No linked evidence', 'Completion status not supplied', false], ['Revenue', 'No ledger evidence', 'No attributable amount · model / join missing', false]]

  return (
    <GrowthFrame back={{ to: ROUTES.growthPerformance, label: 'Growth performance · GO30 · Restore cohort, filters & scroll' }} crumb="Owner Panel / Growth OS / Campaign Attribution" code="GO-31" title="Campaign Attribution Details" description={`Trace ${campaign.id} from its historical lead association to the evidence required for downstream credit.`} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, '01–25 Oct 2026 inclusive · Asia/Kolkata · Source cohort · Retain filters & scroll on return']} sample="Sample slice · Live data is not connected · Sample and live sources are never combined">
      {early && <Banner tone="warning" title="Historical tag predates proposed campaign window — verification required" className="mb-6">{early.id} was created {day(early.created.date)}; {campaign.id} proposes {day(campaign.start)} – {day(campaign.end)}. The historical tag is not proof of campaign acquisition, delivery or an eligible touch. The exact tag actor and timestamp are not supplied; creation time is not touch proof.</Banner>}
      <Section title={campaign.name} aside={`${campaign.id} · saved record`} className="mb-6">
        <p className="mb-4 flex flex-wrap gap-2"><StatusPill>{campaign.status} · internal</StatusPill>{leads.length > 0 && <StatusPill tone="warning">Attribution unverified</StatusPill>}<StatusPill>Source cohort ≠ proposed plan window</StatusPill></p>
        <dl className="grid gap-4 text-xs sm:grid-cols-3"><KeyValue label="Branch / owner">{campaign.branch} · {campaign.owner}</KeyValue><KeyValue label="Saved plan only · not spend">{formatINR(campaign.budget)} · {day(campaign.start)} – {day(campaign.end)} proposed</KeyValue><KeyValue label={`${campaign.channel.split(' / ')[0]} planned`}>No verified campaign connector</KeyValue></dl>
        <Link to={pathFor(ROUTES.campaign, { campaignId })} className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">Campaign definition → GO08 · Scoped view · No changes to the saved plan</Link>
      </Section>

      <Section title="Campaign → lead → appointment → consultation → revenue" aside="Evidence journey · no inferred results" className="mb-6">
        <ol className="grid gap-3 sm:grid-cols-5">{stages.map(([stage, name, note, flagged]) => <li key={stage} className={`rounded-md border p-3 text-xs ${flagged ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-surface-lowest'}`}><p className="font-semibold">{stage} →</p><p className="mt-1">{name}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
        <Banner className="mt-4 border-violet-200 bg-violet-50" title={`${leads.length} known association · not ${leads.length} directly or assisted-attributed lead`}>Current tag classification: Unknown — model, eligible touch evidence, identity and coverage are insufficient. Attribution rates are not calculated; verified direct and assisted counts are not evaluated, not zero.</Banner>
      </Section>

      <Section title="Linked records & evidence" aside="Supplied samples only · no patient chart access" className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Stage', 'Record / timestamp · IST', 'Source / evidence', 'Verification / blocker', 'Permitted next step'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            <tr className="border-t border-slate-100 align-top"><td className="px-6 py-4 font-semibold">Campaign</td><td className="px-6 py-4">{campaign.id}<br /><span className="text-outline">Updated {day(campaign.updated)}</span></td><td className="px-6 py-4">Saved plan</td><td className="px-6 py-4">Plan window is proposed; delivery unverified</td><td className="px-6 py-4"><Link to={pathFor(ROUTES.campaign, { campaignId })} className="font-semibold text-brand hover:underline">Open campaign → GO08</Link></td></tr>
            {leads.map((lead) => <tr key={lead.id} className="border-t border-slate-100 align-top"><td className="px-6 py-4 font-semibold">Lead</td><td className="px-6 py-4">{lead.id}<br /><span className="text-outline">{when(lead.created)}</span></td><td className="px-6 py-4">{lead.source} · {lead.campaign}</td><td className="px-6 py-4">Tag actor and timestamp not supplied; association unverified</td><td className="px-6 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">Open lead → GO03</Link></td></tr>)}
            {leads.length === 0 && <tr className="border-t border-slate-100"><td colSpan={5} className="px-6 py-6 text-center text-outline">No lead is tagged to this campaign.</td></tr>}
          </tbody></table></div>
      </Section>
      <GrowthFooter code="GO-31" back={{ to: ROUTES.growthPerformance, label: 'Growth performance · GO30' }} />
    </GrowthFrame>
  )
}
