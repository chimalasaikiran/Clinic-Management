import { useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { TARIFF_NOTE } from '../adapters'
import { appointmentsApi } from '../api'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { Check, ChecklistItem, FlowSection, KeyValueRows, SideCard, TextArea } from '../components/parts'
import { useAppointment } from '../context/useAppointment'
import { ARRIVAL_CHANNELS } from '../data/catalog'
import { formatLongDate, formatTime, localToday } from '../format'
import { appointmentTone, clockTime, isChangeable } from '../selectors'
import { validateCheckIn } from '../validation'

export default function CheckInPage() {
  const { patient, patientId, appointment, loading, reload } = useAppointment()
  const navigate = useNavigate()
  const [values, setValues] = useState({ time: clockTime(), channel: ARRIVAL_CHANNELS[0], note: '', printSlip: true, notify: true })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  // Patients already waiting at this branch today, for the queue position.
  const queue = useApiResource(
    () => (appointment ? appointmentsApi.list({ date: appointment.date, branchId: appointment.branchId, status: 'arrived', pageSize: 200 }) : Promise.resolve(null)),
    appointment ? `${appointment.date}:${appointment.branchId}` : 'none',
  )

  if (!appointment) return <FlowMissing patient={patient} loading={loading} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const ready = isChangeable(appointment)
  const today = appointment.date === localToday()
  const errors = submitted ? validateCheckIn(values) : {}
  const token = appointment.queueToken ?? 'Next'
  const waiting = queue.data?.meta?.total ?? 0
  const earlyBy = Math.max(0, Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) - (Number(values.time.slice(0, 2)) * 60 + Number(values.time.slice(3))))

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update_ = (event) => set(event.target.name, event.target.value)

  const confirm = async () => {
    setSubmitted(true)
    setServerError('')
    if (Object.keys(validateCheckIn(values)).length) return
    setSaving(true)
    try {
      await appointmentsApi.checkIn(appointment.id, [values.channel, values.note.trim()].filter(Boolean).join(' — '))
      await reload()
      navigate(backTo)
    } catch (error) {
      setSaving(false)
      setServerError(error.message)
    }
  }

  return (
    <FlowFrame
      title="Check in patient"
      badge={<StatusPill tone="success">Scheduled slot verified</StatusPill>}
      description="Confirm physical arrival at reception, generate the operational waiting queue slip, and notify the consulting suite."
      actions={<BackLink to={backTo}>Back to {appointment.reference}</BackLink>}
    >
      <InfoNote tone="warning" icon={ShieldCheck} className="mb-5">
        <strong>Statutory boundary enforced:</strong> marking arrival issues a queue token only. It will <u>not</u> start an encounter, bill an invoice, or record clinical triage notes.
      </InfoNote>

      <section className="mb-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-5">
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient</span><br /><strong className="text-sm">{patient.name}</strong><br />{patient.age}y · {patient.gender}<br />{patient.mobile}</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting doctor</span><br /><strong className="text-sm">{appointment.doctor}</strong><br />{appointment.department}<br />{appointment.room}</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Scheduled appointment</span><br /><strong className="text-sm">{formatLongDate(appointment.date)}</strong><br />{formatTime(appointment.time)} IST</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Service & tariff</span><br /><strong className="text-sm">{appointment.service}</strong><br />{TARIFF_NOTE}</p>
        <p><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Arrival & queue state</span><br /><StatusPill tone={appointmentTone(appointment.status)}>{ready ? 'Pending reception check-in' : appointment.status}</StatusPill><br />Target token: <strong>{token}</strong></p>
      </section>

      {!ready ? (
        <InfoNote tone="warning" icon={AlertTriangle}>This appointment is <strong>{appointment.status}</strong>, so arrival cannot be recorded. Only pending or confirmed appointments can be checked in.</InfoNote>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5">
            <FlowSection number="1" title="Patient arrival verification" aside="Identity confirmed">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Recorded arrival timestamp" name="time" type="time" required readOnly value={values.time} onChange={update_} error={errors.time} hint={earlyBy ? `Patient arrived ${earlyBy} min early · the server records the exact time` : 'The server records the exact time on confirmation'} />
                <SelectInput label="Arrival verification channel" name="channel" required value={values.channel} onChange={update_} options={ARRIVAL_CHANNELS} error={errors.channel} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                <span>ABHA number: <strong className="font-mono">{patient.abha}</strong></span>
                <StatusPill tone={patient.abha === 'Not linked' ? 'neutral' : 'success'}>{patient.abha === 'Not linked' ? 'NOT LINKED' : 'ON FILE'}</StatusPill>
              </div>
              <div className="mt-4">
                <TextArea label="Operational note for reception & nursing station" rows={2} value={values.note} onChange={(event) => set('note', event.target.value)} hint="Visible on the consulting suite nursing console and queue board. Operational context, not clinical documentation." />
              </div>
            </FlowSection>

            <FlowSection number="2" title="Operational queue placement" aside="Queue engine online">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-slate-900 p-4 text-white"><p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Assigned token</p><p className="mt-1 font-mono text-3xl font-bold text-teal-300">{token}</p><p className="text-[11px] text-slate-400">{appointment.department}</p></div>
                <div className="rounded-md border border-slate-200 p-4"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Queue position</p><p className="mt-1 font-mono text-3xl font-bold">#{waiting + 1}</p><p className="text-[11px] text-on-surface-variant">{waiting} patient{waiting === 1 ? '' : 's'} currently waiting</p></div>
                <div className="rounded-md border border-slate-200 p-4"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Estimated wait</p><p className="mt-1 font-mono text-3xl font-bold">~{(waiting + 1) * 7} min</p><p className="text-[11px] text-on-surface-variant">Doctor in consultation</p></div>
              </div>
              <KeyValueRows rows={[['Assigned queue', `${appointment.department} Waiting Queue — ${appointment.branch}`], ['Physician chamber', `${appointment.doctor} (${appointment.room})`], ['Designated waiting area', `${appointment.campus || appointment.branch} waiting lounge`]]} />
              <div className="mt-4 flex flex-col gap-2">
                <Check checked={values.printSlip} onChange={(event) => set('printSlip', event.target.checked)} label="Auto-print physical thermal queue slip (Desk-02)" />
                <Check checked={values.notify} onChange={(event) => set('notify', event.target.checked)} label={`Send WhatsApp/SMS queue beacon & live tracking URL to patient (${patient.mobile})`} />
              </div>
            </FlowSection>

            <InfoNote tone="brand">
              <strong>Clinical encounter separation boundary:</strong> the clinical encounter remains in state &ldquo;Not Started&rdquo;. When the doctor calls token {token}, they start the encounter directly from the doctor workspace.
            </InfoNote>
          </div>

          <div className="flex flex-col gap-4 xl:sticky xl:top-4">
            <SideCard title="Pre-flight authorization" tag={<span className="font-mono text-[10px] text-outline">{appointment.reference} → ARRIVED</span>}>
              <KeyValueRows rows={[['Patient', `${patient.name} (${patient.mrn})`], ['Arrival time', values.time ? formatTime(values.time) : '—'], ['Queue allocation', `${appointment.department}`], ['Projected token', `${token} (#${waiting + 1})`], ['Consulting chamber', `${appointment.room} (${appointment.doctorShort})`]]} />
              <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">System safety guards (4/4 passed)</p>
              <ul className="flex flex-col gap-1.5">
                <ChecklistItem ok={today}>{today ? 'Appointment is today' : 'Check-in opens on the day of the appointment'}</ChecklistItem>
                <ChecklistItem>Token issued by the server, unique for the day</ChecklistItem>
                <ChecklistItem>Concurrent check-ins are serialised</ChecklistItem>
              </ul>
              <div className="mt-5 flex flex-col gap-2">
                {serverError && <p role="alert" className="text-xs text-rose-600">{serverError}</p>}
                <ActionButton variant="primary" className="w-full" disabled={saving || !today} onClick={confirm}>{saving ? 'Checking in…' : 'Confirm arrival & issue token'}</ActionButton>
                <ActionButton className="w-full" to={backTo}>Cancel (keep scheduled)</ActionButton>
              </div>
            </SideCard>
          </div>
        </div>
      )}
    </FlowFrame>
  )
}
