import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { Check, OptionSelect } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CHANNEL_FORMATS, GROWTH_BRANCH, OWNERS, WORKFLOW_CATEGORIES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { renderTemplate, templateVariables, unknownVariables, validateWorkflow } from '../growthLogic'

const SAMPLE = { preferred_name: 'Sample recipient', appointment_date: '27 Oct 2026', appointment_time: '10:00 IST', service_name: 'a preventive health screening' }
const SAFEGUARDS = ['Verified shared identity and event branch within the branch access scope', 'Approved purpose and current channel-specific consent, plus an allowed recorded contact preference', 'Current opt-out, DND/jurisdiction and suppression checks; any block overrides an allowed preference', 'Eligible event/version and source permission verified; never infer consent from an appointment or phone']

export default function WorkflowFormPage() {
  const { workflowId } = useParams()
  const { data } = useGrowth()
  const workflow = workflowId ? data.workflows.find((entry) => entry.id === workflowId) : null
  if (workflowId && !workflow) {
    return (
      <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows' }} crumb="Owner Panel / Growth OS / Workflows" code="GO-28" title="Workflow not found">
        <Banner tone="warning" title="No workflow matches this link">Open the workflow register to find the definition.</Banner>
      </GrowthFrame>
    )
  }
  return <WorkflowForm key={workflowId ?? 'new'} workflow={workflow} />
}

