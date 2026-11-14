import { useState } from 'react'
import { MoreVertical, Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Toggle } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import AddInventoryLocationDrawer from '../components/AddInventoryLocationDrawer'
import ConfigPage from '../components/ConfigPage'
import { INVENTORY_LOCATIONS, INVENTORY_ROLES, STOCK_ALERTS, STOCK_GOVERNANCE } from '../data/inventory'

function GovernanceCard({ rule, on, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
          {rule.title}
          {rule.badge && <StatusPill tone={rule.badge === 'Mandatory' ? 'brand' : 'neutral'}>{rule.badge}</StatusPill>}
        </p>
        <p className="mt-1 text-xs leading-4 text-on-surface-variant">{rule.detail}</p>
        {rule.field && (
          <label className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
            {rule.field}
            <input
              type="number"
              min="0"
              defaultValue={rule.value}
              aria-label={rule.field}
              className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-brand"
            />
            {rule.unit}
          </label>
        )}
      </div>
      {rule.field === undefined && <Toggle checked={on} onChange={onChange} label={rule.title} />}
    </div>
  )
}

export default function BranchInventoryPage() {
  const { branchId } = useParams()
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(true)
  const [locations, setLocations] = useState(INVENTORY_LOCATIONS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toggles, setToggles] = useState(() =>
    Object.fromEntries([...STOCK_GOVERNANCE, ...STOCK_ALERTS].map((rule) => [rule.id, rule.locked ?? rule.defaultOn ?? true])),
  )

  const setToggle = (id) => (value) => setToggles((current) => ({ ...current, [id]: value }))
  const branchPath = pathFor(ROUTES.branch, { branchId })

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">Branch scope: Main Clinic (HYD-HQ-01) · Operational facility</span>}
        title="Inventory configuration"
        description="Configure inventory capabilities, physical storage nodes, tracking rules, and stock-tracking protocols for this branch."
        actions={
          <>
            <ActionButton onClick={() => navigate(branchPath)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={() => navigate(branchPath)}>
              Save changes
            </ActionButton>
          </>
        }
        note="All changes saved to branch profile"
      />

      <div className="flex flex-col gap-5">
        <Panel title="Branch inventory master switch" action={<StatusPill tone="success">Enabled (Active)</StatusPill>}>
          <div className="flex items-center justify-between gap-4">
            <p className="max-w-2xl text-xs leading-5 text-on-surface-variant">
              When enabled, physical locations can hold stock, register dispensing events, and allocate batches. If disabled, operational
              inventory and dispensing tools remain visible while inventory tracking is suspended.
            </p>
            <span className="flex items-center gap-2 text-xs font-medium text-on-surface">
              {enabled ? 'Active' : 'Paused'}
              <Toggle checked={enabled} onChange={setEnabled} label="Branch inventory" />
            </span>
          </div>
        </Panel>

        <Panel
          title="Inventory locations"
          subtitle="Define the physical or operational locations where stock is stored and managed for this branch."
          action={
            <ActionButton variant="brand" size="sm" icon={Plus} onClick={() => setDrawerOpen(true)}>
              Add inventory location
            </ActionButton>
          }
          bodyClassName="p-0"
        >
          <Table headings={['Location', 'Type', 'Status', 'Stock handling protocol', 'Action']} minWidth={820}>
            {locations.map((location) => (
              <Row key={location.id}>
                <Cell>
                  <p className="font-semibold">{location.name}</p>
                  <p className="text-[11px] text-outline">{location.detail}</p>
                </Cell>
                <Cell><StatusPill className="rounded">{location.type}</StatusPill></Cell>
                <Cell><StatusPill tone={location.status === 'Active' ? 'success' : 'neutral'} dot>{location.status}</StatusPill></Cell>
                <Cell>
                  <StatusPill tone="success">{location.protocol}</StatusPill>
                  <p className="mt-1 text-[11px] text-outline">{location.protocolNote}</p>
                </Cell>
                <Cell>
                  <button type="button" aria-label={`Actions for ${location.name}`} className="text-outline hover:text-on-surface">
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </button>
                </Cell>
              </Row>
            ))}
          </Table>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-on-surface-variant">
            Showing {locations.length} of {locations.length} active storage nodes
          </p>
        </Panel>

        <Panel title="Stock handling & safety governance" subtitle="Set global batch, expiry, serial, and verification across all branch storage sites.">
          <div className="grid gap-4 md:grid-cols-2">
            {STOCK_GOVERNANCE.map((rule) => (
              <GovernanceCard key={rule.id} rule={rule} on={toggles[rule.id]} onChange={rule.locked ? () => {} : setToggle(rule.id)} />
            ))}
          </div>
        </Panel>

        <Panel title="Stock alerts & automated monitoring" subtitle="Configure automated inventory notifications for this branch without creating procurement orders.">
          <div className="flex flex-col gap-4">
            {STOCK_ALERTS.map((rule) => (
              <GovernanceCard key={rule.id} rule={rule} on={toggles[rule.id]} onChange={setToggle(rule.id)} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Inventory access & governance"
          subtitle="Role allocations for stock handling, movements, adjustments, and batch reconciliation."
          action={<ActionButton variant="soft" size="sm" to={pathFor(ROUTES.branchAccess, { branchId })}>Manage inventory access & permissions</ActionButton>}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {INVENTORY_ROLES.map((role) => (
              <div key={role.id} className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="flex items-center justify-between text-[13px] font-semibold text-on-surface">
                  {role.title}
                  <StatusPill>{role.count} Users</StatusPill>
                </p>
                <p className="mt-1 text-xs leading-4 text-on-surface-variant">{role.detail}</p>
                <p className="mt-3 text-[11px] text-outline">{role.people}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Configuration revision & runtime snapshot">
          <div className="flex flex-wrap items-end justify-between gap-4 text-xs text-on-surface-variant">
            <ul className="space-y-1">
              <li>Branch inventory: <strong className="text-on-surface">{enabled ? 'Enabled' : 'Paused'}</strong></li>
              <li>Configured locations: <strong className="text-on-surface">{locations.length} Active Nodes</strong></li>
              <li>Tracking protocols: <strong className="text-on-surface">Batch & FEFO Enforced</strong></li>
            </ul>
            <div className="flex gap-2">
              <ActionButton onClick={() => navigate(branchPath)}>Discard changes</ActionButton>
              <ActionButton variant="primary" onClick={() => navigate(branchPath)}>Save configuration</ActionButton>
            </div>
          </div>
        </Panel>
      </div>

      <AddInventoryLocationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCreate={(location) => setLocations((current) => [...current, location])} />
    </ConfigPage>
  )
}
