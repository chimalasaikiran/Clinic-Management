import { useState } from 'react'
import { CalendarDays, ClipboardList, FileSignature, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { clinicHour, greeting } from '../dashboardView'
import {
  counts, demographics, doctorAction, filterOptions, filterRows, initialsOf, nextWaiting, patientLink, STATUS, summaryLine, waitingMinutes, worklist,
} from './dayView'
import { ArrowLink, Card, DayPage, Empty, Filter, Stats, Table, TaskCard } from './parts'
import { useDay } from './useDay'

const chartTab = (route, patient) => pathFor(route, { patientId: patient.id })

function NextPatient({ row, view, now }) {
  if (!row) {
    return (
      <Card title="Next Patient">
        <Empty>No one is waiting. Checked-in patients appear here.</Empty>
      </Card>
    )
  }
  const action = doctorAction(row)
  return (
    <Card title="Next Patient" aside={<span className="font-semibold text-on-surface">{row.time}</span>}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(row.patient.fullName)} tone="teal" />
          <div>
            <p className="text-lg font-semibold">{row.patient.fullName}</p>
            <p className="text-xs text-outline">{demographics(row.patient, view.date)}{row.token && ` · Token ${row.token}`}</p>
          </div>
        </div>
        <div>
          <p className="text-sm">{row.reason}</p>
          <p className="text-xs text-outline">{row.practitioner.displayName} · {row.practitioner.department}</p>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <StatusPill tone={row.vitals ? 'success' : 'warning'}>{row.vitals ? 'Vitals recorded' : 'Checked in'}</StatusPill>
          {waitingMinutes(row, now)}m waiting · arrived {row.arrivedTime}
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton to={patientLink(row.patient)}>View Patient</ActionButton>
          <ActionButton variant="primary" to={action.to}>{action.label}</ActionButton>
        </div>
      </div>
    </Card>
  )
}

