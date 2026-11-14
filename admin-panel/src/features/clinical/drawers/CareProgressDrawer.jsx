import { useState } from 'react'
import { BellRing } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { Toggle } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Check, FieldError, OptionSelect, TextArea } from '../../patients/components/parts'
import { formatDate, TODAY } from '../../patients/format'
import { ADHERENCE_STATUSES, BARRIERS, GOAL_STATUSES, NEXT_STEPS } from '../constants'
import { goalsOf, overdueDays, validateReview } from '../logic'

const GOAL_TONE = { 'Improving / On Target': 'bg-emerald-50 border-emerald-500 text-emerald-800', Achieved: 'bg-emerald-50 border-emerald-500 text-emerald-800', Unchanged: 'bg-amber-50 border-amber-500 text-amber-800', Worsening: 'bg-red-50 border-red-500 text-red-800', 'Unable to Assess': 'bg-slate-100 border-slate-400 text-slate-700' }

// Structured follow-up on a care plan: rate each goal, record adherence, assess, then save or complete the review.
export default function CareProgressDrawer({ plan, patient, onClose, onSave }) {
  const goals = goalsOf(plan)
  const [values, setValues] = useState({
    goalStatus: Object.fromEntries(goals.map((goal) => [goal.id, goal.status && goal.status !== 'Pending Baseline' ? goal.status : ''])),
    goalNote: Object.fromEntries(goals.map((goal) => [goal.id, goal.observation ?? ''])),
    adherence: plan.interventions.map((entry) => (ADHERENCE_STATUSES.includes(entry.state) ? entry.state : '')),
    adherenceNote: plan.interventions.map(() => ''),
    observation: '', barriers: [], nextStep: NEXT_STEPS[0], nextReview: '', escalate: false,
  })
  const [attempt, setAttempt] = useState(null)
  const errors = attempt ? validateReview(values, { complete: attempt === 'complete' }) : {}
  const overdue = overdueDays(plan.nextReview)

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const toggleBarrier = (barrier) => set('barriers', values.barriers.includes(barrier) ? values.barriers.filter((entry) => entry !== barrier) : [...values.barriers, barrier])

  const submit = (mode) => {
    setAttempt(mode)
    if (Object.keys(validateReview(values, { complete: mode === 'complete' })).length) return
    onSave({ ...values, adherence: values.adherence.map((entry, index) => entry || plan.interventions[index].state) }, { complete: mode === 'complete', escalate: mode === 'escalate' || values.escalate })
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Clinical workflow · Progress record"
      title="Record Care Plan Progress"
      description={`Evaluating active clinical targets and intervention adherence for ${patient.name} (UHID: ${patient.mrn}).`}
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-danger hover:underline">Discard Changes</button>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => submit('save')}>Save Progress</ActionButton>
            <ActionButton variant="brand" onClick={() => submit('escalate')}>Escalate for Attending Review</ActionButton>
            <ActionButton variant="primary" onClick={() => submit('complete')}>Complete Follow-up &amp; Update History</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <dl className="grid gap-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs sm:grid-cols-2">
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Assigned attending clinician</dt><dd className="mt-1 font-semibold">{plan.lead}</dd><dd className="text-outline">{plan.title}</dd></div>
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Follow-up due</dt><dd className="mt-1 font-semibold">{formatDate(plan.nextReview)}</dd>{overdue > 0 && <dd><StatusPill tone="warning">{overdue} {overdue === 1 ? 'day' : 'days'} overdue</StatusPill></dd>}</div>
        </dl>

        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold"><span><span className="mr-2 rounded bg-surface-low px-1.5 py-0.5 text-[10px]">1</span>Structured goal progress evaluation</span><span className="text-[11px] font-normal text-outline">{goals.length} active care targets</span></h3>
          <div className="flex flex-col gap-3">
            {goals.map((goal, index) => (
              <fieldset key={goal.id} className="rounded-md border border-slate-200 p-4">
                <legend className="px-1 text-[13px] font-semibold">Goal {index + 1}: {goal.title}</legend>
                <p className="text-[11px] text-outline">Target: {goal.target}{goal.cadence ? ` · ${goal.cadence}` : ''}</p>
                <div role="radiogroup" aria-label={`Status of ${goal.title}`} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {GOAL_STATUSES.map((status) => {
                    const selected = values.goalStatus[goal.id] === status
                    return <button key={status} type="button" role="radio" aria-checked={selected} onClick={() => setValues((current) => ({ ...current, goalStatus: { ...current.goalStatus, [goal.id]: status } }))} className={`rounded border px-2 py-2 text-[11px] font-medium ${selected ? GOAL_TONE[status] : 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-lowest'}`}>{status}</button>
                  })}
                </div>
                <div className="mt-3"><TextInput label="Clinician evaluator observation" value={values.goalNote[goal.id]} onChange={(event) => setValues((current) => ({ ...current, goalNote: { ...current.goalNote, [goal.id]: event.target.value } }))} /></div>
              </fieldset>
            ))}
          </div>
          <FieldError>{errors.goals}</FieldError>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold"><span className="mr-2 rounded bg-surface-low px-1.5 py-0.5 text-[10px]">2</span>Interventions &amp; adherence tracking</h3>
          <ul className="flex flex-col gap-3">
            {plan.interventions.map((entry, index) => (
              <li key={entry.title} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-[13px] font-semibold">{entry.title}<span className="block text-[11px] font-normal text-outline">{entry.detail}</span></p>
                  <select aria-label={`Adherence for ${entry.title}`} value={values.adherence[index]} onChange={(event) => set('adherence', values.adherence.map((current, at) => (at === index ? event.target.value : current)))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"><option value="">Select adherence</option>{ADHERENCE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold"><span className="mr-2 rounded bg-surface-low px-1.5 py-0.5 text-[10px]">3</span>Clinical assessment, barriers &amp; safeguards</h3>
          <TextArea label="General clinical progress observation" required rows={3} value={values.observation} onChange={(event) => set('observation', event.target.value)} error={errors.observation} />
          <fieldset className="mt-4"><legend className="mb-2 text-[13px] font-semibold">Barriers &amp; risk factors identified</legend><div className="grid gap-2 sm:grid-cols-2">{BARRIERS.map((barrier) => <Check key={barrier} checked={values.barriers.includes(barrier)} onChange={() => toggleBarrier(barrier)} label={barrier} />)}</div></fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OptionSelect label="Recommended next step" value={values.nextStep} onChange={(event) => set('nextStep', event.target.value)} options={NEXT_STEPS.map((step) => ({ value: step, label: step }))} />
            <TextInput label="Next scheduled review milestone" type="date" min={TODAY} value={values.nextReview} onChange={(event) => set('nextReview', event.target.value)} error={errors.nextReview} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
            <span className="flex items-start gap-2"><BellRing className="mt-0.5 size-4 text-outline" aria-hidden="true" /><span><strong className="block text-[13px]">Escalate to attending clinician ({plan.lead})</strong>Generates a priority clinical notification in the attending physician’s inbox.</span></span>
            <Toggle checked={values.escalate} onChange={(next) => set('escalate', next)} label="Escalate to attending clinician" />
          </div>
          <FieldError>{errors.escalate}</FieldError>
        </section>
      </div>
    </Drawer>
  )
}
