import { useState } from 'react'
import { Download, Plus, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import { SERVICE_PRINCIPLES, SERVICE_TOTALS, SERVICE_TYPES, SERVICES } from '../data/services'

export default function ServicesPage() {
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')

  const tabs = SERVICE_TYPES.map((entry) => ({
    ...entry,
    count: entry.id === 'all' ? entry.count : SERVICES.filter((service) => service.type === entry.id).length,
  }))
  const needle = query.trim().toLowerCase()
  const rows = SERVICES.filter(
    (service) => (type === 'all' || service.type === type) && (!needle || `${service.name} ${service.code} ${service.department}`.toLowerCase().includes(needle)),
  )

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="text-on-surface-variant">Service configuration · Master service directory</span>}
        title="Services & pricing"
        description="Manage your organization's master clinical, diagnostic, and procedural catalog, branch availability, and standardized pricing models."
        actions={
          <>
            <ActionButton icon={Download}>Export Catalog</ActionButton>
            <ActionButton icon={Upload}>Batch Update</ActionButton>
            <ActionButton variant="primary" icon={Plus} to={ROUTES.serviceNew}>Add Service</ActionButton>
          </>
        }
      />

      <StatTiles items={SERVICE_TOTALS} className="mb-5" />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <FilterTabs options={tabs} value={type} onChange={setType} label="Service type" />
          <SearchBox value={query} onChange={setQuery} label="Search services" placeholder="Search by service, code or department" className="w-64" />
        </div>

        <Table headings={['Service & master code', 'Department', 'Assigned locations', 'Duration', 'Base price', 'Status', 'Action']} minWidth={1000} empty={rows.length ? null : 'No services match your filters.'}>
          {rows.map((service) => (
            <Row key={service.id} muted={service.status !== 'Active'}>
              <Cell>
                <Link to={pathFor(ROUTES.service, { serviceId: service.id })} className="font-semibold hover:text-brand">{service.name}</Link>
                <p className="mt-0.5 text-[11px] text-outline">
                  <span className="rounded bg-surface-high px-1 py-0.5 font-mono">{service.code}</span> {service.cpt}
                </p>
              </Cell>
              <Cell>
                {service.department ? <StatusPill className="rounded">{service.department}</StatusPill> : <ActionButton size="sm">Assign dept</ActionButton>}
              </Cell>
              <Cell>
                {service.locations ? (
                  <>
                    <p className="font-medium">{service.locations}</p>
                    <p className="text-[11px] text-outline">{service.locationNote}</p>
                  </>
                ) : (
                  <Link to={pathFor(ROUTES.service, { serviceId: service.id })} className="text-xs font-medium text-brand hover:underline">Assign location ▾</Link>
                )}
              </Cell>
              <Cell>{service.duration}</Cell>
              <Cell>
                <p className="font-semibold">{service.price}</p>
                <p className="text-[11px] text-outline">{service.priceNote}</p>
              </Cell>
              <Cell><StatusPill tone={service.status === 'Active' ? 'success' : 'neutral'} dot>{service.status}</StatusPill></Cell>
              <Cell>
                <Link to={pathFor(ROUTES.service, { serviceId: service.id })} className="text-xs font-semibold text-brand hover:underline">
                  {service.unmapped ? 'Configure' : 'View'}
                </Link>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing 1–${rows.length} of 38 master services`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">1</span>
            <ActionButton size="sm">2</ActionButton>
            <ActionButton size="sm">Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <Panel title="Product architecture: Service as single source of truth" className="mt-5" action={<Link to={pathFor(ROUTES.departmentAccess, { departmentId: 'cardiology' })} className="text-xs font-semibold text-brand hover:underline">Configure role-based access for fee updates</Link>}>
        <p className="text-xs leading-5 text-on-surface-variant">
          New ClinicOS data pipelines inherit from a single service master: definitions from one catalog propagate to scheduling, encounters, billing, and insurance claims.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SERVICE_PRINCIPLES.map(([node, title, detail]) => (
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
