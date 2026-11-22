import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useAuth } from '../../auth/context/useAuth'
import { SERVICE_CATEGORIES } from '../../billing/constants'
import { money } from '../../billing/financeFormat'
import { branchSummary } from '../../billing/serviceLogic'
import LoadingState from '../../patients/components/LoadingState'
import ConfigPage from '../components/ConfigPage'
import { useCatalogue } from '../useCatalogue'

const PAGE_SIZE = 25
const PIPELINE = [
  ['STEP 01', 'Service catalogue', 'One master list'],
  ['STEP 02', 'Department & branch', 'Owner and locations'],
  ['STEP 03', 'Branch price', 'Default or local'],
  ['STEP 04', 'Charge', 'Added at the visit'],
  ['STEP 05', 'Invoice', 'With the tax treatment'],
  ['STEP 06', 'Insurance', 'Cashless or reimbursement'],
]

export default function ServicesPage() {
  const { can } = useAuth()
  const catalogue = useCatalogue()
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  if (!catalogue.ready) {
    return (
      <ConfigPage>
        <PageIntro title="Services & pricing" />
        <LoadingState label="Loading the service catalogue…" error={catalogue.error} onRetry={catalogue.reload} />
      </ConfigPage>
    )
  }

  const { services, branches } = catalogue
  const tabs = [{ id: 'all', label: 'All', count: services.length }, ...SERVICE_CATEGORIES.map((category) => ({ id: category, label: category, count: services.filter((service) => service.category === category).length }))].filter((tab) => tab.id === 'all' || tab.count > 0)
  const needle = query.trim().toLowerCase()
  const matches = services.filter((service) => (type === 'all' || service.category === type) && (!needle || `${service.name} ${service.code} ${service.department}`.toLowerCase().includes(needle)))
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const rows = matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const active = services.filter((service) => service.status === 'Active')
  const totals = [
    { label: 'Services', value: services.length, hint: `${active.length} active` },
    { label: 'Without a location', value: services.filter((service) => Object.keys(service.branches).length === 0).length, hint: 'Cannot be charged anywhere' },
    { label: 'Tax not configured', value: services.filter((service) => service.tax === 'Not configured').length, hint: 'Cannot be activated' },
    { label: 'Branch prices', value: services.reduce((sum, service) => sum + Object.values(service.branches).filter((entry) => entry.price != null).length, 0), hint: 'Local price overrides' },
  ]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="text-on-surface-variant">Service configuration · Master service directory</span>}
        title="Services & pricing"
        description="Manage your organization's master clinical, diagnostic, and procedural catalog, branch availability, and pricing. This is the same catalogue billing charges from."
        actions={can('accounting.invoices') && <ActionButton variant="primary" icon={Plus} to={ROUTES.serviceNew}>Add Service</ActionButton>}
      />

      <StatTiles items={totals} className="mb-5" />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <FilterTabs options={tabs} value={type} onChange={(value) => { setType(value); setPage(1) }} label="Service type" />
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1) }} label="Search services" placeholder="Search by service, code or department" className="w-64" />
        </div>

        <Table headings={['Service & master code', 'Department', 'Assigned locations', 'Unit', 'Base price', 'Status', 'Action']} minWidth={1000} empty={rows.length ? null : services.length ? 'No services match your filters.' : 'No services yet. Add the first one.'}>
          {rows.map((service) => {
            const link = pathFor(ROUTES.service, { serviceId: service.id })
            const [locations, locationNote] = branchSummary(service, branches)
            const unmapped = Object.keys(service.branches).length === 0 || service.tax === 'Not configured'
            return (
              <Row key={service.id} muted={service.status !== 'Active'}>
                <Cell>
                  <Link to={link} className="font-semibold hover:text-brand">{service.name}</Link>
                  <p className="mt-0.5 text-[11px] text-outline">
                    <span className="rounded bg-surface-high px-1 py-0.5 font-mono">{service.code}</span> {service.category}
                  </p>
                </Cell>
                <Cell>{service.department ? <StatusPill className="rounded">{service.department}</StatusPill> : <span className="text-xs text-outline">No department</span>}</Cell>
                <Cell>
                  {Object.keys(service.branches).length ? (
                    <>
                      <p className="font-medium">{locations}</p>
                      <p className="text-[11px] text-outline">{locationNote}</p>
                    </>
                  ) : (
                    <Link to={link} className="text-xs font-medium text-brand hover:underline">Assign location ▾</Link>
                  )}
                </Cell>
                <Cell>{service.unit || '—'}</Cell>
                <Cell>
                  <p className="font-semibold">{money(service.price)}</p>
                  <p className="text-[11px] text-outline">{service.tax}</p>
                </Cell>
                <Cell><StatusPill tone={service.status === 'Active' ? 'success' : 'neutral'} dot>{service.status}</StatusPill></Cell>
                <Cell>
                  <Link to={link} className="text-xs font-semibold text-brand hover:underline">{unmapped ? 'Configure' : 'View'}</Link>
                </Cell>
              </Row>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length ? (current - 1) * PAGE_SIZE + 1 : 0}–${(current - 1) * PAGE_SIZE + rows.length} of ${matches.length} services`}>
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <ActionButton size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</ActionButton>
              <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">{current}</span>
              <ActionButton size="sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</ActionButton>
            </nav>
          )}
        </TableFooter>
      </div>

      <Panel title="Product architecture: Service as single source of truth" className="mt-5" action={<Link to={ROUTES.billingServices} className="text-xs font-semibold text-brand hover:underline">Open in Billing</Link>}>
        <p className="text-xs leading-5 text-on-surface-variant">There is one service catalogue. A service defined here is the one charged at the visit, invoiced and claimed from insurance.</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE.map(([node, title, detail]) => (
            <li key={node} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-center">
              <p className="text-[10px] font-bold text-outline">{node}</p>
              <p className="text-xs font-semibold text-on-surface">{title}</p>
              <p className="text-[10px] text-outline">{detail}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </ConfigPage>
  )
}
