import { useState } from 'react'
import { AlertTriangle, ArrowRight, Building2, ChevronRight, Info, Pencil, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import DetailList from '../../../components/workspace/DetailList'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { CLINIC_CLASSIFICATIONS } from '../../onboarding/data/clinicOptions'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, branchAddress, clock12, FACILITY_TYPES, WEEK_ORDER, WEEKDAYS } from '../configView'

const SHORTCUTS = [
  { id: 'staff', title: 'Staff & doctors', detail: 'People deployed to this branch', to: 'branchStaff' },
  { id: 'hours', title: 'Operating hours', detail: 'Weekly sessions and closures', to: 'branchHours' },
  { id: 'services', title: 'Services & pricing', detail: 'Services and this branch’s prices', to: 'services' },
  { id: 'departments', title: 'Departments', detail: 'Departments working here', to: 'departments' },
  { id: 'inventory', title: 'Inventory', detail: 'Stock locations and alerts', to: 'branchInventory' },
  { id: 'access', title: 'Access & permissions', detail: 'Who can work at this branch', to: 'branchAccess' },
]

// "Monday – Saturday · 09:00 AM – 08:00 PM" from the weekly sessions.
function hoursSummary(hours) {
  if (!hours.length) return 'Not set'
  const days = WEEK_ORDER.filter((weekday) => hours.some((session) => session.weekday === weekday))
  const first = hours.reduce((min, session) => (session.start < min ? session.start : min), '24:00')
  const last = hours.reduce((max, session) => (session.end > max ? session.end : max), '00:00')
  return `${days.map((weekday) => WEEKDAYS[weekday].slice(0, 3)).join(', ')} · ${clock12(first)} – ${clock12(last)}`
}

