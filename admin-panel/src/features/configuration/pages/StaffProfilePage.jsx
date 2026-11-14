import { useState } from 'react'
import { BadgeCheck, Building2, History, KeyRound, Stethoscope, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import DetailList from '../../../components/workspace/DetailList'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import BranchAssignmentDrawer from '../components/BranchAssignmentDrawer'
import ConfigPage from '../components/ConfigPage'
import { STAFF_PROFILE as profile } from '../data/staff'

function ProfileHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-4">
        <Avatar initials={profile.initials} tone="ink" size="lg" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-on-surface">{profile.name}</h1>
            <StatusPill tone="success" dot>Active</StatusPill>
            <StatusPill className="rounded">Doctor</StatusPill>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {profile.designation} · Master ID: {profile.masterId} ·{' '}
            <Link to={pathFor(ROUTES.branchStaff, { branchId: 'main' })} className="font-medium text-brand hover:underline">
              Main Clinic Scope
            </Link>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <ActionButton>Edit profile</ActionButton>
        <ActionButton>More actions</ActionButton>
      </div>
    </div>
  )
}

function Affiliation({ branch }) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-md border p-4',
        branch.current ? 'border-brand bg-teal-50/50' : 'border-slate-200',
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-low text-on-surface-variant">
          <Building2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
            {branch.name}
            {branch.current && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">CURRENT VIEW</span>}
            <StatusPill tone="success">Assigned</StatusPill>
            {branch.flag && !branch.current && <StatusPill tone="warning">{branch.flag}</StatusPill>}
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            {[
              ['Department', branch.department],
              ['Chamber allocation', branch.chamber],
              ['Operational status', branch.status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-outline">{label}</dt>
                <dd className="font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {branch.current ? (
        <span className="text-xs font-medium text-brand">{branch.flag}</span>
      ) : (
        <ActionButton size="sm">View schedule</ActionButton>
      )}
    </li>
  )
}

function AuditLog() {
  return (
    <Panel icon={History} title="Operational audit log" action={<span className="font-mono text-[10px] text-outline">SEC_IMMUTABLE</span>}>
      <ol className="space-y-4 border-l border-slate-200 pl-4">
        {profile.audit.map((entry) => (
          <li key={entry.id} className="relative text-xs leading-4">
            <span className="absolute top-1 -left-[21px] size-2 rounded-full bg-brand ring-2 ring-white" />
            <p className="font-medium text-on-surface">{entry.text}</p>
            <p className="mt-0.5 text-outline">{entry.by}</p>
            <p className="text-outline">{entry.at}</p>
          </li>
        ))}
      </ol>
      <button type="button" className="mt-4 block w-full text-center text-xs font-semibold text-brand hover:underline">
        View full immutable audit trail
      </button>
    </Panel>
  )
}

export default function StaffProfilePage() {
  const { access, clinical } = profile
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const openAssignment = () => setAssignmentOpen(true)

  return (
    <ConfigPage>
      <ProfileHeader />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel icon={UserRound} title="Master identification & contact" action={<span className="font-mono text-[10px] text-outline">SYNCD_ABDM_HPR</span>}>
            <DetailList items={profile.identification} />
          </Panel>

          <Panel
            icon={Building2}
            title="Organization & branch roster affiliations"
            subtitle="Dr. Ananya Rao holds active clinical privileges across 3 health system facilities. Branch assignment governs local chamber booking and encounter signing."
            action={<ActionButton variant="brand" size="sm" onClick={openAssignment}>Manage branch assignment</ActionButton>}
          >
            <ul className="flex flex-col gap-3">
              {profile.affiliations.map((branch) => (
                <Affiliation key={branch.id} branch={branch} />
              ))}
            </ul>
          </Panel>

          <Panel icon={Stethoscope} title="Professional & clinical information" action={<span className="text-[10px] text-outline">OPD Clinical Scope</span>}>
            <DetailList
              items={[
                { label: 'Primary department', value: `${clinical.department} ${clinical.departmentCode}` },
                { label: 'Core clinical specialty', value: clinical.specialty },
                {
                  label: 'Secondary clinical competencies',
                  full: true,
                  value: (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {clinical.competencies.map((item) => (
                        <span key={item} className="rounded border border-slate-200 bg-surface-lowest px-2 py-1 text-xs font-normal">
                          {item}
                        </span>
                      ))}
                    </span>
                  ),
                },
                { label: 'Consultation languages', value: clinical.languages },
                { label: 'Clinical signing authority', value: <span className="text-brand">{clinical.signing}</span> },
              ]}
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <aside className="rounded-lg border border-teal-200 bg-teal-50/60 p-5">
            <h2 className="text-sm font-semibold text-on-surface">Managing Main Clinic Assignment?</h2>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Adjust local chamber slots, consultation shifts, or toggle OPD availability specifically for <strong>Main Clinic (HYD-HQ-01)</strong>.
            </p>
            <ActionButton variant="brand" className="mt-4 w-full" onClick={openAssignment}>
              Open Branch Assignment
            </ActionButton>
          </aside>

          <Panel icon={KeyRound} title="Role & access summary" action={<ActionButton variant="soft" size="sm">Manage access</ActionButton>}>
            <dl className="space-y-4 text-xs">
              <div>
                <dt className="text-outline">Global role profile</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-on-surface">{access.profile}</dd>
              </div>
              <div>
                <dt className="text-outline">Role permission matrix</dt>
                <dd className="mt-1 rounded-md bg-surface-lowest p-3">
                  <p className="font-semibold text-on-surface">{access.tier}</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-on-surface-variant">
                    {access.permissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-outline">Authorized facility access scope</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {access.facilities.map((facility) => (
                    <StatusPill key={facility} className="rounded">{facility}</StatusPill>
                  ))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-outline">Two-factor authentication</dt>
                <dd>
                  <StatusPill tone="success">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    {access.twoFactor}
                  </StatusPill>
                </dd>
              </div>
            </dl>
            <p className="mt-4 rounded-md bg-surface-lowest p-3 text-xs leading-4 text-on-surface-variant">
              Access permissions are managed centrally. Modifying RBAC matrices requires Organization Admin privileges.
            </p>
          </Panel>

          <AuditLog />
        </div>
      </div>
      <BranchAssignmentDrawer open={assignmentOpen} onClose={() => setAssignmentOpen(false)} person={profile} />
    </ConfigPage>
  )
}
