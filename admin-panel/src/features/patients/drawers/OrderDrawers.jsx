import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { PatientStrip, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { formatDate, formatTime } from '../format'
import { validateResultReview } from '../validation'

const OUTCOMES = [
  { id: 'action', title: 'Reviewed — Clinical Action Required', detail: 'Adjust medication, order follow-up diagnostics, or schedule a clinical consultation.' },
  { id: 'routine', title: 'Reviewed — Routine / Discuss at Next Visit', detail: 'No immediate action needed; the result will be discussed at the next scheduled visit.' },
  { id: 'normal', title: 'Reviewed — Normal / No Action Needed', detail: 'All parameters are within expected ranges; archive and notify the patient.' },
  { id: 'escalate', title: 'Escalate to Senior Consultant', detail: 'Refer the result to a senior consultant for review before any action.' },
]

function Section({ title, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">{title}</h3>
      {children}
    </section>
  )
}

const FLAG_TONE = { Normal: 'success', High: 'danger', Low: 'warning' }

// Result viewer; when the order still awaits review it also hosts the clinician sign-off.
export function ResultDrawer({ order, patient, onClose, onSign }) {
  const [values, setValues] = useState({ outcome: '', note: '' })
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  if (!order) return null
  const awaiting = order.status === 'Awaiting Review'
  const errors = submitted ? validateResultReview(values) : {}

  // Signing off also clears the alert the result raised on the chart (done by the server in one step).
  const sign = async () => {
    setSubmitted(true)
    if (Object.keys(validateResultReview(values)).length) return
    try {
      await onSign(order.id, { outcome: values.outcome, note: values.note.trim() })
      onClose()
    } catch (error) {
      setServerError(error.message)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${order.reference} · ${order.status}`}
      title={order.title}
      description={`${order.category} · Ordered ${formatDate(order.date)}, ${formatTime(order.time)} by ${order.ordering}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={() => window.print()}>Print slip</ActionButton>
          <div className="flex gap-2"><ActionButton onClick={onClose}>Cancel</ActionButton>{awaiting && <ActionButton variant="primary" onClick={sign}>Sign &amp; Acknowledge Result</ActionButton>}</div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}
        {order.findings && <InfoNote tone="warning" icon={AlertTriangle}><strong>{order.findings.headline}</strong><br />{order.findings.text}</InfoNote>}
        {order.analytes && (
          <Section title="Analyte results & longitudinal comparison">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Test</th><th className="pb-2">Current</th><th className="pb-2">Flag</th><th className="pb-2">Reference interval</th></tr></thead>
              <tbody>{order.analytes.map((row) => <tr key={row.name} className="border-t border-slate-100"><td className="py-2 font-medium">{row.name}</td><td className="py-2 font-mono font-semibold">{row.value} {row.unit}</td><td className="py-2"><StatusPill tone={FLAG_TONE[row.flag] ?? 'neutral'}>{row.flag}</StatusPill></td><td className="py-2 text-on-surface-variant">{row.range}</td></tr>)}</tbody>
            </table>
          </Section>
        )}
        {order.summary && !order.findings && <Section title="Results summary"><p className="text-sm">{order.summary}</p>{order.summaryTone && <p className="mt-1 text-xs font-semibold text-brand">{order.summaryTone}</p>}</Section>}
        {order.reviewedBy && <Section title="Review"><p className="text-sm">Reviewed by <strong>{order.reviewedBy}</strong> · {order.reviewedAt}</p>{order.reviewOutcome && <p className="mt-1 text-xs text-on-surface-variant">{OUTCOMES.find((entry) => entry.id === order.reviewOutcome)?.title}: {order.reviewNote}</p>}</Section>}

        {awaiting && (
          <Section title="Clinician acknowledgement protocol">
            <div role="radiogroup" aria-label="Clinical assessment outcome" className="flex flex-col gap-2">
              {OUTCOMES.map((entry) => <RadioCard key={entry.id} name="outcome" value={entry.id} checked={values.outcome === entry.id} onChange={() => setValues((current) => ({ ...current, outcome: entry.id }))} title={entry.title} detail={entry.detail} />)}
            </div>
            {errors.outcome && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.outcome}</p>}
            <div className="mt-4"><TextArea label="Clinician note & management directive" required rows={3} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} /></div>
          </Section>
        )}
        <InfoNote tone="brand" icon={ShieldCheck}><strong>Statutory clinical summary:</strong> review confirms clinical awareness only. It does not alter the longitudinal problem list or generate billing.</InfoNote>
      </div>
    </Drawer>
  )
}