function Attention({ clinical, date }) {
  const items = [
    ...clinical.alerts.items.map((alert) => ({ id: alert.id, tone: alert.severity === 'critical' ? 'danger' : 'warning', tag: alert.severity === 'critical' ? 'Critical' : 'High', patient: alert.patient, title: alert.title, detail: alert.detail, link: 'Review alert', to: chartTab(ROUTES.patientHub, alert.patient) })),
    ...clinical.results.items.filter((order) => order.urgent || order.resultFlag === 'critical').map((order) => ({ id: order.id, tone: order.resultFlag === 'critical' ? 'danger' : 'warning', tag: order.resultFlag === 'critical' ? 'Critical' : 'Urgent', patient: order.patient, title: order.title, detail: order.resultSummary ?? 'Result awaiting review', link: 'Review result', to: chartTab(ROUTES.patientOrders, order.patient) })),
  ]
  return (
    <Card title="Clinical Attention" aside={`${items.length} to review`}>
      {items.length === 0 ? (
        <Empty>No critical or urgent items right now.</Empty>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-5 py-3 text-xs">
              <StatusPill tone={item.tone} className="h-fit">{item.tag}</StatusPill>
              <div className="min-w-0">
                <p><strong className="text-[13px]">{item.patient.fullName}</strong> <span className="text-outline">{demographics(item.patient, date)}</span></p>
                <p className="mt-0.5">{item.title}</p>
                <p className="line-clamp-2 text-outline">{item.detail}</p>
                <ArrowLink to={item.to}>{item.link}</ArrowLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function DoctorDashboard() {
  const { user, can } = useAuth()
  const day = useDay()
  const [opened] = useState(() => new Date())
  const { view, now } = day
  // null = "my own list"; '' = every clinician the role can see.
  const [chosen, setChosen] = useState(null)
  const [status, setStatus] = useState('')

  const all = view ? worklist(view.appointments) : []
  const options = filterOptions(all)
  const mine = view?.me.practitionerId ?? ''
  const practitionerId = chosen ?? (all.some((row) => row.practitioner.id === mine) ? mine : '')
  const own = filterRows(all, { practitionerId })
  const rows = filterRows(own, { status })
  const tally = counts(own)
  const next = nextWaiting(own)
  const clinical = view?.clinical

  return (
    <DayPage day={day} title={greeting(user?.fullName, clinicHour(opened, view?.timeZone ?? 'Asia/Kolkata'))} subtitle="Your patients, documentation and results for today.">
      {view && clinical && (
        <>
          {!view.me.practitionerId && <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-on-surface-variant">Your account is not set up as a consulting clinician yet, so no appointments are assigned to you. Ask an administrator to add your consulting profile.</p>}
          <Stats
            items={[
              { label: "Today's Appointments", value: tally.total, hint: `${tally.upcoming} still to arrive`, icon: CalendarDays },
              { label: 'Waiting Patients', value: tally.waiting, hint: `${tally.ready} with vitals recorded`, icon: Users },
              { label: 'Active Encounters', value: tally.inConsultation, hint: own.find((row) => row.status === 'in_progress')?.patient.fullName ?? 'No consultation open', icon: Stethoscope },
              { label: 'Incomplete Documentation', value: clinical.unsigned.total, hint: 'Encounters not signed', icon: FileSignature },
              { label: 'Results Awaiting Review', value: clinical.results.total, hint: `${clinical.results.items.filter((order) => order.urgent).length} urgent`, icon: ClipboardList },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <NextPatient row={next} view={view} now={now} />
            <Attention clinical={clinical} date={view.date} />
          </div>

          <Card title="Clinical Work Queue" subtitle="Appointments for today" aside={`${rows.length} of ${all.length} shown`}>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
              {options.practitioners.length > 1 && <Filter label="Doctor" value={practitionerId} onChange={setChosen} options={options.practitioners} all="All clinicians" />}
              <Filter label="Status" value={status} onChange={setStatus} options={options.statuses} all="All statuses" />
            </div>
            {rows.length === 0 ? (
              <Empty>{all.length === 0 ? 'No appointments today.' : 'No appointment matches these filters.'}</Empty>
            ) : (
              <Table headings={['Token', 'Patient', 'Complaint', 'Time / status', 'Assigned clinician', 'Waiting', 'Action']} minWidth="min-w-[920px]">
                {rows.map((row) => {
                  const action = doctorAction(row)
                  return (
                    <tr key={row.id} className={cn('border-t border-slate-100 align-top', next?.id === row.id && 'bg-teal-50/60')}>
                      <td className="px-5 py-4 font-semibold text-outline">{row.token ?? '—'}</td>
                      <td className="px-5 py-4"><Link to={patientLink(row.patient)} className="text-[13px] font-semibold hover:underline">{row.patient.fullName}</Link><span className="block text-outline">{demographics(row.patient, view.date)}</span></td>
                      <td className="max-w-56 px-5 py-4">{row.reason}</td>
                      <td className="px-5 py-4"><span className="mr-2 font-semibold">{row.time}</span><StatusPill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</StatusPill>{row.encounter?.status === 'in_progress' && <span className="mt-1 block text-outline">Note unsigned</span>}</td>
                      <td className="px-5 py-4">{row.practitioner.displayName}<span className="block text-outline">{row.practitioner.department}</span></td>
                      <td className="px-5 py-4">{row.status === 'arrived' ? `${waitingMinutes(row, now)}m` : '—'}</td>
                      <td className="px-5 py-4">{can('clinical.write') && <ArrowLink to={action.to}>{action.label}</ArrowLink>}</td>
                    </tr>
                  )
                })}
              </Table>
            )}
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-outline">{summaryLine(tally)}</p>
          </Card>

          <section aria-label="Pending Tasks">
            <h2 className="mb-3 text-[17px] font-semibold">Pending Tasks</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TaskCard title="Unsigned notes" list={clinical.unsigned} empty="Every encounter is signed." render={(item) => <><span className="block">{item.patient.fullName} · {item.patient.mrn}</span><ArrowLink to={pathFor(ROUTES.encounter, { patientId: item.patient.id, encounterId: item.id })}>Review {item.reference}</ArrowLink></>} />
              <TaskCard title="Results awaiting review" list={clinical.results} empty="No results are waiting." render={(item) => <><span className="block">{item.patient.fullName} · {item.title}</span><ArrowLink to={chartTab(ROUTES.patientOrders, item.patient)}>Open result</ArrowLink></>} />
              <TaskCard title="Care-plan follow-up" list={clinical.carePlans} empty="No care plan is due for review." render={(item) => <><span className="block">{item.patient.fullName} · {item.title}</span><ArrowLink to={ROUTES.clinical}>Review due {item.nextReview}</ArrowLink></>} />
              <TaskCard title="Safety alerts" list={clinical.alerts} empty="No active serious alerts." render={(item) => <><span className="block">{item.patient.fullName} · {item.title}</span><ArrowLink to={chartTab(ROUTES.patientHub, item.patient)}>Open chart</ArrowLink></>} />
            </div>
          </section>
        </>
      )}
    </DayPage>
  )
}
