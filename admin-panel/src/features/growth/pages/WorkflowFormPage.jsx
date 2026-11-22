import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check, OptionSelect } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { TRIGGER_UNIT, TRIGGERS, WORKFLOW_STATUSES, WORKFLOW_TONE } from '../campaignsView'
import { renderTemplate, templateVariables } from '../growthLogic'
import { messagingApi } from '../messagingApi'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

// Filled for each event; the rest need a fixed value.
const EVENT_VARIABLES = { no_show: ['appointment_date', 'appointment_time'], lead_not_booked: ['service_name'], revisit_due: ['appointment_date', 'appointment_time'], review_request: ['appointment_date', 'appointment_time', 'review_link'] }
const AUTOMATIC = ['preferred_name', 'clinic_name']
const EXAMPLE = { preferred_name: 'Ananya', clinic_name: 'your clinic', appointment_date: '27 Nov 2026', appointment_time: '10:30 am', service_name: 'knee physiotherapy', review_link: 'https://g.page/r/your-branch/review' }
const SAFEGUARDS = ['Only events that fall due after switching on are acted on, never history.', 'Each person is checked for an opt-out, channel permission and the weekly limit before the message is queued.', 'A patient who has booked again, or a lead already converted or closed, is skipped and the reason recorded.', 'Nothing is queued between 9 pm and 9 am; it waits until morning.']

export default function WorkflowFormPage() {
  const { workflowId } = useParams()
  const workflow = useApiResource(() => (workflowId ? campaignsApi.workflow(workflowId) : Promise.resolve(null)), `workflow-form:${workflowId ?? 'new'}`)
  if (workflowId && workflow.error?.status === 404) {
    return (
      <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows' }} crumb="Owner Panel / Growth OS / Workflows" code="GO-28" title="Workflow not found" sample="Live records">
        <Banner tone="warning" title="No workflow matches this link">Open the workflow register to find it.</Banner>
      </GrowthFrame>
    )
  }
  if (workflowId && !workflow.data) {
    return (
      <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows' }} crumb="Owner Panel / Growth OS / Workflows" code="GO-28" title="Edit Retention Workflow" sample="Live records">
        <LoadingState label="Loading the workflow…" error={workflow.error} onRetry={workflow.reload} />
      </GrowthFrame>
    )
  }
  return <WorkflowForm key={`${workflowId ?? 'new'}:${workflow.data?.version ?? 0}`} workflow={workflow.data} reload={workflow.reload} />
}

