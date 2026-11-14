import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard, Toggle } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { ChecklistItem, FlowSection, KeyValueRows, SideCard, TextArea } from '../components/parts'
import { useAppointment } from '../context/useAppointment'
import { NO_SHOW_REASONS } from '../data/catalog'
import { TODAY, formatDate, formatINR, formatTime } from '../format'
import { appointmentTone, auditEntry } from '../selectors'
import { validateWorkflowReason } from '../validation'

export default function NoShowPage() {
  const { patient, patientId, appointment, update } = useAppointment()
  const navigate = useNavigate()
  const [values, setValues] = useState({ reasonId: 'no-arrive', note: '', notify: true })
  const [submitted, setSubmitted] = useState(false)

  if (!appointment) return <FlowMissing patient={patient} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const errors = submitted ? validateWorkflowReason(values) : {}
  const reason = NO_SHOW_REASONS.find((entry) => entry.id === values.reasonId)
  const firstName = patient.name.split(' ')[0]

  // Each guard mirrors a rule from the lifecycle: a no-show is only valid for a booked slot nobody has used.
  const checks = [
    { ok: !['Arrived', 'In Progress'].includes(appointment.status), text: 'Arrival status verified (not present in facility)' },
    { ok: !appointment.encounterId, text: 'Zero active clinical encounters detected' },
    { ok: !appointment.queueToken, text: 'No active queue tokens found in lounge' },
    { ok: appointment.date <= TODAY, text: 'Slot date reached — grace period applies' },
  ]
  const markable = ['Scheduled', 'Confirmed'].includes(appointment.status)
  const passed = checks.filter((check) => check.ok).length

  const confirm = () => {
    setSubmitted(true)
    if (Object.keys(validateWorkflowReason(values)).length || passed < checks.length) return
    update('appointments', appointment.id, (current) => ({
      status: 'No-show',
      serviceNote: reason.title,
      audit: [auditEntry(`Marked as no-show — ${reason.title}`, values.note.trim()), ...(current.audit ?? [])],
    }))
    navigate(backTo)
  }

  return (
    <FlowFrame
      title="Mark as no-show"
      description="Record that the patient did not attend the scheduled consultation without prior cancellation notice. The appointment is preserved in audit history and releases the clinician time slot."
      actions={<BackLink to={backTo}>Back to {appointment.id}</BackLink>}
    >
      <section className="mb-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient</span><br /><strong className="text-sm">{patient.name}</strong><br />{patient.age}y · {patient.gender} · {patient.mobile}</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Scheduled slot</span><br /><strong className="text-sm">{formatDate(appointment.date)}</strong><br />{formatTime(appointment.time)} ({appointment.minutes} min)</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting clinician</span><br /><strong className="text-sm">{appointment.doctorShort}</strong><br />{appointment.department} · {appointment.room}</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Tariff & current state</span><br /><strong className="text-sm">{formatINR(appointment.tariff ?? 0, 2)}</strong><br /><StatusPill tone={appointmentTone(appointment.status)}>{appointment.status}</StatusPill></p>
      </section>

      {!markable && (
        <InfoNote tone="danger" icon={AlertTriangle} className="mb-5">
          <strong>Accidental no-show prevention guard:</strong> this appointment is <strong>{appointment.status}</strong>. If the patient is physically present or in consultation, abort this workflow. Only scheduled or confirmed appointments can be marked as no-show.
        </InfoNote>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <FlowSection number="1" title="Arrival status & verification">
            <ul className="flex flex-col gap-2">{checks.map((check) => <ChecklistItem key={check.text} ok={check.ok}>{check.text}</ChecklistItem>)}</ul>
          </FlowSection>

          <FlowSection number="2" title="Why is this appointment being marked as no-show?" aside="Required field">
            <div role="radiogroup" aria-label="No-show reason" className="flex flex-col gap-2">
              {NO_SHOW_REASONS.map((entry) => (
                <RadioCard key={entry.id} name="reasonId" value={entry.id} checked={values.reasonId === entry.id} onChange={() => setValues((current) => ({ ...current, reasonId: entry.id }))} title={entry.title} detail={entry.detail} />
              ))}
            </div>
            <div className="mt-4">
              <TextArea label="Reception contact log & operational note" required rows={3} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} hint="Operational context only: recorded in administrative FHIR provenance metadata. Not clinical documentation and will not appear on medical summaries." />
            </div>
          </FlowSection>

          <FlowSection number="3" title="Downstream domain safeguards" aside="Strict boundary isolation">
            <ul className="flex flex-col gap-3 text-xs leading-5 text-on-surface-variant">
              <li><strong className="text-on-surface">Queue token status — {appointment.queueToken ? 'Token active' : 'No active queue'}.</strong> Waiting room displays and triage queue ledgers remain uncompromised.</li>
              <li><strong className="text-on-surface">Clinical encounter status — {appointment.encounterId ? 'Encounter exists' : 'Zero encounter records'}.</strong> No clinical charts, vitals, prescriptions or progress notes exist for this slot.</li>
              <li><strong className="text-on-surface">Financial ledger protection — strict isolation.</strong> Marking no-show does not automatically void, debit or charge cancellation penalties.</li>
            </ul>
          </FlowSection>

          <FlowSection number="4" title="Patient re-engagement & communication" aside="TRAI DLT verified">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold">Send courteous missed appointment notification</p>
                <p className="text-xs text-on-surface-variant">Dispatches a gentle rescheduling link to the patient via verified clinic gateways.</p>
              </div>
              <Toggle checked={values.notify} onChange={(notify) => setValues((current) => ({ ...current, notify }))} label="Send missed appointment notification" />
            </div>
            <blockquote className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs leading-5 text-on-surface-variant">
              Dear {firstName}, we missed you today for your {formatTime(appointment.time)} consultation with {appointment.doctorShort} at {appointment.branch}. If you&apos;d like to reschedule, please call the clinic desk.
            </blockquote>
          </FlowSection>
        </div>

        <SideCard title="Confirm no-show record?" tag={<span className="font-mono text-[10px] text-outline">{appointment.id}</span>}>
          <p className="mb-3 text-xs font-semibold text-brand">Pre-flight checklist · {passed} / {checks.length} passed</p>
          <KeyValueRows rows={[['Patient', `${patient.name} (${patient.mrn})`], ['Clinician', appointment.doctorShort], ['Slot schedule', `${formatDate(appointment.date)} · ${formatTime(appointment.time)}`], ['Target state change', 'SCHEDULED → NO-SHOW']]} />
          <div className="mt-5 flex flex-col gap-2">
            <ActionButton variant="primary" className="w-full" onClick={confirm} disabled={!markable}>Mark as no-show</ActionButton>
            <ActionButton className="w-full" to={backTo}>Keep appointment / Cancel</ActionButton>
          </div>
          <p className="mt-4 text-[11px] leading-4 text-on-surface-variant">The appointment will be permanently marked as No-show, the slot released for registry reallocation, and retained in the patient longitudinal history.</p>
        </SideCard>
      </div>
    </FlowFrame>
  )
}
