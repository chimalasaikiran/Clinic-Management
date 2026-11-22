import { useState } from 'react'
import { ArrowRight, ChevronRight, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import DetailList from '../../../components/workspace/DetailList'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { money } from '../../billing/financeFormat'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, DEPARTMENT_TYPES, departmentPayload, initialsOf } from '../configView'

const dateLabel = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function DepartmentEditor({ department, onSaved, onCancel }) {
  const [values, setValues] = useState({ name: department.name, type: department.type, description: department.description })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    if (!values.name.trim()) return setErrors({ name: 'Enter the department name.' })
    setPending(true)
    setErrors({})
    setFailure('')
    try {
      const renamed = values.name.trim() !== department.name
      onSaved(await configApi.updateDepartment(department.id, departmentPayload(department, { name: values.name.trim(), type: values.type, description: values.description.trim() })), renamed ? 'Department renamed. Staff, doctors and services in it now show the new name.' : 'Department details saved.')
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? (error.code === 'DEPARTMENT_EXISTS' ? { name: error.message } : {}))
      setFailure(error.message)
      setPending(false)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      {failure && <Banner tone="danger" title="Not saved">{failure}</Banner>}
      <TextInput label="Department name" name="name" required value={values.name} onChange={update} error={errors.name} hint="Renaming updates every staff, doctor and service record in it" />
      <SelectInput label="Department type" name="type" value={values.type} onChange={update} options={DEPARTMENT_TYPES} error={errors.type} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate-800">Description <span className="font-normal text-outline">(optional)</span></span>
        <textarea name="description" rows={3} value={values.description} onChange={update} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
      </label>
      <div className="flex justify-end gap-2">
        <ActionButton onClick={onCancel}>Cancel</ActionButton>
        <ActionButton variant="primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</ActionButton>
      </div>
    </form>
  )
}

function DepartmentStatus({ department, onSaved }) {
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState('')
  const active = department.status === 'active'

  const change = async () => {
    setFailure('')
    try {
      onSaved(await configApi.updateDepartment(department.id, departmentPayload(department, { status: active ? 'inactive' : 'active' })), active ? 'Department deactivated.' : 'Department activated.')
      setConfirming(false)
    } catch (error) {
      setFailure(error.message)
    }
  }

  return (
    <Panel tone={active ? 'danger' : undefined} title="Department status" action={<StatusPill tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</StatusPill>}>
      <p className="text-xs leading-5 text-on-surface-variant">
        {active
          ? 'Deactivating takes this department off the staff, doctor and service forms. People and services already in it keep it, and every past record stays as it is.'
          : 'This department is not offered on staff, doctor or service forms. Activate it to use it again.'}
      </p>
      {failure && <p role="alert" className="mt-2 text-xs text-danger">{failure}</p>}
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <ActionButton size="sm" onClick={() => setConfirming(false)}>Keep {active ? 'active' : 'inactive'}</ActionButton>
          <ActionButton variant={active ? 'danger' : 'primary'} size="sm" onClick={change}>Confirm {active ? 'deactivation' : 'activation'}</ActionButton>
        </div>
      ) : (
        <ActionButton variant={active ? 'danger' : 'primary'} className="mt-3 w-full" onClick={() => setConfirming(true)}>
          {active ? 'Deactivate' : 'Activate'} {department.name}
        </ActionButton>
      )}
    </Panel>
  )
}

