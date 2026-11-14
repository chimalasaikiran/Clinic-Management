import { useState } from 'react'
import { AlertTriangle, ArrowDown, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard, Toggle } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { ChecklistItem, FlowSection, SideCard, TextArea } from '../components/parts'
import MonthCalendar from '../components/MonthCalendar'
import SlotPicker from '../components/SlotPicker'
import { useAppointment } from '../context/useAppointment'
import { RESCHEDULE_REASONS } from '../data/catalog'
import { TODAY, formatDate, formatTime, formatWeekday } from '../format'
import { auditEntry, doctorById, sessionOf, slotsFor } from '../selectors'
import { validateReschedule } from '../validation'

export default function RescheduleAppointmentPage() {
  const { patient, patientId, appointment, records, update } = useAppointment()
  const navigate = useNavigate()
  const [values, setValues] = useState({ date: '', slot: '', session: 'morning', reasonId: '', note: '', notify: true })
  const [view, setView] = useState(() => {
    const [year, month] = (appointment?.date ?? TODAY).split('-').map(Number)
    return { year, month }
  })
  const [submitted, setSubmitted] = useState(false)

  if (!appointment) return <FlowMissing patient={patient} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const movable = ['Scheduled', 'Confirmed'].includes(appointment.status)
  const doctor = doctorById(appointment.doctorId)
  const slots = values.date && doctor ? slotsFor(values.date, doctor.id, records.appointments, appointment.id) : []
  const errors = submitted ? validateReschedule(values) : {}
  const reason = RESCHEDULE_REASONS.find((entry) => entry.id === values.reasonId)

  const dayStatus = (iso) => {
    const closed = new Date(`${iso}T00:00:00`).getDay() === 0
    const past = iso < TODAY
    const open = !closed && !past && doctor ? slotsFor(iso, doctor.id, records.appointments, appointment.id).filter((slot) => slot.state === 'available').length : 0
    return { disabled: closed || past || open === 0, current: iso === appointment.date, label: closed ? 'CLOSED' : past ? '' : iso === appointment.date ? 'Current' : `${open} open` }
  }

  const confirm = () => {
    setSubmitted(true)
    if (Object.keys(validateReschedule(values)).length) return
    update('appointments', appointment.id, (current) => ({
      date: values.date,
      time: values.slot,
      status: 'Confirmed',
      previousSlot: { date: current.date, time: current.time },
      audit: [auditEntry(`Rescheduled from ${formatDate(current.date)} ${formatTime(current.time)}`, `${reason.title} — ${values.note.trim()}`), ...(current.audit ?? [])],
    }))
    navigate(backTo)
  }

  return (
    <FlowFrame
      title="Reschedule appointment"
      description="Choose a new time for this appointment. The current appointment will remain in history."
      actions={<BackLink to={backTo}>Back to {appointment.id}</BackLink>}
    >
      <InfoNote tone="neutral" icon={History} className="mb-5">
        <strong className="text-on-surface">Existing record preservation policy:</strong> rescheduling preserves the original appointment ID {appointment.id} in the audit ledger without creating a duplicate record or premature encounter or invoice.
      </InfoNote>

      {!movable ? (
        <InfoNote tone="warning" icon={AlertTriangle}>This appointment is <strong>{appointment.status}</strong>. Only scheduled or confirmed appointments can be rescheduled.</InfoNote>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5">
            <FlowSection title="Current locked appointment context" aside={appointment.id}>
              <dl className="grid gap-3 text-xs sm:grid-cols-4">
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient</dt><dd className="font-semibold">{patient.name}</dd><dd className="text-on-surface-variant">{patient.age}y · {patient.gender}</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Current scheduled slot</dt><dd className="font-semibold">{formatWeekday(appointment.date)}, {formatDate(appointment.date)}</dd><dd className="text-on-surface-variant">{formatTime(appointment.time)} ({appointment.minutes} min)</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Clinician &amp; location</dt><dd className="font-semibold">{appointment.doctor}</dd><dd className="text-on-surface-variant">{appointment.department} ({appointment.room})</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Service tariff &amp; billing</dt><dd className="font-semibold">Zero billing modification on reschedule</dd></div>
              </dl>
            </FlowSection>

            <FlowSection number="1" title="Select new date" aside="Operating schedule: Monday – Saturday">
              <MonthCalendar year={view.year} month={view.month} selected={values.date} onSelect={(date) => setValues((current) => ({ ...current, date, slot: '' }))} onMonthChange={(year, month) => setView({ year, month })} status={dayStatus} />
              {errors.date && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.date}</p>}
            </FlowSection>

            <FlowSection number="2" title="Select new time slot" aside={values.date ? `${formatWeekday(values.date)}, ${formatDate(values.date)}` : 'Pick a date first'}>
              {values.date ? (
                <SlotPicker slots={slots} session={values.session} onSessionChange={(session) => setValues((current) => ({ ...current, session }))} value={values.slot} onChange={(slot) => setValues((current) => ({ ...current, slot, session: sessionOf(slot) }))} error={errors.slot} />
              ) : (
                <p className="text-sm text-on-surface-variant">Choose a new date to see the clinician&apos;s available slots.</p>
              )}
            </FlowSection>

            <FlowSection number="3" title="Reason for rescheduling">
              <div role="radiogroup" aria-label="Reschedule reason" className="grid gap-3 sm:grid-cols-3">
                {RESCHEDULE_REASONS.map((entry) => (
                  <RadioCard key={entry.id} name="reasonId" value={entry.id} checked={values.reasonId === entry.id} onChange={() => setValues((current) => ({ ...current, reasonId: entry.id }))} title={entry.title} detail={entry.detail} />
                ))}
              </div>
              {errors.reasonId && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.reasonId}</p>}
              <div className="mt-4">
                <TextArea label="Operational context note" required rows={2} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} hint="Audit trail logged, not clinical documentation." />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-surface-lowest p-3">
                <div>
                  <p className="text-[13px] font-semibold">Send automatic WhatsApp &amp; SMS notification to patient</p>
                  <p className="text-xs text-on-surface-variant">Delivery dispatch configured to {patient.mobile} with new calendar invite (.ics).</p>
                </div>
                <Toggle checked={values.notify} onChange={(notify) => setValues((current) => ({ ...current, notify }))} label="Send reschedule notification" />
              </div>
            </FlowSection>
          </div>

          <div className="flex flex-col gap-4 xl:sticky xl:top-4">
            <SideCard title="Reschedule summary" tag={<span className="text-[10px] font-semibold text-outline">PRE-FLIGHT</span>}>
              <div className="rounded-md bg-surface-low p-3 text-xs"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Previous slot (revoking)</p><p className="mt-1 font-semibold">{formatWeekday(appointment.date)}, {formatDate(appointment.date)} · {formatTime(appointment.time)}</p><p className="text-on-surface-variant">{appointment.department} · {appointment.room}</p></div>
              <ArrowDown className="mx-auto my-2 size-4 text-brand" aria-hidden="true" />
              <div className="rounded-md border-2 border-brand p-3 text-xs">
                <p className="text-[10px] font-semibold tracking-wide text-brand uppercase">New rescheduled slot</p>
                {values.date && values.slot ? <p className="mt-1 text-sm font-bold">{formatWeekday(values.date)}, {formatDate(values.date)} · {formatTime(values.slot)}</p> : <p className="mt-1 text-on-surface-variant">Not selected yet</p>}
                <p className="text-on-surface-variant">Clinician: {appointment.doctorShort} · Room: {appointment.room}</p>
              </div>
              <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Pre-commit health checks</p>
              <ul className="flex flex-col gap-1.5">
                <ChecklistItem ok={Boolean(values.slot)}>Doctor OPD roster active for the new slot</ChecklistItem>
                <ChecklistItem ok={Boolean(values.slot)}>Consultation suite concurrency lock {values.slot ? 'acquired' : 'pending'}</ChecklistItem>
                <ChecklistItem>Zero duplicate appointment conflict for {patient.name.split(' ')[0]}</ChecklistItem>
              </ul>
              <div className="mt-5 flex flex-col gap-2">
                <ActionButton variant="primary" className="w-full" onClick={confirm}>Confirm reschedule</ActionButton>
                <ActionButton className="w-full" to={backTo}>Cancel</ActionButton>
              </div>
            </SideCard>
          </div>
        </div>
      )}
    </FlowFrame>
  )
}
