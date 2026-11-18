import { useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { usePatient } from '../context/usePatient'
import { TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { ALERT_DISPOSITIONS } from '../data/catalog'
import { formatDate, formatTime } from '../format'
import { byNewest } from '../selectors'
import { bpStage, validateMitigation } from '../validation'

function Section({ title, children, tone }) {
  return (
    <section className={cn('rounded-md border p-4', tone === 'danger' ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-white')}>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">{title}</h3>
      {children}
    </section>
  )
}

const SEVERITY_TONE = { Critical: 'danger', High: 'warning', Moderate: 'warning', Severe: 'danger' }

// Clinician acknowledgement of a safety alert with a documented mitigation.
export function SafetyAlertDrawer({ alert, onClose, onAcknowledge }) {
  const [values, setValues] = useState({ dispositionId: '', justification: '' })
  const [submitted, setSubmitted] = useState(false)
  if (!alert) return null
  const errors = submitted ? validateMitigation(values) : {}

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(validateMitigation(values)).length) return
    onAcknowledge(alert.id, values)
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${alert.severity} guardrail · ${alert.id}`}
      title="Clinical Safety Alert"
      description={alert.title}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Dismiss drawer</ActionButton>
          {alert.status === 'Active' ? <ActionButton variant="brand" onClick={submit}>Acknowledge with Mitigation</ActionButton> : <StatusPill tone="success">Acknowledged</StatusPill>}
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</StatusPill><StatusPill tone={alert.status === 'Active' ? 'warning' : 'success'}>Status: {alert.status}</StatusPill></div>
        <Section title={alert.kind} tone="danger"><p className="text-sm font-semibold">{alert.detail}</p><p className="mt-2 text-xs leading-5 text-on-surface-variant">{alert.statement}</p></Section>
        <Section title="Linked source clinical records (evidence chain)">
          <ul className="flex flex-col gap-2">{alert.evidence.map((item) => <li key={item.label} className="rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">{item.label}</p><p className="text-on-surface-variant">{item.detail}</p></li>)}</ul>
        </Section>

        {alert.status === 'Active' ? (
          <Section title="Clinician mitigation & acknowledgement">
            <div role="radiogroup" aria-label="Clinical disposition" className="flex flex-col gap-2">
              {ALERT_DISPOSITIONS.map((entry) => <RadioCard key={entry.id} name="disposition" value={entry.id} checked={values.dispositionId === entry.id} onChange={() => setValues((current) => ({ ...current, dispositionId: entry.id }))} title={entry.title} detail={entry.detail} />)}
            </div>
            {errors.dispositionId && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.dispositionId}</p>}
            <div className="mt-4"><TextArea label="Clinical justification & management plan" required rows={3} value={values.justification} onChange={(event) => setValues((current) => ({ ...current, justification: event.target.value }))} error={errors.justification} hint="Committed to the audit record and cannot be modified post-acknowledgement." /></div>
          </Section>
        ) : (
          <Section title="Mitigation recorded"><p className="text-sm font-semibold">{ALERT_DISPOSITIONS.find((entry) => entry.id === alert.disposition)?.title}</p><p className="mt-1 text-xs text-on-surface-variant">{alert.justification}</p></Section>
        )}

        <Section title="Immutable audit trail & dispatch history"><Timeline events={alert.audit} /></Section>
      </div>
    </Drawer>
  )
}

export function AllergyDrawer({ allergy, onClose }) {
  if (!allergy) return null
  return (
    <Drawer open onClose={onClose} eyebrow={`${allergy.id} · Allergy record`} title={allergy.name} description={`${allergy.classLabel} · Recorded ${allergy.recorded}`} width="max-w-2xl" footer={<ActionButton onClick={onClose}>Close (Esc)</ActionButton>}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone="success">{allergy.status}</StatusPill><StatusPill tone={SEVERITY_TONE[allergy.severity]}>{allergy.severity}</StatusPill><StatusPill>{allergy.verification}</StatusPill></div>
        <Section title="Substance & reaction manifestation">
          <dl className="mb-3 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-outline">Primary substance</dt><dd className="font-semibold">{allergy.substance}</dd></div><div><dt className="text-outline">Exposure & onset</dt><dd className="font-semibold">{allergy.exposure}</dd></div></dl>
          <ul className="grid gap-2 sm:grid-cols-3">{allergy.reactions.map((reaction) => <li key={reaction.title} className="rounded-md border border-red-200 bg-red-50/50 p-3 text-xs"><p className="font-semibold text-danger">{reaction.title}</p><p className="mt-1 text-on-surface-variant">{reaction.detail}</p></li>)}</ul>
          <InfoNote tone="warning" icon={AlertTriangle} className="mt-3">{allergy.crossReactivity}</InfoNote>
        </Section>
        <Section title="Clinical provenance & verification chain">
          <dl className="flex flex-col gap-2 text-xs">{allergy.provenance.map((item) => <div key={item.label}><dt className="text-outline">{item.label}</dt><dd className="font-medium">{item.value}</dd></div>)}</dl>
        </Section>
        {allergy.evidence && <Section title="Supporting diagnostic evidence"><p className="rounded-md border border-slate-200 p-3 text-xs font-semibold">{allergy.evidence}</p></Section>}
        <Section title="Immutable audit trail"><Timeline events={allergy.audit} /></Section>
      </div>
    </Drawer>
  )
}

export function VitalDetailDrawer({ vitals, history, onClose }) {
  if (!vitals) return null
  const { sys, dia } = vitals.bp
  const map = Math.round((dia * 2 + sys) / 3 * 10) / 10
  const stage = bpStage(sys, dia)
  const rows = [...history].sort(byNewest)
  return (
    <Drawer open onClose={onClose} eyebrow="Vital sign observation · LOINC 85354-9" title="Blood Pressure (Systolic & Diastolic)" description={`${sys} / ${dia} mmHg · Recorded ${formatDate(vitals.date)}, ${formatTime(vitals.time)}`} width="max-w-2xl" footer={<ActionButton onClick={onClose}>Close (Esc)</ActionButton>}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone={stage === 'Normal' ? 'success' : 'warning'}>{stage}</StatusPill><StatusPill>{vitals.by}</StatusPill></div>
        <InfoNote tone="brand"><strong>Statutory observation boundary:</strong> a recorded vital sign is a point-in-time measurement. An abnormal reading raises decision-support flags but does not change the longitudinal problem list or billing.</InfoNote>
        <Section title="Measurement attributes & source telemetry">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[['Systolic blood pressure', `${sys} mmHg`], ['Diastolic blood pressure', `${dia} mmHg`], ['Mean arterial pressure (MAP)', `${map} mmHg`], ['Pulse pressure', `${sys - dia} mmHg`], ['Measurement site', vitals.site], ['Patient posture & protocol', vitals.posture], ['Device telemetry', vitals.device]].map(([label, value]) => (
              <div key={label} className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>
            ))}
          </dl>
        </Section>
        <Section title="Longitudinal observation history & comparative trend">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Date & time</th><th className="pb-2">Recorded value</th><th className="pb-2">Clinical status</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="py-2 font-medium">{formatDate(row.date)}<br /><span className="text-[10px] text-outline">{formatTime(row.time)}</span></td><td className="py-2 font-mono font-semibold">{row.bp.sys} / {row.bp.dia}</td><td className="py-2"><StatusPill tone={bpStage(row.bp.sys, row.bp.dia) === 'Normal' ? 'success' : 'warning'}>{bpStage(row.bp.sys, row.bp.dia)}</StatusPill></td></tr>)}</tbody>
          </table>
        </Section>
      </div>
    </Drawer>
  )
}

export function NoteDrawer({ note, onClose, onAddendum }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  if (!note) return null

  const save = () => {
    if (text.trim().length < 10) return setError('Write the addendum (at least 10 characters).')
    onAddendum(note.id, text.trim())
    setText('')
    setError('')
    setAdding(false)
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${note.status} · ${note.id}`}
      title={note.title}
      description={`${note.author} · ${note.department} · ${formatDate(note.date)}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={() => window.print()}>Print note / ABHA summary</ActionButton>
          <div className="flex gap-2"><ActionButton variant="brand" onClick={() => setAdding(true)} disabled={adding}>Create Addendum / Correction</ActionButton><ActionButton onClick={onClose}>Close (Esc)</ActionButton></div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote tone="brand"><strong>Statutory clinical documentation boundary:</strong> a signed note is immutable. Amending it creates an auditable addendum without altering the original signed text.</InfoNote>
        {note.sections.map((section, index) => <Section key={section.heading} title={`${index + 1}. ${section.heading}`}><p className="text-sm leading-6">{section.body}</p></Section>)}
        {note.addenda.length > 0 && (
          <Section title="Addenda"><ul className="flex flex-col gap-2">{note.addenda.map((entry) => <li key={entry.id} className="rounded-md border border-slate-200 p-3 text-xs"><p className="text-[10px] text-outline">{entry.time}</p>{entry.text}</li>)}</ul></Section>
        )}
        {adding && (
          <Section title="New addendum"><TextArea label="Addendum text" rows={3} value={text} onChange={(event) => setText(event.target.value)} error={error} /><div className="mt-3 flex justify-end gap-2"><ActionButton onClick={() => setAdding(false)}>Cancel</ActionButton><ActionButton variant="primary" onClick={save}>Save addendum</ActionButton></div></Section>
        )}
        <p className="font-mono text-[10px] text-outline">{note.hash}</p>
      </div>
    </Drawer>
  )
}

const INTERVENTION_LINKS = {
  'follow-up': ['Link to Scheduling', ROUTES.appointmentNew],
  medication: ['Review Regimen', ROUTES.patientPrescriptions],
  diagnostic: ['Queue Lab Order', ROUTES.patientOrders],
  lifestyle: ['Generate Referral', ROUTES.patientReferrals],
}

export function CarePlanDrawer({ plan, onClose, onUpdateProgress }) {
  const { patientId } = usePatient()
  if (!plan) return null

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${plan.reference ?? plan.id} · Active care plan detail`}
      title={plan.title}
      description={`Lead: ${plan.lead} · ${plan.timeline}`}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton variant="brand" onClick={onUpdateProgress}>Update Progress</ActionButton><ActionButton onClick={onClose}>Close (Esc)</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2"><StatusPill tone={plan.status === 'At Risk' ? 'danger' : 'success'}>Active plan</StatusPill><StatusPill>Plan status: {plan.status} ({plan.compliance}% milestone compliance)</StatusPill></div>
        <Section title="Documented clinical goals">
          <ol className="flex flex-col gap-2">{plan.milestones.map((item) => <li key={item.no} className="rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">{item.no}. {item.title}</p><p className="text-on-surface-variant">{item.detail}</p></li>)}</ol>
        </Section>
        <Section title="Planned interventions & activities">
          <ul className="flex flex-col gap-2">
            {plan.interventions.map((item) => {
              const link = INTERVENTION_LINKS[item.type]
              return (
                <li key={item.title} className="flex items-start justify-between gap-2 rounded-md border border-slate-200 p-3 text-xs">
                  <span><strong className="block text-[13px]">{item.title}</strong><span className="text-on-surface-variant">{item.detail}</span></span>
                  <span className="flex flex-col items-end gap-1.5"><StatusPill>{item.state}</StatusPill>{link && <ActionButton size="sm" to={pathFor(link[1], { patientId })}>{link[0]}</ActionButton>}</span>
                </li>
              )
            })}
          </ul>
        </Section>
        <Section title="Progress & review history"><Timeline events={plan.progress.map((entry) => ({ time: entry.time, title: entry.title, detail: entry.detail }))} /></Section>
        <InfoNote tone="danger" icon={ShieldAlert}><strong>Red-flag escalation:</strong> if new neurological deficit, chest pain or syncope occurs, suspend the plan and report to the emergency triage immediately.</InfoNote>
        <p className="text-xs text-on-surface-variant">Next scheduled review: <strong className="text-on-surface">{formatDate(plan.nextReview)}</strong></p>
      </div>
    </Drawer>
  )
}
