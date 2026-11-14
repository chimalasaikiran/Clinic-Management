import { useState } from 'react'
import { Building2, CalendarCheck, CalendarX, CheckCircle2, Hospital, MapPin, Plus, Stethoscope, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import { formatDate, formatLongDate, formatTime, formatWeekday } from '../format'
import { appointmentTone, byNewest, daysLabel, isUpcoming, nextAppointment, upcomingAppointments } from '../selectors'

const TABS = [
  { id: 'all', label: 'All appointments' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled / No-show' },
]

const matchesTab = (appointment, tab) =>
  tab === 'all' || (tab === 'upcoming' && isUpcoming(appointment)) || (tab === 'completed' && appointment.status === 'Completed') || (tab === 'cancelled' && ['Cancelled', 'No-show'].includes(appointment.status))

function NextAppointmentCard({ appointment, patientId }) {
  const detail = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
  const canMoveForward = ['Scheduled', 'Confirmed'].includes(appointment.status)
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 border-l-4 border-l-brand bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <StatusPill tone="brand" dot className="uppercase">Next upcoming appointment · {appointment.status}</StatusPill>
          {appointment.token && <p className="mt-3"><span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-[11px]">{appointment.token} ({appointment.tokenLabel})</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="brand" to={detail}>View appointment details →</ActionButton>
          {canMoveForward && <ActionButton to={pathFor(ROUTES.appointmentReschedule, { patientId, appointmentId: appointment.id })}>Reschedule</ActionButton>}
          {canMoveForward && <ActionButton to={pathFor(ROUTES.appointmentCheckIn, { patientId, appointmentId: appointment.id })}>Check-in / Mark Arrived</ActionButton>}
        </div>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="flex gap-3">
          <CalendarCheck className="mt-1 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Date &amp; time</p>
            <p className="text-sm font-semibold">{formatWeekday(appointment.date)}, {formatDate(appointment.date)}</p>
            <p className="text-xs text-on-surface-variant">{formatTime(appointment.time)} IST ({appointment.minutes} min duration)</p>
            <p className="text-xs font-medium text-brand">{appointment.mode} ({appointment.service})</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Stethoscope className="mt-1 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting specialist</p>
            <p className="text-sm font-semibold">{appointment.doctor}</p>
            <p className="text-xs text-on-surface-variant">{appointment.specialty}</p>
            <p className="text-xs text-on-surface-variant">{appointment.department} · {appointment.room}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Hospital className="mt-1 size-5 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Facility campus</p>
            <p className="text-sm font-semibold">{appointment.branch}</p>
            <p className="text-xs text-on-surface-variant">{appointment.campus}</p>
            {appointment.prep && <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900">{appointment.prep}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AppointmentsTab() {
  const { patient, patientId, mine } = usePatient()
  const appointments = mine('appointments')
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [doctor, setDoctor] = useState('')
  const [department, setDepartment] = useState('')
  const [branch, setBranch] = useState('')

  const next = nextAppointment(appointments)
  const upcoming = upcomingAppointments(appointments)
  const completed = appointments.filter((appointment) => appointment.status === 'Completed')
  const cancelled = appointments.filter((appointment) => ['Cancelled', 'No-show'].includes(appointment.status))
  const noShows = appointments.filter((appointment) => appointment.status === 'No-show').length
  const decided = completed.length + noShows
  const noShowRate = decided ? Math.round((noShows / decided) * 100) : 0
  const needle = query.trim().toLowerCase()
  const rows = appointments
    .filter(
      (appointment) =>
        matchesTab(appointment, tab) &&
        (!needle || `${appointment.service} ${appointment.doctor} ${appointment.department} ${appointment.branch}`.toLowerCase().includes(needle)) &&
        (!doctor || appointment.doctorShort === doctor) &&
        (!department || appointment.department === department) &&
        (!branch || appointment.branch === branch),
    )
    .sort(byNewest)
  const unique = (key) => [...new Set(appointments.map((appointment) => appointment[key]))]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Appointments</h2>
          <p className="text-sm text-on-surface-variant">View and manage this patient&apos;s upcoming schedule and historical clinical encounters.</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All Branches (3)" options={unique('branch')} />
          <ActionButton variant="primary" icon={Plus} to={pathFor(ROUTES.appointmentNew, { patientId })}>Book appointment</ActionButton>
        </div>
      </div>

      {appointments.length === 0 ? (
        <EmptyState icon={CalendarX} title="No appointments yet" action={<ActionButton variant="primary" icon={Plus} to={pathFor(ROUTES.appointmentNew, { patientId })}>Book appointment</ActionButton>}>
          {patient.name} has no scheduled or historical appointments. Book the first visit to start their care journey.
        </EmptyState>
      ) : (
        <>
          <dl className="mb-6 grid divide-y divide-slate-200 rounded-lg border border-slate-200 bg-surface-lowest sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
            {[
              ['Next appointment', next ? `${formatLongDate(next.date)} · ${formatTime(next.time)}` : 'None scheduled', next ? `${daysLabel(next.date)} (${next.status})` : ''],
              ['Upcoming appointments', `${upcoming.length} scheduled`, upcoming.length ? `Through ${formatDate(upcoming[upcoming.length - 1].date)}` : ''],
              ['Completed appointments', `${completed.length} encounters`, 'Since registration'],
              ['Cancelled / rescheduled', `${cancelled.length} records`, 'Prior patient request'],
              ['No-show rate', `${noShowRate}%`, noShowRate === 0 ? 'Excellent adherence' : 'Review adherence'],
            ].map(([label, value, hint]) => (
              <div key={label} className="p-4">
                <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
                <dd className="mt-1 text-base font-bold text-on-surface">{value}</dd>
                <p className="text-[11px] text-on-surface-variant">{hint}</p>
              </div>
            ))}
          </dl>

          {next && <NextAppointmentCard appointment={next} patientId={patientId} />}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <FilterTabs label="Appointment status" value={tab} onChange={setTab} options={TABS.map((option) => ({ ...option, count: appointments.filter((appointment) => matchesTab(appointment, option.id)).length }))} />
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={query} onChange={setQuery} label="Search appointments" placeholder="Search by doctor, department, or service" className="w-64" />
              <FilterSelect label="Doctor" value={doctor} onChange={setDoctor} allLabel="Doctor: All Doctors" options={unique('doctorShort')} />
              <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="Dept: All Departments" options={unique('department')} />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Table headings={['Date & time', 'Appointment & token', 'Doctor & specialty', 'Department & room', 'Branch / facility', 'Status', 'Actions']} minWidth={1080} empty={rows.length ? null : 'No appointments match the current filters.'}>
              {rows.map((appointment) => {
                const detail = pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })
                const cancelledRow = appointment.status === 'Cancelled'
                return (
                  <Row key={appointment.id}>
                    <Cell className={cn(cancelledRow && 'line-through')}>
                      <p className="font-semibold">{formatLongDate(appointment.date)}</p>
                      <p className="font-mono text-[11px] text-brand">{formatTime(appointment.time)} IST</p>
                    </Cell>
                    <Cell>
                      <p className="flex items-center gap-1.5 font-semibold">
                        {appointment.mode === 'Tele-consultation' && <Video className="size-3.5 text-violet-600" aria-label="Video call" />}
                        {appointment.service}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {appointment.token && <span className="mr-1 rounded bg-surface-low px-1 font-mono">Token {appointment.token}</span>}
                        {appointment.serviceNote ?? `Duration: ${appointment.minutes}m`}
                      </p>
                    </Cell>
                    <Cell><p className="font-medium">{appointment.doctorShort}</p><p className="text-[11px] text-on-surface-variant">{appointment.specialty}</p></Cell>
                    <Cell><p>{appointment.department}</p><p className="font-mono text-[11px] text-on-surface-variant">{appointment.room}</p></Cell>
                    <Cell><p className="flex items-center gap-1"><Building2 className="size-3 text-outline" aria-hidden="true" />{appointment.branch}</p><p className="text-[11px] text-on-surface-variant">{appointment.campus}</p></Cell>
                    <Cell><StatusPill tone={appointmentTone(appointment.status)} dot={!['Completed', 'Cancelled'].includes(appointment.status)}>{appointment.status === 'Completed' && <CheckCircle2 className="size-3" aria-hidden="true" />}{appointment.status}</StatusPill></Cell>
                    <Cell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ActionButton size="sm" to={detail}>{isUpcoming(appointment) ? 'View details' : cancelledRow || appointment.status === 'No-show' ? 'View log' : 'View appointment'}</ActionButton>
                        {['Scheduled', 'Confirmed'].includes(appointment.status) && <ActionButton size="sm" to={pathFor(ROUTES.appointmentReschedule, { patientId, appointmentId: appointment.id })}>Reschedule</ActionButton>}
                        {appointment.encounterId && (
                          <Link to={pathFor(ROUTES.encounter, { patientId, encounterId: appointment.encounterId })} className="text-xs font-semibold text-brand hover:underline">#{appointment.encounterId} →</Link>
                        )}
                      </span>
                    </Cell>
                  </Row>
                )
              })}
            </Table>
            <TableFooter summary={`Showing ${rows.length} of ${appointments.length} records`}>
              <span className="flex items-center gap-1 text-brand"><MapPin className="size-3" aria-hidden="true" />Appointments automatically synced to ABDM Milestone 2 Slot Registry</span>
            </TableFooter>
          </div>

          <InfoNote tone="brand" className="mt-5">
            <strong className="text-on-surface">Real-time SMS &amp; WhatsApp alerts active:</strong> {next ? `Patient confirmed for automated SMS reminder 24h and 2h prior to ${formatLongDate(next.date)} consultation.` : 'Reminders are dispatched 24h and 2h before each booked consultation.'}
          </InfoNote>
        </>
      )}
    </div>
  )
}
