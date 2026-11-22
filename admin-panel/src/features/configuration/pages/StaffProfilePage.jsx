import { useState } from 'react'
import { Building2, History, KeyRound, Stethoscope, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import DetailList from '../../../components/workspace/DetailList'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { ENGAGEMENT_LABELS, STATUS_LABELS, TYPE_LABELS } from '../../staff/adapters'
import { staffApi } from '../../staff/api'
import BranchAssignmentDrawer from '../components/BranchAssignmentDrawer'
import ConfigPage from '../components/ConfigPage'
import { initialsOf } from '../configView'

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
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function ProfileHeader({ person, canEdit }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-4">
        <Avatar initials={initialsOf(person.fullName)} tone="ink" size="lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-on-surface">{person.fullName}</h1>
            <StatusPill tone={person.status === 'active' ? 'success' : 'neutral'} dot>{person.onLeave ? 'On leave' : STATUS_LABELS[person.status] ?? person.status}</StatusPill>
            <StatusPill className="rounded">{TYPE_LABELS[person.type]}</StatusPill>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">{[person.designation, `Staff code: ${person.staffCode}`].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {canEdit && <ActionButton to={pathFor(ROUTES.staffEdit, { staffId: person.id })}>Edit profile</ActionButton>}
        <ActionButton to={pathFor(ROUTES.staffMember, { staffId: person.id })}>Full staff record</ActionButton>
      </div>
    </div>
  )
}

