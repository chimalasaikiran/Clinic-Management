import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

const TONE = { Blocked: 'warning', Pending: 'info', Failed: 'danger', Unknown: 'neutral' }
const OUTCOMES = ['Blocked', 'Pending', 'Failed', 'Unknown']
const NEXT = { Blocked: 'Verify the channel connection before any dispatch. Nothing was attempted.', Pending: 'Wait for the eligibility response. Do not dispatch while the recipient count is unrecorded.', Failed: 'Fix the missing variable in the template, then re-validate. This is a structural rejection, not a delivery failure.', Unknown: 'Reconcile with the provider first. Neither failure nor acceptance is confirmed — never resend blindly.' }

export default function WorkflowExecutionsPage() {
  const { data } = useGrowth()
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [selectedId, setSelectedId] = useState(data.executions[0]?.id)
  const needle = filters.q.trim().toLowerCase()
  const rows = data.executions.filter((entry) => (!filters.status || entry.outcome === filters.status) && (!needle || `${entry.id} ${entry.workflowId}`.toLowerCase().includes(needle))).sort((a, b) => `${b.at.date} ${b.at.time}`.localeCompare(`${a.at.date} ${a.at.time}`))
  const selected = data.executions.find((entry) => entry.id === selectedId) ?? rows[0]
  const workflow = selected && data.workflows.find((entry) => entry.id === selected.workflowId)

  return (
    <GrowthFrame back={{ to: ROUTES.growthPerformance, label: 'Growth performance · GO30 · Preserve report context' }} crumb="Owner Panel / Growth OS / Workflow Execution & Exceptions" code="GO-29" title="Workflow Execution & Exceptions" description="Inspect execution evidence, isolate exceptions and recover only when the outcome is safe." context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, '01–25 Oct 2026 inclusive · Asia/Kolkata · Retain filters & scroll on return']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <p className="mb-4 flex gap-3"><StatusPill tone="brand">SAMPLE SOURCE SLICE ✓</StatusPill><StatusPill>Verified live data · setup required</StatusPill></p>
      <Banner tone="warning" title="Simulation scenarios only — no workflow execution verified" className="mb-6">{workflow?.id ?? 'WF-REM201'} “{workflow?.name ?? 'Appointment reminder'}” remains Draft INACTIVE. These {data.executions.length} test scenarios are not runs of the inactive workflow. Live setup is not queried; no actual dispatch, eligibility query or provider receipt is supplied.</Banner>

      <Section title="Execution register" aside={`${rows.length} simulation record${rows.length === 1 ? '' : 's'} · Started newest first`} className="mb-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><SearchBox value={filters.q} onChange={(value) => setFilters((current) => ({ ...current, q: value }))} label="Search executions" placeholder="Search execution ID / workflow" className="self-end" /><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[['', 'All statuses'], ...OUTCOMES]} /></div>
        <p className="mb-4 flex flex-wrap gap-2 text-[11px]">{OUTCOMES.map((outcome) => <StatusPill key={outcome} tone={TONE[outcome]}>{outcome === 'Blocked' ? 'Blocked · not attempted' : outcome === 'Pending' ? 'Pending · awaiting read' : outcome === 'Failed' ? 'Failed · validation' : 'Unknown · reconcile first'}</StatusPill>)}</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Execution ID / started', 'Workflow / trigger / scope', 'Current step', 'Outcome', 'Error reason / evidence'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id} className={cn('border-t border-slate-100 align-top', selected?.id === entry.id && 'bg-teal-50/50')}><td className="px-6 py-4"><button type="button" onClick={() => setSelectedId(entry.id)} className="text-left font-semibold text-brand hover:underline">{entry.id}<br />{day(entry.at.date).slice(0, 6)} · {entry.at.time} IST<br />Simulation timestamp</button></td><td className="px-6 py-4">{entry.workflowId} · v1<br />{GROWTH_BRANCH.name} · {data.workflows.find((workflowEntry) => workflowEntry.id === entry.workflowId)?.owner}<br /><span className="text-outline">Synthetic 24h trigger</span></td><td className="px-6 py-4">{entry.step}</td><td className="px-6 py-4"><StatusPill tone={TONE[entry.outcome]}>{entry.outcome}</StatusPill></td><td className="px-6 py-4">{entry.reason}</td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No executions match these filters.</p>}</div>
        <p className="mt-3 text-[11px] text-outline">Simulation-start window, not a campaign delivery window. No sensitive payloads are shown in this register.</p>
      </Section>

      {selected && (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
          <Section title={`${selected.id} · ${selected.step}`} aside={<StatusPill tone={TONE[selected.outcome]}>{selected.outcome}</StatusPill>}><p className="text-xs leading-5">{selected.reason}</p><p className="mt-4 text-[13px] font-semibold">Safe next step</p><p className="mt-1 text-xs leading-5 text-on-surface-variant">{NEXT[selected.outcome]}</p></Section>
          <Section title="Recovery"><div className="flex flex-wrap gap-3"><ActionButton disabled title="Recovery needs a verified channel and a reconciled outcome">Retry</ActionButton><ActionButton to={ROUTES.deliveryFailures}>Delivery failures → GO26</ActionButton><ActionButton to={ROUTES.channels}>Channel setup → GO25</ActionButton></div><p className="mt-3 text-[11px] text-outline">Recovery is offered only after the outcome is reconciled. <Link to={ROUTES.workflows} className="font-semibold text-brand hover:underline">Back to workflows → GO27</Link></p></Section>
        </div>
      )}
      <GrowthFooter code="GO-29" back={{ to: ROUTES.growthPerformance, label: 'Growth performance · GO30' }} />
    </GrowthFrame>
  )
}
