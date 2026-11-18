import { ChevronRight, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { practitionersApi } from '../../patients/api'
import LoadingState from '../../patients/components/LoadingState'
import { formatDate, localToday } from '../../patients/format'
import { ENGAGEMENT_LABELS, leavePeriod, LEAVE_KIND_LABELS, toPersonView } from '../adapters'
import { staffApi } from '../api'
import StaffNotFound from '../components/StaffNotFound'

const ACTION_TEXT = {
  'staff.created': 'Record created',
  'staff.updated': 'Details updated',
  'staff.branches_changed': 'Branch assignments changed',
  'staff.invited': 'Invited to ClinicOS',
  'staff.account_linked': 'Linked to a ClinicOS account',
  'staff.attendance_recorded': 'Attendance recorded',
  'staff.attendance_corrected': 'Attendance corrected',
  'staff.leave_created': 'Leave or block added',
  'staff.leave_cancelled': 'Leave or block cancelled',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function KeyValues({ title, rows }) {
  return (
    <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
      <p className="mb-2 border-b border-slate-200 pb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">{title}</p>
      <dl className="space-y-2.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-on-surface-variant">{label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-on-surface">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const NAV = [
  { route: 'staffBranches', title: 'Branch assignments', detail: 'Where this person works' },
  { route: 'staffAccount', title: 'User account & access', detail: 'ClinicOS login and role' },
  { route: 'staffSchedule', title: 'OPD schedule', detail: 'Slot length and consulting hours' },
  { route: 'staffLeave', title: 'Leave & availability', detail: 'Planned leave and blocks' },
  { route: 'staffAttendance', title: 'Attendance records', detail: 'Daily attendance ledger' },
]

export default function StaffProfilePage() {
  const { staffId } = useParams()
  const { can } = useAuth()
  const person = useApiResource(() => staffApi.get(staffId), staffId)
  const month = localToday().slice(0, 7)
  const attendance = useApiResource(() => staffApi.attendance(staffId, month), `${staffId}:${month}`)
  const leaves = useApiResource(() => staffApi.leaves(staffId), staffId)
  const history = useApiResource(() => staffApi.history(staffId), staffId)
  const practitionerId = person.data?.practitioner?.id
  const practitioner = useApiResource(() => (practitionerId ? practitionersApi.get(practitionerId) : Promise.resolve(null)), practitionerId ?? 'none')

  if (person.loading && !person.data) return <WorkspacePage><LoadingState label="Loading staff record…" /></WorkspacePage>
  if (!person.data) return person.error?.status === 404 || !person.error ? <StaffNotFound /> : <WorkspacePage><LoadingState error={person.error} onRetry={person.reload} /></WorkspacePage>

  const record = person.data
  const view = toPersonView(record)
  const path = (route) => pathFor(ROUTES[route], { staffId })
  const today = localToday()
  const upcoming = (leaves.data ?? []).filter((leave) => leave.status === 'scheduled' && leave.endDate >= today).slice(0, 3)
  const counts = attendance.data?.counts
  const schedule = practitioner.data

  return (
    <WorkspacePage>
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar initials={view.initials} tone="ink" size="lg" />
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-on-surface">
                {view.name}
                <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-xs font-normal text-on-surface-variant">{view.staffCode}</span>
              </h1>
              <p className="mt-1 flex flex-wrap gap-2">
                <StatusPill tone="success">{view.role}</StatusPill>
                <StatusPill tone={view.status === 'Active' ? 'success' : view.status === 'On Leave' ? 'warning' : 'neutral'} dot>{view.status}{view.leaveNote && ` · ${view.leaveNote}`}</StatusPill>
              </p>
              {record.councilNumber && <p className="mt-2 text-xs text-on-surface-variant">Council registration: <strong className="text-on-surface">{record.council ? `${record.council} · ` : ''}{record.councilNumber}</strong></p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('staff.create') && <ActionButton icon={Pencil} to={path('staffEdit')}>Edit Details</ActionButton>}
            {can('staff.credentials') && <ActionButton to={path('staffAccount')}>Manage Access</ActionButton>}
          </div>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-on-surface-variant">
          <span>Primary department: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{view.department}</strong></span>
          <span>Assigned facilities: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{view.branches.length || 'None yet'}</strong></span>
          <span>ClinicOS login: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{record.account.linked ? 'Active' : record.account.invitationPending ? 'Invitation sent' : 'None'}</strong></span>
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="1. Personal & professional information">
            <div className="grid gap-4 md:grid-cols-2">
              <KeyValues title="Identity & contact" rows={[['Full name', view.name], ['Type', view.type], ['Mobile', view.mobile], ['Work email', view.email]]} />
              <KeyValues title="Professional" rows={[['Designation', view.role], ['Department', view.department], ['Qualifications', record.qualifications.join(', ')], ['Engagement', ENGAGEMENT_LABELS[record.engagement]]]} />
            </div>
          </Panel>

          <Panel title="2. Branch assignments" action={can('staff.create') && <ActionButton variant="soft" size="sm" to={path('staffBranches')}>Manage branches</ActionButton>} bodyClassName="p-0">
            <Table headings={['Facility', 'Deployment', 'City']} minWidth={480} empty={record.branches.length ? null : 'Not assigned to any branch yet.'}>
              {record.branches.map((branch) => (
                <Row key={branch.id}>
                  <Cell className="font-semibold">{branch.name}</Cell>
                  <Cell><StatusPill tone={branch.isPrimary ? 'brand' : 'neutral'}>{branch.isPrimary ? 'Primary' : 'Secondary'}</StatusPill></Cell>
                  <Cell className="text-xs">{branch.city}</Cell>
                </Row>
              ))}
            </Table>
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="3. ClinicOS account" action={can('staff.credentials') && <ActionButton variant="soft" size="sm" to={path('staffAccount')}>Manage →</ActionButton>}>
              {record.account.linked ? (
                <dl className="space-y-3 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Sign-in email</dt><dd className="font-medium text-on-surface">{record.account.email}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Roles</dt><dd className="text-right font-medium text-on-surface">{record.account.roles.join(', ') || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Last sign-in</dt><dd className="font-medium text-on-surface">{record.account.lastLoginAt ? formatDate(record.account.lastLoginAt.slice(0, 10)) : 'Never'}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-on-surface-variant">{record.account.invitationPending ? `Invitation sent to ${record.account.invitedEmail}; the record links when it is accepted.` : 'No ClinicOS login. Not everyone needs one.'}</p>
              )}
            </Panel>

            <Panel title="4. OPD schedule" action={<ActionButton variant="soft" size="sm" to={path('staffSchedule')}>Manage schedule →</ActionButton>}>
              {schedule ? (
                <>
                  <p className="text-sm font-semibold text-on-surface">{schedule.displayName} · {schedule.slotMinutes}-minute slots</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {schedule.availability.map((window) => <li key={`${window.weekday}-${window.start}-${window.branchId}`} className="rounded bg-surface-high px-1.5 py-0.5">{WEEKDAYS[window.weekday]} {window.start}–{window.end}</li>)}
                    {schedule.availability.length === 0 && <li className="text-on-surface-variant">No consulting hours set</li>}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">{record.account.linked ? 'Not set up to see patients.' : 'Needs a ClinicOS login before a schedule can be set up.'}</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="5. Leave & blocks" action={<ActionButton variant="soft" size="sm" to={path('staffLeave')}>Manage →</ActionButton>}>
              <p className="mb-3 flex items-center justify-between rounded-md bg-teal-100 px-3 py-2 text-xs font-semibold text-brand">Current state <span className="uppercase">{view.status === 'On Leave' ? 'On leave' : 'Available'}</span></p>
              <ul className="flex flex-col gap-3">
                {upcoming.map((leave) => (
                  <li key={leave.id} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                    <p className="flex items-center justify-between font-semibold text-on-surface">{leavePeriod(leave)} <StatusPill className="rounded">{LEAVE_KIND_LABELS[leave.kind]}</StatusPill></p>
                    <p className="mt-1 text-on-surface-variant">{leave.title}</p>
                  </li>
                ))}
                {upcoming.length === 0 && <li className="text-xs text-on-surface-variant">No upcoming leave or blocks.</li>}
              </ul>
            </Panel>

            <Panel title="6. Attendance this month" action={<ActionButton variant="soft" size="sm" to={path('staffAttendance')}>Full ledger →</ActionButton>}>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[['Present', counts?.present], ['Late', counts?.late], ['Absent', counts?.absent]].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                    <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
                    <p className="text-lg font-bold text-on-surface">{value ?? '—'}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-outline">{attendance.data ? `${attendance.data.records.length} record${attendance.data.records.length === 1 ? '' : 's'} so far this month` : 'Loading…'}</p>
            </Panel>
          </div>

          <Panel title="7. Record history">
            <ol className="space-y-4 border-l border-slate-200 pl-4">
              {(history.data ?? []).map((entry) => (
                <li key={entry.id} className="relative text-xs">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-slate-400 ring-2 ring-white" />
                  <p className="font-semibold text-on-surface">{ACTION_TEXT[entry.action] ?? entry.action} <span className="font-normal text-outline">{formatDate(entry.at.slice(0, 10))}</span></p>
                  {entry.actor && <p className="text-on-surface-variant">By {entry.actor}</p>}
                </li>
              ))}
              {history.data?.length === 0 && <li className="text-xs text-on-surface-variant">No history yet.</li>}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Workforce management" bodyClassName="p-3">
            <ul className="flex flex-col gap-2">
              {NAV.map((item) => (
                <li key={item.route}>
                  <Link to={path(item.route)} className="flex w-full items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left hover:bg-surface-lowest">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-on-surface">{item.title}</span>
                      <span className="block text-xs text-on-surface-variant">{item.detail}</span>
                    </span>
                    <ChevronRight className="size-4 text-outline" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <InfoNote>
            <strong className="text-on-surface">Historical safety:</strong> changing branches, schedules or access never alters signed encounters, prescriptions or billing records.
          </InfoNote>
        </div>
      </div>
    </WorkspacePage>
  )
}