export function SpecimenDrawer({ order, patient, onClose }) {
  if (!order?.specimen) return null
  const { specimen } = order
  return (
    <Drawer open onClose={onClose} eyebrow={`${order.reference} · Laboratory chain-of-custody`} title="Specimen tracking" description={order.title} width="max-w-2xl" footer={<ActionButton onClick={onClose}>Close (Esc)</ActionButton>}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone="warning">Specimen collected</StatusPill><StatusPill>Order {order.reference}</StatusPill></div>
        <PatientStrip patient={patient} />
        <Section title="Active specimen">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-outline">Specimen accession identifier</dt><dd className="font-mono font-semibold">{specimen.accession}</dd></div>
            <div><dt className="text-outline">Assigned tests</dt><dd className="font-semibold">{specimen.tests.join(' · ')}</dd></div>
            <div><dt className="text-outline">Collected by</dt><dd className="font-semibold">{specimen.collectedBy}</dd></div>
            <div><dt className="text-outline">Collected at</dt><dd className="font-semibold">{specimen.collectedAt}</dd></div>
            <div className="sm:col-span-2"><dt className="text-outline">Destination</dt><dd className="font-semibold">{specimen.destination}</dd></div>
          </dl>
          <p className="mt-3 rounded bg-surface-low p-3 text-xs text-on-surface-variant">{specimen.note}</p>
          <p className="mt-2 text-xs text-on-surface-variant">Estimated turnaround: <strong className="text-on-surface">{specimen.turnaround}</strong></p>
        </Section>
        <Section title="Chain-of-custody & verification audit"><Timeline events={specimen.events} /></Section>
        <InfoNote tone="warning">The result appears on the order once the laboratory reports it and it is entered.</InfoNote>
      </div>
    </Drawer>
  )
}

const FLAGS = [
  { id: 'normal', title: 'Normal', detail: 'Within the expected range; no alert is raised.' },
  { id: 'abnormal', title: 'Abnormal', detail: 'Outside the expected range; raises a high-severity alert until a clinician reviews it.' },
  { id: 'critical', title: 'Critical', detail: 'Needs urgent attention; raises a critical alert until a clinician reviews it.' },
]

// Enters the result reported by the laboratory or imaging service.
export function ResultEntryDrawer({ order, patient, onClose, onSave }) {
  const [values, setValues] = useState({ summary: '', flag: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  if (!order) return null

  const save = async () => {
    const found = {}
    if (!values.summary.trim()) found.summary = 'Enter the result.'
    if (!values.flag) found.flag = 'Choose whether the result is normal, abnormal or critical.'
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      await onSave(order.id, { summary: values.summary.trim(), flag: values.flag })
      onClose()
    } catch (error) {
      setServerError(error.message)
    }
  }

  return (
    <Drawer open onClose={onClose} eyebrow={`${order.reference} · ${order.status}`} title="Enter result" description={order.title} width="max-w-2xl" footer={<div className="flex justify-between gap-3"><ActionButton onClick={onClose}>Cancel</ActionButton><ActionButton variant="primary" onClick={save}>Save Result</ActionButton></div>}>
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}
        <Section title="Reported result">
          <TextArea label="Result and key findings" required rows={4} value={values.summary} onChange={(event) => setValues((current) => ({ ...current, summary: event.target.value }))} error={errors.summary} />
        </Section>
        <Section title="Result flag">
          <div role="radiogroup" aria-label="Result flag" className="flex flex-col gap-2">
            {FLAGS.map((entry) => <RadioCard key={entry.id} name="flag" value={entry.id} checked={values.flag === entry.id} onChange={() => setValues((current) => ({ ...current, flag: entry.id }))} title={entry.title} detail={entry.detail} />)}
          </div>
          {errors.flag && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.flag}</p>}
        </Section>
      </div>
    </Drawer>
  )
}

export function CancelOrderDrawer({ order, onClose, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  if (!order) return null

  const cancel = async () => {
    if (reason.trim().length < 10) return setError('Give the reason for cancelling (at least 10 characters).')
    try {
      await onCancel(order.id, reason.trim())
      onClose()
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <Drawer open onClose={onClose} eyebrow={`${order.reference} · ${order.status}`} title="Cancel order" description={order.title} width="max-w-xl" footer={<div className="flex justify-between gap-3"><ActionButton onClick={onClose}>Keep Order</ActionButton><ActionButton variant="danger" onClick={cancel}>Cancel Order</ActionButton></div>}>
      <div className="flex flex-col gap-4 p-5">
        <TextArea label="Reason for cancelling" required rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} error={error} />
        <InfoNote>The order stays on record as cancelled.</InfoNote>
      </div>
    </Drawer>
  )
}