function OperatingConfiguration({ branch, organisation }) {
  const classification = CLINIC_CLASSIFICATIONS.find((option) => option.id === organisation?.classification)?.title
  const rows = [
    { title: 'Operating model', detail: classification ? `${classification}${branch.facilityType ? ` · ${branch.facilityType}` : ''}` : branch.facilityType ?? 'Not set', badge: branch.facilityType ?? 'Facility type', action: 'Edit branch', anchor: true },
    { title: 'Departments & Specialties', detail: branch.departments.length ? branch.departments.map((department) => department.name).join(', ') : 'No department assigned to this branch yet', badge: `${branch.departments.length} configured`, badgeTone: 'brand', action: 'Manage departments', to: ROUTES.departments },
    { title: 'Working days & Operating hours', detail: hoursSummary(branch.hours), badge: `${branch.closures.filter((closure) => closure.kind === 'closed').length} closure${branch.closures.filter((closure) => closure.kind === 'closed').length === 1 ? '' : 's'} ahead`, badgeTone: 'success', action: 'Configure operating hours', to: pathFor(ROUTES.branchHours, { branchId: branch.id }) },
  ]
  return (
    <Panel title="Operating configuration" subtitle="Care delivery parameters, operational schedules, and department structures.">
      <ul className="-my-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 max-w-sm">
              <p className="text-[13px] font-semibold text-on-surface">{row.title}</p>
              <p className="mt-0.5 text-xs leading-4 text-on-surface-variant">{row.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill tone={row.badgeTone}>{row.badge}</StatusPill>
              {row.to && <ActionButton variant="soft" size="sm" to={row.to}>{row.action} <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Capabilities({ branch }) {
  const { doctors, services, pharmacies, stores, staff } = branch.capabilities
  const list = [
    { id: 'opd', title: 'OPD (Outpatient Department)', detail: `${doctors} doctor${doctors === 1 ? '' : 's'} with sessions here · ${staff} staff deployed`, enabled: doctors > 0, action: 'Set doctor availability', to: ROUTES.appointments },
    { id: 'billing', title: 'Billing & Payment Counter', detail: `${services} active service${services === 1 ? '' : 's'} priced at this branch`, enabled: services > 0, action: 'Add services', to: ROUTES.services },
    { id: 'pharmacy', title: 'Pharmacy Counter', detail: `${pharmacies} pharmacy location${pharmacies === 1 ? '' : 's'} for dispensing`, enabled: pharmacies > 0, action: 'Add a pharmacy location', to: pathFor(ROUTES.branchInventory, { branchId: branch.id }) },
    { id: 'stores', title: 'Central store', detail: `${stores} store location${stores === 1 ? '' : 's'} for receiving and stock`, enabled: stores > 0, action: 'Add a store location', to: pathFor(ROUTES.branchInventory, { branchId: branch.id }) },
  ]
  return (
    <Panel title="Capabilities" subtitle="What this branch is set up to do, from its doctors, services and stock locations." action={<span className="text-[11px] text-outline">{list.filter((entry) => entry.enabled).length} of {list.length} ready</span>}>
      <ul className="-my-3 divide-y divide-slate-100">
        {list.map((capability) => (
          <li key={capability.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-teal-50 text-brand"><ShieldCheck className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0"><p className="text-[13px] font-semibold text-on-surface">{capability.title}</p><p className="mt-0.5 text-xs leading-4 text-on-surface-variant">{capability.detail}</p></div>
            </div>
            {capability.enabled ? <StatusPill tone="success" dot>ENABLED</StatusPill> : <ActionButton variant="soft" size="sm" to={capability.to}>{capability.action}</ActionButton>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function BranchEditor({ branch, onSaved, onCancel }) {
  const [values, setValues] = useState({ name: branch.name, addressLine1: branch.addressLine1 ?? '', addressLine2: branch.addressLine2 ?? '', city: branch.city, state: branch.state, pinCode: branch.pinCode ?? '', phone: branch.phone ?? '', email: branch.email ?? '', facilityType: branch.facilityType ?? FACILITY_TYPES[0] })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await configApi.updateBranch(branch.id, { ...values, status: branch.status, version: branch.version })
      onSaved()
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage(error.message)
      setBusy(false)
    }
  }
  return (
    <Panel icon={Building2} title="Edit branch information">
      {message && <Banner tone="danger" title={message} className="mb-4" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextInput label="Branch name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
        <div className="sm:col-span-2"><TextInput label="Address line 1" required value={values.addressLine1} onChange={(event) => set('addressLine1', event.target.value)} error={errors.addressLine1} /></div>
        <div className="sm:col-span-2"><TextInput label="Address line 2" value={values.addressLine2} onChange={(event) => set('addressLine2', event.target.value)} /></div>
        <TextInput label="City" required value={values.city} onChange={(event) => set('city', event.target.value)} error={errors.city} />
        <TextInput label="State" required value={values.state} onChange={(event) => set('state', event.target.value)} error={errors.state} />
        <TextInput label="PIN code" required inputMode="numeric" maxLength={6} value={values.pinCode} onChange={(event) => set('pinCode', event.target.value.replace(/\D/g, ''))} error={errors.pinCode} />
        <SelectInput label="Facility type" required value={values.facilityType} onChange={(event) => set('facilityType', event.target.value)} options={[...new Set([...FACILITY_TYPES, values.facilityType])]} />
        <TextInput label="Branch phone" value={values.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} />
        <TextInput label="Branch email" type="email" value={values.email} onChange={(event) => set('email', event.target.value)} error={errors.email} />
      </div>
      <div className="mt-4 flex gap-3"><ActionButton variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save branch'}</ActionButton><ActionButton onClick={onCancel}>Cancel</ActionButton></div>
    </Panel>
  )
}

function BranchLifecycle({ branch, onSaved }) {
  const [target, setTarget] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [label, tone] = BRANCH_STATUS[branch.status]
  const change = async (status) => {
    setBusy(true)
    setMessage(null)
    try {
      const { id, version, addressLine1, addressLine2, name, city, state, pinCode, phone, email, facilityType, country } = branch
      await configApi.updateBranch(id, { name, addressLine1, addressLine2, city, state, pinCode, phone, email, facilityType, country, status, version })
      setTarget(null)
      onSaved()
    } catch (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }
  const options = branch.status === 'active' ? [['paused', 'Pause branch'], ['inactive', 'Deactivate branch']] : [['active', 'Set active']]
  return (
    <Panel tone="danger" icon={AlertTriangle} title="Branch status & lifecycle" subtitle="Carefully manage the operational activation lifecycle for this physical facility." action={<StatusPill tone={tone}>Current Status: {label}</StatusPill>}>
      {message && <Banner tone="danger" title={message} className="mb-4" />}
      {branch.isPrimary ? <p className="text-xs leading-5 text-on-surface-variant">This is the primary branch. It stays active; pause or deactivate other branches instead.</p> : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-md">
            <p className="text-[13px] font-semibold text-on-surface">{branch.status === 'active' ? 'Pause or deactivate branch' : 'Reopen branch'}</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">A paused or inactive branch takes no new appointments. Existing clinical records, invoices and shared patient profiles stay intact.</p>
          </div>
          {target ? (
            <div className="flex items-center gap-2"><ActionButton size="sm" onClick={() => setTarget(null)}>Keep {label.toLowerCase()}</ActionButton><ActionButton variant="danger" size="sm" disabled={busy} onClick={() => change(target)}>Confirm: {BRANCH_STATUS[target][0]}</ActionButton></div>
          ) : (
            <div className="flex gap-2">{options.map(([status, text]) => <ActionButton key={status} variant={status === 'active' ? 'primary' : 'danger'} onClick={() => setTarget(status)}>{text}</ActionButton>)}</div>
          )}
        </div>
      )}
    </Panel>
  )
}

function SidePanels({ branch, organisation }) {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Branch setup" action={<span className="text-[10px] tracking-wide text-outline uppercase">Hub shortcuts</span>} bodyClassName="p-0">
        <p className="px-5 pt-4 text-xs leading-4 text-on-surface-variant">Direct pathways to manage this branch’s modules and rosters.</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.id}>
              <Link to={pathFor(ROUTES[shortcut.to], { branchId: branch.id })} className="flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-lowest">
                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-surface-low text-on-surface-variant"><Building2 className="size-3.5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-on-surface">{shortcut.title}</span><span className="block text-xs leading-4 text-on-surface-variant">{shortcut.detail}</span></span>
                <ChevronRight className="size-4 text-outline" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Location context">
        <dl className="space-y-3 text-xs">
          {[['Organization', organisation?.displayName ?? '—'], ['Branch', `${branch.name} · ${branch.code}`], ['Primary location', branch.isPrimary ? 'Yes' : 'No']].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3"><dt className="text-on-surface-variant">{label}</dt><dd className="font-semibold text-on-surface">{value}</dd></div>
          ))}
          <div className="flex items-center justify-between gap-3"><dt className="text-on-surface-variant">Shared patient identity</dt><dd><StatusPill tone="success">Enabled</StatusPill></dd></div>
        </dl>
        <div className="mt-4 rounded-md bg-surface-lowest p-3 text-xs leading-5 text-on-surface-variant"><p className="font-semibold text-on-surface">Shared identity model:</p>Patients are registered once for the organisation and can be seen at any branch the staff member covers. Encounters, prescriptions and invoices record the branch where they happened.</div>
      </Panel>
      <aside className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-xs leading-5 text-on-surface-variant">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand"><Info className="size-3.5" aria-hidden="true" />Configuration hub</p>
        Doctor availability, prices and stock are managed in their own modules; this page links to them for this branch.
      </aside>
    </div>
  )
}

export default function BranchDetailPage() {
  const { branchId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.branch(branchId), `config-branch:${branchId}`)
  const organisation = useApiResource(() => configApi.organisation(), 'organisation').data
  const [editing, setEditing] = useState(false)
  const branch = resource.data

  if (!branch) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Branch not found' : 'Branch'} description={resource.error?.status === 404 ? 'No branch matches this link.' : undefined} />
        {resource.error?.status !== 404 && <LoadingState label="Loading the branch…" error={resource.error} onRetry={resource.reload} />}
      </ConfigPage>
    )
  }
  const [label, tone] = BRANCH_STATUS[branch.status]
  const manage = can('settings.organisation')
  const info = [
    { label: 'Branch name', value: branch.name },
    { label: 'Branch type', value: `${branch.isPrimary ? 'Primary location' : 'Branch'}${branch.facilityType ? ` · ${branch.facilityType}` : ''}` },
    { label: 'Physical address', value: branchAddress(branch) || 'Not set', full: true },
    { label: 'City & State', value: `${branch.city}, ${branch.state}` },
    { label: 'Operational status', value: label },
    { label: 'Primary contact telephone', value: branch.phone ?? 'Not set' },
    { label: 'Facility communications email', value: branch.email ?? 'Not set' },
  ]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<><span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-brand">{branch.code}</span><StatusPill tone={tone} dot>{label}</StatusPill>{branch.isPrimary && <StatusPill>Primary location</StatusPill>}</>}
        title={branch.name}
        description="Manage the foundational configuration, operating schedules, capabilities, and operational routing for this clinic location."
        actions={manage && !editing && <ActionButton icon={Pencil} onClick={() => setEditing(true)}>Edit branch</ActionButton>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {editing ? <BranchEditor key={branch.version} branch={branch} onSaved={() => { setEditing(false); resource.reload() }} onCancel={() => setEditing(false)} /> : (
            <Panel icon={Building2} title="Branch information" subtitle="Physical facility identity and contact endpoints." action={manage && <ActionButton variant="soft" size="sm" onClick={() => setEditing(true)}>Edit branch information <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
              <DetailList items={info} />
              <p className="mt-5 flex flex-wrap justify-between gap-2 border-t border-dashed border-slate-200 pt-3 font-mono text-[11px] text-outline"><span>Branch code: {branch.code}{branch.pinCode ? ` · PIN ${branch.pinCode}` : ''}</span><span>Created {new Date(branch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
            </Panel>
          )}
          <OperatingConfiguration branch={branch} organisation={organisation} />
          <Capabilities branch={branch} />
          {manage && <BranchLifecycle key={branch.version} branch={branch} onSaved={resource.reload} />}
        </div>
        <SidePanels branch={branch} organisation={organisation} />
      </div>
    </ConfigPage>
  )
}
