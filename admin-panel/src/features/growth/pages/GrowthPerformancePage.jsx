import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { exportCsv } from '../../../lib/exportCsv'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, LEAD_SOURCES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { when } from '../format'

export default function GrowthPerformancePage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const needle = filters.get('q').trim().toLowerCase()
  const leads = data.leads
    .filter((lead) => (!filters.get('source') || lead.source === filters.get('source')) && (!filters.get('campaign') || lead.campaignId === filters.get('campaign')))
    .filter((lead) => !needle || `${lead.name} ${lead.id} ${lead.campaign}`.toLowerCase().includes(needle))
  const branchLeads = data.leads.filter((lead) => lead.branch === GROWTH_BRANCH.name)
  const tagged = data.leads.filter((lead) => lead.campaignId)
  const bySource = LEAD_SOURCES.map((source) => [source, leads.filter((lead) => lead.source === source).length]).filter(([, count]) => count > 0)
  const largest = Math.max(...bySource.map(([, count]) => count), 1)

  const exportSlice = () => exportCsv('growth-sample-slice.csv', [['Lead', 'Name', 'Source', 'Campaign', 'Stage', 'Created'], ...leads.map((lead) => [lead.id, lead.name, lead.source, lead.campaign, lead.stage, lead.created.date])])

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Growth Performance" code="GO-30" title="Growth Performance & Attribution" description="Understand the evidence behind growth — from source inquiries to outcomes that can be supported." context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, '01–25 Oct 2026 inclusive · Asia/Kolkata · Source cohort · Retain filters & scroll on return']} sample="Sample slice · Live data is not connected · Sample and live sources are never combined">
      <Section title="Report scope" aside="Source cohort · not campaign delivery dates" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Source date · inclusive IST" value="" disabled options={[['', '01–25 Oct 2026']]} /><FilterField label="Campaign" value={filters.get('campaign')} onChange={(value) => filters.change('campaign', value)} options={[['', 'All campaigns'], ...data.campaigns.map((campaign) => [campaign.id, campaign.name])]} /><FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', 'All source samples'], ...LEAD_SOURCES]} /></div>
        <div className="mt-4 flex flex-wrap items-end gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search leads" placeholder="Search campaign / lead" className="min-w-72 flex-1" /><ActionButton onClick={exportSlice} disabled={leads.length === 0}>Export sample slice</ActionButton></div>
        <p className="mt-3 text-[11px] text-outline">01 Oct 00:00 ≤ source date &lt; 26 Oct 00:00 Asia/Kolkata. Leads: created date · Reviews: posted date · Workflow definitions are not executions. Export carries a SAMPLE marker; there is no live export.</p>
      </Section>

      <Section title="Source coverage" aside="Local sample slice · prepared 25 Oct 2026" className="mb-6">
        <dl className="grid gap-5 text-xs sm:grid-cols-3">{[['CRM', `${data.leads.length} samples known`, `${branchLeads.length} branch-known lead${branchLeads.length === 1 ? '' : 's'} included.`], ['Campaign connector · not verified', `${tagged.length} historical ${tagged[0]?.campaign ? tagged[0].campaignId : 'tag'} tag`, 'No spend, clicks or reach evidence.'], ['Appointments + consultations', 'No verified feed', 'No linked feed or completion evidence.'], ['Finance attribution · no ledger join', 'Not approved', 'No recognized or collected revenue basis approved.'], ['Workflow execution · none verified', `${data.workflows.length} inactive definitions`, 'Not retention outcomes.'], ['Reviews · samples, not live', `${data.reviews.length} samples`, 'No verified review feed or reply timestamps.']].map(([title, value, note]) => <div key={title}><dt className="text-[13px] font-semibold">{title}</dt><dd className="mt-1">{value}</dd><p className="text-outline">{note}</p></div>)}</dl>
      </Section>

      <dl className="mb-6 grid gap-4 sm:grid-cols-3">{[['Branch-scoped lead volume', `${branchLeads.length} local sample${branchLeads.length === 1 ? '' : 's'}`, `${branchLeads.map((lead) => lead.id).join(', ')} in the selected window. Not the branch’s live lead count.`], ['Historical campaign association', `${tagged.length} unverified tag${tagged.length === 1 ? '' : 's'}`, `${tagged.map((lead) => `${lead.campaignId} → ${lead.id}`).join(', ') || 'None'}. Association is not campaign acquisition or attributed credit.`], ['Retention definition samples', `${data.workflows.length} inactive`, 'Separate coverage set. No verified execution evidence or return-rate denominator.']].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="mt-2 text-[28px] leading-8 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>)}</dl>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Leads by source" aside="Sample counts">
          <ul className="space-y-4">{bySource.map(([source, count]) => <li key={source} className="grid grid-cols-[140px_1fr_24px] items-center gap-3 text-xs"><span>{source}</span><span className="h-3 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(count / largest) * 100}%` }} /></span><strong>{count}</strong></li>)}</ul>
          {bySource.length === 0 && <p className="text-xs text-outline">No leads in this slice.</p>}
          <p className="mt-4 text-[11px] text-outline">Counts are sample leads, not source performance or conversion.</p>
        </Section>
        <Section title="Leads behind this slice" aside={`${leads.length} supplied inquir${leads.length === 1 ? 'y' : 'ies'} · not organization totals`}>
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead', 'Source / campaign', 'Created · IST', 'Attribution'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-slate-100"><td className="px-6 py-3"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.name}</Link><br /><span className="text-outline">{lead.id}</span></td><td className="px-6 py-3">{lead.source}<br /><span className="text-outline">{lead.campaign}</span></td><td className="px-6 py-3">{when(lead.created)}</td><td className="px-6 py-3">{lead.campaignId ? <Link to={pathFor(ROUTES.campaignAttribution, { campaignId: lead.campaignId })} className="font-semibold text-brand hover:underline">Unverified · trace →</Link> : 'No campaign tag'}</td></tr>)}</tbody></table>
            {leads.length === 0 && <p className="px-6 py-6 text-center text-xs text-outline">No leads match these filters.</p>}</div>
        </Section>
      </div>
      <Banner tone="warning" title="Attribution is unavailable, not zero" className="mb-6">A historical tag is not a verified direct or assisted attributed lead. Appointments, consultations and revenue are not linked. <Link to={ROUTES.workflowExecutions} className="font-semibold text-brand hover:underline">Workflow execution evidence → GO29</Link></Banner>
      <GrowthFooter code="GO-30" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
