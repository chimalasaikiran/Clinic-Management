import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { toPatientView } from '../../patients/adapters'
import { patientsApi, practitionersApi } from '../../patients/api'
import { Check, FieldError, OptionSelect, TextArea } from '../../patients/components/parts'
import { APPOINTMENT_TYPES } from '../../patients/data/catalog'
import { formatLongDate, formatTime, localClock } from '../../patients/format'
import { slotOf, validateWalkIn } from '../logic'

const SEARCH_DELAY_MS = 300

// Reception desk flow for a patient who arrives without a booking: pick the patient, the therapist and how to
// place them. `columns` are the therapists consulting at this branch today.
export default function WalkInDrawer({ date, branchId, branchName, columns, waitingCount, preset, saving, error, onClose, onCreate }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [patient, setPatient] = useState(null)
  const [values, setValues] = useState({ doctorId: preset?.doctorId ?? columns[0]?.doctorId ?? '', type: 'Consultation', complaint: '', option: 'slot', present: true })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])
  const results = useApiResource(() => (search.length >= 2 ? patientsApi.list({ query: search, status: 'active', pageSize: 5 }) : Promise.resolve(null)), search)
  const matches = (results.data?.data ?? []).map(toPatientView)

  // The therapist's first free slot today (or the cell that was clicked).
  const slots = useApiResource(() => (values.doctorId ? practitionersApi.slots(values.doctorId, { branchId, from: date, days: 1 }) : Promise.resolve(null)), `${values.doctorId}:${date}`)
  const free = (slots.data?.days[0]?.slots ?? []).filter((slot) => slot.state === 'available')
  const clicked = preset?.time && preset.doctorId === values.doctorId ? free.find((slot) => slotOf(slot.time) === preset.time) : null
  const freeSlot = clicked?.time ?? free[0]?.time
  const column = columns.find((entry) => entry.doctorId === values.doctorId)
  const form = { ...values, patientId: patient?.id ?? '' }
  const errors = submitted ? validateWalkIn(form, { hasSlot: Boolean(freeSlot) }) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const submit = (option) => {
    setSubmitted(true)
    const next = { ...form, option }
    if (option === 'queue') set('option', 'queue')
    if (Object.keys(validateWalkIn(next, { hasSlot: Boolean(freeSlot) })).length) return
    onCreate({ ...next, slot: option === 'slot' ? freeSlot : undefined, patient })
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Reception walk-in"
      title="Add Walk-In Patient"
      description="Allocate the next free slot with a therapist or place the patient in the live OPD arrival queue."
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ActionButton onClick={onClose}>Cancel [Esc]</ActionButton>
          <div className="flex gap-2">
            <ActionButton disabled={saving} onClick={() => submit('queue')}>Add to Waiting Queue Only</ActionButton>
            <ActionButton variant="primary" disabled={saving} onClick={() => submit(values.option)}>{saving ? 'Saving…' : 'Add Walk-In & Assign Slot'}</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <p className="flex flex-wrap gap-2 text-[11px]">
          <StatusPill>{branchName}</StatusPill><StatusPill>{formatLongDate(date)}</StatusPill><StatusPill tone="success" dot>{formatTime(localClock())}</StatusPill>
        </p>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Patient identification &amp; master lookup</h3>
          {patient ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-lowest p-3 text-xs">
              <div><p className="text-sm font-semibold">{patient.name} <span className="font-normal text-outline">({patient.age}y, {patient.gender})</span></p><p className="font-mono text-outline">{patient.mrn} · ABHA {patient.abha}</p><p className="text-outline">{patient.mobile} · Blood group {patient.bloodGroup}</p></div>
              <button type="button" onClick={() => setPatient(null)} className="font-semibold text-brand hover:underline">Change patient</button>
            </div>
          ) : (
            <>
              <TextInput label="Search patient" aria-label="Search patient by name, MRN or mobile" placeholder="Name, MRN or mobile number" value={query} onChange={(event) => setQuery(event.target.value)} />
              {matches.length > 0 && <ul className="mt-2 flex flex-col gap-1">{matches.map((entry) => <li key={entry.id}><button type="button" onClick={() => { setPatient(entry); setQuery('') }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs hover:bg-surface-lowest"><strong>{entry.name}</strong> · {entry.mrn} · {entry.mobile}</button></li>)}</ul>}
              {search.length >= 2 && !results.loading && matches.length === 0 && <p className="mt-2 text-xs text-on-surface-variant">No active patient matches “{search}”.</p>}
            </>
          )}
          <FieldError>{errors.patientId}</FieldError>
          <p className="mt-3 flex items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-on-surface-variant">Unregistered walk-in? <Link to={ROUTES.patientNew} className="font-semibold text-brand hover:underline">Register new patient →</Link></p>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Therapist &amp; visit type</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionSelect label="Consulting chamber / therapist" required value={values.doctorId} onChange={(event) => set('doctorId', event.target.value)} error={errors.doctorId} placeholder={columns.length ? undefined : 'Nobody is consulting today'} options={columns.map((entry) => ({ value: entry.doctorId, label: `${entry.chamber} · ${entry.doctor.name}` }))} />
            <OptionSelect label="Visit type" required value={values.type} onChange={(event) => set('type', event.target.value)} options={APPOINTMENT_TYPES.map((type) => ({ value: type, label: type }))} />
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">{column ? `${column.slotMinutes}-minute visit with ${column.doctor.short}. Fees are priced in billing.` : 'Choose a therapist to see the visit length.'}</p>
          <div className="mt-4"><TextArea label="Triage / walk-in reason & immediate complaint" required rows={3} value={values.complaint} onChange={(event) => set('complaint', event.target.value)} error={errors.complaint} /></div>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">Capacity check &amp; allocation pathway</h3>
          <div role="radiogroup" aria-label="Allocation pathway" className="flex flex-col gap-2">
            <RadioCard name="option" value="slot" checked={values.option === 'slot'} onChange={() => set('option', 'slot')} title="Option A: Allocate the next free OPD slot" badge={freeSlot && <StatusPill tone="success">Available</StatusPill>} detail={slots.loading ? 'Checking the therapist’s free slots…' : freeSlot ? `The ${formatTime(freeSlot)} slot with ${column?.doctor.short} is free.` : `${column?.doctor.short ?? 'This therapist'} has no free slot left today.`} />
            <RadioCard name="option" value="queue" checked={values.option === 'queue'} onChange={() => set('option', 'queue')} title="Option B: Place in live OPD walk-in waiting queue (priority overflow)" detail={`Issues the next waiting token behind ${waitingCount} patient${waitingCount === 1 ? '' : 's'} already waiting at this branch.`} />
          </div>
          <FieldError>{errors.slot}</FieldError>
          <div className="mt-3"><Check checked={values.present} onChange={(event) => set('present', event.target.checked)} label="Patient is physically present at the reception desk (issue an OPD token & mark arrived). Unchecked holds the slot as confirmed without a token." /></div>
        </section>

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
        <InfoNote tone="warning"><strong>Clinical policy:</strong> adding a walk-in reserves therapist time and registers arrival. It does NOT generate billing invoices, process payments, or create clinical records until the consultation starts.</InfoNote>
      </div>
    </Drawer>
  )
}
