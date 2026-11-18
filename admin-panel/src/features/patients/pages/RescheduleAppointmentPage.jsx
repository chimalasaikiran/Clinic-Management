import { useState } from 'react'
import { AlertTriangle, ArrowDown, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard, Toggle } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { appointmentsApi, practitionersApi } from '../api'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { ChecklistItem, FlowSection, SideCard, TextArea } from '../components/parts'
import MonthCalendar from '../components/MonthCalendar'
import SlotPicker from '../components/SlotPicker'
import { useAppointment } from '../context/useAppointment'
import { RESCHEDULE_REASONS } from '../data/catalog'
import { formatDate, formatTime, formatWeekday, localToday } from '../format'
import { isChangeable, sessionOf, slotsForPicker } from '../selectors'
import { validateReschedule } from '../validation'

export default function RescheduleAppointmentPage() {
  const { patient, patientId, appointment, loading, reload } = useAppointment()
  const navigate = useNavigate()
  const today = localToday()
  const [values, setValues] = useState({ date: '', slot: '', session: 'morning', reasonId: '', note: '', notify: true })
  const [view, setView] = useState(() => {
    const [year, month] = today.split('-').map(Number)
    return { year, month }
  })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  // Open slots for the visible month (from today), not counting this appointment's own slot as taken.
  const monthStart = `${view.year}-${String(view.month).padStart(2, '0')}-01`
  const from = monthStart < today ? today : monthStart
  const daysInMonth = new Date(view.year, view.month, 0).getDate()
  const days = Math.max(1, daysInMonth - Number(from.slice(8)) + 1)
  const inMonth = from.slice(0, 7) === monthStart.slice(0, 7)
  const slotKey = appointment && inMonth ? `${appointment.doctorId}:${appointment.branchId}:${from}:${days}` : 'none'
  const month = useApiResource(
    () => (appointment && inMonth ? practitionersApi.slots(appointment.doctorId, { branchId: appointment.branchId, from, days, excludeAppointmentId: appointment.id }) : Promise.resolve(null)),
    slotKey,
  )

  if (!appointment) return <FlowMissing patient={patient} loading={loading} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const movable = isChangeable(appointment) && !appointment.waitingQueue
  const daySlots = (iso) => month.data?.days.find((day) => day.date === iso)?.slots
  const slots = values.date ? slotsForPicker(daySlots(values.date)) : []
  const errors = submitted ? { ...validateReschedule(values), ...(serverError ? { slot: serverError } : {}) } : {}
  const reason = RESCHEDULE_REASONS.find((entry) => entry.id === values.reasonId)

  const dayStatus = (iso) => {
    const past = iso < today
    const list = daySlots(iso)
    const open = list ? list.filter((slot) => slot.state === 'available').length : 0
    const closed = !past && list !== undefined && list.length === 0
    return { disabled: past || open === 0, current: iso === appointment.date, label: closed ? 'OFF' : past || !list ? '' : iso === appointment.date ? 'Current' : `${open} open` }
  }

  const confirm = async () => {
    setSubmitted(true)
    setServerError('')
    if (Object.keys(validateReschedule(values)).length) return
    setSaving(true)
    try {
      await appointmentsApi.reschedule(appointment.id, { date: values.date, time: values.slot, reason: reason.title, note: values.note.trim() })
      await reload()
      navigate(backTo)
    } catch (error) {
      setSaving(false)
      setServerError(error.message)
      month.reload()
    }
  }

  return (
    <FlowFrame
      title="Reschedule appointment"
      description="Choose a new time for this appointment. The current appointment will remain in history."
      actions={<BackLink to={backTo}>Back to {appointment.reference}</BackLink>}
    >
      <InfoNote tone="neutral" icon={History} className="mb-5">
        <strong className="text-on-surface">Existing record preservation policy:</strong> rescheduling keeps appointment {appointment.reference} and records the change in its history without creating a duplicate record or premature encounter or invoice.
      </InfoNote>

      {!movable ? (
        <InfoNote tone="warning" icon={AlertTriangle}>This appointment is <strong>{appointment.status}</strong>. Only pending or confirmed appointments with a fixed slot can be rescheduled.</InfoNote>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5">
            <FlowSection title="Current locked appointment context" aside={appointment.reference}>
              <dl className="grid gap-3 text-xs sm:grid-cols-4">
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient</dt><dd className="font-semibold">{patient.name}</dd><dd className="text-on-surface-variant">{patient.age}y · {patient.gender}</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Current scheduled slot</dt><dd className="font-semibold">{formatWeekday(appointment.date)}, {formatDate(appointment.date)}</dd><dd className="text-on-surface-variant">{formatTime(appointment.time)} ({appointment.minutes} min)</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Clinician &amp; location</dt><dd className="font-semibold">{appointment.doctor}</dd><dd className="text-on-surface-variant">{appointment.department} ({appointment.room})</dd></div>
                <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Service tariff &amp; billing</dt><dd className="font-semibold">No billing change on reschedule</dd></div>
              </dl>
            </FlowSection>

            <FlowSection number="1" title="Select new date" aside={month.loading ? 'Checking availability…' : "The therapist's consulting days"}>
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
                  <p className="text-[13px] font-semibold">Notify the patient of the new time</p>
                  <p className="text-xs text-on-surface-variant">Sent to {patient.mobile} once an SMS / WhatsApp provider is connected.</p>
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
                <ChecklistItem ok={Boolean(values.slot)}>New slot taken from the therapist's live availability</ChecklistItem>
                <ChecklistItem>Double booking checked by the server on save</ChecklistItem>
              </ul>
              <div className="mt-5 flex flex-col gap-2">
                <ActionButton variant="primary" className="w-full" disabled={saving} onClick={confirm}>{saving ? 'Saving…' : 'Confirm reschedule'}</ActionButton>
                <ActionButton className="w-full" to={backTo}>Cancel</ActionButton>
              </div>
            </SideCard>
          </div>
        </div>
      )}
    </FlowFrame>
  )
}
