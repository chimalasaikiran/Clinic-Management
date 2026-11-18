import { useState } from 'react'
import { AlertTriangle, Ban, Stethoscope, Ticket, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard, Toggle } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { FlowSection, KeyValueRows, SideCard, TextArea } from '../components/parts'
import { appointmentsApi } from '../api'
import { useAppointment } from '../context/useAppointment'
import { CANCEL_REASONS } from '../data/catalog'
import { formatDate, formatTime } from '../format'
import { appointmentTone, isChangeable } from '../selectors'
import { validateWorkflowReason } from '../validation'

export default function CancelAppointmentPage() {
  const { patient, patientId, appointment, loading, reload } = useAppointment()
  const navigate = useNavigate()
  const [values, setValues] = useState({ reasonId: '', note: '', notify: true })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  if (!appointment) return <FlowMissing patient={patient} loading={loading} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const cancellable = isChangeable(appointment)
  const errors = submitted ? validateWorkflowReason(values) : {}
  const reason = CANCEL_REASONS.find((entry) => entry.id === values.reasonId)

  const confirm = async () => {
    setSubmitted(true)
    setServerError('')
    if (Object.keys(validateWorkflowReason(values)).length) return
    setSaving(true)
    try {
      await appointmentsApi.cancel(appointment.id, reason.title, values.note.trim())
      await reload()
      navigate(backTo)
    } catch (error) {
      setSaving(false)
      setServerError(error.message)
    }
  }

  return (
    <FlowFrame
      title="Cancel appointment"
      badge={<StatusPill tone="warning">Irreversible lifecycle transition · History preserved</StatusPill>}
      description="Cancel this appointment without deleting its audit history. The record will transition to Cancelled in the slot registry and patient ledger."
      actions={<BackLink to={backTo}>Back to {appointment.reference}</BackLink>}
    >
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 border-l-4 border-l-brand bg-white p-4">
        <p className="text-sm"><strong>{patient.name}</strong> <span className="font-mono text-xs text-on-surface-variant">{patient.mrn}</span><br /><span className="text-xs text-on-surface-variant">{patient.age}y · {patient.gender} · {patient.mobile}</span></p>
        <p className="text-xs"><span className="text-outline">Service &amp; clinician</span><br /><strong>{appointment.service}</strong> · {appointment.doctor}</p>
        <p className="text-xs"><span className="text-outline">Scheduled window</span><br /><strong>{formatDate(appointment.date)} · {formatTime(appointment.time)}</strong></p>
        <StatusPill tone={appointmentTone(appointment.status)}>{appointment.status}</StatusPill>
      </section>

      {!cancellable ? (
        <InfoNote tone="warning" icon={AlertTriangle}>This appointment is <strong>{appointment.status}</strong> and can no longer be cancelled. Only pending or confirmed appointments can be cancelled.</InfoNote>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5">
            <FlowSection number="1" title="Why is this appointment being cancelled?" aside="Mandatory field">
              <div role="radiogroup" aria-label="Cancellation reason" className="grid gap-3 sm:grid-cols-2">
                {CANCEL_REASONS.map((entry) => (
                  <RadioCard key={entry.id} name="reasonId" value={entry.id} checked={values.reasonId === entry.id} onChange={() => setValues((current) => ({ ...current, reasonId: entry.id }))} title={entry.title} detail={entry.detail} />
                ))}
              </div>
              {errors.reasonId && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.reasonId}</p>}
              <div className="mt-5">
                <TextArea label="Operational context note" required rows={3} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} hint="Saved to the operational audit ledger and FHIR provenance log. It is not clinical documentation and is not shown on patient summaries." />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-surface-lowest p-3">
                <div>
                  <p className="text-[13px] font-semibold">Notify the patient of the cancellation</p>
                  <p className="text-xs text-on-surface-variant">Sent to {patient.mobile} once an SMS / WhatsApp provider is connected.</p>
                </div>
                <Toggle checked={values.notify} onChange={(notify) => setValues((current) => ({ ...current, notify }))} label="Send cancellation notification" />
              </div>
            </FlowSection>

            <FlowSection number="2" title="Downstream impact & domain boundaries" aside="Domain segregation active">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><Ticket className="size-3.5" aria-hidden="true" />QUEUE TOKEN</p>
                  <p className="mt-1 text-sm font-semibold">{appointment.queueToken ? `Token ${appointment.queueToken}` : 'No token issued'}</p>
                  <p className="text-on-surface-variant">{appointment.queueToken ? 'Cancelling releases the token and removes the patient from the triage display.' : 'The slot is released automatically and the roster refreshes immediately.'}</p>
                </div>
                <div className="rounded-md border border-teal-200 bg-teal-50/50 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><Stethoscope className="size-3.5" aria-hidden="true" />CLINICAL ENCOUNTER</p>
                  <p className="mt-1 text-sm font-semibold">No encounter started</p>
                  <p className="text-on-surface-variant">No clinical notes, requisitions or vitals are affected or deleted.</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><Wallet className="size-3.5" aria-hidden="true" />BILLING GOVERNANCE</p>
                  <p className="mt-1 text-sm font-semibold">No invoice raised</p>
                  <p className="text-on-surface-variant">Cancelling does not delete or alter any invoice. No premature debit was collected.</p>
                </div>
              </div>
            </FlowSection>
          </div>

          <SideCard title="Cancel this appointment?" tag={<Ban className="size-4 text-danger" aria-hidden="true" />}>
            <KeyValueRows rows={[['Patient', `${patient.name} (${patient.mrn})`], ['Target appointment', appointment.reference], ['Scheduled slot', `${formatDate(appointment.date)} · ${formatTime(appointment.time)}`], ['Clinician', appointment.doctor], ['Selected reason', reason?.title ?? 'Not selected']]} />
            {serverError && <p role="alert" className="mt-3 text-xs text-rose-600">{serverError}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <ActionButton variant="danger" className="w-full border-danger bg-danger text-white hover:bg-red-800" disabled={saving} onClick={confirm}>{saving ? 'Cancelling…' : 'Cancel appointment'}</ActionButton>
              <ActionButton className="w-full" to={backTo}>Keep appointment (Back to detail)</ActionButton>
            </div>
            <ul className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 text-[11px] leading-4 text-on-surface-variant">
              <li>• {appointment.reference} remains permanently searchable in patient history.</li>
              <li>• Original date/time, actor and timestamp are preserved in the immutable ledger.</li>
              <li>• Downstream medical records and patient profile remain 100% intact.</li>
            </ul>
          </SideCard>
        </div>
      )}
    </FlowFrame>
  )
}
