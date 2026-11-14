import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import FlowFrame, { FlowMissing } from '../components/FlowFrame'
import { Check, ChecklistItem, FlowSection, KeyValueRows, OptionSelect, PatientStrip, SideCard, TextArea } from '../components/parts'
import SlotPicker from '../components/SlotPicker'
import { usePatient } from '../context/usePatient'
import { APPOINTMENT_TYPES, BOOKING_SOURCES, DEPARTMENTS, DOCTORS, FACILITIES, SERVICES } from '../data/catalog'
import { TODAY, formatDate, formatINR, formatTime, formatWeekday } from '../format'
import { auditEntry, datesFrom, doctorById, isUpcoming, sessionOf, slotsFor } from '../selectors'
import { validateBooking } from '../validation'

const facilityParts = (facility) => {
  const [branch, campus = ''] = facility.split(' · ')
  return { branch, campus }
}

export default function BookAppointmentPage() {
  const { patient, patientId, records, add, newId, mine } = usePatient()
  const navigate = useNavigate()
  const [values, setValues] = useState({
    facility: FACILITIES[0], department: 'Cardiology', doctorId: 'rahul-mehta', type: 'Consultation', serviceCode: 'SRV-CARD-001',
    date: TODAY, session: 'afternoon', slot: '', reason: '', note: '', source: BOOKING_SOURCES[0], whatsapp: true, sms: true,
  })
  const [submitted, setSubmitted] = useState(false)

  if (!patient) return <FlowMissing patient={patient} />

  const doctor = doctorById(values.doctorId)
  const doctors = DOCTORS.filter((entry) => entry.department === values.department)
  const services = SERVICES.filter((entry) => entry.department === values.department)
  const service = SERVICES.find((entry) => entry.code === values.serviceCode)
  const days = datesFrom(TODAY, 5)
  const slots = doctor ? slotsFor(values.date, doctor.id, records.appointments) : []
  const conflict = values.slot && mine('appointments').some((entry) => isUpcoming(entry) && entry.date === values.date && entry.time === values.slot)
  const errors = submitted ? { ...validateBooking(values), ...(conflict ? { slot: 'This patient already has an appointment at that time.' } : {}) } : {}

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)
  const chooseDepartment = (department) => {
    const firstDoctor = DOCTORS.find((entry) => entry.department === department)
    const firstService = SERVICES.find((entry) => entry.department === department)
    setValues((current) => ({ ...current, department, doctorId: firstDoctor?.id ?? '', serviceCode: firstService?.code ?? '', slot: '' }))
  }

  const book = (status) => {
    setSubmitted(true)
    if (Object.keys(validateBooking(values)).length || conflict) return
    const { branch, campus } = facilityParts(values.facility)
    const appointment = add('appointments', {
      id: newId('APT-2026-', 'appointments', 4), patientId, date: values.date, time: values.slot, minutes: service.minutes, type: values.type, mode: 'In-Person Clinical Consultation',
      service: service.name, serviceCode: service.code, tariff: service.price, doctorId: doctor.id, doctor: doctor.name, doctorShort: doctor.short, specialty: doctor.specialty,
      department: values.department, room: doctor.suite, branch, campus, status, reason: values.reason.trim(), note: values.note.trim(), channel: values.source, bookedBy: 'Reception desk',
      notify: { whatsapp: values.whatsapp, sms: values.sms }, audit: [auditEntry(status === 'Confirmed' ? 'Appointment booked' : 'Saved as tentative draft', `Booking source: ${values.source}`)],
    })
    navigate(pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id }))
  }

  return (
    <FlowFrame title="Book appointment" description="Schedule a validated clinical visit for the patient without generating premature encounter or billing records.">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <PatientStrip patient={patient}>
            <Link to={pathFor(ROUTES.patientHub, { patientId })} className="text-xs font-semibold text-brand hover:underline">View patient profile →</Link>
          </PatientStrip>

          <FlowSection number="1" title="Location & clinical department" aside="Branch operating hours: 08:00 AM – 08:30 PM IST">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Facility / node" name="facility" value={values.facility} onChange={update} options={FACILITIES} />
              <SelectInput label="Department" name="department" value={values.department} onChange={(event) => chooseDepartment(event.target.value)} options={DEPARTMENTS} error={errors.department} />
            </div>
          </FlowSection>

          <FlowSection number="2" title="Clinician & service package" aside="Standard attending roster">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-brand bg-white p-4">
              {doctor ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded bg-surface-low text-xs font-semibold">{doctor.initials}</span>
                  <div>
                    <p className="text-sm font-semibold">{doctor.name} <StatusPill tone="success" className="ml-1">In Clinic · OPD Active</StatusPill></p>
                    <p className="text-xs text-on-surface-variant">{doctor.specialty} · Consultation {doctor.suite}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">No doctors are rostered in this department.</p>
              )}
              <OptionSelect label="Change doctor" name="doctorId" value={values.doctorId} onChange={(event) => setValues((current) => ({ ...current, doctorId: event.target.value, slot: '' }))} options={doctors.map((entry) => ({ value: entry.id, label: entry.short }))} className="min-w-44" />
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

            <p className="mb-1.5 flex items-center justify-between text-[13px] font-semibold">Standard clinical service <span className="text-[11px] font-normal text-outline">Configured via Services &amp; Pricing catalog</span></p>
            <div className="grid gap-3 sm:grid-cols-3">
              {services.map((entry) => (
                <label key={entry.code} className={cn('cursor-pointer rounded-lg border p-3', values.serviceCode === entry.code ? 'border-brand bg-teal-50/50' : 'border-slate-200')}>
                  <input type="radio" name="serviceCode" value={entry.code} checked={values.serviceCode === entry.code} onChange={update} className="sr-only" />
                  <p className="text-[13px] font-semibold">{entry.name}</p>
                  <p className="text-[10px] text-outline">Code: #{entry.code}</p>
                  <p className="mt-2 flex items-center justify-between text-xs"><span>{entry.minutes} Mins Duration</span><strong>{formatINR(entry.price)}</strong></p>
                </label>
              ))}
            </div>
            {errors.serviceCode && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.serviceCode}</p>}
          </FlowSection>

          <FlowSection number="3" title="Date & real-time time slot">
            <p className="mb-2 text-[13px] font-semibold">Select appointment date</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {days.map((day) => {
                const free = doctor ? slotsFor(day, doctor.id, records.appointments).filter((slot) => slot.state === 'available').length : 0
                return (
                  <button key={day} type="button" aria-pressed={values.date === day} onClick={() => setValues((current) => ({ ...current, date: day, slot: '' }))} className={cn('rounded-lg border p-3 text-left', values.date === day ? 'border-2 border-brand bg-white' : 'border-slate-200')}>
                    <span className="block text-[10px] font-semibold text-brand uppercase">{day === TODAY ? 'Today' : formatWeekday(day).slice(0, 3)}</span>
                    <span className="block text-sm font-semibold">{formatDate(day).slice(0, 6)}</span>
                    <span className="block text-[10px] text-outline">{free} slots left</span>
                  </button>
                )
              })}
            </div>
            <SlotPicker slots={slots} session={values.session} onSessionChange={(session) => set('session', session)} value={values.slot} onChange={(slot) => setValues((current) => ({ ...current, slot, session: sessionOf(slot) }))} error={errors.slot} />
          </FlowSection>

          <FlowSection number="4" title="Visit details & automated communications" aside="Clinical record ID will generate upon intake">
            <div className="flex flex-col gap-4">
              <TextInput label="Reason for visit / primary concern" name="reason" required value={values.reason} onChange={update} error={errors.reason} hint="Visible to physician OPD roster and triage nurse station" />
              <TextArea label="Internal coordinator & reception desk note" name="note" rows={2} value={values.note} onChange={update} hint="Internal only. Never shared on external patient notifications." />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectInput label="Booking source / channel" name="source" value={values.source} onChange={update} options={BOOKING_SOURCES} />
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold">Automated dispatch protocols</p>
                  <div className="flex flex-col gap-2">
                    <Check checked={values.whatsapp} onChange={(event) => set('whatsapp', event.target.checked)} label={`WhatsApp confirmation (${patient.mobile})`} />
                    <Check checked={values.sms} onChange={(event) => set('sms', event.target.checked)} label="SMS reminder 2 hours prior to slot" />
                  </div>
                </div>
              </div>
              <InfoNote tone="brand"><strong>Telecommunication compliance:</strong> Templates pre-approved under TRAI DLT registration.</InfoNote>
            </div>
          </FlowSection>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-4">
          <SideCard title="Booking summary" tag={<StatusPill tone="brand">NEW APT</StatusPill>}>
            <KeyValueRows rows={[
              ['Patient', `${patient.name} (${patient.mrn})`],
              ['Facility', values.facility],
              ['Department', values.department],
              ['Clinician', doctor?.name ?? '—'],
              ['Type & service', `${values.type} · ${service?.name ?? '—'}`],
              ['Scheduled slot', values.slot ? `${formatWeekday(values.date)}, ${formatDate(values.date)} · ${formatTime(values.slot)}` : 'Not selected'],
            ]} />
            <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
              <p className="flex items-center justify-between font-semibold">Configured tariff <span className="text-base">{service ? formatINR(service.price) : '—'}</span></p>
              <p className="mt-1 text-[11px] text-on-surface-variant">Base consultation fee. No invoice is generated at booking stage.</p>
            </div>
            <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">System verification status</p>
            <ul className="flex flex-col gap-1.5">
              <ChecklistItem ok={Boolean(doctor)}>Doctor duty active</ChecklistItem>
              <ChecklistItem>Branch operational window · 08:00 – 20:30</ChecklistItem>
              <ChecklistItem ok={Boolean(values.slot)}>OP suite allocation {values.slot ? 'confirmed' : 'pending slot'}</ChecklistItem>
              <ChecklistItem ok={!conflict}>{conflict ? 'Duplicate appointment conflict' : 'No duplicate appointment conflicts'}</ChecklistItem>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <ActionButton variant="primary" className="w-full" onClick={() => book('Confirmed')}>Confirm &amp; Book Appointment</ActionButton>
              <ActionButton className="w-full" onClick={() => book('Scheduled')}>Save as Tentative Draft</ActionButton>
              <Link to={pathFor(ROUTES.patientAppointments, { patientId })} className="text-center text-xs text-outline hover:text-on-surface">Cancel and return to Appointments list</Link>
            </div>
          </SideCard>
          <InfoNote tone="warning"><strong>Scheduling guarantee notice:</strong> Submitting this form reserves the slot only. Encounter documentation, token allocation, and billing must be initiated separately upon patient arrival.</InfoNote>
        </div>
      </div>
    </FlowFrame>
  )
}
