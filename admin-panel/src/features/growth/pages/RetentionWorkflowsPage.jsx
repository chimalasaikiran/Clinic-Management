import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { TRIGGERS, WORKFLOW_STATUSES, WORKFLOW_TONE } from '../campaignsView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

export default function RetentionWorkflowsPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const workflows = useApiResource(() => campaignsApi.workflows(), 'workflows')
  const needle = filters.get('q').trim().toLowerCase()
  const all = workflows.data ?? []
  const rows = all
    .filter((workflow) => (!filters.get('trigger') || workflow.trigger === filters.get('trigger')) && (!filters.get('status') || workflow.status === filters.get('status')))
    .filter((workflow) => !needle || `${workflow.name} ${workflow.code}`.toLowerCase().includes(needle))
  const state = { search: filters.search }
  const active = all.filter((workflow) => workflow.status === 'active').length

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Retention & Reminder Workflows" title="Retention & Reminder Workflows" description="Send one approved template automatically after a missed appointment, a lead that has not converted, or a completed visit." badge={<StatusPill tone={active ? 'success' : 'neutral'}>{workflows.data ? `${active} on · ${all.length - active} off` : 'Loading'}</StatusPill>} context={[context.line, 'Filters and search are kept in the address']} today={context.today} sample="Live records · Workflows queue messages through the connected channels and record every event they act on">
      <Banner tone="brand" title="What a workflow does when it is on" className="mb-6">Every few minutes it looks for events that have come due since it was switched on, checks permission, opt-outs and the weekly limit for each person, and queues the message. Nothing is sent between 9 pm and 9 am. Events from before it was switched on are never acted on.</Banner>
      <Section title="Find workflows" aside="Filters" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search workflows" placeholder="Search name or code" className="self-end" /><FilterField label="Trigger" value={filters.get('trigger')} onChange={(value) => filters.change('trigger', value)} options={[['', 'All triggers'], ...Object.entries(TRIGGERS)]} /><FilterField label="Status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...Object.entries(WORKFLOW_STATUSES)]} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-3">{can('growth.manage') && <ActionButton variant="brand" icon={Plus} to={ROUTES.workflowNew} state={state}>Create workflow →</ActionButton>}<ActionButton onClick={filters.reset}>Clear filters</ActionButton><Link to={ROUTES.workflowExecutions} className="text-xs font-semibold text-brand hover:underline">Execution & exceptions →</Link></div>
      </Section>

      <Section title="Workflow register" aside={`${rows.length} workflow${rows.length === 1 ? '' : 's'}`} className="mb-6">
        {!workflows.data ? <LoadingState label="Loading workflows…" error={workflows.error} onRetry={workflows.reload} /> : (
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Workflow / branch / owner', 'Trigger & delay', 'Template / channel', 'State / readiness', 'Last 7 days'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((workflow) => (
              <tr key={workflow.id} className="border-t border-slate-100 align-top">
                <td className="px-6 py-4"><Link to={pathFor(ROUTES.workflowEdit, { workflowId: workflow.id })} state={state} className="font-semibold text-brand hover:underline">{workflow.name}</Link><br /><strong>{workflow.code} · v{workflow.version}</strong><br />{workflow.branch?.name ?? 'All branches'}<br />{workflow.owner.name}</td>
                <td className="px-6 py-4">{TRIGGERS[workflow.trigger]}<br /><span className="text-on-surface-variant">Sends {workflow.delayLabel} after · at most {workflow.weeklyCap} automated messages a week per person</span></td>
                <td className="px-6 py-4">{workflow.template ? `${workflow.template.code} v${workflow.template.version} · ${workflow.template.name}` : 'Not selected — required'}<br /><span className="text-outline">{workflow.template ? CHANNELS[workflow.template.channel] : 'No channel yet'}</span></td>
                <td className="px-6 py-4"><StatusPill tone={WORKFLOW_TONE[workflow.status]}>{WORKFLOW_STATUSES[workflow.status]}</StatusPill><br /><span className="text-on-surface-variant">{workflow.status === 'active' ? `On since ${when(stampOf(workflow.activatedAt))}` : workflow.problems.length ? workflow.problems.join(' ') : 'Ready to switch on'}</span></td>
                <td className="px-6 py-4">{workflow.lastWeek.queued} sent<br /><span className="text-outline">{workflow.lastWeek.skipped} skipped</span></td>
              </tr>))}</tbody>
          </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">{all.length ? 'No workflows match these filters.' : 'No workflows yet.'}</p>}</div>
        )}
        <p className="mt-3 flex flex-wrap justify-between gap-3 text-[11px] text-outline"><span>Restores filters and search on return.</span><span><Link to={ROUTES.messageTemplates} className="font-semibold text-brand hover:underline">Message templates →</Link> · <Link to={ROUTES.channels} className="font-semibold text-brand hover:underline">Channels →</Link></span></p>
      </Section>
      <GrowthFooter back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
