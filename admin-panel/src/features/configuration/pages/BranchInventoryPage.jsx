import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { accessApi } from '../../auth/api'
import { useAuth } from '../../auth/context/useAuth'
import { inventoryApi } from '../../inventory/api'
import LoadingState from '../../patients/components/LoadingState'
import { coversBranch } from '../access'
import { configApi } from '../api'
import AddInventoryLocationDrawer from '../components/AddInventoryLocationDrawer'
import ConfigPage from '../components/ConfigPage'

// What the inventory module enforces at every location; these are not settings.
const STOCK_RULES = [
  ['Batch & expiry on every receipt', 'Stock is received against a batch number and expiry date.'],
  ['First expiry, first out', 'Issues, dispensing and transfers take the batch that expires first.'],
  ['Quarantine is held back', 'Quarantined units stay on the books but are never issued or dispensed.'],
  ['Every movement recorded', 'Receipts, issues, transfers and adjustments are kept with who made them.'],
]
const INVENTORY_ROLES = [
  ['Manage stock', 'inventory.manage', 'Items, suppliers, locations, receipts, issues and transfers.'],
  ['View stock', 'inventory.view', 'See stock levels and movements.'],
  ['Pharmacy', 'pharmacy.dispense', 'Dispense prescriptions at pharmacy counters.'],
]

export default function BranchInventoryPage() {
  const { branchId } = useParams()
  const { can } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const branch = useApiResource(() => configApi.branch(branchId), `config-branch:${branchId}`)
  const stock = useApiResource(() => inventoryApi.state(), `inventory-state#${attempt}`)
  const roles = useApiResource(() => (can('settings.roles') ? accessApi.roles() : Promise.resolve([])), 'roles').data ?? []

  if (!branch.data || !stock.data) {
    return (
      <ConfigPage>
        <PageIntro title={branch.error?.status === 404 ? 'Branch not found' : 'Inventory configuration'} />
        {branch.error?.status !== 404 && <LoadingState label="Loading inventory…" error={branch.error ?? stock.error} onRetry={() => { branch.reload(); stock.reload() }} />}
      </ConfigPage>
    )
  }

  const current = branch.data
  const manage = can('inventory.manage')
  const locations = stock.data.locations.filter((location) => location.branch.id === branchId)
  const onHand = (locationId) => {
    const batches = stock.data.batches.filter((batch) => batch.locationId === locationId)
    return { batches: batches.length, units: batches.reduce((sum, batch) => sum + batch.posted, 0) }
  }
  const reload = (text) => {
    setMessage({ tone: 'brand', title: text })
    setAttempt((count) => count + 1)
  }
  const setActive = async (location) => {
    setMessage(null)
    try {
      await inventoryApi.setLocationActive(location.id, !location.active)
      reload(`${location.name} ${location.active ? 'deactivated' : 'activated'}.`)
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not changed', text: error.message })
    }
  }

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: {current.name} ({current.code})</span>}
        title="Inventory configuration"
        description="The stock locations at this branch and the rules ClinicOS applies to stock held in them."
        actions={
          <>
            <ActionButton to={pathFor(ROUTES.branch, { branchId })}>Back to branch</ActionButton>
            <ActionButton to={ROUTES.inventory}>Open Inventory</ActionButton>
          </>
        }
      />

      {message && <Banner tone={message.tone} title={message.title} className="mb-5">{message.text}</Banner>}

      <div className="flex flex-col gap-5">
        <Panel
          title="Inventory locations"
          subtitle="The physical or operational locations where stock is stored and managed for this branch."
          action={manage && <ActionButton variant="brand" size="sm" icon={Plus} onClick={() => setDrawerOpen(true)}>Add inventory location</ActionButton>}
          bodyClassName="p-0"
        >
          <Table headings={['Location', 'Type', 'Status', 'Stock held', 'Action']} minWidth={820} empty={locations.length ? null : 'No stock locations at this branch yet.'}>
            {locations.map((location) => {
              const held = onHand(location.id)
              return (
                <Row key={location.id} muted={!location.active}>
                  <Cell>
                    <p className="font-semibold">{location.name}</p>
                    <p className="text-[11px] text-outline">{[location.code, location.detail].filter(Boolean).join(' · ')}</p>
                  </Cell>
                  <Cell><StatusPill className="rounded">{location.kind === 'pharmacy' ? 'Pharmacy' : 'Store'}</StatusPill></Cell>
                  <Cell><StatusPill tone={location.active ? 'success' : 'neutral'} dot>{location.active ? 'Active' : 'Inactive'}</StatusPill></Cell>
                  <Cell>
                    <p className="font-medium">{held.units} units</p>
                    <p className="text-[11px] text-outline">{held.batches} batch{held.batches === 1 ? '' : 'es'}</p>
                  </Cell>
                  <Cell>{manage && <ActionButton size="sm" variant={location.active ? 'secondary' : 'primary'} onClick={() => setActive(location)}>{location.active ? 'Deactivate' : 'Activate'}</ActionButton>}</Cell>
                </Row>
              )
            })}
          </Table>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-on-surface-variant">
            {locations.filter((location) => location.active).length} of {locations.length} locations active
          </p>
        </Panel>

        <Panel title="Stock handling & safety governance" subtitle="Applied at every location; not configurable per branch.">
          <div className="grid gap-4 md:grid-cols-2">
            {STOCK_RULES.map(([title, detail]) => (
              <div key={title} className="rounded-md border border-slate-200 p-4">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">{title}<StatusPill tone="brand">Always on</StatusPill></p>
                <p className="mt-1 text-xs leading-4 text-on-surface-variant">{detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Inventory access & governance"
          subtitle="Roles at this branch that hold inventory permissions."
          action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.branchAccess, { branchId })}>Manage inventory access & permissions</ActionButton>}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {INVENTORY_ROLES.map(([title, permission, detail]) => {
              const holding = roles.filter((role) => coversBranch(role, branchId) && role.permissions.includes(permission))
              return (
                <div key={permission} className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                  <p className="flex items-center justify-between text-[13px] font-semibold text-on-surface">
                    {title}
                    {can('settings.roles') && <StatusPill>{holding.length} roles</StatusPill>}
                  </p>
                  <p className="mt-1 text-xs leading-4 text-on-surface-variant">{detail}</p>
                  {can('settings.roles') && <p className="mt-3 text-[11px] text-outline">{holding.map((role) => role.name).join(', ') || 'No role at this branch'}</p>}
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-outline">Day-to-day stock work happens in <Link to={ROUTES.inventory} className="font-semibold text-brand hover:underline">Inventory</Link>.</p>
        </Panel>
      </div>

      {manage && <AddInventoryLocationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} branch={current} onCreated={reload} />}
    </ConfigPage>
  )
}
