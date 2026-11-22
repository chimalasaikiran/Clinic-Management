import { useState } from 'react'
import { ArrowRight, Building2, GitFork, Network, Pencil, Plus, Search, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { CLINIC_CLASSIFICATIONS, OPERATING_STRUCTURES } from '../../onboarding/data/clinicOptions'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_FILTERS, BRANCH_STATUS, branchAddress, initialsOf } from '../configView'

const classificationName = (id) => CLINIC_CLASSIFICATIONS.find((option) => option.id === id)?.title ?? null
const structureName = (id) => OPERATING_STRUCTURES.find((option) => option.id === id)?.title ?? null

function OrganisationSummary({ organisation, branches, onEdit }) {
  const primary = branches.find((branch) => branch.isPrimary)
  const facts = [
    { label: 'Operational facilities', value: `${organisation.counts.activeBranches} active branch${organisation.counts.activeBranches === 1 ? '' : 'es'}`, hint: `${organisation.counts.branches} in total` },
    { label: 'Primary location', value: primary?.name ?? '—', hint: primary ? `${primary.city}, ${primary.state}` : '' },
    { label: 'Departmental scope', value: `${organisation.counts.departments} department${organisation.counts.departments === 1 ? '' : 's'}`, hint: 'Active, across branches' },
    { label: 'Organisation status', value: organisation.status === 'active' ? 'Active' : organisation.status === 'onboarding' ? 'Setting up' : 'Suspended', hint: `${organisation.counts.members} active member${organisation.counts.members === 1 ? '' : 's'}` },
  ]
  return (
    <Panel bodyClassName="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {organisation.logoId ? (
            <img src={configApi.logoUrl()} alt={`${organisation.displayName} logo`} className="size-12 shrink-0 rounded-lg border border-slate-200 object-contain" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-surface-low text-base font-bold text-on-surface-variant">{initialsOf(organisation.displayName)}</span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-on-surface">{organisation.displayName}</h2>
              {[organisation.facilityType, classificationName(organisation.classification), structureName(organisation.structure)].filter(Boolean).map((tag) => <StatusPill key={tag}>{tag}</StatusPill>)}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />{organisation.phone ?? 'No phone saved'}</span>
              <span>{organisation.email ?? 'No email saved'}</span>
              {organisation.specialties.length > 0 && <span>{organisation.specialties.join(' · ')}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onEdit && <ActionButton size="sm" icon={Pencil} onClick={onEdit}>Edit organization profile</ActionButton>}
          {primary && <ActionButton variant="soft" size="sm" className="text-brand" to={pathFor(ROUTES.branchAccess, { branchId: primary.id })}>Access &amp; permissions <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-md border border-slate-200 bg-surface-lowest p-4">
            <dt className="text-[11px] font-medium tracking-wide text-on-surface-variant uppercase">{fact.label}</dt>
            <dd className="mt-2 text-lg leading-6 font-semibold text-on-surface">{fact.value}</dd>
            <p className="mt-1 text-xs leading-4 text-on-surface-variant">{fact.hint}</p>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function ProfileEditor({ organisation, onDone, onCancel }) {
  const [values, setValues] = useState({ displayName: organisation.displayName, phone: organisation.phone ?? '', email: organisation.email ?? '', classification: organisation.classification ?? '', structure: organisation.structure ?? '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await configApi.updateOrganisation({ ...values, classification: values.classification || null, structure: values.structure || null, version: organisation.version })
      onDone()
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage(error.message)
      setBusy(false)
    }
  }
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      await configApi.uploadLogo(file)
      onDone()
    } catch (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }
  return (
    <Panel title="Edit organization profile" className="mt-6" bodyClassName="space-y-4">
      {message && <Banner tone="danger" title={message} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextInput label="Organization name" required value={values.displayName} onChange={(event) => set('displayName', event.target.value)} error={errors.displayName} /></div>
        <TextInput label="Phone" value={values.phone} onChange={(event) => set('phone', event.target.value)} error={errors.phone} hint="Mobile or landline with STD code" />
        <TextInput label="Email" type="email" value={values.email} onChange={(event) => set('email', event.target.value)} error={errors.email} />
        <SelectInput label="Clinic classification" value={values.classification} onChange={(event) => set('classification', event.target.value)} options={[{ value: '', label: 'Not set' }, ...CLINIC_CLASSIFICATIONS.map((option) => ({ value: option.id, label: option.title }))]} />
        <SelectInput label="Operational structure" value={values.structure} onChange={(event) => set('structure', event.target.value)} options={[{ value: '', label: 'Not set' }, ...OPERATING_STRUCTURES.map((option) => ({ value: option.id, label: option.title }))]} />
        <label className="text-xs font-medium text-on-surface-variant sm:col-span-2">Logo · PNG, JPG or WebP, at most 5 MB<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0])} className="mt-2 block text-xs" /></label>
      </div>
      <div className="flex gap-3"><ActionButton variant="primary" disabled={busy || !values.displayName.trim()} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</ActionButton><ActionButton onClick={onCancel}>Cancel</ActionButton></div>
    </Panel>
  )
}

