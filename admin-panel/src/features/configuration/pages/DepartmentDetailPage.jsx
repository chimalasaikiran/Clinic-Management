import { useState } from 'react'
import { ArrowRight, ChevronRight, MoreHorizontal, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import DetailList from '../../../components/workspace/DetailList'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import DetailUnavailable from '../components/DetailUnavailable'
import { CARDIOLOGY } from '../data/departments'

function DeactivateDepartment({ name }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Panel tone="danger" title="Department status" action={<StatusPill tone="success">Active</StatusPill>}>
      <p className="text-xs leading-5 text-on-surface-variant">
        Deactivating this department will pause new patient bookings and prevent new service additions. Historical health records, completed invoices, and ABDM encounter archives will remain permanently accessible.
      </p>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <ActionButton size="sm" onClick={() => setConfirming(false)}>Keep active</ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => setConfirming(false)}>Confirm deactivation</ActionButton>
        </div>
      ) : (
        <ActionButton variant="danger" className="mt-3 w-full" onClick={() => setConfirming(true)}>
          Deactivate {name.toLowerCase()}
        </ActionButton>
      )}
    </Panel>
  )
}

export default function DepartmentDetailPage() {
  const { departmentId } = useParams()
  const department = CARDIOLOGY

  if (departmentId !== department.id) {
    return <DetailUnavailable title="Department" backTo={ROUTES.departments} backLabel="Back to departments" />
  }

  const params = { departmentId }

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-on-surface-variant">Department configuration</span>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">{department.orgNode}</span>
          </>
        }
        title={
          <span className="flex items-center gap-3">
            {department.name}
            <StatusPill tone="success" dot>Active</StatusPill>
          </span>
        }
        description={department.description}
        actions={
          <>
            <ActionButton variant="primary" icon={Pencil}>Edit department</ActionButton>
            <ActionButton aria-label="More department actions"><MoreHorizontal className="size-4" aria-hidden="true" /></ActionButton>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Department information" action={<ActionButton variant="soft" size="sm">Edit details <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
            <DetailList items={department.info} />
          </Panel>

          <Panel
            title="Operating locations"
            subtitle="Branches where this department actively delivers and accepts patients."
            action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.departmentLocations, params)}>Manage locations</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {department.locations.map((location) => (
                <li key={location.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                      {location.name}
                      <StatusPill className="rounded">{location.tag}</StatusPill>
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">{location.detail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone="success">Active</StatusPill>
                    <ActionButton size="sm" to={pathFor(ROUTES.branch, { branchId: location.id })}>View branch</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">
              <strong className="text-on-surface">Department mapping:</strong> Changes made to departmental protocols or base fee catalogs automatically reflect across both linked branches, while branch practitioner duty rosters remain branch-specific.
            </p>
          </Panel>

          <Panel
            title="Services & diagnostic procedures"
            subtitle="8 clinical and diagnostic services configured under this department."
            action={<ActionButton variant="soft" size="sm" to={ROUTES.services}>Manage services in catalog</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {department.services.map((service) => (
                <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <Link to={pathFor(ROUTES.service, { serviceId: service.id })} className="text-[13px] font-medium text-on-surface hover:text-brand">
                      {service.name}
                    </Link>
                    <p className="text-[11px] text-outline">{service.detail}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusPill tone="success">Active</StatusPill>
                    <span className="w-14 text-right text-[13px] font-semibold">{service.price}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">
              + 2 additional configured procedures. All billing codes mapped to ABDM / Standard Health Terminology.
              <Link to={ROUTES.services} className="font-semibold text-brand hover:underline">View Full Fee Catalog</Link>
            </p>
          </Panel>

          <Panel
            title="Rostered practitioners & care staff"
            subtitle="4 Doctors and 3 Specialized Care Personnel assigned to this department across active branches."
            action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.departmentStaff, params)}>Manage roster & personnel</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {department.practitioners.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={person.initials} tone={person.head ? 'teal' : 'slate'} />
                    <div>
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
                        {person.name}
                        {person.head && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">HEAD OF DEPT</span>}
                      </p>
                      <p className="text-xs text-on-surface-variant">{person.detail}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-on-surface">{person.where}</p>
                    <p className="text-outline">{person.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Department setup & modules" subtitle="Quick access to operational relationships." bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              {department.modules.map((module) => {
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-on-surface">{module.title}</span>
                      <span className="block text-xs leading-4 text-on-surface-variant">{module.detail}</span>
                    </span>
                    <ChevronRight className="size-4 text-outline" aria-hidden="true" />
                  </>
                )
                const rowClass = 'flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-lowest'
                return (
                  <li key={module.id}>
                    {module.to ? (
                      <Link to={pathFor(ROUTES[module.to], params)} className={rowClass}>{body}</Link>
                    ) : (
                      <button type="button" className={rowClass}>{body}</button>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title="Access & governance" action={<StatusPill tone="brand">RBAC</StatusPill>}>
            <dl className="space-y-2 text-xs">
              {department.governance.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="font-semibold text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-md bg-surface-lowest p-3 text-xs">
              <p className="mb-1 text-[11px] text-outline">Assigned role privileges</p>
              {department.privileges.map(([role, privilege]) => (
                <p key={role} className="flex justify-between py-0.5">
                  <span className="text-on-surface-variant">{role}</span>
                  <span className="font-medium text-on-surface">{privilege}</span>
                </p>
              ))}
            </div>
            <Link to={pathFor(ROUTES.departmentAccess, params)} className="mt-3 block text-xs font-semibold text-brand hover:underline">
              Manage access & permissions →
            </Link>
          </Panel>

          <DeactivateDepartment name={department.name} />
        </div>
      </div>
    </ConfigPage>
  )
}
