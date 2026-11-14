import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { LEAD_SOURCES, LEAD_STAGES, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { TONES, when } from '../format'
import { dueState, leadRows, leadSummary } from '../growthLogic'

const SORTS = [['follow-up', 'Next follow-up · Earliest first'], ['newest', 'Newest first'], ['name', 'Name · A–Z']]

export default function LeadRegisterPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters({ sort: 'follow-up' })
  const [openId, setOpenId] = useState(null)
  const query = filters.get('q')
  const rows = leadRows(data.leads, { query, stage: filters.get('stage'), source: filters.get('source'), campaign: filters.get('campaign'), owner: filters.get('owner'), due: filters.get('due'), sort: filters.get('sort') })
  const summary = leadSummary(data.leads)
  const campaigns = [...new Set(data.leads.map((lead) => lead.campaign))]
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Back to Growth OS' }} crumb="Owner Panel / Growth / Leads" code="GO-02" title="Lead Register" description="Review inquiries, prioritize follow-ups and maintain a shared lead history across Aura Health." actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.leadNew} state={state}>Add Lead</ActionButton>} context={['Aura Health · All locations (3) · 01–22 Oct 2026', 'Register activity window · Search / stage / source / campaign / owner / follow-up filters are kept in the address']}>
      <dl className="mb-2 grid gap-4 sm:grid-cols-5">
        {[['New', summary.new], ['Follow up Due', summary.followUpsDue], ['Overdue', summary.overdue], ['Qualified', summary.qualified], ['Converted', summary.converted]].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-[13px] font-medium">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd><p className="text-[11px] text-outline">From the sample leads</p></div>)}
      </dl>
      <p className="mb-6 text-[11px] text-outline">Counts come from the lead records below, not a live summary.</p>

      <Section title="All leads" aside={`${rows.length} of ${data.leads.length} inquiries`} className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={query} onChange={(value) => filters.change('q', value)} label="Search leads" placeholder="Search by lead name or contact details" className="min-w-72 flex-1" />
          <FilterField label="" value={filters.get('sort')} onChange={(value) => filters.change('sort', value, 'follow-up')} options={SORTS} className="w-64" />
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-5">
          <FilterField label="Stage" value={filters.get('stage')} onChange={(value) => filters.change('stage', value)} options={[['', 'All stages'], ...LEAD_STAGES]} />
          <FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', 'All sources'], ...LEAD_SOURCES]} />
          <FilterField label="Campaign" value={filters.get('campaign')} onChange={(value) => filters.change('campaign', value)} options={[['', 'All campaigns'], ...campaigns]} />
          <FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...OWNERS]} />
          <FilterField label="Follow-up status" value={filters.get('due')} onChange={(value) => filters.change('due', value)} options={[['', 'All statuses'], 'Overdue', 'Due today', 'Upcoming']} />
        </div>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead / patient', 'Contact', 'Source / campaign', 'Stage', 'Owner', 'Last activity', 'Next follow-up', 'Due status', ''].map((heading, index) => <th key={`${heading}${index}`} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((lead) => (
            <tr key={lead.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
              <td className="px-5 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} state={state} className="font-semibold text-brand hover:underline">{lead.name} ↗</Link><br /><span className="text-outline">{lead.summary}<br />{lead.id.replace('LD', 'LD ')} · Patient link unverified</span></td>
              <td className="px-5 py-4">{lead.phone}<br /><span className="text-outline">Sample contact</span></td>
              <td className="px-5 py-4">{lead.source}<br /><span className="text-outline">{lead.campaign}</span><br /><span className="text-[11px] text-brand">Verify attribution</span></td>
              <td className="px-5 py-4">{lead.stage}</td>
              <td className="px-5 py-4">{lead.owner}</td>
              <td className="px-5 py-4">{when(lead.lastActivity)}</td>
              <td className="px-5 py-4">{lead.due ? when(lead.due) : '—'}<br /><span className="text-outline">{lead.nextAction}</span></td>
              <td className="px-5 py-4">{dueState(lead) !== 'None' && <StatusPill tone={TONES[dueState(lead)]}>{dueState(lead)}</StatusPill>}</td>
              <td className="px-5 py-4"><button type="button" aria-label={`Actions for ${lead.name}`} aria-expanded={openId === lead.id} onClick={() => setOpenId(openId === lead.id ? null : lead.id)} className="rounded border border-slate-300 p-1.5 hover:bg-slate-50"><MoreHorizontal className="size-4" aria-hidden="true" /></button></td>
            </tr>))}</tbody>
        </table>
        {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No leads match these filters.</p>}</div>
        {openId && (() => {
          const lead = data.leads.find((entry) => entry.id === openId)
          return (
            <div className="mt-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs">
              <p className="mb-3 flex justify-between"><strong className="text-[13px]">{lead.name} · Row actions</strong><span className="text-outline">Marketing, reception and management · authorized access only</span></p>
              <div className="flex flex-wrap gap-3"><ActionButton to={pathFor(ROUTES.lead, { leadId: lead.id })} state={state}>Lead Details</ActionButton><ActionButton to={pathFor(ROUTES.leadFollowUp, { leadId: lead.id })} state={state}>Record Follow-up</ActionButton><ActionButton to={pathFor(ROUTES.leadEdit, { leadId: lead.id })} state={state}>Edit Lead</ActionButton></div>
            </div>
          )
        })()}
        <p className="mt-3 flex justify-between text-[11px] text-outline"><span>Lead IDs: {data.leads.map((lead) => lead.id.replace('LD', 'LD ')).join(', ')} · All times IST</span><span>Recorded activity does not resolve an open follow-up.</span></p>
      </Section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {[['Shared records, not new copies', 'Review shared patient and lead records before creating or linking a lead. Matching values alone do not verify identity.'], ['Attribution & history stay intact', 'Verify campaign attribution before linking. Keep the original source and the immutable activity history through edits and conversion.'], ['Conversion is not a booking', 'Converted is a lead stage. Continue to the patient and appointment workflows; confirm details before booking.']].map(([title, text]) => <div key={title} className="rounded-md border border-slate-200 bg-white p-4 text-xs"><p className="text-[13px] font-semibold">{title}</p><p className="mt-2 leading-5 text-on-surface-variant">{text}</p></div>)}
      </div>
      <GrowthFooter code="GO-02" back={{ to: ROUTES.growth, label: 'Back to Growth OS' }} />
    </GrowthFrame>
  )
}
