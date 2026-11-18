import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { CHANNEL_VALUES, TARIFF_NOTE, TYPE_VALUES } from '../adapters'
import { appointmentsApi, branchesApi, practitionersApi } from '../api'
import FlowFrame, { FlowMissing } from '../components/FlowFrame'
import { Check, ChecklistItem, FlowSection, KeyValueRows, OptionSelect, PatientStrip, SideCard, TextArea } from '../components/parts'
import SlotPicker from '../components/SlotPicker'
import { usePatient } from '../context/usePatient'
import { APPOINTMENT_TYPES, BOOKING_SOURCES } from '../data/catalog'
import { formatDate, formatTime, formatWeekday, initialsOf, localToday } from '../format'
import { datesFrom, sessionOf, slotsForPicker } from '../selectors'
import { validateBooking } from '../validation'

const DAYS_SHOWN = 5
const SLOT_ERRORS = ['SLOT_TAKEN', 'SLOT_NOT_AVAILABLE', 'SLOT_IN_PAST', 'PATIENT_DOUBLE_BOOKED', 'DUPLICATE_BOOKING']

export default function BookAppointmentPage() {
  const { patient, patientId, loading, refresh } = usePatient()
  const { can } = useAuth()
  const navigate = useNavigate()
  const today = localToday()
  const [values, setValues] = useState({ branchId: '', department: '', doctorId: '', type: 'Consultation', date: today, session: 'morning', slot: '', reason: '', note: '', source: BOOKING_SOURCES[0], whatsapp: true, sms: true })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)

  const practitioners = useApiResource(() => practitionersApi.list({ status: 'active' }), 'practitioners')
  const branches = useApiResource(() => branchesApi.list(), 'branches')

  // Branch → department → therapist, each narrowing the next. Defaults fall to the first available option.
  const consulting = (practitioners.data ?? []).filter((entry) => entry.availability.length > 0)
  const branchOptions = (branches.data ?? []).filter((branch) => branch.status === 'active' && consulting.some((entry) => entry.availability.some((window) => window.branchId === branch.id)))
  const branchId = branchOptions.some((branch) => branch.id === values.branchId) ? values.branchId : (branchOptions[0]?.id ?? '')
  const atBranch = consulting.filter((entry) => entry.availability.some((window) => window.branchId === branchId))
  const departments = [...new Set(atBranch.map((entry) => entry.department))].sort()
  const department = departments.includes(values.department) ? values.department : (departments[0] ?? '')
  const doctors = atBranch.filter((entry) => entry.department === department)
  const doctor = doctors.find((entry) => entry.id === values.doctorId) ?? doctors[0]

  const slotKey = doctor && branchId ? `${doctor.id}:${branchId}:${today}` : 'none'
  const slots = useApiResource(() => (doctor && branchId ? practitionersApi.slots(doctor.id, { branchId, from: today, days: DAYS_SHOWN }) : Promise.resolve(null)), slotKey)
  const days = datesFrom(today, DAYS_SHOWN)
  const daySlots = (date) => slots.data?.days.find((day) => day.date === date)?.slots ?? []
  const pickerSlots = slotsForPicker(daySlots(values.date))

  const form = { ...values, branchId, department, doctorId: doctor?.id ?? '' }
  const errors = submitted ? { ...validateBooking(form), ...(serverError?.field ? { [serverError.field]: serverError.message } : {}) } : {}
  const inactive = patient?.status === 'Inactive'

  if (!patient) return <FlowMissing patient={patient} loading={loading} />

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)
  const choose = (patch) => {
    setServerError(null)
    setValues((current) => ({ ...current, ...patch, slot: '' }))
  }

  const book = async (status) => {
    setSubmitted(true)
    setServerError(null)
    if (Object.keys(validateBooking(form)).length || inactive) return
    setSaving(true)
    try {
      const appointment = await appointmentsApi.create({
        patientId,
        practitionerId: doctor.id,
        branchId,
        date: values.date,
        time: values.slot,
        type: TYPE_VALUES[values.type],
        channel: CHANNEL_VALUES[values.source] ?? 'reception',
        status: status === 'Confirmed' ? 'confirmed' : 'pending',
        reason: values.reason.trim(),
        internalNote: values.note.trim(),
        notifyWhatsapp: values.whatsapp,
        notifySms: values.sms,
      })
      await refresh()
      navigate(pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id }))
    } catch (error) {
      setSaving(false)
      if (SLOT_ERRORS.includes(error.code)) {
        setServerError({ field: 'slot', message: error.message })
        slots.reload()
      } else if (error.code === 'VALIDATION_FAILED') {
        const [field, message] = Object.entries(error.fieldErrors())[0] ?? []
        setServerError({ field: field === 'time' ? 'slot' : field, message: message ?? error.message })
      } else {
        setServerError({ message: error.message })
      }
    }
  }

  const noTherapists = !practitioners.loading && consulting.length === 0

  return (
    <FlowFrame title="Book appointment" description="Schedule a validated clinical visit for the patient without generating premature encounter or billing records.">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <PatientStrip patient={patient}>
            <Link to={pathFor(ROUTES.patientHub, { patientId })} className="text-xs font-semibold text-brand hover:underline">View patient profile →</Link>
          </PatientStrip>

          {inactive && <InfoNote tone="warning"><strong>This patient is inactive.</strong> Reactivate the patient from the directory before booking a new appointment.</InfoNote>}
          {practitioners.error && <InfoNote tone="warning">{practitioners.error.message}</InfoNote>}
          {noTherapists && (
            <InfoNote tone="warning">
              <strong>No therapists are taking appointments yet.</strong> A therapist needs a profile and weekly consulting hours before slots can be booked.
              {can('bookings.assign') && <> <Link to={ROUTES.staffDirectory} className="font-semibold text-brand hover:underline">Set up a therapist →</Link></>}
            </InfoNote>
          )}

          <FlowSection number="1" title="Location & clinical department" aside="Branches where a therapist consults">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Facility / node" name="branchId" value={branchId} onChange={(event) => choose({ branchId: event.target.value, department: '', doctorId: '' })} error={errors.branchId} placeholder={branches.loading ? 'Loading…' : 'No branch available'} options={branchOptions.map((branch) => ({ value: branch.id, label: branch.name }))} />
              <SelectInput label="Department" name="department" value={department} onChange={(event) => choose({ department: event.target.value, doctorId: '' })} placeholder="No department available" options={departments} />
            </div>
          </FlowSection>

          <FlowSection number="2" title="Clinician & visit type" aside="Therapists consulting at this branch">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-brand bg-white p-4">
              {doctor ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded bg-surface-low text-xs font-semibold">{initialsOf(doctor.displayName)}</span>
                  <div>
                    <p className="text-sm font-semibold">{doctor.credentials ? `${doctor.displayName}, ${doctor.credentials}` : doctor.displayName} <StatusPill tone="success" className="ml-1">Taking appointments</StatusPill></p>
                    <p className="text-xs text-on-surface-variant">{doctor.specialty}{doctor.room && ` · ${doctor.room}`}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">{practitioners.loading ? 'Loading therapists…' : 'No therapists are rostered in this department.'}</p>
              )}
              <OptionSelect label="Change doctor" name="doctorId" value={doctor?.id ?? ''} onChange={(event) => choose({ doctorId: event.target.value })} options={doctors.map((entry) => ({ value: entry.id, label: entry.displayName }))} className="min-w-44" />
            </div>
            {errors.doctorId && <p role="alert" className="mb-3 text-xs text-rose-600">{errors.doctorId}</p>}

            <p className="mb-1.5 text-[13px] font-semibold">Appointment type</p>
            <div role="tablist" aria-label="Appointment type" className="mb-4 grid grid-cols-2 rounded-md bg-surface-low p-1 sm:grid-cols-4">
              {APPOINTMENT_TYPES.map((type) => (
                <button key={type} type="button" role="tab" aria-selected={values.type === type} onClick={() => set('type', type)} className={cn('rounded px-3 py-1.5 text-xs font-medium', values.type === type ? 'bg-white shadow-sm' : 'text-on-surface-variant')}>
                  {type}
                </button>
              ))}
            </div>

            <p className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">Visit length <span className="text-[11px] font-normal text-outline">Set per therapist in their OPD schedule</span></p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-brand bg-teal-50/50 p-3">
                <p className="text-[13px] font-semibold">{values.type}</p>
                <p className="text-[10px] text-outline">{department || 'No department'}</p>
                <p className="mt-2 flex items-center justify-between text-xs"><span>{doctor ? `${doctor.slotMinutes} Mins Duration` : '—'}</span><strong>{TARIFF_NOTE}</strong></p>
              </div>
            </div>
          </FlowSection>

          <FlowSection number="3" title="Date & real-time time slot">
            <p className="mb-2 text-[13px] font-semibold">Select appointment date</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {days.map((day) => {
                const free = daySlots(day).filter((slot) => slot.state === 'available').length
                return (
                  <button key={day} type="button" aria-pressed={values.date === day} onClick={() => choose({ date: day })} className={cn('rounded-lg border p-3 text-left', values.date === day ? 'border-2 border-brand bg-white' : 'border-slate-200')}>
                    <span className="block text-[10px] font-semibold text-brand uppercase">{day === today ? 'Today' : formatWeekday(day).slice(0, 3)}</span>
                    <span className="block text-sm font-semibold">{formatDate(day).slice(0, 6)}</span>
                    <span className="block text-[10px] text-outline">{slots.loading ? 'Checking…' : `${free} slots left`}</span>
                  </button>
                )
              })}
            </div>
            {slots.error ? (
              <p role="alert" className="text-xs text-rose-600">{slots.error.message} <button type="button" onClick={slots.reload} className="font-semibold text-brand hover:underline">Try again</button></p>
            ) : (
              <SlotPicker slots={pickerSlots} session={values.session} onSessionChange={(session) => set('session', session)} value={values.slot} onChange={(slot) => setValues((current) => ({ ...current, slot, session: sessionOf(slot) }))} error={errors.slot} />
            )}
          </FlowSection>

          <FlowSection number="4" title="Visit details & automated communications" aside="Clinical record ID will generate upon intake">
            <div className="flex flex-col gap-4">
              <TextInput label="Reason for visit / primary concern" name="reason" required value={values.reason} onChange={update} error={errors.reason} hint="Visible to physician OPD roster and triage nurse station" />
              <TextArea label="Internal coordinator & reception desk note" name="note" rows={2} value={values.note} onChange={update} hint="Internal only. Never shared on external patient notifications." />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectInput label="Booking source / channel" name="source" value={values.source} onChange={update} options={BOOKING_SOURCES} />
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold">Notification preferences</p>
                  <div className="flex flex-col gap-2">
                    <Check checked={values.whatsapp} onChange={(event) => set('whatsapp', event.target.checked)} label={`WhatsApp confirmation (${patient.mobile})`} />
                    <Check checked={values.sms} onChange={(event) => set('sms', event.target.checked)} label="SMS reminder 2 hours prior to slot" />
                  </div>
                </div>
              </div>
              <InfoNote tone="brand"><strong>Notifications:</strong> preferences are saved with the booking. Messages are sent once an SMS / WhatsApp provider is connected.</InfoNote>
            </div>
          </FlowSection>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-4">
          <SideCard title="Booking summary" tag={<StatusPill tone="brand">NEW APT</StatusPill>}>
            <KeyValueRows rows={[
              ['Patient', `${patient.name} (${patient.mrn})`],
              ['Facility', branchOptions.find((branch) => branch.id === branchId)?.name ?? '—'],
              ['Department', department || '—'],
              ['Clinician', doctor?.displayName ?? '—'],
              ['Type & length', doctor ? `${values.type} · ${doctor.slotMinutes} min` : values.type],
              ['Scheduled slot', values.slot ? `${formatWeekday(values.date)}, ${formatDate(values.date)} · ${formatTime(values.slot)}` : 'Not selected'],
            ]} />
            <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
              <p className="flex items-center justify-between font-semibold">Tariff <span className="text-sm">{TARIFF_NOTE}</span></p>
              <p className="mt-1 text-[11px] text-on-surface-variant">No invoice is generated at booking stage.</p>
            </div>
            <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">System verification status</p>
            <ul className="flex flex-col gap-1.5">
              <ChecklistItem ok={Boolean(doctor)}>Therapist consulting at this branch</ChecklistItem>
              <ChecklistItem ok={Boolean(values.slot)}>Slot {values.slot ? 'selected from live availability' : 'pending selection'}</ChecklistItem>
              <ChecklistItem ok={!inactive}>{inactive ? 'Patient is inactive' : 'Patient record active'}</ChecklistItem>
              <ChecklistItem>Double booking checked by the server on save</ChecklistItem>
            </ul>
            {serverError && !serverError.field && <p role="alert" className="mt-3 text-xs text-rose-600">{serverError.message}</p>}
            <div className="mt-5 flex flex-col gap-2">
              <ActionButton variant="primary" className="w-full" disabled={saving || inactive} onClick={() => book('Confirmed')}>{saving ? 'Booking…' : 'Confirm & Book Appointment'}</ActionButton>
              <ActionButton className="w-full" disabled={saving || inactive} onClick={() => book('Pending')}>Save as Tentative Draft</ActionButton>
              <Link to={pathFor(ROUTES.patientAppointments, { patientId })} className="text-center text-xs text-outline hover:text-on-surface">Cancel and return to Appointments list</Link>
            </div>
          </SideCard>
          <InfoNote tone="warning"><strong>Scheduling guarantee notice:</strong> Submitting this form reserves the slot only. Encounter documentation, token allocation, and billing must be initiated separately upon patient arrival.</InfoNote>
        </div>
      </div>
    </FlowFrame>
  )
}
