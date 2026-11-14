import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { Check, FieldError, OptionSelect, TextArea } from '../../patients/components/parts'
import { DOCTORS, SERVICES } from '../../patients/data/catalog'
import { formatDate, formatINR, formatLongDate, formatTime } from '../../patients/format'
import { CHAMBERS, SCHEDULE_NOW } from '../constants'
import { firstFreeSlot, validateWalkIn, waitingToken } from '../logic'

// Reception desk flow for a patient who arrives without a booking: pick the patient, the chamber and how to place them.
export default function WalkInDrawer({ date, sessionId, appointments, patients, preset, onClose, onCreate }) {
  const [query, setQuery] = useState('')
  const [values, setValues] = useState({ patientId: '', doctorId: preset?.doctorId ?? CHAMBERS[0].doctorId, serviceCode: '', complaint: '', option: 'slot', present: true })
  const [submitted, setSubmitted] = useState(false)
  const doctor = DOCTORS.find((entry) => entry.id === values.doctorId)
  const services = SERVICES.filter((service) => service.department === doctor?.department)
  const freeSlot = preset?.time && preset.doctorId === values.doctorId ? preset.time : firstFreeSlot(appointments, date, values.doctorId, sessionId)
  const full = { ...values, slot: values.option === 'slot' ? freeSlot : undefined }
  const errors = submitted ? validateWalkIn(full, appointments, date) : {}
  const patient = patients.find((entry) => entry.id === values.patientId)
  const needle = query.trim().toLowerCase()
  const matches = needle.length >= 2 ? patients.filter((entry) => `${entry.name} ${entry.mrn} ${entry.mobile}`.toLowerCase().includes(needle)).slice(0, 4) : []
  const service = SERVICES.find((entry) => entry.code === values.serviceCode)
  const queueDepth = appointments.filter((entry) => entry.date === date && entry.doctorId === values.doctorId && entry.status === 'Arrived').length
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const submit = (option) => {
    setSubmitted(true)
    const next = { ...values, option, slot: option === 'slot' ? freeSlot : undefined }
    if (option === 'queue') set('option', 'queue')
    if (Object.keys(validateWalkIn(next, appointments, date)).length) return
    onCreate(next)
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Reception walk-in"
      title="Add Walk-In Patient"
      description="Allocate an immediate unallocated chamber slot or place the patient in the live OPD arrival queue."
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ActionButton onClick={onClose}>Cancel &amp; Release Lock [Esc]</ActionButton>
          <div className="flex gap-2">
            <ActionButton onClick={() => submit('queue')}>Add to Waiting Queue Only</ActionButton>
            <ActionButton variant="primary" onClick={() => submit(values.option)}>Add Walk-In &amp; Assign Slot [⌘Enter]</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <p className="flex flex-wrap gap-2 text-[11px]">
          <StatusPill>Main Pavilion · Room 304</StatusPill><StatusPill>{formatLongDate(date)}</StatusPill><StatusPill>Priya Nair (Desk 01)</StatusPill><StatusPill tone="success" dot>{formatTime(SCHEDULE_NOW)} IST</StatusPill>
        </p>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Patient identification &amp; master lookup</h3>
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-lowest p-3 text-xs">
              <div><p className="text-sm font-semibold">{patient.name} <span className="font-normal text-outline">({patient.age}y, {patient.gender})</span></p><p className="font-mono text-outline">{patient.mrn} · ABHA {patient.abha}</p><p className="text-outline">{patient.mobile} · Blood group {patient.bloodGroup}</p></div>
              <button type="button" onClick={() => set('patientId', '')} className="font-semibold text-brand hover:underline">Change patient</button>
            </div>
          ) : (
            <>
              <TextInput label="Search patient" aria-label="Search patient by name, MRN or mobile" placeholder="Name, MRN or mobile number" value={query} onChange={(event) => setQuery(event.target.value)} />
              {matches.length > 0 && <ul className="mt-2 flex flex-col gap-1">{matches.map((entry) => <li key={entry.id}><button type="button" onClick={() => { set('patientId', entry.id); setQuery('') }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs hover:bg-surface-lowest"><strong>{entry.name}</strong> · {entry.mrn} · {entry.mobile}</button></li>)}</ul>}
              {needle.length >= 2 && matches.length === 0 && <p className="mt-2 text-xs text-on-surface-variant">No registered patient matches “{query}”.</p>}
            </>
          )}
          <FieldError>{errors.patientId}</FieldError>
          <p className="mt-3 flex items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-on-surface-variant">Unregistered walk-in? <Link to={ROUTES.patientNew} className="font-semibold text-brand hover:underline">Register new patient →</Link></p>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Clinician chamber &amp; service tariff assignment</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionSelect label="Consulting chamber / clinician" required value={values.doctorId} onChange={(event) => setValues((current) => ({ ...current, doctorId: event.target.value, serviceCode: '' }))} error={errors.doctorId} options={CHAMBERS.map((entry) => ({ value: entry.doctorId, label: `${entry.chamber} · ${DOCTORS.find((item) => item.id === entry.doctorId).name}` }))} />
            <OptionSelect label="Service package" required placeholder="Select a service" value={values.serviceCode} onChange={(event) => set('serviceCode', event.target.value)} error={errors.serviceCode} options={services.map((entry) => ({ value: entry.code, label: `${entry.name} · ${formatINR(entry.price)}` }))} />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">{service ? `${service.minutes}-minute consultation · ${formatINR(service.price)} payable at the cashier desk.` : 'Choose a service to see its duration and tariff.'} Arrival timestamp: {formatDate(date)}, {formatTime(SCHEDULE_NOW)}.</p>
          <div className="mt-4"><TextArea label="Triage / walk-in reason & immediate complaint" required rows={3} value={values.complaint} onChange={(event) => set('complaint', event.target.value)} error={errors.complaint} /></div>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Capacity check &amp; allocation pathway</h3>
          <div role="radiogroup" aria-label="Allocation pathway" className="flex flex-col gap-2">
            <RadioCard name="option" value="slot" checked={values.option === 'slot'} onChange={() => set('option', 'slot')} title="Option A: Allocate immediate OPD slot" badge={freeSlot && <StatusPill tone="success">Optimal</StatusPill>} detail={freeSlot ? `The ${formatTime(freeSlot)} slot in ${doctor?.short}'s chamber is free. Roster updates on commit.` : `${doctor?.short} has no free slot left in this session.`} />
            <RadioCard name="option" value="queue" checked={values.option === 'queue'} onChange={() => set('option', 'queue')} title="Option B: Place in live OPD walk-in waiting queue (priority overflow)" detail={`Assigns the next sequential token ${waitingToken(appointments, date)} behind ${queueDepth} patient${queueDepth === 1 ? '' : 's'} already waiting for this chamber.`} />
          </div>
          <FieldError>{errors.slot}</FieldError>
          <div className="mt-3"><Check checked={values.present} onChange={(event) => set('present', event.target.checked)} label="Patient is physically present at the reception desk (generate an OPD token & mark arrived). Unchecked holds the slot as confirmed without printing a queue token." /></div>
        </section>

        <InfoNote tone="warning"><strong>Clinical policy:</strong> adding a walk-in reserves clinician time and registers arrival. It does NOT automatically generate billing invoices, process payments, or create clinical EMR records until the physician starts the consultation.</InfoNote>
      </div>
    </Drawer>
  )
}
