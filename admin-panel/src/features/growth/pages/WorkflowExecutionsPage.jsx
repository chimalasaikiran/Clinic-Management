import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { MESSAGE_STATUSES, TRIGGERS } from '../campaignsView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

const MESSAGE_TONE = { queued: 'info', sending: 'info', sent: 'brand', delivered: 'success', read: 'success', failed: 'danger', unknown: 'warning' }

// What to do next for one recorded event.
function nextStep(run) {
  if (run.outcome === 'skipped') {
    if (run.skipReason === 'CONSENT_REQUIRED') return 'Record the person’s permission for this channel if they have given it; later events will then be sent.'
    if (run.skipReason === 'CONSENT_WITHDRAWN') return 'They opted out. Nothing should be sent unless they opt back in.'
    if (run.skipReason === 'WEEKLY_CAP') return 'They already had the weekly limit of automated messages. Nothing to do.'
    if (run.skipReason === 'NO_ADDRESS') return 'Add a valid mobile number or email to the record.'
    if (run.skipReason === 'VARIABLES_MISSING') return 'Give the workflow a fixed value for the missing template variable.'
    return 'The event no longer called for a message. Nothing to do.'
  }
  if (run.message?.status === 'failed') return 'The provider rejected the message. Check it on Delivery failures before retrying.'
  if (run.message?.status === 'unknown') return 'The outcome is unknown. Check the provider’s console and record the outcome on Delivery failures; never resend blindly.'
  return 'Queued for the channel. Its status updates as the provider reports it.'
}

const who = (run) => run.patient ? (run.patient.fullName ? `${run.patient.fullName} · ${run.patient.mrn}` : 'Patient') : run.lead ? `${run.lead.fullName} · ${run.lead.number}` : '—'

export default function WorkflowExecutionsPage() {
  const context = useLeadContext()
  const [filters, setFilters] = useState({ workflowId: '', outcome: '', problem: '' })
  const [selectedId, setSelectedId] = useState(null)
  const workflows = useApiResource(() => campaignsApi.workflows(), 'workflows').data ?? []
  const query = { workflowId: filters.workflowId || undefined, outcome: filters.outcome || undefined, problem: filters.problem || undefined, pageSize: 100 }
  const runs = useApiResource(() => campaignsApi.runs(query), `runs:${JSON.stringify(query)}`)
  const rows = runs.data?.data ?? []
  const selected = rows.find((run) => run.id === selectedId) ?? rows[0]
  const change = (name, value) => setFilters((current) => ({ ...current, [name]: value }))

  return (
    <GrowthFrame back={{ to: ROUTES.growthPerformance, label: 'Growth performance · Preserve report context' }} crumb="Owner Panel / Growth OS / Workflow Execution & Exceptions" title="Workflow Execution & Exceptions" description="Every event a workflow acted on: the message it queued and its delivery, or the reason it was skipped." context={[context.line, 'Newest first · times in IST']} today={context.today} sample="Live records · One entry per event; a workflow never acts on the same event twice">
      <Section title="Execution register" aside={runs.data ? `${rows.length} of ${runs.data.meta.total} events` : 'Loading'} className="mb-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><FilterField label="Workflow" value={filters.workflowId} onChange={(value) => change('workflowId', value)} options={[['', 'All workflows'], ...workflows.map((workflow) => [workflow.id, `${workflow.code} · ${workflow.name}`])]} /><FilterField label="Outcome" value={filters.outcome} onChange={(value) => change('outcome', value)} options={[['', 'All outcomes'], ['queued', 'Message queued'], ['skipped', 'Skipped']]} /><FilterField label="Show" value={filters.problem} onChange={(value) => change('problem', value)} options={[['', 'Everything'], ['true', 'Exceptions only']]} /></div>
        {!runs.data ? <LoadingState label="Loading executions…" error={runs.error} onRetry={runs.reload} /> : (
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Recorded', 'Workflow / trigger', 'Person', 'Outcome', 'Reason / delivery'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((run) => <tr key={run.id} className={cn('border-t border-slate-100 align-top', selected?.id === run.id && 'bg-teal-50/50')}>
              <td className="px-6 py-4"><button type="button" onClick={() => setSelectedId(run.id)} className="text-left font-semibold text-brand hover:underline">{when(stampOf(run.createdAt))}</button><br /><span className="text-outline">Due {when(stampOf(run.dueAt))}</span></td>
              <td className="px-6 py-4">{run.workflow.code} · v{run.workflowVersion}<br />{run.workflow.name}<br /><span className="text-outline">{TRIGGERS[run.workflow.trigger]}</span></td>
              <td className="px-6 py-4">{run.lead ? <Link to={pathFor(ROUTES.lead, { leadId: run.lead.id })} className="font-semibold text-brand hover:underline">{who(run)}</Link> : who(run)}{run.appointment && <><br /><span className="text-outline">{run.appointment.reference}</span></>}</td>
              <td className="px-6 py-4"><StatusPill tone={run.outcome === 'queued' ? MESSAGE_TONE[run.message?.status] ?? 'info' : 'neutral'}>{run.outcome === 'queued' ? MESSAGE_STATUSES[run.message?.status] ?? 'Queued' : 'Skipped'}</StatusPill></td>
              <td className="px-6 py-4">{run.skipLabel ?? (run.message?.errorMessage || 'Sent through the channel')}</td>
            </tr>)}</tbody></table>
            {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">{filters.workflowId || filters.outcome || filters.problem ? 'No events match these filters.' : 'No workflow has acted on an event yet.'}</p>}</div>
        )}
      </Section>

      {selected && (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
          <Section title={`${selected.workflow.code} · ${who(selected)}`} aside={<StatusPill tone={selected.outcome === 'queued' ? 'brand' : 'neutral'}>{selected.outcome === 'queued' ? 'Message queued' : 'Skipped'}</StatusPill>}><p className="text-xs leading-5">{selected.skipLabel ?? `${MESSAGE_STATUSES[selected.message?.status] ?? 'Queued'}${selected.message?.errorMessage ? ` · ${selected.message.errorMessage}` : ''}`}</p><p className="mt-4 text-[13px] font-semibold">Safe next step</p><p className="mt-1 text-xs leading-5 text-on-surface-variant">{nextStep(selected)}</p></Section>
          <Section title="Recovery"><div className="flex flex-wrap gap-3">{selected.message && <ActionButton to={pathFor(ROUTES.conversation, { threadId: selected.message.conversationId })}>Open conversation</ActionButton>}<ActionButton to={ROUTES.deliveryFailures}>Delivery failures →</ActionButton><ActionButton to={ROUTES.channels}>Channel setup →</ActionButton></div><p className="mt-3 text-[11px] text-outline">Failed messages are retried from Delivery failures, after their checks. <Link to={ROUTES.workflows} className="font-semibold text-brand hover:underline">Back to workflows →</Link></p></Section>
        </div>
      )}
      {runs.data && !rows.length && <Banner title="Nothing to show yet" className="mb-6">Entries appear here once an active workflow finds an event that has come due.</Banner>}
      <GrowthFooter back={{ to: ROUTES.growthPerformance, label: 'Growth performance' }} />
    </GrowthFrame>
  )
}
