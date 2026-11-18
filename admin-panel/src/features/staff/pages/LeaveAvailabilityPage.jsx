import { useState } from 'react'
import { AlertTriangle, CalendarDays, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { formatDate, localToday } from '../../patients/format'
import { LEAVE_KIND_LABELS, leaveLength, leavePeriod, toPersonView } from '../adapters'
import { staffApi } from '../api'
import LeaveExceptionDrawer from '../components/LeaveExceptionDrawer'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'

export default function LeaveAvailabilityPage() {
  const { staffId } = useParams()
  const person = useApiResource(() => staffApi.get(staffId), staffId)
  if (person.loading && !person.data) return <WorkspacePage><LoadingState label="Loading leave…" /></WorkspacePage>
  if (!person.data) return <StaffNotFound title="Leave & Availability" />
  return <Leaves record={person.data} />
}

function Leaves({ record }) {
  const { can } = useAuth()
  const person = toPersonView(record)
  const leaves = useApiResource(() => staffApi.leaves(record.id), record.id)
  const [scope, setScope] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState(null)

  const memberPath = pathFor(ROUTES.staffMember, { staffId: record.id })
  const schedulePath = pathFor(ROUTES.staffSchedule, { staffId: record.id })
  const today = localToday()
  const all = leaves.data ?? []
  const upcoming = all.filter((leave) => leave.status === 'scheduled' && leave.endDate >= today)
  const history = all.filter((leave) => leave.status === 'cancelled' || leave.endDate < today)
  const visible = upcoming.filter((leave) => scope === 'all' || leave.branch === null || leave.branch.id === scope)
  const next = [...upcoming].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  const tabs = [{ id: 'all', label: 'All Branches' }, ...record.branches.map((branch) => ({ id: branch.id, label: `${branch.name} Only` }))]

  const commit = async (body) => {
    const result = await staffApi.createLeave(record.id, body)
    setNotice(result.affectedAppointments ? { tone: 'warning', text: `${result.affectedAppointments} booked appointment${result.affectedAppointments === 1 ? '' : 's'} fall in this window and should be moved.` } : { tone: 'success', text: 'Exception saved. No booked appointments are affected.' })
    leaves.reload()
  }
  const cancel = async (leave) => {
    setNotice(null)
    try {
      await staffApi.cancelLeave(record.id, leave.id)
      setNotice({ tone: 'success', text: `${leave.title} cancelled; the slots are bookable again.` })
      leaves.reload()
    } catch (error) {
      setNotice({ tone: 'warning', text: error.message })
    }
  }

  return (
    <WorkspacePage>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-outline">
        <Link to={ROUTES.staffDirectory} className="hover:text-on-surface">Staff Directory</Link>/
        <Link to={memberPath} className="hover:text-on-surface">{person.name}</Link>/
        <span className="font-medium text-on-surface">Leave &amp; Availability</span>
      </nav>

      <PageIntro
        title="Leave & Availability"
        description="Record leave and temporary blocks. They remove this person's appointment slots for those dates without changing the recurring OPD schedule."
        actions={
          <>
            <ActionButton icon={CalendarDays} to={schedulePath}>View OPD Schedule</ActionButton>
            {can('staff.leave') && <ActionButton variant="brand" icon={Plus} onClick={() => setDrawerOpen(true)}>Add Leave / Exception</ActionButton>}
          </>
        }
      />

      <PersonBanner person={person} subtitle={`${person.role} · ${person.department}`} facts={[['Primary branch', person.primaryBranch ?? 'Not assigned'], ['Branches', record.branches.map((branch) => branch.name).join(', ') || '—'], ['ClinicOS login', record.account.linked ? 'Linked' : 'None']]} />

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Current availability', person.status === 'On Leave' ? 'On leave' : 'Available', person.leaveNote ?? 'No whole-day leave today'],
          ['Upcoming exceptions', `${upcoming.length} Scheduled`, `${upcoming.filter((leave) => leave.kind === 'block').length} block(s)`],
          ['Next unavailable date', next ? formatDate(next.startDate) : 'None', next?.title ?? ''],
        ].map(([label, value, hint], index) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
            <dd className={index === 0 ? 'text-lg font-bold text-brand' : 'text-lg font-bold text-on-surface'}>{value}</dd>
            <p className="text-[11px] text-on-surface-variant">{hint}</p>
          </div>
        ))}
      </dl>
      {notice && <p role={notice.tone === 'warning' ? 'alert' : 'status'} className={`mb-4 rounded-md border px-4 py-2.5 text-xs ${notice.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-teal-200 bg-teal-50/60 text-on-surface'}`}>{notice.text}</p>}

      <div className="flex flex-col gap-5">
        <Panel title={<span className="flex items-center gap-2">Upcoming leave &amp; exceptions <StatusPill>{visible.length} Active</StatusPill></span>} bodyClassName="p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <FilterTabs options={tabs} value={scope} onChange={setScope} label="Branch scope" />
          </div>
          <Table headings={['Date / period', 'Type', 'Branch scope', 'Reason / operational note', 'Recorded by', '']} minWidth={820} empty={visible.length ? null : leaves.loading ? 'Loading…' : 'No upcoming exceptions.'}>
            {visible.map((leave) => (
              <Row key={leave.id}>
                <Cell>
                  <p className="font-semibold">{leavePeriod(leave)}</p>
                  <p className="text-[11px] text-outline">{leaveLength(leave)}</p>
                </Cell>
                <Cell>
                  <StatusPill tone={leave.kind === 'leave' ? 'success' : 'warning'} className="rounded">{LEAVE_KIND_LABELS[leave.kind]}</StatusPill>
                  <p className="mt-1 text-[11px] text-outline">{leave.title}</p>
                </Cell>
                <Cell className="font-medium">{leave.branch?.name ?? 'All assigned branches'}</Cell>
                <Cell className="max-w-48 text-xs">{leave.reason}</Cell>
                <Cell className="text-xs text-on-surface-variant">{leave.createdBy}</Cell>
                <Cell>
                  {can('staff.leave') && (
                    <button type="button" aria-label={`Cancel ${leave.title}`} onClick={() => cancel(leave)} className="text-outline hover:text-danger">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </Cell>
              </Row>
            ))}
          </Table>
          <InfoNote tone="neutral" icon={ShieldCheck} className="m-5">
            <strong className="text-on-surface">Appointment protection:</strong> while an exception is scheduled, its slots cannot be booked. Appointments booked before it are left in place and counted when you save, so the desk can move them.
          </InfoNote>
        </Panel>

        <Panel title="Availability history" action={<span className="text-[11px] text-outline">{history.length} records</span>} bodyClassName="p-0">
          <Table headings={['Period', 'Type', 'Branch scope', 'Status', 'Recorded by']} minWidth={640} empty={history.length ? null : 'No past or cancelled exceptions.'}>
            {history.map((leave) => (
              <Row key={leave.id}>
                <Cell className="font-medium">{leavePeriod(leave)}</Cell>
                <Cell>{leave.title}</Cell>
                <Cell>{leave.branch?.name ?? 'All branches'}</Cell>
                <Cell>{leave.status === 'cancelled' ? <StatusPill><AlertTriangle className="size-3" aria-hidden="true" />Cancelled{leave.cancelledBy ? ` by ${leave.cancelledBy}` : ''}</StatusPill> : <StatusPill tone="neutral">Completed</StatusPill>}</Cell>
                <Cell className="text-xs text-on-surface-variant">{leave.createdBy}</Cell>
              </Row>
            ))}
          </Table>
        </Panel>
      </div>

      {drawerOpen && <LeaveExceptionDrawer open branches={record.branches} onClose={() => setDrawerOpen(false)} onCommit={commit} />}
    </WorkspacePage>
  )
}
