import { useState } from 'react'
import { ArrowRight, Building2, GitFork, Network, Pencil, Plus, Search, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_FILTERS, BRANCHES, ORG_FACTS, ORGANISATION } from '../data/organisation'

function OrganisationSummary() {
  return (
    <Panel bodyClassName="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-surface-low text-base font-bold text-on-surface-variant">
            {ORGANISATION.initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-on-surface">{ORGANISATION.name}</h2>
              {ORGANISATION.tags.map((tag) => (
                <StatusPill key={tag}>{tag}</StatusPill>
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />
                {ORGANISATION.registry}
              </span>
              <span>{ORGANISATION.licence}</span>
            </p>
          </div>
        </div>
        <ActionButton variant="soft" size="sm" className="text-brand" to={pathFor(ROUTES.branchAccess, { branchId: 'main' })}>
          Access &amp; permissions <ArrowRight className="size-3" aria-hidden="true" />
        </ActionButton>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORG_FACTS.map((fact) => (
          <div key={fact.label} className="rounded-md border border-slate-200 bg-surface-lowest p-4">
            <dt className="text-[11px] font-medium tracking-wide text-on-surface-variant uppercase">{fact.label}</dt>
            <dd className="mt-2 flex items-center gap-2 text-lg leading-6 font-semibold text-on-surface">
              {fact.value}
              {fact.badge && <StatusPill tone="success">{fact.badge}</StatusPill>}
            </dd>
            <p className="mt-1 text-xs leading-4 text-on-surface-variant">{fact.hint}</p>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function BranchRow({ branch }) {
  const isPrimary = branch.kind === 'Primary location'
  const Icon = isPrimary ? Building2 : GitFork

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md border',
            isPrimary ? 'border-teal-200 bg-teal-50 text-brand' : 'border-slate-200 bg-surface-low text-on-surface-variant',
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-on-surface">{branch.name}</h3>
            <StatusPill tone={isPrimary ? 'success' : 'neutral'}>{branch.kind}</StatusPill>
            <span className="text-xs text-outline">{branch.secondary}</span>
          </div>
          <p className="text-xs text-on-surface-variant">{branch.address}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-outline">
            <span>{branch.departments.length} Departments:</span>
            {branch.departments.map((department) => (
              <span key={department} className="rounded border border-slate-200 bg-surface-lowest px-2 py-0.5 text-on-surface-variant">
                {department}
              </span>
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span>
              <strong className="font-semibold text-on-surface">{branch.appointmentsToday}</strong> appointments today
            </span>
            <span>
              <strong className="font-semibold text-on-surface">{branch.suites}</strong> consultation suites
            </span>
            <span className="font-mono text-[11px]">
              ABDM Node: <strong className="font-semibold text-brand">{branch.abdmNode}</strong>
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3">
        <StatusPill tone="success" dot>
          {branch.status}
        </StatusPill>
        <div className="flex gap-2">
          <ActionButton to={pathFor(ROUTES.branch, { branchId: branch.id })} size="sm">
            View
          </ActionButton>
          <ActionButton to={pathFor(ROUTES.branch, { branchId: branch.id })} variant="soft" size="sm">
            Open branch <ArrowRight className="size-3" aria-hidden="true" />
          </ActionButton>
        </div>
      </div>
    </li>
  )
}

function LocationsSection() {
  const [filterId, setFilterId] = useState('all')
  const [query, setQuery] = useState('')

  const activeFilter = BRANCH_FILTERS.find((filter) => filter.id === filterId)
  const needle = query.trim().toLowerCase()
  const visible = BRANCHES.filter(
    (branch) => activeFilter.match(branch) && (!needle || `${branch.name} ${branch.address}`.toLowerCase().includes(needle)),
  )

  return (
    <section aria-labelledby="locations-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <h2 id="locations-heading" className="text-xl font-semibold text-on-surface">
            Locations
          </h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">Manage the clinics and branches connected to this organization.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Filter locations" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {BRANCH_FILTERS.map((filter) => {
              const count = BRANCHES.filter(filter.match).length
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={filter.id === filterId}
                  onClick={() => setFilterId(filter.id)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    filter.id === filterId ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {filter.label} ({count})
                </button>
              )
            })}
          </div>
          <label className="relative">
            <span className="sr-only">Search locations</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search locations..."
              className="w-52 rounded-md border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {visible.length ? (
          <ul className="divide-y divide-slate-100">
            {visible.map((branch) => (
              <BranchRow key={branch.id} branch={branch} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No locations match your filters.</p>
        )}
      </div>
    </section>
  )
}

export default function OrganisationPage() {
  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-brand">Organization &amp; hierarchy</span>
            <StatusPill tone="success" dot>
              ABDM Live Synced
            </StatusPill>
          </>
        }
        title="Organization & branches"
        description="Manage your organization structure, physical clinics, and licensed operational facilities across the regional network."
        actions={
          <>
            <ActionButton icon={Pencil}>Edit organization profile</ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.branchNew}>
              Add branch
            </ActionButton>
          </>
        }
      />

      <OrganisationSummary />
      <LocationsSection />

      <aside className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-surface-low p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-brand">
            <Network className="size-4" aria-hidden="true" />
          </span>
          <div className="max-w-xl space-y-2">
            <p className="inline-block rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-on-surface">
              Organization → Clinic → Branch → Department
            </p>
            <p className="text-xs leading-5 text-on-surface-variant">
              Each branch operates with independent doctor allocations, room rosters, localized inventory, and ABDM billing endpoints
              while rolling up into organization-wide analytics and compliance.
            </p>
          </div>
        </div>
        <ActionButton size="sm" className="text-brand" to={pathFor(ROUTES.branchAccess, { branchId: 'main' })}>
          Configure role-based access &amp; permissions <ArrowRight className="size-3" aria-hidden="true" />
        </ActionButton>
      </aside>
    </ConfigPage>
  )
}
