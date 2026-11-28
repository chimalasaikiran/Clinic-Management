import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { TONES, when } from '../format'
import { leadsApi } from '../leadsApi'
import { LIVE_NOTE, leadSummary, listQuery, SOURCES, STAGES, toLeadView } from '../leadsView'
import { useLeadContext, useLeadOwners } from '../useLeads'

const SORTS = [['follow-up', 'Next follow-up · Earliest first'], ['newest', 'Newest first'], ['name', 'Name · A–Z']]
const PAGE_SIZE = 50
const FILTERS = ['q', 'stage', 'source', 'owner', 'due', 'sort']

export default function LeadRegisterPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const owners = useLeadOwners()
  const filters = useRegisterFilters({ sort: 'follow-up' })
  const [openId, setOpenId] = useState(null)
  const query = listQuery(Object.fromEntries(FILTERS.map((key) => [key, filters.get(key)])), context.branchId)
  // Any change of filter or location starts again from the first page.
  const queryKey = JSON.stringify(query)
  const [paging, setPaging] = useState({ key: queryKey, page: 1 })
  const page = paging.key === queryKey ? paging.page : 1
  const result = useApiResource(() => leadsApi.list({ ...query, page, pageSize: PAGE_SIZE }), `${queryKey}#${page}`)
  const rows = (result.data?.data ?? []).map(toLeadView)
  const meta = result.data?.meta
  const total = meta?.total ?? 0
  const summary = leadSummary(meta)
  const writer = can('growth.leads')
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Back to Growth OS' }} crumb="Owner Panel / Growth / Leads" title="Lead Register" description="Review inquiries, prioritize follow-ups and maintain a shared lead history." actions={writer && <ActionButton variant="brand" icon={Plus} to={ROUTES.leadNew} state={state}>Add Lead</ActionButton>} context={[context.line, 'Search / stage / source / owner / follow-up filters are kept in the address · The header location applies here']} today={context.today} sample={LIVE_NOTE}>
      <dl className="mb-2 grid gap-4 sm:grid-cols-5">
        {[['New', summary.new], ['Follow up Due', summary.followUpsDue], ['Overdue', summary.overdue], ['Qualified', summary.qualified], ['Converted', summary.converted]].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-[13px] font-medium">{label}</dt><dd className="mt-1 text-2xl font-semibold">{meta ? value : '—'}</dd><p className="text-[11px] text-outline">All leads in this location</p></div>)}
      </dl>
      <p className="mb-6 text-[11px] text-outline">Follow up Due counts follow-ups that are overdue or due before the end of today (IST). Filters below do not change these counts.</p>

      <Section title="All leads" aside={meta ? `${total} matching ${total === 1 ? 'inquiry' : 'inquiries'}` : 'Loading…'} className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search leads" placeholder="Search by name, lead number, mobile or interest" className="min-w-72 flex-1" />
          <FilterField label="" value={filters.get('sort')} onChange={(value) => filters.change('sort', value, 'follow-up')} options={SORTS} className="w-64" />
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          <FilterField label="Stage" value={filters.get('stage')} onChange={(value) => filters.change('stage', value)} options={[['', 'All stages'], ...Object.values(STAGES)]} />
          <FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', 'All sources'], ...Object.values(SOURCES)]} />
          <FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...owners.map((owner) => [owner.membershipId, owner.name])]} />
          <FilterField label="Follow-up status" value={filters.get('due')} onChange={(value) => filters.change('due', value)} options={[['', 'All statuses'], 'Overdue', 'Due today', 'Upcoming']} />
        </div>
        {result.error && !result.data ? <LoadingState error={result.error} onRetry={result.reload} /> : <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead / patient', 'Contact', 'Source', 'Stage', 'Owner', 'Last activity', 'Next follow-up', 'Due status', ''].map((heading, index) => <th key={`${heading}${index}`} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((lead) => (
            <tr key={lead.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
              <td className="px-5 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} state={state} className="font-semibold text-brand hover:underline">{lead.name} ↗</Link><br /><span className="text-outline">{lead.summary}<br />{lead.number} · {lead.patient ? `Patient ${lead.patient.mrn}` : 'No patient linked'}</span></td>
              <td className="px-5 py-4">{lead.phone}<br /><span className="text-outline">{lead.email || 'No email'}</span></td>
              <td className="px-5 py-4">{lead.source}<br /><span className="text-outline">{lead.branch}</span></td>
              <td className="px-5 py-4">{lead.stage}</td>
              <td className="px-5 py-4">{lead.owner}</td>
              <td className="px-5 py-4">{when(lead.lastActivity)}</td>
              <td className="px-5 py-4">{lead.due ? when(lead.due) : '—'}<br /><span className="text-outline">{lead.nextAction}</span></td>
              <td className="px-5 py-4">{lead.dueState !== 'None' && <StatusPill tone={TONES[lead.dueState]}>{lead.dueState}</StatusPill>}</td>
              <td className="px-5 py-4"><button type="button" aria-label={`Actions for ${lead.name}`} aria-expanded={openId === lead.id} onClick={() => setOpenId(openId === lead.id ? null : lead.id)} className="rounded border border-slate-300 p-1.5 hover:bg-slate-50"><MoreHorizontal className="size-4" aria-hidden="true" /></button></td>
            </tr>))}</tbody>
        </table>
        {meta && rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">{FILTERS.slice(0, 5).some((key) => filters.get(key)) ? 'No leads match these filters.' : 'No leads recorded for this location yet.'}</p>}
        {!meta && <LoadingState label="Loading leads…" />}</div>}
        {openId && (() => {
          const lead = rows.find((entry) => entry.id === openId)
          if (!lead) return null
          return (
            <div className="mt-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs">
              <p className="mb-3 flex justify-between"><strong className="text-[13px]">{lead.name} · Row actions</strong><span className="text-outline">{writer ? 'Changes are recorded in the activity history' : 'View only · your role cannot change leads'}</span></p>
              <div className="flex flex-wrap gap-3"><ActionButton to={pathFor(ROUTES.lead, { leadId: lead.id })} state={state}>Lead Details</ActionButton>{writer && <><ActionButton to={pathFor(ROUTES.leadFollowUp, { leadId: lead.id })} state={state}>Record Follow-up</ActionButton><ActionButton to={pathFor(ROUTES.leadEdit, { leadId: lead.id })} state={state}>Edit Lead</ActionButton></>}</div>
            </div>
          )
        })()}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-outline">
          <span>{total > PAGE_SIZE ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}` : 'All times IST'}</span>
          {total > PAGE_SIZE && <span className="flex gap-2"><ActionButton disabled={page === 1} onClick={() => setPaging({ key: queryKey, page: page - 1 })}>Previous</ActionButton><ActionButton disabled={page * PAGE_SIZE >= total} onClick={() => setPaging({ key: queryKey, page: page + 1 })}>Next</ActionButton></span>}
          <span>Recorded activity does not resolve an open follow-up.</span>
        </div>
      </Section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {[['Shared records, not new copies', 'Review shared patient and lead records before creating or linking a lead. Matching values alone do not verify identity.'], ['Source & history stay intact', 'The original source and the activity history are kept through edits and conversion.'], ['Conversion is not a booking', 'Converted is a lead stage. Continue to the patient and appointment workflows; confirm details before booking.']].map(([title, text]) => <div key={title} className="rounded-md border border-slate-200 bg-white p-4 text-xs"><p className="text-[13px] font-semibold">{title}</p><p className="mt-2 leading-5 text-on-surface-variant">{text}</p></div>)}
      </div>
      <GrowthFooter back={{ to: ROUTES.growth, label: 'Back to Growth OS' }} />
    </GrowthFrame>
  )
}
