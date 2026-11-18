import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { Check, OptionSelect, PatientStrip, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES, REFERRAL_MODELS, REFERRAL_PRIORITIES } from '../data/catalog'
import { formatDate, formatTime } from '../format'
import { slaState } from '../selectors'
import { validateFollowUp, validateInbound, validateReferral } from '../validation'

function Section({ title, aside, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center justify-between text-xs font-semibold tracking-wide text-brand uppercase">{title}{aside && <span className="font-normal text-outline normal-case">{aside}</span>}</h3>
      {children}
    </section>
  )
}

// Choosing "outside" asks for the clinician or facility by hand.
const EXTERNAL = 'external'
const BLANK = { targetId: '', facility: '', contact: '', specialty: '', priority: REFERRAL_PRIORITIES[1].label, model: REFERRAL_MODELS[0], indication: '', narrative: '', question: '', questions: [], records: [] }

// Outbound referral composer. `targets` are the clinic's therapists; `records` are the chart items that can
// travel with the referral. `onCreate` receives the API request and returns the call.
export function CreateReferralDrawer({ open, onClose, patient, encounter, records, targets = [], onCreate }) {
  const [values, setValues] = useState({ ...BLANK, records: records.map((entry) => entry.id) })
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const external = values.targetId === EXTERNAL
  const target = targets.find((entry) => entry.id === values.targetId)
  const destination = external ? values.facility.trim() : values.targetId
  const errors = submitted
    ? { ...validateReferral({ target: destination, priority: values.priority, indication: values.indication, narrative: values.narrative }), ...(external && !values.specialty.trim() ? { specialty: 'Give the specialty.' } : {}) }
    : {}

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const finish = () => {
    setValues({ ...BLANK, records: records.map((entry) => entry.id) })
    setSubmitted(false)
    setServerError('')
    onClose()
  }
  const addQuestion = () => {
    if (!values.question.trim()) return
    setValues((current) => ({ ...current, questions: [...current.questions, current.question.trim()], question: '' }))
  }

  const submit = async () => {
    setSubmitted(true)
    if (Object.keys(errors).length || !destination || (external && !values.specialty.trim())) return
    const route = external
      ? { facility: values.facility.trim(), facilityNote: [values.contact.trim(), values.specialty.trim() && `(${values.specialty.trim()})`].filter(Boolean).join(' ') }
      : { targetPractitionerId: target.id }
    try {
      await onCreate({
        direction: 'outgoing',
        ...(encounter?.status === 'In Progress' ? { encounterId: encounter.id } : {}),
        ...route,
        priority: values.priority,
        model: values.model,
        specialty: external ? values.specialty.trim() : target.specialty,
        indication: values.indication.trim(),
        narrative: values.narrative.trim(),
        questions: values.questions,
        attachedRecords: records.filter((entry) => values.records.includes(entry.id)).map((entry) => entry.label),
      })
      finish()
    } catch (error) {
      setServerError(error.message)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Referral requisition"
      title="Create Outbound Clinical Referral"
      description="Authoritative clinical handoff, specialist routing, and diagnostic referral requisition."
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={finish}>Cancel / Discard</ActionButton><ActionButton variant="primary" onClick={submit}>Create &amp; Authorize Referral</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}
        <Section title="Inherited clinical context" aside="Zero data re-entry active">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-outline">Patient name & MRN</dt><dd className="font-semibold">{patient.name} · {patient.mrn}</dd></div>
            <div><dt className="text-outline">Originating encounter</dt><dd className="font-semibold">{encounter?.status === 'In Progress' ? encounter.reference : 'None (standalone referral)'}</dd></div>
            <div><dt className="text-outline">Originating branch & dept</dt><dd className="font-semibold">{encounter?.branch ?? patient.branch} · {encounter?.department ?? 'Clinic'}</dd></div>
            <div><dt className="text-outline">Referring clinician</dt><dd className="font-semibold">{encounter?.doctor ?? 'Attending clinician'}</dd></div>
          </dl>
        </Section>

        <Section title="Referral destination & provider routing" aside="* Required">
          <OptionSelect label="Target specialist or service directory" required value={values.targetId} onChange={(event) => set('targetId', event.target.value)} error={external ? undefined : errors.target} placeholder="Choose a specialist or facility" options={[...targets.map((entry) => ({ value: entry.id, label: `${entry.displayName} — ${entry.specialty} (this clinic)` })), { value: EXTERNAL, label: 'Outside clinician or facility…' }]} />
          {target && <div className="mt-3 rounded-md border-2 border-brand p-3 text-xs"><p className="text-sm font-semibold">{target.displayName} <StatusPill tone="success">This clinic</StatusPill></p><p className="text-on-surface-variant">{target.specialty} · {[target.department, target.room].filter(Boolean).join(' · ')}</p></div>}
          {external && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextInput label="Facility" required value={values.facility} onChange={(event) => set('facility', event.target.value)} error={errors.target} />
              <TextInput label="Specialty" required value={values.specialty} onChange={(event) => set('specialty', event.target.value)} error={errors.specialty} />
              <TextInput label="Clinician or department (optional)" value={values.contact} onChange={(event) => set('contact', event.target.value)} className="sm:col-span-2" />
            </div>
          )}
          <div className="mt-3"><OptionSelect label="Referral clinical priority / acuity tier" required value={values.priority} onChange={(event) => set('priority', event.target.value)} error={errors.priority} options={REFERRAL_PRIORITIES.map((entry) => ({ value: entry.label, label: entry.label }))} /></div>
        </Section>

        <Section title="Clinical reason, indication & requested services">
          <p className="mb-1.5 text-[13px] font-semibold">Referral engagement model</p>
          <div role="group" aria-label="Engagement model" className="mb-4 flex flex-wrap gap-2">{REFERRAL_MODELS.map((entry) => <button key={entry} type="button" aria-pressed={values.model === entry} onClick={() => set('model', entry)} className={cn('rounded-md border px-3 py-1.5 text-xs', values.model === entry ? 'border-brand bg-brand text-white' : 'border-slate-200')}>{entry}</button>)}</div>
          <div className="flex flex-col gap-4">
            <TextInput label="Primary clinical indication / reason for referral" required value={values.indication} onChange={(event) => set('indication', event.target.value)} error={errors.indication} />
            <TextArea label="Structured clinical narrative & handoff summary" required rows={4} value={values.narrative} onChange={(event) => set('narrative', event.target.value)} error={errors.narrative} />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Specific clinical questions for specialist ({values.questions.length} added)</p>
              <ol className="mb-2 flex flex-col gap-1.5">{values.questions.map((entry, index) => <li key={entry} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-xs"><span>{index + 1}. {entry}</span><button type="button" aria-label={`Remove question ${index + 1}`} onClick={() => setValues((current) => ({ ...current, questions: current.questions.filter((item) => item !== entry) }))}><Trash2 className="size-3.5 text-outline" aria-hidden="true" /></button></li>)}</ol>
              <div className="flex gap-2"><TextInput label="Add a question" value={values.question} onChange={(event) => set('question', event.target.value)} className="min-w-72" /><ActionButton className="mt-6" onClick={addQuestion}>+ Add Question</ActionButton></div>
            </div>
          </div>
        </Section>

        <Section title="Bridge supporting clinical records" aside="Listed on the referral">
          {records.length === 0 && <p className="text-xs text-on-surface-variant">There are no chart records to attach.</p>}
          <ul className="flex flex-col gap-2">{records.map((entry) => <li key={entry.id}><Check checked={values.records.includes(entry.id)} onChange={(event) => setValues((current) => ({ ...current, records: event.target.checked ? [...current.records, entry.id] : current.records.filter((id) => id !== entry.id) }))} label={entry.label} /></li>)}</ul>
        </Section>
        <InfoNote><strong>Medico-legal boundary:</strong> creating a referral initiates a clinical consultation request. It does not automatically book an appointment, generate billing invoices, or transfer medical responsibility until formally acknowledged by the receiving provider.</InfoNote>
      </div>
    </Drawer>
  )
}

export function ReferralDetailDrawer({ referral, patient, onClose, onFollowUp }) {
  if (!referral) return null
  const sla = slaState(referral)
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${referral.reference} · ${referral.direction}`}
      title={`Referral Detail · ${referral.reference}`}
      description={`${referral.specialty} · Dispatched ${formatDate(referral.date)}, ${formatTime(referral.time)}`}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Close</ActionButton>{referral.direction === 'Outgoing' && <ActionButton variant="primary" onClick={onFollowUp}>Follow Up</ActionButton>}</div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone="warning">{referral.status}</StatusPill>{sla && <StatusPill tone={sla.overdue ? 'danger' : 'info'}>{referral.sla.windowHours}h SLA · {sla.text}</StatusPill>}</div>
        <PatientStrip patient={patient} />
        <Section title="Routing destination & target specialist"><p className="text-sm font-semibold">{referral.facility}</p><p className="text-xs text-on-surface-variant">{referral.facilityNote}</p>{referral.priority && <p className="mt-2 text-xs font-semibold text-danger">Priority: {referral.priority}</p>}</Section>
        <Section title="Clinical indication & referral justification"><blockquote className="border-l-4 border-brand bg-surface-low p-3 text-sm italic">&ldquo;{referral.clinicalIndication}&rdquo;</blockquote>{referral.questions?.length > 0 && <ol className="mt-3 list-decimal pl-5 text-xs">{referral.questions.map((entry) => <li key={entry}>{entry}</li>)}</ol>}</Section>
        <Section title="Bridged supporting clinical records" aside={`${referral.attachments} attached`}>
          {referral.attachedRecords?.length ? <ul className="flex flex-col gap-1.5 text-xs">{referral.attachedRecords.map((entry) => <li key={entry} className="rounded border border-slate-200 px-3 py-2">{entry}</li>)}</ul> : <p className="text-xs text-on-surface-variant">{referral.attachments} document{referral.attachments === 1 ? '' : 's'} attached to this referral.</p>}
        </Section>
        <Section title="Chronological activity log">
          <Timeline events={[...referral.log.map((entry) => ({ time: entry.time, title: entry.title, detail: entry.text })), { time: `${formatDate(referral.date)}, ${formatTime(referral.time)}`, title: 'Referral drafted & clinically authorized', detail: referral.direction === 'Outgoing' ? `Authorized by ${referral.clinician}` : `Received from ${referral.clinician}` }]} />
        </Section>
      </div>
    </Drawer>
  )
}

export function FollowUpDrawer({ referral, onClose, onSave, onReroute }) {
  const [values, setValues] = useState({ method: 'phone', representative: '', phone: '', outcome: '', notes: '', staff: '' })
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  if (!referral) return null
  const sla = slaState(referral)
  const errors = submitted ? validateFollowUp(values) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(validateFollowUp(values)).length) return
    try {
      await onSave(referral.id, { method: values.method, outcome: values.outcome, representative: values.representative.trim(), staff: values.staff.trim(), notes: values.notes.trim() })
      onClose()
    } catch (error) {
      setServerError(error.message)
    }
  }
  const reroute = async () => {
    try {
      await onReroute(referral.id)
      onClose()
    } catch (error) {
      setServerError(error.message)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Referral ${referral.reference}`}
      title="Follow Up with Receiving Center"
      description={`${referral.specialty} · ${referral.facility}`}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Cancel / Discard</ActionButton><div className="flex gap-2"><ActionButton variant="danger" onClick={reroute}>Re-route to Backup Specialist</ActionButton><ActionButton variant="primary" onClick={save}>Save Follow-Up &amp; Update Ledger</ActionButton></div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}
        <section className="rounded-md border-l-4 border-brand bg-surface-lowest p-4 text-xs"><p className="font-semibold text-sm">{referral.facility}</p><p className="text-on-surface-variant">{referral.facilityNote}</p>{sla && <p className={cn('mt-2 font-semibold', sla.overdue ? 'text-danger' : 'text-brand')}>Response window {referral.sla.windowHours}h · {referral.sla.elapsedHours}h elapsed · {sla.text}</p>}</section>
        <Section title="Communication history & audit trail"><Timeline events={referral.log.map((entry) => ({ time: entry.time, title: entry.title, detail: entry.text }))} /></Section>
        <Section title="Log follow-up interaction">
          <p className="mb-1.5 text-[13px] font-semibold">1. Contact method <span className="text-rose-500">*</span></p>
          <div role="radiogroup" aria-label="Contact method" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{FOLLOW_UP_METHODS.map((entry) => <RadioCard key={entry.id} name="method" value={entry.id} checked={values.method === entry.id} onChange={() => set('method', entry.id)} title={entry.title} detail={entry.detail} />)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Receiving representative name & title" required value={values.representative} onChange={(event) => set('representative', event.target.value)} error={errors.representative} />
            <TextInput label="Direct extension / phone" value={values.phone} onChange={(event) => set('phone', event.target.value)} />
            <TextInput label="Recording staff member" required value={values.staff} onChange={(event) => set('staff', event.target.value)} error={errors.staff} />
          </div>
          <p className="mt-4 mb-1.5 text-[13px] font-semibold">3. Contact outcome & clinical disposition <span className="text-rose-500">*</span></p>
          <div role="radiogroup" aria-label="Contact outcome" className="flex flex-col gap-2">{FOLLOW_UP_OUTCOMES.map((entry) => <RadioCard key={entry.id} name="outcome" value={entry.id} checked={values.outcome === entry.id} onChange={() => set('outcome', entry.id)} title={entry.title} detail={entry.detail} />)}</div>
          {errors.outcome && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.outcome}</p>}
          <div className="mt-4"><TextArea label="4. Conversation record & clinical notes" required rows={3} value={values.notes} onChange={(event) => set('notes', event.target.value)} error={errors.notes} /></div>
        </Section>
      </div>
    </Drawer>
  )
}

