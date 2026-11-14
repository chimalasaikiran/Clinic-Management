import { AlertTriangle, ArrowRight, CalendarClock, Printer, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { KeyValueRows, SideCard } from '../components/parts'
import Timeline from '../components/Timeline'
import { useAppointment } from '../context/useAppointment'
import { formatDate, formatINR, formatLongDate, formatTime } from '../format'
import { appointmentTone } from '../selectors'

const STAGES = ['Scheduled', 'Confirmed', 'Arrived', 'In Progress', 'Completed']
const GATE_COPY = {
  Scheduled: 'This is a tentative booking. Confirm it by reception or proceed to arrival when the patient reports.',
  Confirmed: 'Next standard action: mark arrival when the patient reports to reception. This will issue a queue token and alert the OPD triage desk for vitals recording.',
  Arrived: 'The patient is checked in and waiting. The consulting clinician can now start the encounter from the doctor workspace.',
  'In Progress': 'A clinical encounter is open for this appointment. Continue documentation in the encounter workspace.',
  Completed: 'This visit is complete. The appointment is preserved in the audit history.',
  Cancelled: 'This appointment was cancelled. Its record is preserved for audit and can no longer be changed.',
  'No-show': 'The patient did not attend. The record is preserved in audit history and the slot was released.',
}

function Lifecycle({ status }) {
  const closed = status === 'Cancelled' || status === 'No-show'
  const current = STAGES.indexOf(status)
  return (
    <section aria-label="Operational lifecycle progression" className="mb-5 rounded-lg border border-slate-200 bg-surface-lowest p-4">
      <p className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold tracking-wide text-outline uppercase">
        Operational lifecycle progression
        <span className="font-normal normal-case">Current stage: <strong className="text-brand">{status}</strong></span>
      </p>
      {closed ? (
        <p className={cn('text-sm font-semibold', 'text-danger')}>Lifecycle closed — {status}</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-5">
          {STAGES.map((stage, index) => (
            <li key={stage} aria-current={index === current ? 'step' : undefined} className={cn('rounded-md border px-3 py-2 text-xs', index === current ? 'border-brand bg-teal-50 font-semibold text-brand' : index < current ? 'border-slate-200 bg-white text-on-surface' : 'border-dashed border-slate-200 text-outline')}>
              {index + 1}. {stage}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function AppointmentDetailPage() {
  const { patient, patientId, appointment, mine } = useAppointment()
  if (!appointment) return <FlowMissing patient={patient} />

  const route = (pattern) => pathFor(pattern, { patientId, appointmentId: appointment.id })
  const open = ['Scheduled', 'Confirmed'].includes(appointment.status)
  const allergies = mine('allergies')
  const messages = mine('messages').slice(0, 2)

  return (
    <FlowFrame
      title={`Consultation with ${appointment.doctorShort}`}
      badge={<StatusPill tone={appointmentTone(appointment.status)} dot>{appointment.status}</StatusPill>}
      description={`${appointment.id} · ${formatLongDate(appointment.date)}, ${formatTime(appointment.time)} · ${appointment.minutes} min duration · Booked via ${appointment.channel ?? 'Reception'}`}
      actions={
        <>
          <BackLink to={pathFor(ROUTES.patientAppointments, { patientId })}>Appointments</BackLink>
          {open && <ActionButton icon={CalendarClock} to={route(ROUTES.appointmentReschedule)}>Reschedule</ActionButton>}
          {open && <ActionButton variant="primary" to={route(ROUTES.appointmentCheckIn)}>Mark arrival</ActionButton>}
          {appointment.status === 'Arrived' && <ActionButton variant="primary" icon={Stethoscope} to={route(ROUTES.appointmentStartEncounter)}>Start encounter</ActionButton>}
          {appointment.encounterId && <ActionButton variant="primary" to={pathFor(ROUTES.encounter, { patientId, encounterId: appointment.encounterId })}>Open encounter</ActionButton>}
        </>
      }
    >
      <Lifecycle status={appointment.status} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-slate-200 border-l-4 border-l-brand bg-white p-5">
            <p className="font-mono text-[10px] text-outline">OPERATIONAL ACTION GATE</p>
            <h2 className="mt-1 text-lg font-bold uppercase">{appointment.status} • {formatLongDate(appointment.date)} at {formatTime(appointment.time)}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{GATE_COPY[appointment.status]}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {open && <ActionButton variant="primary" to={route(ROUTES.appointmentCheckIn)}>Mark arrival</ActionButton>}
              <ActionButton icon={Printer} onClick={() => window.print()}>Print appointment slip</ActionButton>
              {open && <ActionButton variant="danger" to={route(ROUTES.appointmentCancel)}>Cancel appointment</ActionButton>}
              {open && <ActionButton variant="danger" to={route(ROUTES.appointmentNoShow)}>Mark as no-show</ActionButton>}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Patient identity &amp; clinical safety</h2>
              <Link to={pathFor(ROUTES.patientHub, { patientId })} className="text-xs font-semibold text-brand hover:underline">View patient profile →</Link>
            </header>
            <p className="mb-4 text-sm"><strong>{patient.name}</strong> <span className="font-mono text-xs text-on-surface-variant">{patient.mrn}</span> · {patient.age}y · {patient.gender} · {patient.mobile}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {allergies.length ? allergies.map((allergy) => (
                <div key={allergy.id} className="rounded-md border border-red-200 bg-red-50 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-danger"><AlertTriangle className="size-3.5" aria-hidden="true" />ALLERGY WARNING <StatusPill tone="danger">{allergy.severity.toUpperCase()}</StatusPill></p>
                  <p className="mt-1 font-semibold">{allergy.name} ({allergy.reaction})</p>
                </div>
              )) : <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs text-on-surface-variant">No allergies documented.</div>}
              <div className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-brand"><ShieldCheck className="size-3.5" aria-hidden="true" />ABDM CONSENT ON FILE</p>
                <p className="mt-1 font-semibold">{patient.consent}</p>
                <p className="text-on-surface-variant">Ayushman Bharat ID {patient.abha === 'Not linked' ? 'not linked' : 'linked'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">Appointment parameters</h2>
            <dl className="grid gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2">
              {[
                ['Service', appointment.service],
                ['Appointment type', `${appointment.type} (${appointment.mode})`],
                ['Consulting doctor', appointment.doctor],
                ['Department', appointment.department],
                ['Branch & facility location', `${appointment.branch} · ${appointment.room}`],
                ['Scheduled window', `${formatDate(appointment.date)}, ${formatTime(appointment.time)} (${appointment.minutes} min)`],
                ['Booking channel & operator', `${appointment.channel ?? 'Reception'} · ${appointment.bookedBy ?? 'Reception desk'}`],
                ['Slot allocation mode', 'Standard fixed block (guaranteed)'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] text-outline">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {appointment.reason && (
              <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Reason for visit</p>
                <p className="mt-1 italic">&ldquo;{appointment.reason}&rdquo;</p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">OPD live queue context</h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ['Queue token', appointment.queueToken ?? 'Assigned at arrival'],
                ['Expected slot', formatTime(appointment.time)],
                ['Arrival recorded', appointment.arrivedAt ? formatTime(appointment.arrivedAt) : 'Not yet arrived'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <InfoNote tone={appointment.encounterId ? 'brand' : 'warning'} icon={Stethoscope}>
            <strong>Clinical encounter boundary:</strong>{' '}
            {appointment.encounterId
              ? `Encounter #${appointment.encounterId} is linked to this appointment.`
              : 'No encounter has been started for this appointment. Clinical charting is only permitted once the patient has arrived and the doctor starts the encounter.'}
          </InfoNote>
        </div>

        <div className="flex flex-col gap-5">
          <SideCard title="Financial governance & tariff">
            <KeyValueRows rows={[['Configured service tariff', formatINR(appointment.tariff ?? 0, 2)], ['Payment commitment', appointment.status === 'Completed' ? 'Billed on encounter' : 'Pending (zero premature debit)']]} />
            <InfoNote className="mt-3"><strong>Strict rule:</strong> booking an appointment never automatically executes financial charges or generates taxable debits.</InfoNote>
            <ActionButton className="mt-3 w-full" to={pathFor(ROUTES.patientBilling, { patientId })}>Open billing ledger</ActionButton>
          </SideCard>

          <SideCard title="Patient communications" tag={<span className="text-[10px] text-outline">TRAI DLT Verified</span>}>
            <ul className="flex flex-col gap-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-md border border-slate-200 p-3 text-xs">
                  <p className="font-semibold">{message.channel} · {message.direction}</p>
                  <p className="mt-0.5 text-on-surface-variant">{message.preview}</p>
                  <p className="mt-1 text-[11px] text-brand">{message.status}</p>
                </li>
              ))}
              {messages.length === 0 && <li className="text-xs text-on-surface-variant">No messages sent yet.</li>}
            </ul>
            <ActionButton className="mt-3 w-full" icon={ArrowRight} to={pathFor(ROUTES.patientCommunication, { patientId })}>Open communication hub</ActionButton>
          </SideCard>

          <SideCard title="Audit & state ledger" tag={<span className="font-mono text-[10px] text-outline">NODE #HYD-04</span>}>
            <Timeline events={appointment.audit ?? []} />
          </SideCard>
        </div>
      </div>
    </FlowFrame>
  )
}