function BranchRow({ branch }) {
  const Icon = branch.isPrimary ? Building2 : GitFork
  const [label, tone] = BRANCH_STATUS[branch.status]
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md border', branch.isPrimary ? 'border-teal-200 bg-teal-50 text-brand' : 'border-slate-200 bg-surface-low text-on-surface-variant')}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-on-surface">{branch.name}</h3>
            <StatusPill tone={branch.isPrimary ? 'success' : 'neutral'}>{branch.isPrimary ? 'Primary location' : 'Branch'}</StatusPill>
            <span className="text-xs text-outline">{branch.code}{branch.facilityType ? ` · ${branch.facilityType}` : ''}</span>
          </div>
          <p className="text-xs text-on-surface-variant">{branchAddress(branch)}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-outline">
            <span>{branch.departments.length} Departments{branch.departments.length ? ':' : ''}</span>
            {branch.departments.map((department) => <span key={department.id} className="rounded border border-slate-200 bg-surface-lowest px-2 py-0.5 text-on-surface-variant">{department.name}</span>)}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span><strong className="font-semibold text-on-surface">{branch.today?.appointments ?? 0}</strong> appointments today</span>
            <span><strong className="font-semibold text-on-surface">{branch.today?.staff ?? 0}</strong> staff deployed</span>
            <span><strong className="font-semibold text-on-surface">{branch.hours.length}</strong> weekly sessions set</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-3">
        <StatusPill tone={tone} dot>{label}</StatusPill>
        <div className="flex gap-2">
          <ActionButton to={pathFor(ROUTES.branch, { branchId: branch.id })} size="sm">View</ActionButton>
          <ActionButton to={pathFor(ROUTES.branchHours, { branchId: branch.id })} variant="soft" size="sm">Operating hours <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>
        </div>
      </div>
    </li>
  )
}

function LocationsSection({ branches }) {
  const [filterId, setFilterId] = useState('all')
  const [query, setQuery] = useState('')
  const activeFilter = BRANCH_FILTERS.find((filter) => filter.id === filterId)
  const needle = query.trim().toLowerCase()
  const visible = branches.filter((branch) => activeFilter.match(branch) && (!needle || `${branch.name} ${branch.code} ${branchAddress(branch)}`.toLowerCase().includes(needle)))

  return (
    <section aria-labelledby="locations-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <h2 id="locations-heading" className="text-xl font-semibold text-on-surface">Locations</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">Manage the clinics and branches connected to this organization.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Filter locations" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {BRANCH_FILTERS.map((filter) => (
              <button key={filter.id} type="button" role="tab" aria-selected={filter.id === filterId} onClick={() => setFilterId(filter.id)} className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', filter.id === filterId ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
                {filter.label} ({branches.filter(filter.match).length})
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search locations</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations..." className="w-52 rounded-md border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15" />
          </label>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {visible.length ? <ul className="divide-y divide-slate-100">{visible.map((branch) => <BranchRow key={branch.id} branch={branch} />)}</ul> : <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No locations match your filters.</p>}
      </div>
    </section>
  )
}

export default function OrganisationPage() {
  const { can } = useAuth()
  const organisation = useApiResource(() => configApi.organisation(), 'organisation')
  const branches = useApiResource(() => configApi.branches(), 'config-branches')
  const [editing, setEditing] = useState(false)
  const primary = branches.data?.find((branch) => branch.isPrimary)

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="text-brand">Organization &amp; hierarchy</span>}
        title="Organization & branches"
        description="Manage your organization profile, its clinics and branches, and where each department operates."
        actions={can('branches.create') && <ActionButton variant="primary" icon={Plus} to={ROUTES.branchNew}>Add branch</ActionButton>}
      />
      {!organisation.data || !branches.data ? <LoadingState label="Loading the organization…" error={organisation.error ?? branches.error} onRetry={() => { organisation.reload(); branches.reload() }} /> : (
        <>
          <OrganisationSummary organisation={organisation.data} branches={branches.data} onEdit={can('settings.organisation') && !editing ? () => setEditing(true) : null} />
          {editing && <ProfileEditor key={organisation.data.version} organisation={organisation.data} onDone={() => { setEditing(false); organisation.reload() }} onCancel={() => setEditing(false)} />}
          <LocationsSection branches={branches.data} />
        </>
      )}
      <aside className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface-low p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-brand"><Network className="size-4" aria-hidden="true" /></span>
          <div className="max-w-xl space-y-2">
            <p className="inline-block rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-on-surface">Organization → Branch → Department</p>
            <p className="text-xs leading-5 text-on-surface-variant">Each branch has its own hours, staff deployment, doctor availability, stock locations and prices, and rolls up into organization-wide reports. Organization-wide roles see every branch; branch-limited roles see the branches they are given.</p>
          </div>
        </div>
        {primary && <ActionButton size="sm" className="text-brand" to={pathFor(ROUTES.branchAccess, { branchId: primary.id })}>Configure role-based access &amp; permissions <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}
      </aside>
    </ConfigPage>
  )
}