function Affiliation({ branch, department, staffId }) {
  return (
    <li className={`flex flex-wrap items-start justify-between gap-3 rounded-md border p-4 ${branch.isPrimary ? 'border-brand bg-teal-50/50' : 'border-slate-200'}`}>
      <div className="flex min-w-0 gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-low text-on-surface-variant">
          <Building2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
            <Link to={pathFor(ROUTES.branchStaff, { branchId: branch.id })} className="hover:text-brand">{branch.name}</Link>
            {branch.isPrimary && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">PRIMARY</span>}
            <StatusPill tone="success">Assigned</StatusPill>
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {[
              ['Department', department ?? '—'],
              ['City', branch.city],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-outline">{label}</dt>
                <dd className="font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <ActionButton size="sm" to={pathFor(ROUTES.staffSchedule, { staffId })}>View schedule</ActionButton>
    </li>
  )
}

function AuditLog({ staffId }) {
  const history = useApiResource(() => staffApi.history(staffId), `staff-history:${staffId}`)
  const entries = history.data ?? []
  return (
    <Panel icon={History} title="Operational audit log">
      {!history.data ? (
        <p role={history.error ? 'alert' : 'status'} className="text-xs text-on-surface-variant">{history.error ? history.error.message : 'Loading history…'}</p>
      ) : (
        <ol className="space-y-4 border-l border-slate-200 pl-4">
          {entries.slice(0, 8).map((entry) => (
            <li key={entry.id} className="relative text-xs leading-4">
              <span className="absolute top-1 -left-[21px] size-2 rounded-full bg-brand ring-2 ring-white" />
              <p className="font-medium text-on-surface">{ACTION_TEXT[entry.action] ?? entry.action}</p>
              <p className="mt-0.5 text-outline">{entry.actor ?? 'System'}</p>
              <p className="text-outline">{when(entry.at)}</p>
            </li>
          ))}
          {entries.length === 0 && <li className="text-xs text-on-surface-variant">No changes recorded yet.</li>}
        </ol>
      )}
      <Link to={pathFor(ROUTES.staffMember, { staffId })} className="mt-4 block w-full text-center text-xs font-semibold text-brand hover:underline">View full staff record</Link>
    </Panel>
  )
}

export default function StaffProfilePage() {
  const { staffId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => staffApi.get(staffId), `staff:${staffId}`)
  const [updated, setUpdated] = useState(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const person = updated?.id === staffId ? updated : resource.data

  if (!person) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Staff member not found' : 'Staff profile'} />
        {resource.error?.status !== 404 && <LoadingState label="Loading profile…" error={resource.error} onRetry={resource.reload} />}
      </ConfigPage>
    )
  }

  const canAssign = can('staff.create')
  const identification = [
    { label: 'Staff code', value: person.staffCode },
    { label: 'Type', value: TYPE_LABELS[person.type] },
    { label: 'Email', value: person.email ?? '—' },
    { label: 'Mobile', value: person.mobile ?? '—' },
    { label: 'Engagement', value: ENGAGEMENT_LABELS[person.engagement] ?? person.engagement },
    ...(person.type === 'doctor' ? [{ label: 'Council registration', value: [person.council, person.councilNumber].filter(Boolean).join(' · ') || '—' }] : []),
  ]

  return (
    <ConfigPage>
      <ProfileHeader person={person} canEdit={canAssign} />
      {notice && <Banner tone="brand" title={notice} className="mb-5" />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel icon={UserRound} title="Master identification & contact">
            <DetailList items={identification} />
          </Panel>

          <Panel
            icon={Building2}
            title="Organization & branch roster affiliations"
            subtitle={`${person.fullName} works at ${person.branches.length} branch${person.branches.length === 1 ? '' : 'es'}.`}
            action={canAssign && <ActionButton variant="brand" size="sm" onClick={() => setAssignmentOpen(true)}>Manage branch assignment</ActionButton>}
          >
            <ul className="flex flex-col gap-3">
              {person.branches.map((branch) => (
                <Affiliation key={branch.id} branch={branch} department={person.department} staffId={person.id} />
              ))}
              {person.branches.length === 0 && <li className="text-xs text-on-surface-variant">Not deployed to any branch yet.</li>}
            </ul>
          </Panel>

          <Panel icon={Stethoscope} title="Professional & clinical information">
            <DetailList
              items={[
                { label: 'Primary department', value: person.department ?? '—' },
                { label: 'Designation', value: person.designation || '—' },
                {
                  label: 'Qualifications',
                  full: true,
                  value: person.qualifications.length ? (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {person.qualifications.map((item) => (
                        <span key={item} className="rounded border border-slate-200 bg-surface-lowest px-2 py-1 text-xs font-normal">{item}</span>
                      ))}
                    </span>
                  ) : '—',
                },
              ]}
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {canAssign && (
            <aside className="rounded-lg border border-teal-200 bg-teal-50/60 p-5">
              <h2 className="text-sm font-semibold text-on-surface">Managing branch assignment?</h2>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">Choose the branches this person works at and their primary branch.</p>
              <ActionButton variant="brand" className="mt-4 w-full" onClick={() => setAssignmentOpen(true)}>Open Branch Assignment</ActionButton>
            </aside>
          )}

          <Panel icon={KeyRound} title="Role & access summary" action={person.account.linked && can('settings.roles') && <ActionButton variant="soft" size="sm" to={ROUTES.roles}>Manage access</ActionButton>}>
            {person.account.linked ? (
              <dl className="space-y-4 text-xs">
                <div>
                  <dt className="text-outline">ClinicOS account</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-on-surface">{person.account.email}</dd>
                </div>
                <div>
                  <dt className="text-outline">Roles</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {person.account.roles.map((role) => <StatusPill key={role} className="rounded">{role}</StatusPill>)}
                    {person.account.roles.length === 0 && <span className="text-on-surface-variant">No roles</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-outline">Last sign-in</dt>
                  <dd className="font-medium text-on-surface">{person.account.lastLoginAt ? when(person.account.lastLoginAt) : 'Never'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs leading-5 text-on-surface-variant">{person.account.invitationPending ? `Invitation sent to ${person.account.invitedEmail}; not accepted yet.` : 'Has no ClinicOS account. Invite them from their staff record to give them access.'}</p>
            )}
            <p className="mt-4 rounded-md bg-surface-lowest p-3 text-xs leading-4 text-on-surface-variant">Access comes from roles; changing roles needs the Roles & permissions privilege.</p>
          </Panel>

          <AuditLog staffId={person.id} />
        </div>
      </div>
      {canAssign && (
        <BranchAssignmentDrawer
          key={person.branches.map((branch) => branch.id).join(',')}
          open={assignmentOpen}
          onClose={() => setAssignmentOpen(false)}
          person={person}
          onSaved={(next) => {
            setUpdated(next)
            setNotice('Branch assignment saved.')
          }}
        />
      )}
    </ConfigPage>
  )
}
