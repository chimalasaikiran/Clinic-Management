import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatLongDate, formatTime, TODAY } from '../../patients/format'
import { appointmentTone, auditEntry } from '../../patients/selectors'
import { CHAMBERS, GRID_SESSIONS, OFF_GRID_STATUSES, SCHEDULE_NOW, STATUS_FILTERS } from '../constants'
import ConfirmAppointmentModal from '../drawers/ConfirmAppointmentModal'
import WalkInDrawer from '../drawers/WalkInDrawer'
import { addDays, buildWalkIn, dayGrid, dayStats, slotOf } from '../logic'

const TILE_TONE = { teal: 'border-teal-200 bg-teal-50/60', amber: 'border-amber-200 bg-amber-50/70', slate: 'border-slate-200 bg-white' }

function Tile({ label, value, hint, sub, tone = 'slate', bar }) {
  return (
    <div className={cn('rounded-lg border p-4', TILE_TONE[tone])}>
      <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold">{value}{hint && <span className="text-xs font-normal text-on-surface-variant">{hint}</span>}</p>
      {bar !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200"><div className="h-full bg-brand" style={{ width: `${Math.min(100, bar)}%` }} /></div>}
      {sub && <p className="mt-1 text-[11px] text-on-surface-variant">{sub}</p>}
    </div>
  )
}

export default function AppointmentsSchedulePage() {
  const { records, patients, getPatient, update, add } = usePatientRecords()
  const navigate = useNavigate()
  const [date, setDate] = useState(TODAY)
  const [view, setView] = useState('grid')
  const [sessionId, setSessionId] = useState('morning')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [walkIn, setWalkIn] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [notice, setNotice] = useState('')

  const appointments = records.appointments
  const { slots, columns } = dayGrid(appointments, date, sessionId)
  const stats = dayStats(appointments, date, sessionId)
  const needle = query.trim().toLowerCase()
  const nameOf = (appointment) => getPatient(appointment.patientId)?.name ?? ''
  const matches = (appointment) =>
    (!statusFilter || appointment.status === statusFilter) &&
    (!needle || `${nameOf(appointment)} ${getPatient(appointment.patientId)?.mrn ?? ''} ${appointment.queueToken ?? ''}`.toLowerCase().includes(needle))
  const visibleColumns = columns.filter((column) => !doctorFilter || column.doctorId === doctorFilter)
  const queueEntries = appointments.filter((appointment) => appointment.date === date && appointment.waitingQueue && appointment.status === 'Arrived')
  const dayList = appointments.filter((appointment) => appointment.date === date && CHAMBERS.some((entry) => entry.doctorId === appointment.doctorId) && matches(appointment) && (!doctorFilter || appointment.doctorId === doctorFilter)).sort((a, b) => a.time.localeCompare(b.time))
  const reset = () => { setDoctorFilter(''); setStatusFilter(''); setQuery('') }

  useEffect(() => {
    const onKey = (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      if (event.key.toLowerCase() === 'n' && !typing && !event.metaKey && !event.ctrlKey) navigate(ROUTES.patients)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])

  const confirmBooking = (id, notify) =>
    update('appointments', id, (current) => ({ status: 'Confirmed', audit: [...(notify ? [auditEntry('WhatsApp and SMS confirmation slip dispatched', 'Delivery reported independently')] : []), auditEntry('Appointment confirmed — OPD slot locked', 'Priya Nair (Desk 01)'), ...(current.audit ?? [])] }))

  const createWalkIn = (values) => {
    const patient = getPatient(values.patientId)
    const record = buildWalkIn(values, { appointments, patient, date })
    add('appointments', record)
    setNotice(record.waitingQueue ? `${patient.name} joined the waiting queue with token ${record.queueToken}.` : `${patient.name} is booked for ${formatTime(record.time)} with ${record.doctorShort}${record.queueToken ? ` · token ${record.queueToken}` : ''}.`)
  }

  const action = (appointment) => {
    const to = (route, id = appointment.id) => pathFor(route, { patientId: appointment.patientId, appointmentId: id })
    switch (appointment.status) {
      case 'Pending Confirmation': return <button type="button" onClick={() => setConfirming(appointment)} className="rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white">Verify &amp; Confirm</button>
      case 'Scheduled':
      case 'Confirmed': return <ActionButton size="sm" to={to(ROUTES.appointmentCheckIn)}>Check In</ActionButton>
      case 'Arrived': return <ActionButton size="sm" variant="primary" to={to(ROUTES.appointmentStartEncounter)}>Call Patient to Chamber</ActionButton>
      case 'In Progress': return <ActionButton size="sm" variant="brand" to={pathFor(ROUTES.encounter, { patientId: appointment.patientId, encounterId: appointment.encounterId })}>View Encounter →</ActionButton>
      case 'Completed': return <Link to={to(ROUTES.appointment)} className="text-[11px] font-semibold text-brand hover:underline">View Summary</Link>
      default: return null
    }
  }

  const download = () => exportCsv(`opd-roster-${date}.csv`, [['Time', 'Chamber', 'Doctor', 'Patient', 'Token', 'Status', 'Reason'], ...dayList.map((appointment) => [appointment.time, appointment.room, appointment.doctorShort, nameOf(appointment), appointment.queueToken ?? '', appointment.status, appointment.reason])])

  return (
    <WorkspacePage>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight">Appointments &amp; OPD Schedule<span className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-normal text-on-surface-variant">Main Pavilion · {CHAMBERS.length} Chambers</span></h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">Real-time outpatient queue, doctor chamber rosters, and slot allocation across the Main Surgical Pavilion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Schedule view" className="flex overflow-hidden rounded-md border border-slate-200 bg-white text-xs">
            {[['grid', 'Day Schedule (Chambers)'], ['list', 'List View (Ledger)']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn('px-3 py-2 font-medium', view === id ? 'bg-surface-low text-brand' : 'text-on-surface-variant')}>{label}</button>)}
          </div>
          <ActionButton icon={Download} onClick={download}>Export Roster</ActionButton>
          <ActionButton onClick={() => setWalkIn({})}>Add Walk-In</ActionButton>
          <ActionButton variant="primary" icon={Plus} to={ROUTES.patients}>New Appointment [N]</ActionButton>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Tile label="Total booked" value={stats.booked} hint={`/ ${stats.capacity} max cap`} bar={stats.capacity ? (stats.booked / stats.capacity) * 100 : 0} />
        <Tile label="In waiting queue" value={stats.waiting} sub={queueEntries.length ? `${queueEntries.length} walk-in overflow` : 'Triage flow active'} />
        <Tile label="In consultation" value={stats.inConsultation} sub={stats.chambers ? `Rms ${stats.chambers}` : 'No chamber in session'} tone="teal" />
        <Tile label="Confirmed slot" value={stats.confirmed} sub={stats.nextConfirmed ? `Next: ${formatTime(stats.nextConfirmed.time)} ${nameOf(stats.nextConfirmed).split(' ')[0]}` : 'None upcoming'} />
        <Tile label="Pending action" value={stats.pending} sub={`${stats.pending} unverified tele-slot${stats.pending === 1 ? '' : 's'}`} tone="amber" />
        <Tile label="Cancelled / No-show" value={stats.cancelled} sub={stats.cancelledDetail} />
      </div>
      {notice && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs text-on-surface">{notice}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-1 text-xs">
          <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="rounded p-1 hover:bg-surface-low"><ChevronLeft className="size-3.5" aria-hidden="true" /></button>
          <span className="flex items-center gap-1.5 px-2 font-medium"><CalendarDays className="size-3.5" aria-hidden="true" />{date === TODAY ? 'Today: ' : ''}{formatLongDate(date)}{date === TODAY && <StatusPill tone="success">Active</StatusPill>}</span>
          <button type="button" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} className="rounded p-1 hover:bg-surface-low"><ChevronRight className="size-3.5" aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={() => setDate(TODAY)} className="text-xs font-semibold text-brand hover:underline">Go to Today</button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select aria-label="Doctor" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand"><option value="">All Doctors (Chambers {CHAMBERS.map((entry) => entry.chamber).join(', ')})</option>{columns.map((column) => <option key={column.doctorId} value={column.doctorId}>{column.chamber} · {column.doctor.short}</option>)}</select>
        <select aria-label="Session" value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand">{GRID_SESSIONS.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}</select>
        <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand"><option value="">All Statuses</option>{STATUS_FILTERS.map((status) => <option key={status}>{status}</option>)}</select>
        <SearchBox value={query} onChange={setQuery} label="Search token, name or MRN" placeholder="Token #, name, UHID..." className="w-56" />
        <button type="button" onClick={reset} className="text-xs font-semibold text-brand hover:underline">Reset</button>
      </div>

      {queueEntries.length > 0 && (
        <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs">
          <h2 className="mb-2 text-sm font-semibold">Walk-in waiting queue</h2>
          <ul className="flex flex-wrap gap-2">{queueEntries.map((entry) => <li key={entry.id} className="rounded-md border border-amber-200 bg-white px-3 py-2"><span className="font-mono font-semibold">{entry.queueToken}</span> · {nameOf(entry)} · {entry.doctorShort}<span className="ml-3">{action(entry)}</span></li>)}</ul>
        </section>
      )}

      {view === 'list' ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Time', 'Token', 'Patient', 'Chamber / Doctor', 'Reason', 'Status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
              <tbody>
                {dayList.map((appointment) => (
                  <tr key={appointment.id} className="border-b border-slate-100 align-top text-xs hover:bg-surface-lowest">
                    <td className="px-4 py-3 font-semibold">{formatTime(appointment.time)}</td>
                    <td className="px-4 py-3 font-mono">{appointment.queueToken ?? '—'}</td>
                    <td className="px-4 py-3"><Link to={pathFor(ROUTES.appointment, { patientId: appointment.patientId, appointmentId: appointment.id })} className="font-semibold text-brand hover:underline">{nameOf(appointment)}</Link><p className="text-outline">{getPatient(appointment.patientId)?.mrn}</p></td>
                    <td className="px-4 py-3">{appointment.room}<p className="text-outline">{appointment.doctorShort}</p></td>
                    <td className="px-4 py-3 text-on-surface-variant">{appointment.reason}</td>
                    <td className="px-4 py-3"><StatusPill tone={appointmentTone(appointment.status)}>{appointment.status}</StatusPill></td>
                    <td className="px-4 py-3">{action(appointment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dayList.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No appointments match the current filters for this day.</p>}
          </div>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `5.5rem repeat(${visibleColumns.length}, minmax(0, 1fr))` }}>
            <div className="border-b border-slate-200 bg-surface-lowest p-3 text-[10px] font-semibold tracking-wide text-outline uppercase">Slot time</div>
            {visibleColumns.map((column) => (
              <div key={column.doctorId} className="border-b border-l border-slate-200 bg-surface-lowest p-3 text-xs">
                <p className="flex items-center gap-2"><span className="rounded bg-black px-1.5 py-0.5 font-mono text-[10px] text-white">{column.chamber}</span><strong className="text-[13px]">{column.doctor.name}</strong></p>
                <p className="text-outline">{column.specialty} · {column.booked} Booked</p>
              </div>
            ))}
            {slots.map((slot) => {
              const current = date === TODAY && slot === slotOf(SCHEDULE_NOW)
              return [
                <div key={`${slot}-time`} className={cn('border-b border-slate-100 p-3 text-xs font-semibold', current && 'bg-teal-50 text-brand')}>{formatTime(slot)}{current && <p className="mt-1 inline-block rounded bg-brand px-1.5 py-0.5 text-[9px] text-white">CURRENT</p>}</div>,
                ...visibleColumns.map((column) => {
                  const cell = column.cells.find((entry) => entry.slot === slot)
                  const shown = cell.appointments.filter(matches)
                  return (
                    <div key={`${slot}-${column.doctorId}`} className={cn('min-h-24 border-b border-l border-slate-100 p-2', current && 'bg-teal-50/40')}>
                      {cell.block && <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900"><strong className="block">{cell.block.label}</strong>{cell.block.note}</p>}
                      {!cell.block && shown.length === 0 && cell.appointments.length === 0 && (
                        <button type="button" onClick={() => setWalkIn({ doctorId: column.doctorId, time: slot })} className="flex h-full min-h-20 w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-200 text-[11px] text-outline hover:border-brand hover:text-brand">Unallocated slot<span className="font-semibold">+ Walk-In</span><span className="sr-only">{`at ${formatTime(slot)} in chamber ${column.chamber}`}</span></button>
                      )}
                      {shown.map((appointment) => {
                        const off = OFF_GRID_STATUSES.includes(appointment.status)
                        return (
                          <article key={appointment.id} className={cn('mb-1.5 rounded-md border p-2 text-[11px]', off ? 'border-slate-200 bg-slate-50 opacity-70' : appointment.status === 'In Progress' ? 'border-2 border-brand bg-white' : 'border-slate-200 bg-white')}>
                            <div className="flex items-start justify-between gap-1">
                              <p><span className="font-mono text-[10px] text-outline">{appointment.queueToken ? `#${appointment.queueToken}` : '#—'}</span> <Link to={pathFor(ROUTES.appointment, { patientId: appointment.patientId, appointmentId: appointment.id })} className="font-semibold text-on-surface hover:underline">{nameOf(appointment)}</Link></p>
                              <StatusPill tone={appointmentTone(appointment.status)}>{appointment.status === 'Pending Confirmation' ? 'Unverified' : appointment.status}</StatusPill>
                            </div>
                            <p className="mt-1 text-on-surface-variant">{appointment.reason}</p>
                            <p className="mt-0.5 text-outline">{getPatient(appointment.patientId)?.mrn}{appointment.walkIn ? ' · Walk-in' : ''}</p>
                            <div className="mt-2">{action(appointment)}</div>
                          </article>
                        )
                      })}
                    </div>
                  )
                }),
              ]
            })}
          </div>
        </section>
      )}

      {walkIn && <WalkInDrawer date={date} sessionId={sessionId} appointments={appointments} patients={patients} preset={walkIn.doctorId ? walkIn : undefined} onClose={() => setWalkIn(null)} onCreate={createWalkIn} />}
      {confirming && <ConfirmAppointmentModal appointment={confirming} patient={getPatient(confirming.patientId)} appointments={appointments} onClose={() => setConfirming(null)} onConfirm={confirmBooking} />}
    </WorkspacePage>
  )
}
