import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { WORKFLOW_STATUSES, WORKFLOW_TONE } from '../campaignsView'
import { contentApi } from '../contentApi'
import { when } from '../format'
import { renderTemplate } from '../growthLogic'
import { stampOf } from '../leadsView'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

const EXAMPLE = { preferred_name: 'Ananya', clinic_name: 'your clinic', appointment_date: '27 Nov 2026', appointment_time: '10:30 am' }

// Review requests are a workflow: after a completed visit, an approved template with the branch's public review link.
export default function ReviewRequestPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const workflows = useApiResource(() => campaignsApi.workflows(), 'workflows')
  const branchId = context.branchId || context.branches[0]?.id || ''
  const profile = useApiResource(() => (branchId ? contentApi.profile(branchId) : Promise.resolve(null)), `profile:${branchId}`)
  const requests = (workflows.data ?? []).filter((workflow) => workflow.trigger === 'review_request')
  const runs = useApiResource(() => (requests[0] ? campaignsApi.runs({ workflowId: requests[0].id, pageSize: 10 }) : Promise.resolve(null)), `review-runs:${requests[0]?.id ?? ''}`)
  const link = profile.data?.profile.reviewUrl ?? null
  const active = requests.find((workflow) => workflow.status === 'active')
  const manage = can('growth.manage')

  return (
    <GrowthFrame back={{ to: ROUTES.reviews, label: 'Back to reviews' }} crumb="Owner Panel / Growth OS / Review Requests" title="Review Request Workflow" description="Ask for honest feedback after a completed visit, with the branch’s public review link. Every visit is asked the same way." badge={<StatusPill tone={active ? 'success' : 'warning'}>{active ? 'On' : 'Off'}</StatusPill>} context={[context.line, 'Review requests run as a workflow with the same permission, quiet-hours and weekly-limit rules']} today={context.today} sample="Live records · Sent through the connected messaging channel">
      <Banner tone="brand" title="No review gating" className="mb-6">Requests go to every completed visit, never only to people expected to be happy. They offer the public review link and do not ask for a rating first. Nothing is offered in return.</Banner>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Review-request workflows" aside={`${requests.length} set up`}>
            {!workflows.data ? <LoadingState label="Loading workflows…" error={workflows.error} onRetry={workflows.reload} /> : requests.length === 0 ? <p className="text-xs text-on-surface-variant">No review-request workflow yet. Create one: choose an approved “Review request” template that includes {'{{review_link}}'}, and how long after the visit to send it.</p> : (
              <ul className="divide-y divide-slate-100 text-xs">{requests.map((workflow) => (
                <li key={workflow.id} className="py-3">
                  <p className="flex items-center justify-between"><Link to={pathFor(ROUTES.workflowEdit, { workflowId: workflow.id })} className="text-[13px] font-semibold text-brand hover:underline">{workflow.code} · {workflow.name}</Link><StatusPill tone={WORKFLOW_TONE[workflow.status]}>{WORKFLOW_STATUSES[workflow.status]}</StatusPill></p>
                  <p className="mt-1 text-on-surface-variant">{workflow.delayLabel} after the visit · {workflow.branch?.name ?? 'All branches'} · {workflow.template ? `${workflow.template.code} by ${CHANNELS[workflow.template.channel]}` : 'No template'} · at most {workflow.weeklyCap} a week per person</p>
                  {workflow.problems.length > 0 && <p className="mt-1 text-amber-700">{workflow.problems.join(' ')}</p>}
                  <p className="mt-1 text-outline">Last 7 days: {workflow.lastWeek.queued} sent · {workflow.lastWeek.skipped} skipped</p>
                </li>))}</ul>
            )}
            {manage && <ActionButton className="mt-4" variant="brand" to={`${ROUTES.workflowNew}?trigger=review_request`}>Create review-request workflow →</ActionButton>}
          </Section>
          <Section title="Recent requests" aside={requests[0] ? requests[0].code : 'None'}>
            {!requests[0] ? <p className="text-xs text-outline">Entries appear once a review-request workflow is on.</p> : !runs.data ? <LoadingState label="Loading…" error={runs.error} /> : (
              <ul className="space-y-2 text-xs">{runs.data.data.map((run) => <li key={run.id} className="flex justify-between gap-3"><span>{when(stampOf(run.createdAt))} · {run.patient?.fullName ?? 'Patient'}</span><span className={run.outcome === 'queued' ? 'text-brand' : 'text-outline'}>{run.outcome === 'queued' ? 'Request queued' : run.skipLabel}</span></li>)}{!runs.data.data.length && <li className="text-outline">No completed visits have come due yet.</li>}</ul>
            )}
            <Link to={ROUTES.workflowExecutions} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">All workflow events →</Link>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Message preview" aside="Example values">
            {active?.template ? <p className="rounded-xl bg-surface-low p-4 text-sm leading-6">{renderTemplate(active.template.body, { ...EXAMPLE, review_link: link ?? '{{review_link}}' })}</p> : <p className="text-xs text-outline">Switch a review-request workflow on to preview its message.</p>}
          </Section>
          <Section title="Readiness" aside={profile.data?.branch.name ?? ''}>
            <ul className="space-y-2 text-xs">
              <li className={link ? 'text-brand' : 'text-amber-700'}>{link ? '✓' : '—'} Public review link {link ? <span className="break-all text-outline">· {link}</span> : '· add it on the Business Profile screen'}</li>
              <li className={active ? 'text-brand' : 'text-amber-700'}>{active ? '✓' : '—'} A review-request workflow is on</li>
              <li className="text-on-surface-variant">Each person needs recorded permission for the channel; without it the visit is skipped and the reason recorded.</li>
            </ul>
            <ActionButton className="mt-4" to={ROUTES.businessProfile}>Business profile</ActionButton>
          </Section>
        </div>
      </div>
      <GrowthFooter back={{ to: ROUTES.reviews, label: 'Back to reviews' }} />
    </GrowthFrame>
  )
}
