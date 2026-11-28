import { useState } from 'react'
import { Activity, CheckCircle2, ClipboardList, TestTube, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { clinicalApi } from '../../patients/api'
import RecordVitalsDrawer from '../../patients/drawers/RecordVitalsDrawer'
import { toVitalsRequest } from '../../patients/vitals'
import { clinicHour, greeting } from '../dashboardView'
import {
  allergyLine, counts, demographics, filterOptions, filterRows, initialsOf, nextWaiting, patientLink, preparation, readings, waitingMinutes, worklist,
} from './dayView'
import { ArrowLink, Card, DayPage, Empty, Filter, Stats, Table, TaskCard } from './parts'
import { useDay } from './useDay'

export default function NurseDashboard() {
  const { user, can } = useAuth()
  const day = useDay()
  const [opened] = useState(() => new Date())
  const { view, now, act, busy } = day
  const [filters, setFilters] = useState({ practitionerId: '', status: '', department: '' })
  const [recording, setRecording] = useState(null)

  const all = view ? worklist(view.appointments) : []
  const options = filterOptions(all)
  const rows = filterRows(all, filters)
  const tally = counts(all)
  const next = nextWaiting(all, (row) => !row.vitals)
  const ready = all.filter((row) => row.status === 'arrived' && row.vitals)
  const clinical = view?.clinical
  const mayRecord = can('clinical.vitals') || can('clinical.write')
  const setFilter = (name) => (value) => setFilters((current) => ({ ...current, [name]: value }))

  const save = (record) => {
    const row = recording
    act(`vitals:${row.id}`, () => clinicalApi.recordVitals(row.patient.id, toVitalsRequest(record, row.encounter?.status === 'in_progress' ? row.encounter.id : undefined)), `Vitals saved for ${row.patient.fullName}.`)
  }

  return (
    <DayPage day={day} eyebrow="Clinical assistant workspace" title={greeting(user?.fullName, clinicHour(opened, view?.timeZone ?? 'Asia/Kolkata'))} subtitle="Prepare checked-in patients and hand them over to their clinician.">
      {view && clinical && (
        <>
          <Stats
            items={[
              { label: 'Awaiting Preparation', value: tally.awaitingPreparation, hint: 'Checked in, no vitals today', icon: ClipboardList },
              { label: 'Ready for Doctor', value: tally.ready, hint: 'Waiting with vitals recorded', icon: UserCheck },
              { label: 'Specimens to Collect', value: clinical.specimens.total, hint: `${clinical.specimens.items.filter((order) => order.urgent).length} urgent`, icon: TestTube },
              { label: 'Safety Alerts', value: clinical.alerts.total, hint: "Critical or high, today's patients", icon: Activity },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Next Patient to Prepare" aside={next && <span className="font-semibold text-on-surface">{next.time}</span>}>
              {!next ? (
                <Empty>Everyone waiting has been prepared.</Empty>
              ) : (
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(next.patient.fullName)} tone="teal" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold">{next.patient.fullName}</p>
                      <p className="text-xs text-outline">{demographics(next.patient, view.date)}</p>
                    </div>
                    {next.token && <StatusPill>Token {next.token}</StatusPill>}
                  </div>
                  <p className="text-sm">{next.reason}<span className="block text-xs text-outline">{next.practitioner.displayName} · {next.practitioner.department}{next.practitioner.room && ` · ${next.practitioner.room}`}</span></p>
                  <p className="text-xs text-on-surface-variant">Arrived {next.arrivedTime} · {waitingMinutes(next, now)}m waiting</p>
                  <ul className="flex flex-col gap-2 rounded-md bg-surface-lowest p-3 text-xs">
                    <li className="flex justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2">Vital signs <StatusPill tone="warning">Pending</StatusPill></li>
                    <li className="flex justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2">Allergies <span className="text-right font-medium">{allergyLine(next.allergies)}</span></li>
                  </ul>
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton to={patientLink(next.patient)}>View Record</ActionButton>
                    {mayRecord && <ActionButton variant="primary" icon={Activity} disabled={busy !== null} onClick={() => setRecording(next)}>Record vitals</ActionButton>}
                  </div>
                </div>
              )}
            </Card>

            <Card title="Clinical Alerts" aside={`${clinical.alerts.total} active`}>
              {clinical.alerts.items.length === 0 ? (
                <Empty>No serious alerts for today’s patients.</Empty>
              ) : (
                <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto p-5">
                  {clinical.alerts.items.map((alert) => (
                    <li key={alert.id} className={cn('rounded-md border p-3 text-xs', alert.severity === 'critical' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60')}>
                      <p className="flex flex-wrap items-center gap-2"><StatusPill tone={alert.severity === 'critical' ? 'danger' : 'warning'}>{alert.severity === 'critical' ? 'Critical' : 'High'}</StatusPill><strong className="text-[13px]">{alert.title}</strong></p>
                      <p className="mt-1 text-on-surface-variant">{alert.patient.fullName} · {demographics(alert.patient, view.date)}</p>
                      <p className="mt-1">{alert.detail}</p>
                      <ArrowLink to={patientLink(alert.patient)}>Open chart</ArrowLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Nursing Work Queue" subtitle="Today’s bookings and walk-ins" aside={`${rows.length} of ${all.length} shown`}>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
              <Filter label="Doctor" value={filters.practitionerId} onChange={setFilter('practitionerId')} options={options.practitioners} all="All clinicians" />
              <Filter label="Status" value={filters.status} onChange={setFilter('status')} options={options.statuses} all="All statuses" />
              <Filter label="Dept" value={filters.department} onChange={setFilter('department')} options={options.departments} all="All departments" />
            </div>
            {rows.length === 0 ? (
              <Empty>{all.length === 0 ? 'No appointments today.' : 'No appointment matches these filters.'}</Empty>
            ) : (
              <Table headings={['Token', 'Patient', 'Time & reason', 'Preparation', 'Vitals & allergies', 'Doctor & room', 'Action']} minWidth="min-w-[960px]">
                {rows.map((row) => {
                  const state = preparation(row)
                  return (
                    <tr key={row.id} className={cn('border-t border-slate-100 align-top', next?.id === row.id && 'bg-teal-50/60')}>
                      <td className="px-5 py-4 font-semibold text-outline">{row.token ?? '—'}</td>
                      <td className="px-5 py-4"><Link to={patientLink(row.patient)} className="text-[13px] font-semibold hover:underline">{row.patient.fullName}</Link><span className="block text-outline">{demographics(row.patient, view.date)}</span></td>
                      <td className="max-w-48 px-5 py-4"><span className="font-semibold">{row.time}</span><span className="block text-outline">{row.reason}</span></td>
                      <td className="px-5 py-4"><StatusPill tone={state.tone}>{state.label}</StatusPill></td>
                      <td className="max-w-60 px-5 py-4">{row.vitals ? readings(row.vitals) : <span className="text-outline">No vitals today</span>}{row.allergies.length > 0 && <span className="block font-medium text-danger">{allergyLine(row.allergies)}</span>}</td>
                      <td className="px-5 py-4">{row.practitioner.displayName}<span className="block text-outline">{row.practitioner.room ?? row.practitioner.department}</span></td>
                      <td className="px-5 py-4">
                        {mayRecord && ['arrived', 'in_progress'].includes(row.status) ? (
                          <ActionButton size="sm" variant={row.vitals ? 'secondary' : 'primary'} disabled={busy !== null} onClick={() => setRecording(row)}>{busy === `vitals:${row.id}` ? 'Saving…' : row.vitals ? 'Record again' : 'Record vitals'}</ActionButton>
                        ) : (
                          <ArrowLink to={patientLink(row.patient)}>View record</ArrowLink>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Table>
            )}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-outline">{tally.completed} completed · {tally.awaitingPreparation} awaiting preparation · {tally.ready} ready · {tally.upcoming} upcoming</p>
          </Card>

          <div className="grid gap-3 lg:grid-cols-3">
            <TaskCard title="Doctor Handoff" list={{ total: ready.length, items: ready }} empty="No prepared patient is waiting." render={(row) => <><span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="size-3.5 text-brand" aria-hidden="true" />{row.patient.fullName}{row.token && ` (${row.token})`}</span><span className="block text-outline">Ready for {row.practitioner.displayName}{row.practitioner.room && ` · ${row.practitioner.room}`}</span></>} footer={<p className="text-[11px] text-outline">Prepared patients appear in their clinician’s queue with vitals recorded.</p>} />
            <TaskCard
              title="Specimens to Collect"
              list={clinical.specimens}
              empty="No laboratory order is waiting for a specimen."
              render={(order) => (
                <div className="flex items-start justify-between gap-2">
                  <span><span className="block font-semibold">{order.patient.fullName}</span><span className="text-outline">{order.title}{order.urgent && ' · Urgent'}</span></span>
                  {mayRecord && <ActionButton size="sm" disabled={busy !== null} aria-label={`Mark specimen collected: ${order.title} for ${order.patient.fullName}`} onClick={() => act(`collect:${order.id}`, () => clinicalApi.collectSpecimen(order.id), `Specimen marked collected for ${order.patient.fullName}.`)}>{busy === `collect:${order.id}` ? 'Saving…' : 'Collected'}</ActionButton>}
                </div>
              )}
            />
            <TaskCard title="Results Awaiting Clinician" list={clinical.results} empty="No results are waiting for review." render={(order) => <><span className="block font-semibold">{order.patient.fullName}</span><span className="block text-outline">{order.title}{order.resultFlag && order.resultFlag !== 'normal' && ` · ${order.resultFlag}`}</span><ArrowLink to={pathFor(ROUTES.patientOrders, { patientId: order.patient.id })}>View result</ArrowLink></>} />
          </div>
        </>
      )}
      <RecordVitalsDrawer
        open={recording !== null}
        onClose={() => setRecording(null)}
        onSave={save}
        eyebrow={recording ? `${recording.reference} · Vitals capture` : ''}
        description="Record this patient’s vital signs before the consultation."
        submitLabel="Save vitals"
        summary={recording && view && <p className="rounded-md border border-slate-200 bg-white p-4 text-sm"><strong>{recording.patient.fullName}</strong> <span className="text-xs text-outline">{demographics(recording.patient, view.date)} · {allergyLine(recording.allergies)}</span></p>}
      />
    </DayPage>
  )
}