function WorkflowForm({ workflow }) {
  const { data, add, update } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [values, setValues] = useState({ name: workflow?.name ?? '', category: workflow?.category ?? WORKFLOW_CATEGORIES[0], branch: workflow?.branch ?? GROWTH_BRANCH.name, owner: workflow?.owner ?? OWNERS[0], trigger: workflow?.trigger ?? '', templateId: workflow?.templateId ?? '', channel: workflow?.channel ?? '', cap: workflow?.cap ?? '', checks: workflow?.checks ?? [false, false, false, false] })
  const [attempted, setAttempted] = useState(false)
  const errors = attempted ? validateWorkflow(values) : {}
  const template = data.messageTemplates.find((entry) => entry.id === values.templateId)
  const unresolved = template ? unknownVariables(template.body) : []
  const capError = values.cap !== '' && !(Number(values.cap) >= 1 && Number.isInteger(Number(values.cap))) ? 'Use a whole number of messages (1 or more).' : undefined
  const backPath = `${ROUTES.workflows}${state?.search ?? ''}`
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const save = () => {
    setAttempted(true)
    if (Object.keys(validateWorkflow(values)).length || capError) return
    const fields = { ...values, name: values.name.trim(), trigger: values.trigger.trim(), status: 'Draft · inactive', readiness: 'Channel setup and template approval unverified; consent query required.' }
    if (workflow) update('workflows', workflow.id, { ...fields, version: workflow.version + 1 })
    else add('workflows', { id: `WF-NEW${String(data.workflows.filter((entry) => entry.id.startsWith('WF-NEW')).length + 1).padStart(2, '0')}`, version: 1, ...fields })
    navigate(backPath, { state })
  }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Retention workflows · GO27 · Restore filters & scroll' }} crumb={`Owner Panel / Growth OS / Workflows / ${workflow ? `${workflow.id} / Edit` : 'New'}`} code="GO-28" title={workflow ? 'Edit Retention Workflow' : 'Create Retention Workflow'} description={workflow ? `Configure ${workflow.id}, review exact gates and save a draft independently of activation or dispatch.` : 'Define a new workflow. Saving creates an inactive draft; nothing is sent.'} badge={<StatusPill tone="warning">Draft inactive</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Return keeps the register filters and the scroll anchor']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title={workflow ? `Saved v${workflow.version} stays Draft and inactive — no actual persistence evidence` : 'New workflows start as Draft and inactive'} className="mb-6">Quiet hours and caps are draft policy requiring approval. Saving never overwrites an active configuration or starts a run.</Banner>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Trigger & branch" aside="Workflow config / appointment service / event bus">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Workflow name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <SelectInput label="Category" required value={values.category} onChange={(event) => set('category', event.target.value)} options={WORKFLOW_CATEGORIES} />
              <SelectInput label="Owner" required value={values.owner} onChange={(event) => set('owner', event.target.value)} options={OWNERS} />
              <div className="sm:col-span-2"><TextInput label="Trigger · proposed mapping" required value={values.trigger} onChange={(event) => set('trigger', event.target.value)} error={errors.trigger} hint="Required source: appointment service event + appointment ID + version + branch + timezone." /></div>
            </div>
            <Banner tone="brand" title="No actual appointment event or patient is supplied" className="mt-4">Use only a legitimate permitted event. Validate datetime, confirmed status, version and branch mapping, and re-evaluate the current version immediately before dispatch.</Banner>
          </Section>
          <Section title="Template & channel" aside="Integration dependent">
            <div className="grid gap-4 sm:grid-cols-2"><OptionSelect label="Message template" value={values.templateId} onChange={(event) => set('templateId', event.target.value)} placeholder="Not selected — required" options={data.messageTemplates.map((entry) => ({ value: entry.id, label: `${entry.id} · ${entry.name}` }))} /><SelectInput label="Proposed channel" value={values.channel} onChange={(event) => set('channel', event.target.value)} options={['', ...CHANNEL_FORMATS]} hint="Channel setup is not verified" /><TextInput label="Routine-message cap per 7 days" inputMode="numeric" value={values.cap} onChange={(event) => set('cap', event.target.value.replace(/\D/g, ''))} error={capError} hint="Draft policy · requires approval" /></div>
          </Section>
          <Section title="Eligibility & contact safeguards" aside="Identity / consent / preference evidence">
            <div className="space-y-3">{SAFEGUARDS.map((item, index) => <Check key={item} checked={values.checks[index]} onChange={(event) => set('checks', values.checks.map((entry, position) => (position === index ? event.target.checked : entry)))} label={item} />)}</div>
            <p className="mt-3 text-[11px] text-outline">Ticking a safeguard records your review. It does not verify consent or activate the workflow.</p>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Message preview" aside="Synthetic · no recipient">
            {template ? <><StatusPill>{template.id} v{template.version} · {template.locale.split(' · ')[1]}</StatusPill><p className="mt-3 rounded-md bg-teal-50 p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-brand">Aura Health</strong>{renderTemplate(template.body, SAMPLE)}</p><p className="mt-3 text-[11px] text-outline">Sample recipient · 27 Oct 2026, 10:00 IST. Fully substituted synthetic values, not an appointment or identity record. No delivery status is claimed.</p></> : <p className="text-xs text-outline">Select a template to preview its message.</p>}
          </Section>
          <Section title="Variable validation" aside="Allowlist only">
            {template ? <p className="text-xs leading-5 text-on-surface-variant">Variables used: {templateVariables(template.body).map((name) => `{{${name}}}`).join(', ') || 'none'}.</p> : <p className="text-xs text-outline">No template selected.</p>}
            {unresolved.length > 0 && <Banner tone="danger" title="Unresolved variables block dispatch" className="mt-3">Required variable {unresolved[0]} is unresolved — sending blocked. Never substitute blanks or add sensitive variables.</Banner>}
            <Link to={ROUTES.messageTemplates} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Variable mapping & full body → GO23</Link>
          </Section>
          <Section title="Channel readiness"><p className="text-xs leading-5 text-on-surface-variant">{values.channel ? `${values.channel} is proposed but no branch connection is verified.` : 'No channel selected.'}</p><Link to={ROUTES.channels} className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">Channel / auth setup → GO25</Link></Section>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save draft</strong>Saving keeps the workflow inactive. Activation and dispatch are separate, gated actions.</p>
        <ActionButton onClick={() => navigate(backPath)}>Cancel</ActionButton>
        <ActionButton variant="brand" onClick={save}>Save draft</ActionButton>
        <ActionButton disabled title="Needs a verified channel and approved template">Activate</ActionButton>
      </div>
      <GrowthFooter code="GO-28" back={{ to: backPath, label: 'Retention workflows · GO27' }} />
    </GrowthFrame>
  )
}