function WorkflowForm({ workflow, reload }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { can, organisation } = useAuth()
  const context = useLeadContext()
  const [params] = useSearchParams()
  const owners = useApiResource(() => campaignsApi.owners(), 'campaign-owners').data ?? []
  const templates = useApiResource(() => messagingApi.templates(), 'templates').data ?? []
  const orgWide = organisation?.branchScope === 'all'
  const trigger0 = workflow?.trigger ?? (TRIGGERS[params.get('trigger')] ? params.get('trigger') : 'no_show')
  const unit0 = workflow && workflow.delayHours % 24 !== 0 ? 'hours' : workflow ? 'days' : TRIGGER_UNIT[trigger0]
  const [values, setValues] = useState({
    name: workflow?.name ?? '', trigger: trigger0, delay: workflow ? String(unit0 === 'days' ? workflow.delayHours / 24 : workflow.delayHours) : unit0 === 'days' ? '2' : '4', unit: unit0,
    branchId: workflow ? workflow.branch?.id ?? '' : context.branchId || (orgWide ? '' : context.branches[0]?.id ?? ''), ownerMembershipId: workflow?.owner.membershipId ?? '', templateId: workflow?.template?.id ?? '',
    variables: workflow?.variables ?? {}, weeklyCap: String(workflow?.weeklyCap ?? 2), changeNote: '',
  })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const active = workflow?.status === 'active'
  const editable = can('growth.manage') && !active
  const owner = values.ownerMembershipId || owners[0]?.membershipId || ''
  const template = templates.find((entry) => entry.id === values.templateId)
  const fixedNeeded = template ? templateVariables(template.body).filter((name) => !AUTOMATIC.includes(name) && !EVENT_VARIABLES[values.trigger].includes(name)) : []
  const delayHours = Number(values.delay) * (values.unit === 'days' ? 24 : 1)
  const backPath = `${ROUTES.workflows}${state?.search ?? ''}`
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const save = async () => {
    const local = {}
    if (!values.name.trim()) local.name = 'Enter a workflow name.'
    if (!(delayHours >= 1)) local.delayHours = 'Enter how long after the event to send.'
    if (!(Number(values.weeklyCap) >= 1 && Number(values.weeklyCap) <= 14)) local.weeklyCap = 'Use a whole number from 1 to 14.'
    setErrors(local)
    if (Object.keys(local).length) return
    setBusy(true)
    setMessage(null)
    const body = { name: values.name.trim(), trigger: values.trigger, delayHours, branchId: values.branchId || null, templateId: values.templateId || null, variables: Object.fromEntries(fixedNeeded.map((name) => [name, values.variables[name] ?? ''])), weeklyCap: Number(values.weeklyCap), ownerMembershipId: owner, changeNote: values.changeNote.trim() || null }
    try {
      const saved = workflow ? await campaignsApi.updateWorkflow(workflow.id, { ...body, version: workflow.version }) : await campaignsApi.createWorkflow(body)
      if (workflow) reload()
      else navigate(pathFor(ROUTES.workflowEdit, { workflowId: saved.id }), { state, replace: true })
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
      setBusy(false)
    }
  }
  const change = async (call, text) => {
    setBusy(true)
    setMessage(null)
    try {
      await call()
      reload()
    } catch (error) {
      setMessage({ tone: 'danger', title: text, text: error.message })
      setBusy(false)
    }
  }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Retention workflows · GO27 · Restore filters' }} crumb={`Owner Panel / Growth OS / Workflows / ${workflow ? `${workflow.code} / Edit` : 'New'}`} code="GO-28" title={workflow ? 'Edit Retention Workflow' : 'Create Retention Workflow'} description={workflow ? `${workflow.code} · Changes need the workflow to be off; switching it on is a separate, confirmed step.` : 'Define a workflow. It is saved switched off; nothing is sent until you switch it on.'} badge={<StatusPill tone={WORKFLOW_TONE[workflow?.status ?? 'draft']}>{WORKFLOW_STATUSES[workflow?.status ?? 'draft']}</StatusPill>} context={[context.line, 'Return keeps the register filters']} today={context.today} sample="Live records · Messages go through the connected channels with the same checks as the inbox">
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      {active && <Banner tone="brand" title="This workflow is on" className="mb-6">Pause it to change anything. Events that come due while it is paused are not sent later.</Banner>}
      {workflow?.changeNote?.startsWith('Paused automatically') && <Banner tone="warning" title="Paused by ClinicOS" className="mb-6">{workflow.changeNote}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Trigger & branch" aside={workflow ? `${workflow.code} · v${workflow.version}` : '* Required'}>
            <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Workflow name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <SelectInput label="Trigger" required value={values.trigger} onChange={(event) => { set('trigger', event.target.value); set('unit', TRIGGER_UNIT[event.target.value]) }} options={Object.entries(TRIGGERS).map(([value, label]) => ({ value, label }))} />
              <SelectInput label="Owner" required value={owner} onChange={(event) => set('ownerMembershipId', event.target.value)} options={owners.map((entry) => ({ value: entry.membershipId, label: entry.name }))} error={errors.ownerMembershipId} />
              <TextInput label="Send after" required inputMode="numeric" value={values.delay} onChange={(event) => set('delay', event.target.value.replace(/\D/g, ''))} error={errors.delayHours} hint={values.trigger === 'no_show' ? 'After the appointment is marked no-show' : values.trigger === 'lead_not_booked' ? 'After the lead was recorded, if still not converted' : values.trigger === 'review_request' ? 'After the completed visit; every visit is asked the same way' : 'After the completed visit'} />
              <SelectInput label="Unit" value={values.unit} onChange={(event) => set('unit', event.target.value)} options={[{ value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }]} />
              <SelectInput label="Branch" required value={values.branchId} onChange={(event) => set('branchId', event.target.value)} options={[...(orgWide ? [{ value: '', label: 'All branches' }] : []), ...context.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} error={errors.branchId} />
              <TextInput label="Weekly limit per person" inputMode="numeric" value={values.weeklyCap} onChange={(event) => set('weeklyCap', event.target.value.replace(/\D/g, ''))} error={errors.weeklyCap} hint="Automated messages in 7 days, counting broadcasts" />
            </fieldset>
          </Section>
          <Section title="Template & values" aside="Approved templates only send">
            <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><OptionSelect label="Message template" value={values.templateId} onChange={(event) => set('templateId', event.target.value)} placeholder="Not selected — required to switch on" options={templates.map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name} · ${CHANNELS[entry.channel]}${entry.status === 'approved' ? '' : ' (not approved)'}` }))} /></div>
              {fixedNeeded.map((name) => <TextInput key={name} label={name.replace(/_/g, ' ')} value={values.variables[name] ?? ''} onChange={(event) => set('variables', { ...values.variables, [name]: event.target.value })} hint={name === 'service_name' && values.trigger === 'lead_not_booked' ? 'Used when the lead has no recorded interest' : 'The same for everyone'} />)}
              {values.trigger === 'lead_not_booked' && template && templateVariables(template.body).includes('service_name') && <p className="text-[11px] text-outline sm:col-span-2">{'{{service_name}}'} is filled from the lead’s recorded interest.</p>}
              {workflow && <div className="sm:col-span-2"><TextInput label="Change note" value={values.changeNote} onChange={(event) => set('changeNote', event.target.value)} hint="Optional · kept with this version" /></div>}
            </fieldset>
          </Section>
          <Section title="Safeguards" aside="Applied on every run">
            <ul className="space-y-2 text-xs leading-5 text-on-surface-variant">{SAFEGUARDS.map((item) => <li key={item}>✓ {item}</li>)}</ul>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Message preview" aside="Example values">
            {template ? <><StatusPill>{template.code} v{template.version} · {CHANNELS[template.channel]}</StatusPill><p className="mt-3 rounded-md bg-teal-50 p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-brand">Example</strong>{renderTemplate(template.body, { ...EXAMPLE, ...values.variables })}</p><p className="mt-3 text-[11px] text-outline">Real messages use each person’s name and the event’s own date and time.</p></> : <p className="text-xs text-outline">Select a template to preview its message.</p>}
            <Link to={ROUTES.messageTemplates} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Message templates → GO23</Link>
          </Section>
          {workflow && <Section title="Readiness" aside={workflow.problems.length ? 'Not ready' : 'Ready'}>
            {workflow.problems.length ? <ul className="space-y-1 text-xs text-amber-700">{workflow.problems.map((problem) => <li key={problem}>• {problem}</li>)}</ul> : <p className="text-xs text-on-surface-variant">The template is approved, its channel is connected and every value is filled.</p>}
            <Link to={ROUTES.channels} className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">Channel setup → GO25</Link>
          </Section>}
          {workflow && can('growth.manage') && !active && confirming && <Section title="Switch on" aside="Confirm">
            <p className="text-xs leading-5">{TRIGGERS[workflow.trigger]} → {workflow.delayLabel} later, send {workflow.template?.code} by {workflow.template ? CHANNELS[workflow.template.channel] : '—'} at {workflow.branch?.name ?? 'all branches'}, at most {workflow.weeklyCap} a week per person.</p>
            <div className="mt-3"><Check checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} label="I confirm this workflow may send these messages automatically from now on." /></div>
            <ActionButton variant="brand" className="mt-3" disabled={!confirmed || busy} onClick={() => change(() => campaignsApi.activateWorkflow(workflow.id, workflow.version), 'Not switched on')}>Switch on</ActionButton>
          </Section>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{active ? 'On' : 'Save while off'}</strong>{active ? 'Pause to change the workflow.' : 'Saving keeps the workflow off. Switching on is a separate, confirmed step.'}</p>
        <ActionButton onClick={() => navigate(backPath)}>{workflow ? 'Back' : 'Cancel'}</ActionButton>
        {editable && <ActionButton variant="brand" disabled={busy} onClick={save}>{busy ? 'Saving…' : workflow ? 'Save changes' : 'Save draft'}</ActionButton>}
        {workflow && can('growth.manage') && !active && <ActionButton disabled={busy || workflow.problems.length > 0} title={workflow.problems.join(' ') || undefined} onClick={() => setConfirming(true)}>Activate</ActionButton>}
        {active && can('growth.manage') && <ActionButton disabled={busy} onClick={() => change(() => campaignsApi.pauseWorkflow(workflow.id, workflow.version), 'Not paused')}>Pause</ActionButton>}
      </div>
      <GrowthFooter code="GO-28" back={{ to: backPath, label: 'Retention workflows · GO27' }} />
    </GrowthFrame>
  )
}