export function InboundReferralDrawer({ referral, onClose, onAccept, onDecline }) {
  const [checks, setChecks] = useState(() => referral?.checklist?.map(() => false) ?? [])
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  if (!referral) return null
  const error = submitted ? validateInbound({ checks }).checks : null

  const decide = async (decision) => {
    try {
      await (decision === 'accept' ? onAccept : onDecline)(referral.id)
      onClose()
    } catch (failure) {
      setServerError(failure.message)
    }
  }
  const accept = () => {
    setSubmitted(true)
    if (Object.keys(validateInbound({ checks })).length) return
    decide('accept')
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Referral triage · ${referral.reference}`}
      title="Review Inbound Referral"
      description={`Received ${formatDate(referral.date)}, ${formatTime(referral.time)}`}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton variant="danger" onClick={() => decide('decline')}>Decline Referral</ActionButton><ActionButton variant="brand" onClick={accept}>Accept Referral</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}
        <div className="flex flex-wrap gap-2"><StatusPill tone="info">Awaiting Clinical Review</StatusPill>{referral.priority && <StatusPill tone="danger">{referral.priority}</StatusPill>}</div>
        <Section title="1. Referral source & routing"><dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-outline">Referring clinician & origin</dt><dd className="font-semibold">{referral.clinician}</dd><dd className="text-on-surface-variant">{referral.clinicianNote}</dd></div><div><dt className="text-outline">Requested branch & attending</dt><dd className="font-semibold">{referral.facility}</dd><dd className="text-on-surface-variant">{referral.facilityNote}</dd></div></dl></Section>
        <Section title="3. Referral summary & clinical indication"><blockquote className="border-l-4 border-brand bg-surface-low p-3 text-sm leading-6">{referral.clinicalIndication}</blockquote></Section>
        <Section title="4. Attached documents & clinical dossier" aside={`${referral.attachments} listed`}>{referral.attachedRecords?.length ? <ul className="flex flex-col gap-1.5 text-xs">{referral.attachedRecords.map((entry) => <li key={entry} className="rounded border border-slate-200 px-3 py-2">{entry}</li>)}</ul> : <p className="text-xs text-on-surface-variant">No documents were listed with this referral.</p>}</Section>
        <Section title="5. Clinical review checklist" aside={`${checks.filter(Boolean).length} of ${checks.length} criteria verified`}>
          <ul className="flex flex-col gap-2">{referral.checklist.map((item, index) => <li key={item}><Check checked={checks[index]} onChange={(event) => setChecks((current) => current.map((value, position) => (position === index ? event.target.checked : value)))} label={item} /></li>)}</ul>
          {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
        </Section>
        <InfoNote>Acceptance confirms clinical intake responsibility only. It does not auto-book appointments or generate invoices.</InfoNote>
      </div>
    </Drawer>
  )
}
