import { useState } from 'react'
import { CheckCircle2, ShieldCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Toggle } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useDraft } from '../../../lib/useDraft'
import FlowFrame, { BackLink, FlowMissing } from '../../patients/components/FlowFrame'
import { FieldError, FlowSection, KeyValueRows, OptionSelect, SideCard, TextArea } from '../../patients/components/parts'
import { usePatient } from '../../patients/context/usePatient'
import { CONDITIONS, DOCTORS } from '../../patients/data/catalog'
import { formatDate } from '../../patients/format'
import { CARE_CATEGORIES, DEFAULT_RED_FLAGS, GOAL_CADENCES, INTERVENTION_TYPES } from '../constants'
import { buildCarePlan, defaultDates, duplicatePlans, validateCarePlan, validateGoal, validateIntervention } from '../logic'

const BLANK_GOAL = { title: '', target: '', protocol: '', cadence: GOAL_CADENCES[0] }
const BLANK_INTERVENTION = { type: INTERVENTION_TYPES[0].id, title: '', due: '' }

// Writes a structured care plan for a patient. The form is kept as a draft until the plan is activated.
export default function CreateCarePlanPage() {
  const { patient, patientId, mine, add, records } = usePatient()
  const navigate = useNavigate()
  const diagnoses = mine('diagnoses').filter((entry) => entry.status === 'Active').filter((entry, index, all) => all.findIndex((other) => other.icd === entry.icd) === index)
  const plans = mine('carePlans')
  const draft = useDraft(`care-plan-draft:${patientId}`, {
    title: '', category: CARE_CATEGORIES[0], leadId: 'rahul-mehta', rationale: '', ...defaultDates(),
    diagnoses: diagnoses.map((entry) => ({ icd: entry.icd, name: entry.name })), goals: [], interventions: [], redFlags: DEFAULT_RED_FLAGS, whatsapp: true,
  })
  const values = draft.value
  const [goal, setGoal] = useState(null)
  const [goalErrors, setGoalErrors] = useState({})
  const [intervention, setIntervention] = useState(null)
  const [interventionErrors, setInterventionErrors] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [icdChoice, setIcdChoice] = useState('')

  if (!patient) return <FlowMissing patient={null} />

  const errors = attempted ? validateCarePlan(values) : {}
  const lead = DOCTORS.find((entry) => entry.id === values.leadId)
  const duplicates = duplicatePlans(plans, values)
  const set = (name, value) => draft.setValue((current) => ({ ...current, [name]: value }))
  const backTo = pathFor(ROUTES.patientRecords, { patientId })

  const addGoal = () => {
    const found = validateGoal(goal)
    setGoalErrors(found)
    if (Object.keys(found).length) return
    set('goals', [...values.goals, goal])
    setGoal(null)
  }
  const addIntervention = () => {
    const found = validateIntervention(intervention)
    setInterventionErrors(found)
    if (Object.keys(found).length) return
    set('interventions', [...values.interventions, { ...intervention, label: INTERVENTION_TYPES.find((entry) => entry.id === intervention.type).label }])
    setIntervention(null)
  }
  const attach = (icd) => {
    const condition = CONDITIONS.find((entry) => entry.icd === icd)
    if (condition && !values.diagnoses.some((entry) => entry.icd === icd)) set('diagnoses', [...values.diagnoses, { icd: condition.icd, name: condition.name }])
    setIcdChoice('')
  }

  const activate = () => {
    setAttempted(true)
    if (Object.keys(validateCarePlan(values)).length) return
    add('carePlans', buildCarePlan(values, { patientId, plans: records.carePlans, leadName: lead.short }))
    draft.clear()
    navigate(backTo)
  }

  return (
    <FlowFrame
      title="Create Care Plan"
      badge={<StatusPill tone="warning">Draft Plan · {draft.savedAt ? `Auto-saved ${draft.savedAt}` : 'Unsaved'}</StatusPill>}
      description="Formulate multi-disciplinary secondary prevention milestones, telemetry thresholds, and structured clinical reviews."
      actions={<BackLink to={backTo}>Cancel &amp; Return to Patient Clinical Records</BackLink>}
    >
      <p className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs"><strong className="text-sm">{patient.name}</strong><span>{patient.age}{patient.gender[0]} · {patient.mrn}</span><span className="text-on-surface-variant">ABHA: {patient.abha}</span><StatusPill tone="success">{patient.consent}</StatusPill></p>

      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-5">
          <FlowSection number="1" title="Plan focus & clinical architecture" aside="Mandatory medical record data">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Care plan title" required value={values.title} onChange={(event) => set('title', event.target.value)} error={errors.title} placeholder="Post-CABG Secondary Cardiovascular Prevention Plan" /></div>
              <OptionSelect label="Clinical category / care scope" required value={values.category} onChange={(event) => set('category', event.target.value)} error={errors.category} options={CARE_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} />
              <OptionSelect label="Responsible attending clinician" required value={values.leadId} onChange={(event) => set('leadId', event.target.value)} error={errors.leadId} options={DOCTORS.map((entry) => ({ value: entry.id, label: entry.name }))} />
            </div>
            <div className="mt-4">
              <p className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">Linked diagnoses / health concerns<span className="text-[11px] font-normal text-outline">Pulled from the patient’s active problem list</span></p>
              <ul className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-surface-lowest p-2">
                {values.diagnoses.map((entry) => <li key={entry.icd} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs"><span className="font-mono font-semibold">{entry.icd}</span>{entry.name}<button type="button" aria-label={`Remove ${entry.icd}`} onClick={() => set('diagnoses', values.diagnoses.filter((other) => other.icd !== entry.icd))} className="text-outline hover:text-danger"><X className="size-3" aria-hidden="true" /></button></li>)}
                <li className="ml-auto"><select aria-label="Attach ICD-10" value={icdChoice} onChange={(event) => attach(event.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"><option value="">+ Attach ICD-10</option>{CONDITIONS.filter((entry) => !values.diagnoses.some((other) => other.icd === entry.icd)).map((entry) => <option key={entry.icd} value={entry.icd}>{entry.icd} · {entry.name}</option>)}</select></li>
              </ul>
              <FieldError>{errors.diagnoses}</FieldError>
            </div>
            <div className="mt-4"><TextArea label="Clinical rationale & therapeutic objectives" required rows={4} value={values.rationale} onChange={(event) => set('rationale', event.target.value)} error={errors.rationale} /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <TextInput label="Start date" type="date" value={values.start} onChange={(event) => set('start', event.target.value)} error={errors.start} />
              <TextInput label="Interim review (30 days)" type="date" value={values.interim} onChange={(event) => set('interim', event.target.value)} error={errors.interim} />
              <TextInput label="Target completion (6 mo)" type="date" value={values.target} onChange={(event) => set('target', event.target.value)} error={errors.target} />
            </div>
          </FlowSection>

          <FlowSection number="2" title="Measurable goals & clinical targets" aside={<StatusPill tone="success">{values.goals.length} targets active</StatusPill>}>
            <ul className="flex flex-col gap-3">
              {values.goals.map((entry, index) => (
                <li key={`${entry.title}-${index}`} className="rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs">
                  <div className="flex items-start justify-between gap-3"><p className="text-[13px] font-semibold">{entry.title}</p><div className="flex items-center gap-2"><StatusPill tone="neutral">Pending Baseline</StatusPill><button type="button" aria-label={`Remove goal ${entry.title}`} onClick={() => set('goals', values.goals.filter((_, at) => at !== index))} className="text-outline hover:text-danger"><X className="size-3.5" aria-hidden="true" /></button></div></div>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-3"><div><dt className="text-outline">Target metric</dt><dd className="font-mono font-semibold">{entry.target}</dd></div><div><dt className="text-outline">Measurement protocol</dt><dd>{entry.protocol || 'Not specified'}</dd></div><div><dt className="text-outline">Evaluation cadence</dt><dd className="font-semibold">{entry.cadence}</dd></div></dl>
                </li>
              ))}
            </ul>
            {goal ? (
              <div className="mt-3 rounded-md border border-dashed border-brand p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Goal" required value={goal.title} onChange={(event) => setGoal({ ...goal, title: event.target.value })} error={goalErrors.title} />
                  <TextInput label="Target metric" required value={goal.target} onChange={(event) => setGoal({ ...goal, target: event.target.value })} error={goalErrors.target} />
                  <TextInput label="Measurement protocol" value={goal.protocol} onChange={(event) => setGoal({ ...goal, protocol: event.target.value })} />
                  <OptionSelect label="Evaluation cadence" value={goal.cadence} onChange={(event) => setGoal({ ...goal, cadence: event.target.value })} options={GOAL_CADENCES.map((entry) => ({ value: entry, label: entry }))} />
                </div>
                <div className="mt-3 flex justify-end gap-2"><ActionButton onClick={() => { setGoal(null); setGoalErrors({}) }}>Cancel</ActionButton><ActionButton variant="primary" onClick={addGoal}>Add goal</ActionButton></div>
              </div>
            ) : (
              <button type="button" onClick={() => { setGoal(BLANK_GOAL); setGoalErrors({}) }} className="mt-3 w-full rounded-md border border-dashed border-slate-300 py-2 text-xs font-semibold text-brand hover:bg-surface-lowest">+ Add Clinical Goal</button>
            )}
            <FieldError>{errors.goals}</FieldError>
          </FlowSection>

          <FlowSection number="3" title="Planned interventions & multidisciplinary actions" aside={`${values.interventions.length} interventions staged`}>
            <ul className="flex flex-col gap-3">
              {values.interventions.map((entry, index) => (
                <li key={`${entry.title}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs">
                  <span><span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">{entry.label}</span><strong className="text-[13px]">{entry.title}</strong>{entry.due && <span className="mt-1 block text-on-surface-variant">Due: {entry.due}</span>}</span>
                  <button type="button" aria-label={`Remove intervention ${entry.title}`} onClick={() => set('interventions', values.interventions.filter((_, at) => at !== index))} className="text-outline hover:text-danger"><X className="size-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
            {intervention ? (
              <div className="mt-3 rounded-md border border-dashed border-brand p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <OptionSelect label="Type" value={intervention.type} onChange={(event) => setIntervention({ ...intervention, type: event.target.value })} options={INTERVENTION_TYPES.map((entry) => ({ value: entry.id, label: entry.label }))} />
                  <TextInput label="Intervention" required value={intervention.title} onChange={(event) => setIntervention({ ...intervention, title: event.target.value })} error={interventionErrors.title} />
                  <TextInput label="Due / cadence" value={intervention.due} onChange={(event) => setIntervention({ ...intervention, due: event.target.value })} />
                </div>
                <div className="mt-3 flex justify-end gap-2"><ActionButton onClick={() => { setIntervention(null); setInterventionErrors({}) }}>Cancel</ActionButton><ActionButton variant="primary" onClick={addIntervention}>Add intervention</ActionButton></div>
              </div>
            ) : (
              <button type="button" onClick={() => { setIntervention(BLANK_INTERVENTION); setInterventionErrors({}) }} className="mt-3 w-full rounded-md border border-dashed border-slate-300 py-2 text-xs font-semibold text-brand hover:bg-surface-lowest">+ Add Intervention</button>
            )}
            <FieldError>{errors.interventions}</FieldError>
          </FlowSection>

          <FlowSection number="4" title="Patient education & self-management guidance" aside="Patient-facing output">
            <TextArea label="Mandatory red-flag symptoms for immediate clinic / ER presentation" rows={5} value={values.redFlags} onChange={(event) => set('redFlags', event.target.value)} />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs"><span><strong className="block text-[13px]">Patient communication &amp; tele-care channel</strong>Encrypted automated reminders, medication checklists and weekly telemetry prompts.</span><Toggle checked={values.whatsapp} onChange={(next) => set('whatsapp', next)} label="WhatsApp care channel enabled" /></div>
          </FlowSection>
        </div>

        <div className="flex flex-col gap-5 self-start">
          <SideCard title="Activation command">
            <KeyValueRows rows={[['Overall status', <StatusPill key="s" tone="warning">Draft (Pending Activation)</StatusPill>], ['Total goals', `${values.goals.length} defined targets`], ['Total interventions', `${values.interventions.length} staged`], ['Responsible care lead', lead?.short ?? '—'], ['Primary chamber', lead?.suite ?? '—']]} />
            <div className={`mt-4 rounded-md border p-3 text-xs ${duplicates.length ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-surface-lowest'}`}>
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />Clinical decision support: {duplicates.length ? 'REVIEW' : 'PASS'}</p>
              <p className="text-on-surface-variant">{duplicates.length ? `${duplicates.length} active care plan${duplicates.length === 1 ? '' : 's'} already cover this category (${duplicates.map((plan) => plan.id).join(', ')}). Confirm this plan adds to, rather than duplicates, the existing one.` : `No conflicting duplicate care plans were found for ${patient.name}.`}</p>
              <p className="mt-2 text-outline">{patient.consent} · ABDM care context linked to this patient record.</p>
            </div>
            <ActionButton variant="primary" icon={CheckCircle2} className="mt-4 w-full justify-center" onClick={activate}>Activate &amp; Link to Patient Record</ActionButton>
            <div className="mt-2 grid grid-cols-2 gap-2"><ActionButton onClick={() => draft.setValue((current) => ({ ...current }))}>Save Draft</ActionButton><ActionButton variant="danger" onClick={() => { draft.clear(); navigate(backTo) }}>Discard</ActionButton></div>
            <p className="mt-3 text-[11px] text-outline">{draft.restored ? 'Restored from your saved draft.' : 'Changes are saved as a draft automatically until the plan is activated.'}</p>
          </SideCard>
          <p className="px-1 text-xs text-on-surface-variant">Associated record: <strong>{patient.name}</strong> · started {formatDate(values.start)}</p>
        </div>
      </div>
    </FlowFrame>
  )
}
