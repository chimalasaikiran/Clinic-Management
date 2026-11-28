import { useState } from 'react'
import { CalendarClock, CalendarDays, CalendarPlus, Clock, Search, UserCheck, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { appointmentsApi } from '../../patients/api'
import { localToday } from '../../patients/format'
import {
  appointmentLink, counts, demographics, eventLabel, filterOptions, filterRows, nextWaiting, patientLink, STATUS, summaryLine, waitingMinutes, worklist,
} from './dayView'
import { ArrowLink, Card, DayPage, Empty, Filter, Stats, Table } from './parts'
import { useDay } from './useDay'

const QUEUE = ['arrived', 'pending', 'confirmed']

export default function ReceptionDashboard() {
  const { can } = useAuth()
  const day = useDay()
  const { view, now, act, busy } = day
  const [filters, setFilters] = useState({ practitionerId: '', department: '' })

  const today = view?.today ?? localToday()
  const isToday = !view || view.date === today
  const all = view ? worklist(view.appointments) : []
  const options = filterOptions(all)
  const shown = filterRows(all, filters)
  const tally = counts(shown)
  const waiting = nextWaiting(shown)
  // Waiting patients first, in order of arrival; then the bookings still to arrive.
  const queue = shown.filter((row) => QUEUE.includes(row.status)).sort((a, b) => Number(b.status === 'arrived') - Number(a.status === 'arrived') || (a.arrivedAt ?? a.time).localeCompare(b.arrivedAt ?? b.time))
  const withDoctor = shown.filter((row) => row.status === 'in_progress')
  const setFilter = (name) => (value) => setFilters((current) => ({ ...current, [name]: value }))

  const nextAction = (row) => {
    const name = row.patient.fullName
    if (row.status === 'pending' && can('bookings.create')) {
      return <ActionButton size="sm" variant="brand" disabled={busy !== null} aria-label={`Confirm ${name}`} onClick={() => act(row.id, () => appointmentsApi.confirm(row.id), `Booking confirmed for ${name}.`)}>{busy === row.id ? 'Confirming…' : 'Confirm'}</ActionButton>
    }
    if (row.status === 'confirmed' && isToday && can('bookings.create')) {
      return <ActionButton size="sm" variant="primary" disabled={busy !== null} aria-label={`Check in ${name}`} onClick={() => act(row.id, () => appointmentsApi.checkIn(row.id), `${name} is checked in.`)}>{busy === row.id ? 'Checking in…' : 'Check in'}</ActionButton>
    }
    return null
  }

  return (
    <DayPage day={day} eyebrow="Reception workspace · Front desk" title="Reception Desk" subtitle="Coordinate arrivals, appointments and the patient queue.">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-outline">
          Date
          <input type="date" value={day.date ?? today} onChange={(event) => day.setDate(!event.target.value || event.target.value === today ? null : event.target.value)} className="bg-transparent font-medium text-on-surface" />
        </label>
        <Filter label="Department" value={filters.department} onChange={setFilter('department')} options={options.departments} all="All departments" />
        <Filter label="Doctor" value={filters.practitionerId} onChange={setFilter('practitionerId')} options={options.practitioners} all="All doctors" />
        <p className="text-xs text-outline">All figures reflect this date and these filters.</p>
      </div>

      {view && (
        <>
          <Stats
            items={[
              { label: isToday ? "Today's Appointments" : 'Appointments', value: tally.total, hint: `${tally.completed} completed`, icon: CalendarDays },
              { label: 'Checked-in Patients', value: tally.checkedIn, hint: 'Arrivals recorded', icon: UserCheck },
              { label: 'Waiting Patients', value: tally.waiting, hint: waiting ? `${waiting.patient.fullName} · ${waitingMinutes(waiting, now)} min` : 'No one is waiting', icon: Clock },
              { label: 'Upcoming Arrivals', value: tally.upcoming, hint: 'Booked, not yet arrived', icon: CalendarClock },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-on-surface">Quick actions</span>
            {can('patients.create') && <ActionButton variant="primary" icon={UserPlus} to={ROUTES.patientNew}>Register Patient</ActionButton>}
            {can('bookings.create') && <ActionButton icon={CalendarPlus} to={ROUTES.patients}>Book Appointment</ActionButton>}
            {can('bookings.create') && <ActionButton icon={UserCheck} to={`${ROUTES.appointments}?walkIn=1`}>Add Walk-in</ActionButton>}
            <ActionButton icon={Search} to={ROUTES.patients}>Find Patient</ActionButton>
          </div>

          <Card title="Front-desk work queue" aside={<span className="flex gap-3">{tally.waiting} waiting · {tally.upcoming} expected <ArrowLink to={ROUTES.appointments}>View appointments</ArrowLink></span>}>
            {queue.length === 0 ? (
              <Empty>No one is waiting or expected.</Empty>
            ) : (
              <Table headings={['Patient', 'Booked slot', 'Token', 'Status', 'Next action']}>
                {queue.map((row) => (
                  <tr key={row.id} className={cn('border-t border-slate-100 align-top', row.status === 'arrived' && 'bg-amber-50/40')}>
                    <td className="px-5 py-3"><Link to={patientLink(row.patient)} className="text-[13px] font-semibold hover:underline">{row.patient.fullName}</Link><span className="block text-outline">{demographics(row.patient, view.date)} · {row.reason}</span></td>
                    <td className="px-5 py-3">{row.waitingQueue ? 'Walk-in queue' : row.time}<span className="block text-outline">{row.practitioner.displayName}</span></td>
                    <td className="px-5 py-3 font-semibold">{row.token ?? '—'}</td>
                    <td className="px-5 py-3"><StatusPill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</StatusPill><span className="mt-1 block text-outline">{row.status === 'arrived' ? `${waitingMinutes(row, now)} min waiting` : 'Check in on arrival'}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2">{nextAction(row)}<ActionButton size="sm" to={appointmentLink(row)}>View appointment</ActionButton></div></td>
                  </tr>
                ))}
              </Table>
            )}
            {withDoctor.length > 0 && (
              <ul className="flex flex-col gap-2 border-t border-slate-100 p-4">
                {withDoctor.map((row) => <li key={row.id} className="rounded-md bg-teal-50 px-3 py-2 text-xs text-brand">With {row.practitioner.displayName}: {row.patient.fullName}{row.token && ` · ${row.token}`}</li>)}
              </ul>
            )}
          </Card>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card title="Doctor schedule" aside={summaryLine(tally)}>
              {shown.length === 0 ? (
                <Empty>No bookings for this selection.</Empty>
              ) : (
                <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
                  {shown.map((row) => (
                    <li key={row.id} className={cn('flex items-start gap-4 px-5 py-3 text-xs', row.status === 'in_progress' && 'bg-teal-50/60')}>
                      <span className="w-14 shrink-0"><span className="block font-semibold">{row.time}</span><span className="text-outline">{row.token}</span></span>
                      <Link to={appointmentLink(row)} className="min-w-0 flex-1 hover:underline"><span className="block text-[13px] font-semibold">{row.patient.fullName}</span><span className="block text-outline">{row.practitioner.displayName}{row.practitioner.room && ` · ${row.practitioner.room}`} · {row.durationMinutes} min · {row.reason}</span></Link>
                      <StatusPill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="flex flex-col gap-5">
              <Card title="Recent activity" aside="Appointments on this day">
                {view.events.length === 0 ? (
                  <Empty>No activity yet.</Empty>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {view.events.map((event) => (
                      <li key={event.id} className="px-5 py-3 text-xs">
                        <p className="flex justify-between gap-2"><strong className="text-[13px]">{eventLabel(event.action)}</strong><span className="text-outline">{event.time}</span></p>
                        <p>{event.patient.fullName}{event.token && ` · ${event.token}`}</p>
                        <p className="text-outline">By {event.actor}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Token & queue coordination">
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-5 text-xs">
                  <dt><StatusPill tone="warning">Check-in</StatusPill></dt><dd>Checking a patient in gives them their queue token.</dd>
                  <dt><StatusPill tone="neutral">Walk-in</StatusPill></dt><dd>Walk-ins in the waiting queue get a W token.</dd>
                  <dt><StatusPill tone="brand">With doctor</StatusPill></dt><dd>Only a clinician starts a consultation.</dd>
                </dl>
              </Card>
            </div>
          </div>
        </>
      )}
    </DayPage>
  )
}
