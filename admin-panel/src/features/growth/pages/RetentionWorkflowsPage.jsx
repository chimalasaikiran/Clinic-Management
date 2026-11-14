import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, OWNERS, WORKFLOW_CATEGORIES } from '../constants'
import { useGrowth } from '../context/growthContext'

export default function RetentionWorkflowsPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const needle = filters.get('q').trim().toLowerCase()
  const rows = data.workflows
    .filter((workflow) => (!filters.get('category') || workflow.category === filters.get('category')) && (!filters.get('owner') || workflow.owner === filters.get('owner')))
    .filter((workflow) => !needle || `${workflow.name} ${workflow.id}`.toLowerCase().includes(needle))
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Retention & Reminder Workflows" code="GO-27" title="Retention & Reminder Workflows" description="Manage routine reminders and permitted follow-up definitions. Review readiness before activation." badge={<StatusPill tone="warning">Local definitions · inactive</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Category / status / owner filters and search are kept in the address · Scroll anchor retained']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Definition readiness only — no actual execution or next run" className="mb-6">No verified production channel, consent, patient identity or branch authorization. These {data.workflows.length} definitions are local baselines. No recipient counts, conversion rates, runs or receipts are supplied. The review-request workflow in GO-18 stays Disabled.</Banner>
      <Section title="Find workflows" aside="Workflow config / scheduler / event bus / RBAC" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search workflows" placeholder="Search name or workflow ID" className="self-end" /><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Category" value={filters.get('category')} onChange={(value) => filters.change('category', value)} options={[['', 'All categories'], ...WORKFLOW_CATEGORIES]} /><FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...OWNERS]} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><ActionButton variant="brand" icon={Plus} to={ROUTES.workflowNew} state={state}>Create workflow → GO28</ActionButton><ActionButton onClick={filters.reset}>Clear filters</ActionButton><Link to={ROUTES.workflowExecutions} className="text-xs font-semibold text-brand hover:underline">Execution & exceptions → GO29</Link></div>
      </Section>

      <Section title="Workflow register" aside={`${rows.length} definitions · no sends from this register`} className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Workflow / branch / owner', 'Category & proposed trigger', 'Template / proposed channel', 'Local state / readiness exception', 'Next known run'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((workflow) => {
            const template = data.messageTemplates.find((entry) => entry.id === workflow.templateId)
            return (
              <tr key={workflow.id} className="border-t border-slate-100 align-top">
                <td className="px-6 py-4"><Link to={pathFor(ROUTES.workflowEdit, { workflowId: workflow.id })} state={state} className="font-semibold text-brand hover:underline">{workflow.name}</Link><br /><strong>{workflow.id} · v{workflow.version}</strong><br />{workflow.branch} · {GROWTH_BRANCH.code}<br />{workflow.owner}</td>
                <td className="px-6 py-4">{workflow.category}<br /><span className="text-on-surface-variant">{workflow.trigger}</span></td>
                <td className="px-6 py-4">{template ? `${template.id} v${template.version}` : 'Not selected — required'}<br />{template?.locale.split(' · ')[1]}<br /><span className="text-outline">{workflow.channel ? `${workflow.channel} proposed` : 'Channel not selected — setup required'}</span></td>
                <td className="px-6 py-4">{workflow.status}<br /><span className="text-on-surface-variant">{workflow.readiness}</span></td>
                <td className="px-6 py-4">Not scheduled —<br />workflow is inactive</td>
              </tr>)
          })}</tbody>
        </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No workflows match these filters.</p>}</div>
        <p className="mt-3 flex flex-wrap justify-between gap-3 text-[11px] text-outline"><span>Restores filters, search, branch and the selected record on return.</span><span><Link to={ROUTES.messageTemplates} className="font-semibold text-brand hover:underline">Message templates → GO23</Link> · <Link to={ROUTES.channels} className="font-semibold text-brand hover:underline">Channels → GO25</Link></span></p>
      </Section>
      <GrowthFooter code="GO-27" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
