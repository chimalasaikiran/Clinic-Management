import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import { exportCsv } from '../../../lib/exportCsv'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { day, when } from '../format'
import { leadsApi } from '../leadsApi'
import { clinicNow, SOURCES, sourceId, toLeadView } from '../leadsView'
import { useLeadContext } from '../useLeads'

const PAGE_SIZE = 100
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')

export default function GrowthPerformancePage() {
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const [today] = useState(() => clinicNow().date)
  const from = filters.get('from') || `${today.slice(0, 8)}01`
  const to = filters.get('to') || today
  const source = sourceId(filters.get('source')) || undefined
  const branchId = context.branchId || undefined
  const validRange = from <= to
  const cohort = { branchId, from, to, source }
  const key = JSON.stringify(cohort)
  const report = useApiResource(() => (validRange ? leadsApi.performance(cohort) : Promise.resolve(null)), key)
  const list = useApiResource(() => (validRange ? leadsApi.list({ ...cohort, q: filters.get('q') || undefined, sort: 'newest', pageSize: PAGE_SIZE }) : Promise.resolve(null)), `${key}:${filters.get('q')}`)
  const [exporting, setExporting] = useState(false)

  const data = report.data
  const leads = (list.data?.data ?? []).map(toLeadView)
  const listed = list.data?.meta?.total ?? 0
  const bySource = Object.entries(SOURCES).map(([id, label]) => [label, data?.bySource[id] ?? 0]).filter(([, count]) => count > 0)
  const largest = Math.max(...bySource.map(([, count]) => count), 1)
  const branchName = branchId ? context.branches.find((branch) => branch.id === branchId)?.name : 'All locations in your role'

  // Every lead in the slice, not just the page on screen.
  const exportSlice = async () => {
    setExporting(true)
    try {
      const rows = []
      for (let page = 1; ; page += 1) {
        const result = await leadsApi.list({ ...cohort, q: filters.get('q') || undefined, sort: 'newest', page, pageSize: PAGE_SIZE })
        rows.push(...result.data.map(toLeadView))
        if (rows.length >= result.meta.total || result.data.length === 0) break
      }
      exportCsv(`growth-leads-${from}-to-${to}.csv`, [['Lead', 'Name', 'Source', 'Branch', 'Stage', 'Owner', 'Created', 'Patient MRN'], ...rows.map((lead) => [lead.number, lead.name, lead.source, lead.branch, lead.stage, lead.owner, lead.created.date, lead.patient?.mrn ?? ''])])
    } finally {
      setExporting(false)
    }
  }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Growth Performance" code="GO-30" title="Growth Performance & Attribution" description="Understand the evidence behind growth — from source inquiries to outcomes that can be supported." context={[context.line, `${day(from)} – ${day(to)} inclusive · Asia/Kolkata · Leads by the date they were recorded`]} today={context.today} sample="Live lead records · Leads are credited to a campaign only when recorded against it">
      <Section title="Report scope" aside="Lead cohort · by recorded date" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <FilterField label="Branch" value="" disabled options={[['', branchName ?? 'All locations']]} />
          <TextInput label="From · IST" type="date" max={to} value={from} onChange={(event) => filters.change('from', event.target.value)} />
          <TextInput label="To · IST" type="date" min={from} max={today} value={to} onChange={(event) => filters.change('to', event.target.value)} error={validRange ? undefined : 'The end date must not be before the start date.'} />
          <FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', 'All sources'], ...Object.values(SOURCES)]} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search leads" placeholder="Search lead name, number or mobile" className="min-w-72 flex-1" /><ActionButton onClick={exportSlice} disabled={!listed || exporting}>{exporting ? 'Exporting…' : 'Export leads (CSV)'}</ActionButton></div>
        <p className="mt-3 text-[11px] text-outline">{day(from)} 00:00 ≤ recorded date &lt; the day after {day(to)}, Asia/Kolkata. The branch follows the location chosen in the header. The search narrows the lead list and export, not the totals.</p>
      </Section>

      <Section title="Source coverage" aside={data ? `${data.total} lead${data.total === 1 ? '' : 's'} in this cohort` : 'Loading…'} className="mb-6">
        <dl className="grid gap-5 text-xs sm:grid-cols-3">{[
          ['Leads', data ? `${data.total} recorded` : '—', 'Every enquiry recorded in the Lead Register.'],
          ['From campaigns', data ? `${data.total - data.untagged} of ${data.total} · ${percent(data.total - data.untagged, data.total)}` : '—', 'Recorded against a campaign; the rest have only a source.'],
          ['Converted', data ? `${data.converted} of ${data.total} · ${percent(data.converted, data.total)}` : '—', 'Linked to one shared patient record.'],
          ['Appointments after conversion', data ? `${data.booked} of ${data.converted} converted` : '—', 'Booked on or after the conversion date; cancellations excluded.'],
          ['Consultations', data ? `${data.consulted} completed a visit` : '—', 'A completed appointment on or after conversion.'],
          ['Revenue', 'Not traced', 'Invoices are not attributed to leads.'],
        ].map(([title, value, note]) => <div key={title}><dt className="text-[13px] font-semibold">{title}</dt><dd className="mt-1">{value}</dd><p className="text-outline">{note}</p></div>)}</dl>
      </Section>

      <dl className="mb-6 grid gap-4 sm:grid-cols-3">{[
        ['Lead volume', data ? String(data.total) : '—', `Recorded ${day(from)} – ${day(to)} in ${branchName ?? 'this location'}.`],
        ['Conversion', data ? percent(data.converted, data.total) : '—', data ? `${data.converted} converted · ${data.byStage.closed} closed · ${data.total - data.converted - data.byStage.closed} still open` : 'Loading'],
        ['Booked after conversion', data ? percent(data.booked, data.converted) : '—', data ? `${data.booked} of ${data.converted} converted leads booked an appointment` : 'Loading'],
      ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="mt-2 text-[28px] leading-8 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>)}</dl>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Leads by source" aside="Recorded source">
          <ul className="space-y-4">{bySource.map(([label, count]) => <li key={label} className="grid grid-cols-[140px_1fr_24px] items-center gap-3 text-xs"><span>{label}</span><span className="h-3 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(count / largest) * 100}%` }} /></span><strong>{count}</strong></li>)}</ul>
          {data && bySource.length === 0 && <p className="text-xs text-outline">No leads in this cohort.</p>}
          {report.error && <p role="alert" className="text-xs text-danger">{report.error.message}</p>}
          <p className="mt-4 text-[11px] text-outline">Where each enquiry came from, as recorded. Source volume is not campaign performance.</p>
        </Section>
        <Section title="Leads behind this report" aside={`${listed} lead${listed === 1 ? '' : 's'}${listed > PAGE_SIZE ? ` · newest ${PAGE_SIZE} shown` : ''}`}>
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead', 'Source / branch', 'Recorded · IST', 'Outcome'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-slate-100"><td className="px-6 py-3"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.name}</Link><br /><span className="text-outline">{lead.number}</span></td><td className="px-6 py-3">{lead.source}<br /><span className="text-outline">{lead.branch}</span></td><td className="px-6 py-3">{when(lead.created)}</td><td className="px-6 py-3">{lead.patient ? <Link to={pathFor(ROUTES.patientHub, { patientId: lead.patient.id })} className="font-semibold text-brand hover:underline">Converted · {lead.patient.mrn}</Link> : lead.stage}</td></tr>)}</tbody></table>
            {list.data && leads.length === 0 && <p className="px-6 py-6 text-center text-xs text-outline">No leads match these filters.</p>}</div>
        </Section>
      </div>
      <Section title="Leads by campaign" aside="Same cohort · recorded against a campaign" className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Campaign', 'Leads', 'Converted', 'Booked after converting', 'Completed a visit'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead>
          <tbody>{(data?.byCampaign ?? []).map((campaign) => <tr key={campaign.id} className="border-t border-slate-100"><td className="px-6 py-3"><Link to={pathFor(ROUTES.campaignAttribution, { campaignId: campaign.id })} className="font-semibold text-brand hover:underline">{campaign.code} · {campaign.name}</Link></td><td className="px-6 py-3">{campaign.total}</td><td className="px-6 py-3">{campaign.converted} · {percent(campaign.converted, campaign.total)}</td><td className="px-6 py-3">{campaign.booked}</td><td className="px-6 py-3">{campaign.consulted}</td></tr>)}</tbody></table>
          {data && !data.byCampaign.length && <p className="px-6 py-6 text-center text-xs text-outline">No lead in this cohort was recorded against a campaign.</p>}</div>
        <p className="mt-3 text-[11px] text-outline">{data ? `${data.untagged} lead${data.untagged === 1 ? '' : 's'} in this cohort have no campaign.` : ''} Appointments count only when the converted patient booked on or after conversion. <Link to={ROUTES.workflowExecutions} className="font-semibold text-brand hover:underline">Workflow execution evidence → GO29</Link></p>
      </Section>
      <GrowthFooter code="GO-30" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
