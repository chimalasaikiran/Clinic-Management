import { ChevronRight, Pencil, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import StaffNotFound from '../components/StaffNotFound'
import { useStaffDirectory } from '../context/useStaffDirectory'
import {
  ANANYA as ananya,
  AUDIT_TRAIL,
  BRANCH_ROWS,
  CLINICAL_CADRE,
  DEMOGRAPHICS,
  IAM,
  OPD_CADENCE,
  PROFILE_LEAVES,
  PROFILE_STATUS,
  ROLES,
  TARIFFS,
  TRUST_VAULT,
  UNITS,
  WORKFORCE_NAV,
} from '../data/ananya'

function KeyValues({ title, rows }) {
  return (
    <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
      <p className="mb-2 border-b border-slate-200 pb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">{title}</p>
      <dl className="space-y-2.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-on-surface-variant">{label}</dt>
            <dd className="max-w-[60%] text-right font-medium text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function WorkforceNav({ staffId }) {
  return (
    <Panel title="Workforce management" action={<span className="text-[10px] text-outline">HUB NAV</span>} bodyClassName="p-3">
      <p className="px-2 pb-3 text-xs text-on-surface-variant">Direct authoritative links to individual operational subsystems for Dr. Rao.</p>
      <ul className="flex flex-col gap-2">
        {WORKFORCE_NAV.map((item) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-on-surface">{item.title}</span>
                <span className="block text-xs text-on-surface-variant">{item.detail}</span>
              </span>
              <ChevronRight className="size-4 text-outline" aria-hidden="true" />
            </>
          )
          const rowClass = 'flex w-full items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left hover:bg-surface-lowest'
          return (
            <li key={item.id}>
              {item.to ? (
                <Link to={pathFor(ROUTES[item.to], { staffId })} className={rowClass}>{body}</Link>
              ) : (
                <a href={`#${item.id}`} className={rowClass}>{body}</a>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function FullProfile({ staffId }) {
  const path = (route) => pathFor(ROUTES[route], { staffId })

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="1. Personal & professional information" action={<ActionButton variant="soft" size="sm">View full professional details →</ActionButton>} className="scroll-mt-20">
          <div id="professional" className="grid gap-4 md:grid-cols-2">
            <KeyValues title="Personal demographics" rows={DEMOGRAPHICS} />
            <KeyValues title="Clinical cadre & academics" rows={CLINICAL_CADRE} />
          </div>
        </Panel>

        <Panel title="2. Institutional branch assignments" action={<ActionButton variant="soft" size="sm" to={path('staffBranches')}>+ Assign additional branch</ActionButton>} bodyClassName="p-0">
          <Table headings={['Facility unit', 'Deployment type', 'Physical location', 'Operating cadence', 'Status']} minWidth={680}>
            {BRANCH_ROWS.map((row) => (
              <Row key={row.id}>
                <Cell>
                  <p className="font-semibold">{row.unit}</p>
                  <p className="text-[11px] text-outline">{row.campus}</p>
                </Cell>
                <Cell><span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">{row.type}</span></Cell>
                <Cell className="text-xs">{row.location}</Cell>
                <Cell className="text-xs">{row.cadence}</Cell>
                <Cell><StatusPill tone="success" dot>{row.status}</StatusPill></Cell>
              </Row>
            ))}
          </Table>
          <div className="border-t border-slate-100 px-5 py-3 text-right">
            <Link to={path('staffBranches')} className="text-xs font-semibold text-brand hover:underline">Manage branch assignments →</Link>
          </div>
        </Panel>

        <Panel title="3. Department & clinical unit association" action={<ActionButton variant="soft" size="sm" to={ROUTES.departments}>Manage allocations →</ActionButton>}>
          <div id="department" className="grid gap-3 md:grid-cols-3">
            {UNITS.map((unit) => (
              <div key={unit.id} className={cn('rounded-md border p-4 text-xs', unit.primary ? 'border-brand bg-teal-50/40' : 'border-slate-200')}>
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{unit.label}</p>
                <p className="mt-1 text-[14px] font-semibold text-on-surface">{unit.name}</p>
                <p className="mt-1 text-on-surface-variant">{unit.code}</p>
                <p className="mt-3 border-t border-slate-200 pt-2 text-on-surface-variant">{unit.footLabel} <strong className="block text-on-surface">{unit.foot}</strong></p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="4. System account & IAM" action={<ActionButton variant="soft" size="sm" to={path('staffAccount')}>IAM Hub →</ActionButton>}>
            <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
              <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">SSO identifier</p>
              <p className="text-[13px] font-semibold text-on-surface">{ananya.email}</p>
            </div>
            <dl className="mt-3 space-y-3 text-xs">
              {IAM.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="text-right font-medium text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="5. Roles & permissions" action={<span id="roles" className="text-xs font-semibold text-brand">Matrix</span>}>
            <ul className="flex flex-col gap-3">
              {ROLES.map((role) => (
                <li key={role.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <div>
                    <p className="text-[13px] font-semibold text-on-surface">{role.name}</p>
                    <p className="text-xs text-on-surface-variant">{role.detail}</p>
                  </div>
                  <StatusPill className="rounded">{role.badge}</StatusPill>
                </li>
              ))}
            </ul>
            <InfoNote icon={ShieldCheck} className="mt-3">Segregation of duties: Billing tariff alteration explicitly restricted by DISHA policy.</InfoNote>
          </Panel>
        </div>

        <Panel title="6. OPD operating cadence & tariff ledger" action={<ActionButton variant="soft" size="sm" to={path('staffSchedule')}>Manage schedule →</ActionButton>} bodyClassName="p-0">
          <dl className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-4">
            {OPD_CADENCE.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
                <dd className="text-[15px] font-semibold text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center justify-between bg-surface-low px-5 py-2 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
            Associated billing tariffs (master ledger linked)
            <Link to={ROUTES.services} className="text-brand normal-case hover:underline">View in Services & Pricing</Link>
          </p>
          <ul className="divide-y divide-slate-100">
            {TARIFFS.map((tariff) => (
              <li key={tariff.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-on-surface">{tariff.name}</p>
                  <p className="text-[11px] text-outline">Code: {tariff.code} · {tariff.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-on-surface">{tariff.price}</p>
                  <p className="text-[11px] text-outline">{tariff.context}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="7. Exceptions & leaves" action={<ActionButton variant="soft" size="sm" to={path('staffLeave')}>Manage →</ActionButton>}>
            <p className="mb-3 flex items-center justify-between rounded-md bg-teal-100 px-3 py-2 text-xs font-semibold text-brand">Current state <span className="uppercase">Available on duty</span></p>
            <ul className="flex flex-col gap-3">
              {PROFILE_LEAVES.map((leave) => (
                <li key={leave.id} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                  <p className="flex items-center justify-between font-semibold text-on-surface">{leave.period} <StatusPill className="rounded">{leave.badge}</StatusPill></p>
                  <p className="mt-1 text-on-surface-variant">{leave.title}</p>
                  {leave.note && <p className="mt-1 text-[11px] text-outline">{leave.note}</p>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="8. Attendance ledger" action={<ActionButton variant="soft" size="sm" to={path('staffAttendance')}>Full ledger →</ActionButton>}>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">October present</p>
                <p className="text-lg font-bold text-on-surface">18 Days</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">OPD punctuality</p>
                <p className="text-lg font-bold text-brand">98.4%</p>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
              <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Latest biometric clock-in</p>
              <p className="mt-1 font-semibold text-on-surface">Today, 08:52 AM IST <span className="font-normal text-outline">Terminal B1 (Main Pavilion)</span></p>
              <p className="text-brand">Verified via Sovereign Hardware Reader</p>
            </div>
            <p className="mt-3 flex justify-between text-[11px] text-outline"><span>Shift completed: 6.2 / 8.0 hrs</span><span>Absences: 0 Unexcused</span></p>
          </Panel>
        </div>

        <Panel title="9. Chronological audit trail & workforce events" action={<span className="text-xs font-semibold text-brand">View full cryptographic audit log</span>}>
          <ol className="space-y-4 border-l border-slate-200 pl-4">
            {AUDIT_TRAIL.map((entry) => (
              <li key={entry.id} className="relative text-xs">
                <span className={cn('absolute top-1 -left-[21px] size-2.5 rounded-full ring-2 ring-white', entry.current ? 'bg-brand' : 'bg-slate-400')} />
                <p className="font-semibold text-on-surface">{entry.title} <span className="font-normal text-outline">{entry.when}</span></p>
                <p className="text-on-surface-variant">{entry.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        <WorkforceNav staffId={staffId} />
        <Panel title="Statutory trust vault" action={<StatusPill tone="success">Valid</StatusPill>}>
          <dl className="space-y-3 text-xs">
            {TRUST_VAULT.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                <dt className="text-on-surface-variant">{label}</dt>
                <dd className="max-w-[60%] text-right font-semibold text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <InfoNote>
          <strong className="text-on-surface">Historical safety guarantee:</strong> Modifying future schedules, roles, or tariff links never alters previously signed encounters, e-prescriptions, or patient billing ledgers. All past records remain permanently anchored to their original clinical signature timestamps.
        </InfoNote>
      </div>
    </div>
  )
}

function BasicProfile({ person, staffId }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Master record">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ['Full name', person.name],
            ['Staff ID', person.staffCode],
            ['Council / registry', person.registry],
            ['Department', person.department],
            ['Branch deployments', person.branches.length ? person.branches.join(', ') : 'Not assigned yet'],
            ['Work email', person.email || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-outline">{label}</dt>
              <dd className="font-medium text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
        <InfoNote className="mt-5">Detailed schedule, leave and attendance ledgers are connected for Dr. Ananya Rao in this build. This record shows its master data only.</InfoNote>
      </Panel>
      <Panel title="Workforce management" bodyClassName="flex flex-col gap-2">
        <ActionButton to={pathFor(ROUTES.staffBranches, { staffId })}>Branch assignments</ActionButton>
        <ActionButton to={pathFor(ROUTES.staffAccount, { staffId })}>User account & IAM</ActionButton>
      </Panel>
    </div>
  )
}

export default function StaffProfilePage() {
  const { staffId } = useParams()
  const { getPerson } = useStaffDirectory()
  const person = getPerson(staffId)

  if (!person) return <StaffNotFound />

  const isFull = staffId === ananya.id

  return (
    <WorkspacePage>
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar initials={person.initials} tone="ink" size="lg" />
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-on-surface">
                {person.name}
                <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-xs font-normal text-on-surface-variant">{person.staffCode}</span>
              </h1>
              <StatusPill tone="success" className="mt-1">{person.role}</StatusPill>
              {isFull && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Faculty rank: <strong className="text-on-surface">{ananya.rank}</strong> · Institution: <strong className="text-on-surface">{ananya.institution}</strong>
                  <br />
                  Statutory council ID: <strong className="text-on-surface">{ananya.council}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Pencil}>Edit Details</ActionButton>
            <ActionButton to={pathFor(ROUTES.staffAccount, { staffId })}>Manage Access</ActionButton>
          </div>
        </div>

        {isFull && (
          <>
            <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROFILE_STATUS.map(([label, value, hint]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
                  <dd className="mt-1 text-[13px] font-semibold text-on-surface"><span className="mr-1.5 text-brand">●</span>{value}</dd>
                  <p className="text-[11px] text-on-surface-variant">{hint}</p>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-on-surface-variant">
              <span>Primary department: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{ananya.department}</strong></span>
              <span>Assigned facilities: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{ananya.facilities}</strong></span>
              <span>Statutory ABDM token: <strong className="rounded bg-surface-high px-1.5 py-0.5 text-on-surface">{ananya.token}</strong></span>
            </p>
          </>
        )}
      </section>

      {isFull ? <FullProfile staffId={staffId} /> : <BasicProfile person={person} staffId={staffId} />}
    </WorkspacePage>
  )
}
