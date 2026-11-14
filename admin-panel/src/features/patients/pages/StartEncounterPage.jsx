import { AlertTriangle, ClipboardCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { ChecklistItem, FlowSection, KeyValueRows, SideCard } from '../components/parts'
import { useAppointment } from '../context/useAppointment'
import { formatDate, formatINR, formatLongDate, formatTime } from '../format'
import { auditEntry, byNewest, clockTime } from '../selectors'

export default function StartEncounterPage() {
  const { patient, patientId, appointment, mine, add, update, newId } = useAppointment()
  const navigate = useNavigate()
  if (!appointment) return <FlowMissing patient={patient} />

  const backTo = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const arrived = appointment.status === 'Arrived'
  const allergies = mine('allergies')
  const latestVitals = mine('vitals').sort(byNewest)[0]

  const start = () => {
    const encounter = add('encounters', {
      id: newId('ENC-2026-', 'encounters', 4), patientId, appointmentId: appointment.id, date: appointment.date, time: clockTime(), minutes: 0, mode: 'OPD',
      type: appointment.service, reason: appointment.reason ?? appointment.service, icd: '', doctor: appointment.doctorShort, credentials: appointment.doctor.split(', ').slice(1).join(', '),
      department: appointment.department, chamber: appointment.room, branch: appointment.branch, campus: appointment.campus, artifacts: [], status: 'In Progress',
      complaint: appointment.reason ?? '', soap: { subjective: '', objective: '', assessment: '', plan: '' },
    })
    update('appointments', appointment.id, (current) => ({ status: 'In Progress', encounterId: encounter.id, audit: [auditEntry(`Encounter ${encounter.id} started`, appointment.doctorShort), ...(current.audit ?? [])] }))
    navigate(pathFor(ROUTES.encounter, { patientId, encounterId: encounter.id }))
  }

  return (
    <FlowFrame
      title="Start encounter"
      badge={<span className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-xs font-normal">{appointment.id}</span>}
      description="Transition this appointment into an active clinical care delivery. This creates an encounter record and opens the Clinical Workspace."
      actions={<BackLink to={backTo}>Back to {appointment.id}</BackLink>}
    >
      <InfoNote tone="neutral" icon={ClipboardCheck} className="mb-5">
        <strong className="text-on-surface">Statutory clinical boundary:</strong> transitioning to an encounter marks the consultation in progress. It does <u>not</u> automatically commit charges, generate or sign clinical notes, or dispense medications.
      </InfoNote>

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <header className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">Active patient &amp; appointment context</h2><StatusPill tone={arrived ? 'success' : 'warning'} dot>{appointment.status}{arrived && ' · Ready for encounter'}</StatusPill></header>
        <dl className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient details</dt><dd className="text-sm font-semibold">{patient.name}</dd><dd className="text-on-surface-variant">{patient.age}y / {patient.gender} · {patient.mobile}</dd></div>
          <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting clinician</dt><dd className="text-sm font-semibold">{appointment.doctor}</dd><dd className="text-on-surface-variant">{appointment.department} · {appointment.room}</dd></div>
          <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Scheduled slot</dt><dd className="text-sm font-semibold">{formatLongDate(appointment.date)}</dd><dd className="text-on-surface-variant">{formatTime(appointment.time)} ({appointment.minutes} min)</dd></div>
          <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Arrival & queue state</dt><dd className="text-sm font-semibold">Token {appointment.queueToken ?? '—'}</dd><dd className="text-on-surface-variant">{appointment.arrivedAt ? `Arrived ${formatTime(appointment.arrivedAt)}` : 'Not yet arrived'}</dd></div>
        </dl>
      </section>

      {!arrived ? (
        <InfoNote tone="danger" icon={AlertTriangle}>
          <strong>Patient not arrived:</strong> an encounter can only be started for an appointment in the <strong>Arrived</strong> state (currently {appointment.status}).{' '}
          {['Scheduled', 'Confirmed'].includes(appointment.status) && <Link className="font-semibold underline" to={pathFor(ROUTES.appointmentCheckIn, { patientId, appointmentId: appointment.id })}>Check the patient in first.</Link>}
        </InfoNote>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5">
            <FlowSection title="Clinical context & appointment binding" aside="Read-only configuration">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-surface-lowest p-3 text-xs"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Service specification</p><p className="mt-1 text-sm font-semibold">{appointment.service}</p><p className="text-on-surface-variant">Tariff: {formatINR(appointment.tariff ?? 0)}</p></div>
                <div className="rounded-md bg-surface-lowest p-3 text-xs"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Encounter type</p><p className="mt-1 text-sm font-semibold">{appointment.type} (Ambulatory OPD)</p><p className="text-on-surface-variant">Inherited from master service configuration.</p></div>
                <div className="rounded-md bg-surface-lowest p-3 text-xs"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Facility location</p><p className="mt-1 text-sm font-semibold">{appointment.branch} — {appointment.room}</p><p className="text-on-surface-variant">{appointment.campus}</p></div>
                <div className="rounded-md bg-surface-lowest p-3 text-xs"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Physical roster verification</p><p className="mt-1 text-sm font-semibold">{appointment.doctor}</p><p className="text-on-surface-variant">Practitioner clocked-in at workstation</p></div>
              </div>
              <p className="mt-3 text-xs text-on-surface-variant">Queue token <strong>{appointment.queueToken}</strong> will transition automatically from &lsquo;Waiting&rsquo; to &lsquo;Called / In Consultation&rsquo;.</p>
            </FlowSection>

            <FlowSection title="Clinical safety guards & pre-triage vitals">
              {allergies.length > 0 && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs">
                  <p className="font-semibold text-danger">{allergies[0].severity} {allergies[0].name} allergy recorded <StatusPill tone="danger">ANAPHYLAXIS RISK</StatusPill></p>
                  <p className="mt-1 text-on-surface-variant">Verified by clinical immunology records. Prescriptions with {allergies[0].classLabel.toLowerCase()} core will be strictly interlocked.</p>
                </div>
              )}
              {latestVitals ? (
                <dl className="grid gap-3 sm:grid-cols-4">
                  {[['Blood pressure', `${latestVitals.bp.sys}/${latestVitals.bp.dia}`, 'mmHg'], ['Oxygen sat (SpO₂)', `${latestVitals.spo2}%`, 'Room air'], ['Pulse rate', `${latestVitals.pulse} bpm`, 'Regular rhythm'], ['Body temperature', `${latestVitals.temp}°F`, 'Afebrile']].map(([label, value, note]) => (
                    <div key={label} className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="text-lg font-bold">{value}</dd><p className="text-[11px] text-brand">{note}</p></div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-on-surface-variant">No prior vitals on file. Record vitals inside the encounter workspace.</p>
              )}
              <p className="mt-3 text-[11px] text-outline">Last recorded {latestVitals ? `${formatDate(latestVitals.date)}, ${formatTime(latestVitals.time)}` : 'never'}. Missing historical diagnoses do not imply absence of medical conditions.</p>
            </FlowSection>

            <FlowSection title="Lifecycle state transition map" aside="Atomic database transaction">
              <ol className="grid gap-2 text-xs sm:grid-cols-4">
                {[['1. Appointment', 'Confirmed → In Progress'], ['2. Queue token', `${appointment.queueToken} Waiting → Called`], ['3. Clinical encounter', 'None → Active workspace opened'], ['4. Billing / finance', 'No charge committed']].map(([title, detail]) => (
                  <li key={title} className="rounded-md border border-slate-200 p-3"><p className="font-semibold">{title}</p><p className="text-on-surface-variant">{detail}</p></li>
                ))}
              </ol>
            </FlowSection>
          </div>

          <SideCard title="Launch cockpit" tag={<span className="font-mono text-[10px] text-outline">PRE-FLIGHT 5/5 PASSED</span>}>
            <ul className="flex flex-col gap-1.5">
              <ChecklistItem>Clinician verified: {appointment.doctorShort} active in {appointment.room}</ChecklistItem>
              <ChecklistItem>Patient physical arrival confirmed at reception ({formatTime(appointment.arrivedAt ?? appointment.time)})</ChecklistItem>
              <ChecklistItem>Zero duplicate active encounters detected for {appointment.id}</ChecklistItem>
              <ChecklistItem>ABDM M3 encounter provenance bundle verified</ChecklistItem>
              <ChecklistItem>Encounter concurrency lock acquired</ChecklistItem>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <ActionButton variant="primary" className="w-full" onClick={start}>Start encounter &amp; open clinical workspace</ActionButton>
              <ActionButton className="w-full" to={backTo}>Cancel / Return to {appointment.id}</ActionButton>
            </div>
            <KeyValueRows className="mt-5 border-t border-slate-100 pt-4" rows={[['Active room', appointment.room], ['Data sovereignty', 'Local node HYD-04 · Encrypted']]} />
          </SideCard>
        </div>
      )}
    </FlowFrame>
  )
}