export default function DepartmentDetailPage() {
  const { departmentId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.department(departmentId), `department:${departmentId}`)
  const [updated, setUpdated] = useState(null)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const department = updated?.id === departmentId ? updated : resource.data

  if (!department) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Department not found' : 'Department'} />
        {resource.error?.status !== 404 && <LoadingState label="Loading department…" error={resource.error} onRetry={resource.reload} />}
      </ConfigPage>
    )
  }

  const manage = can('settings.organisation')
  const params = { departmentId }
  const saved = (next, text) => {
    setUpdated(next)
    setEditing(false)
    setMessage(text)
  }
  const people = [
    ...department.staff.map((person) => ({ key: `staff:${person.id}`, name: person.fullName, detail: person.designation || (person.type === 'doctor' ? 'Doctor' : 'Staff'), type: person.type, to: pathFor(ROUTES.staffMember, { staffId: person.id }) })),
    ...department.doctors.map((doctor) => ({ key: `doctor:${doctor.id}`, name: doctor.displayName, detail: `${doctor.specialty} · schedule profile`, type: 'doctor', to: null })),
  ]
  const modules = [
    { id: 'locations', title: 'Operating locations', detail: `${department.branches.length} branch${department.branches.length === 1 ? '' : 'es'} linked`, to: pathFor(ROUTES.departmentLocations, params) },
    { id: 'services', title: 'Services & prices', detail: `${department.services.length} services in the billing catalogue`, to: ROUTES.services },
    { id: 'practitioners', title: 'Staff & doctors', detail: `${people.length} people in this department`, to: pathFor(ROUTES.departmentStaff, params) },
    { id: 'scheduling', title: 'Appointment scheduling', detail: 'Doctors’ availability and bookings', to: ROUTES.appointments },
  ]
  const info = [
    { label: 'Department name', value: department.name },
    { label: 'Department code', value: department.code },
    { label: 'Department type', value: department.type },
    { label: 'Description', value: department.description || 'No description', full: true },
    { label: 'Created', value: dateLabel(department.createdAt) },
    { label: 'Last changed', value: dateLabel(department.updatedAt) },
  ]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-on-surface-variant">Department configuration</span>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">{department.code}</span>
          </>
        }
        title={
          <span className="flex items-center gap-3">
            {department.name}
            <StatusPill tone={department.status === 'active' ? 'success' : 'neutral'} dot>{department.status === 'active' ? 'Active' : 'Inactive'}</StatusPill>
          </span>
        }
        description="Manage this department's operating branches, linked clinical services and assigned personnel."
        actions={manage && !editing && <ActionButton variant="primary" icon={Pencil} onClick={() => setEditing(true)}>Edit department</ActionButton>}
      />

      {message && <Banner tone="brand" title={message} className="mb-5" />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Department information" action={manage && !editing && <ActionButton variant="soft" size="sm" onClick={() => setEditing(true)}>Edit details <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
            {editing ? <DepartmentEditor department={department} onSaved={saved} onCancel={() => setEditing(false)} /> : <DetailList items={info} />}
          </Panel>

          <Panel
            title="Operating locations"
            subtitle="Branches where this department actively delivers and accepts patients."
            action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.departmentLocations, params)}>Manage locations</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {department.branches.map((branch) => (
                <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                      {branch.name}
                      <StatusPill className="rounded">{branch.code}</StatusPill>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={BRANCH_STATUS[branch.status][1]}>{BRANCH_STATUS[branch.status][0]}</StatusPill>
                    <ActionButton size="sm" to={pathFor(ROUTES.branch, { branchId: branch.id })}>View branch</ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Services & diagnostic procedures"
            subtitle={`${department.services.length} service${department.services.length === 1 ? '' : 's'} in the billing catalogue under this department.`}
            action={<ActionButton variant="soft" size="sm" to={ROUTES.services}>Manage services in catalog</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {department.services.map((service) => (
                <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <Link to={pathFor(ROUTES.service, { serviceId: service.id })} className="text-[13px] font-medium text-on-surface hover:text-brand">{service.name}</Link>
                    <p className="text-[11px] text-outline">{[service.code, service.category, service.unit].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusPill tone={service.status === 'active' ? 'success' : 'neutral'}>{service.status === 'active' ? 'Active' : 'Inactive'}</StatusPill>
                    <span className="w-20 text-right text-[13px] font-semibold">{money(service.price)}</span>
                  </div>
                </li>
              ))}
              {department.services.length === 0 && <li className="px-5 py-6 text-center text-xs text-on-surface-variant">No services name this department yet.</li>}
            </ul>
          </Panel>

          <Panel
            title="Rostered practitioners & care staff"
            subtitle={`${people.length} people assigned to this department.`}
            action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.departmentStaff, params)}>Manage roster & personnel</ActionButton>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {people.slice(0, 8).map((person) => (
                <li key={person.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(person.name)} tone={person.type === 'doctor' ? 'teal' : 'slate'} />
                    <div>
                      {person.to ? <Link to={person.to} className="text-[13px] font-semibold text-on-surface hover:text-brand">{person.name}</Link> : <p className="text-[13px] font-semibold text-on-surface">{person.name}</p>}
                      <p className="text-xs text-on-surface-variant">{person.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
              {people.length === 0 && <li className="px-5 py-6 text-center text-xs text-on-surface-variant">No one is in this department yet.</li>}
            </ul>
            {people.length > 8 && <p className="border-t border-slate-100 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">+ {people.length - 8} more · <Link to={pathFor(ROUTES.departmentStaff, params)} className="font-semibold text-brand hover:underline">See everyone</Link></p>}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Department setup & modules" subtitle="Quick access to operational relationships." bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              {modules.map((module) => (
                <li key={module.id}>
                  <Link to={module.to} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-lowest">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-on-surface">{module.title}</span>
                      <span className="block text-xs leading-4 text-on-surface-variant">{module.detail}</span>
                    </span>
                    <ChevronRight className="size-4 text-outline" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Access & governance" action={<StatusPill tone="brand">RBAC</StatusPill>}>
            <p className="text-xs leading-5 text-on-surface-variant">Access is granted by role and branch, not by department. Anyone whose role covers a branch where {department.name} operates can work with its patients there.</p>
            <Link to={pathFor(ROUTES.departmentAccess, params)} className="mt-3 block text-xs font-semibold text-brand hover:underline">Manage access & permissions →</Link>
          </Panel>

          {manage && <DepartmentStatus department={department} onSaved={saved} />}
        </div>
      </div>
    </ConfigPage>
  )
}
