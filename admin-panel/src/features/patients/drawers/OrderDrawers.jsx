import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { Check, PatientStrip, TextArea } from '../components/parts'
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
  const [values, setValues] = useState({ outcome: '', note: '', task: true, notify: true })
  const [submitted, setSubmitted] = useState(false)
  if (!order) return null
  const awaiting = order.status === 'Awaiting Review'
  const errors = submitted ? validateResultReview(values) : {}

  const sign = () => {
    setSubmitted(true)
    if (Object.keys(validateResultReview(values)).length) return
    onSign(order.id, values)
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${order.id} · ${order.status}`}
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
        {order.findings && (
          <>
            <InfoNote tone="warning" icon={AlertTriangle}><strong>{order.findings.headline}</strong><br />{order.findings.text}</InfoNote>
            <Section title="Reference & trend"><p className="text-xs text-on-surface-variant">Reference range: <strong className="text-on-surface">{order.findings.range}</strong> · {order.findings.baseline}</p>{order.document && <p className="mt-2 rounded border border-slate-200 p-2 text-xs font-semibold">{order.document.name} <span className="font-normal text-outline">· {order.document.meta}</span></p>}</Section>
          </>
        )}
        {order.analytes && (
          <Section title="Analyte results & longitudinal comparison">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Test</th><th className="pb-2">Current</th><th className="pb-2">Flag</th><th className="pb-2">Reference interval</th></tr></thead>
              <tbody>{order.analytes.map((row) => <tr key={row.name} className="border-t border-slate-100"><td className="py-2 font-medium">{row.name}</td><td className="py-2 font-mono font-semibold">{row.value} {row.unit}</td><td className="py-2"><StatusPill tone={FLAG_TONE[row.flag] ?? 'neutral'}>{row.flag}</StatusPill></td><td className="py-2 text-on-surface-variant">{row.range}</td></tr>)}</tbody>
            </table>
          </Section>
        )}
        {order.summary && <Section title="Results summary"><p className="text-sm">{order.summary}</p>{order.summaryTone && <p className="mt-1 text-xs font-semibold text-brand">{order.summaryTone}</p>}</Section>}
        {order.reviewedBy && <Section title="Review"><p className="text-sm">Reviewed by <strong>{order.reviewedBy}</strong> · {order.reviewedAt}</p>{order.reviewOutcome && <p className="mt-1 text-xs text-on-surface-variant">{OUTCOMES.find((entry) => entry.id === order.reviewOutcome)?.title}: {order.reviewNote}</p>}</Section>}

        {awaiting && (
          <Section title="Clinician acknowledgement protocol">
            <div role="radiogroup" aria-label="Clinical assessment outcome" className="flex flex-col gap-2">
              {OUTCOMES.map((entry) => <RadioCard key={entry.id} name="outcome" value={entry.id} checked={values.outcome === entry.id} onChange={() => setValues((current) => ({ ...current, outcome: entry.id }))} title={entry.title} detail={entry.detail} />)}
            </div>
            {errors.outcome && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.outcome}</p>}
            <div className="mt-4"><TextArea label="Clinician note & management directive" required rows={3} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} /></div>
            <div className="mt-3 flex flex-col gap-2">
              <Check checked={values.task} onChange={(event) => setValues((current) => ({ ...current, task: event.target.checked }))} label="Create a follow-up task for the care coordinator" />
              <Check checked={values.notify} onChange={(event) => setValues((current) => ({ ...current, notify: event.target.checked }))} label="Transmit a verified result slip to the patient (WhatsApp / ABHA PHR app)" />
            </div>
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
    <Drawer open onClose={onClose} eyebrow={`${order.id} · Laboratory chain-of-custody`} title="Specimen tracking" description={order.title} width="max-w-2xl" footer={<ActionButton onClick={onClose}>Close (Esc)</ActionButton>}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone="warning">Specimen in transit</StatusPill><StatusPill>Order {order.id}</StatusPill></div>
        <PatientStrip patient={patient} />
        <Section title="Active specimen">
          <p className="text-sm font-semibold">{specimen.container}</p>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-outline">Specimen accession identifier</dt><dd className="font-mono font-semibold">{specimen.accession}</dd></div>
            <div><dt className="text-outline">Assigned tests</dt><dd className="font-semibold">{specimen.tests.join(' · ')}</dd></div>
            <div><dt className="text-outline">Phlebotomist</dt><dd className="font-semibold">{specimen.phlebotomist}</dd></div>
            <div><dt className="text-outline">Cold-chain telemetry</dt><dd className="font-semibold">{specimen.temperature}</dd></div>
            <div className="sm:col-span-2"><dt className="text-outline">Core destination</dt><dd className="font-semibold">{specimen.destination}</dd></div>
          </dl>
          <p className="mt-3 rounded bg-surface-low p-3 text-xs text-on-surface-variant">{specimen.note}</p>
          <p className="mt-2 text-xs text-on-surface-variant">Estimated turnaround: <strong className="text-on-surface">{specimen.turnaround}</strong></p>
        </Section>
        <Section title="Chain-of-custody & verification audit"><Timeline events={specimen.events} /></Section>
        <InfoNote tone="warning">Specimen in transit — awaiting accessioning and centrifugation. Results are not generated until technical validation is complete.</InfoNote>
      </div>
    </Drawer>
  )
}
