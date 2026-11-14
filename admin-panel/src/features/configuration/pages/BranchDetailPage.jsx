import { useState } from 'react'
import { AlertTriangle, ArrowRight, Building2, ChevronRight, Info, MoreHorizontal, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import DetailList from '../../../components/workspace/DetailList'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_INFO, BRANCH_SHORTCUTS, CAPABILITIES, OPERATING_CONFIG } from '../data/branchDetail'

function OperatingConfiguration({ branchId }) {
  return (
    <Panel title="Operating configuration" subtitle="Care delivery parameters, operational schedules, and department structures.">
      <ul className="-my-3 divide-y divide-slate-100">
        {OPERATING_CONFIG.map((row) => (
          <li key={row.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 max-w-sm">
              <p className="text-[13px] font-semibold text-on-surface">{row.title}</p>
              <p className="mt-0.5 text-xs leading-4 text-on-surface-variant">{row.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill tone={row.badgeTone}>{row.badge}</StatusPill>
              <ActionButton
                variant="soft"
                size="sm"
                to={row.to ? pathFor(ROUTES[row.to], { branchId }) : undefined}
              >
                {row.action} <ArrowRight className="size-3" aria-hidden="true" />
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function CapabilityRow({ capability }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-teal-50 text-brand">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-on-surface">{capability.title}</p>
          <p className="mt-0.5 text-xs leading-4 text-on-surface-variant">{capability.detail}</p>
        </div>
      </div>
      {capability.enabled ? (
        <div className="flex items-center gap-3">
          <StatusPill tone="success" dot>
            ENABLED
          </StatusPill>
          <button type="button" aria-label={`Remove ${capability.title}`} className="text-outline hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <ActionButton variant="soft" size="sm">
          {capability.action}
        </ActionButton>
      )}
    </li>
  )
}

function Capabilities() {
  return (
    <Panel
      title="Capabilities"
      subtitle="Functional operational modules currently provisioned and routed for this facility."
      action={<span className="text-[11px] text-outline">5 modules mapped</span>}
    >
      <ul className="-my-3 divide-y divide-slate-100">
        {CAPABILITIES.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-[11px] text-on-surface-variant">
        Standard state hierarchy:
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" />Enabled</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-sky-500" />Available</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-slate-400" />Disabled</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-violet-500" />Enterprise Only</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" />Integration Dependent</span>
      </p>
    </Panel>
  )
}

function DeactivateBranch({ branchName }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Panel
      tone="danger"
      icon={AlertTriangle}
      title="Branch status & lifecycle"
      subtitle="Carefully manage the operational activation lifecycle for this physical facility."
      action={<StatusPill tone="success">Current Status: Active</StatusPill>}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-md">
          <p className="text-[13px] font-semibold text-on-surface">Deactivate branch</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Temporarily pausing or deactivating this branch will freeze new patient appointment bookings and OPD queue tokens for{' '}
            {branchName}. Existing clinical records, historical financial invoices, and shared patient profiles remain intact in the
            organization vault.
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <ActionButton size="sm" onClick={() => setConfirming(false)}>
              Keep active
            </ActionButton>
            <ActionButton variant="danger" size="sm" onClick={() => setConfirming(false)}>
              Confirm deactivation
            </ActionButton>
          </div>
        ) : (
          <ActionButton variant="danger" onClick={() => setConfirming(true)}>
            Deactivate branch
          </ActionButton>
        )}
      </div>
    </Panel>
  )
}

function SidePanels({ branchId }) {
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Branch setup" action={<span className="text-[10px] tracking-wide text-outline uppercase">Hub shortcuts</span>} bodyClassName="p-0">
        <p className="px-5 pt-4 text-xs leading-4 text-on-surface-variant">
          Direct pathways to manage localized modules and operational rosters for this branch.
        </p>
        <ul className="mt-2 divide-y divide-slate-100">
          {BRANCH_SHORTCUTS.map((shortcut) => {
            const row = (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-surface-low text-on-surface-variant">
                  <Building2 className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-on-surface">{shortcut.title}</span>
                  <span className="block text-xs leading-4 text-on-surface-variant">{shortcut.detail}</span>
                </span>
                <ChevronRight className="size-4 text-outline" aria-hidden="true" />
              </>
            )
            const rowClass = 'flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-lowest'
            return (
              <li key={shortcut.id}>
                {shortcut.to ? (
                  <Link to={pathFor(ROUTES[shortcut.to], { branchId })} className={rowClass}>
                    {row}
                  </Link>
                ) : (
                  <button type="button" className={cn(rowClass, 'w-full')}>
                    {row}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Location context">
        <dl className="space-y-3 text-xs">
          {[
            ['Organization', 'CarePoint Clinics'],
            ['Branch', 'Main Clinic'],
            ['Primary location', 'Yes (HQ Node)'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-on-surface-variant">{label}</dt>
              <dd className="font-semibold text-on-surface">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-on-surface-variant">Shared patient identity</dt>
            <dd>
              <StatusPill tone="success">Enabled</StatusPill>
            </dd>
          </div>
        </dl>
        <div className="mt-4 rounded-md bg-surface-lowest p-3 text-xs leading-5 text-on-surface-variant">
          <p className="font-semibold text-on-surface">Shared Identity Model:</p>
          Patients registered at Main Clinic can be seen at any connected branch without duplicate demographic records. Clinical
          encounters, prescriptions, and local invoices remain scoped to this facility node.
        </div>
      </Panel>

      <aside className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-xs leading-5 text-on-surface-variant">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand">
          <Info className="size-3.5" aria-hidden="true" />
          Configuration Hub Principle
        </p>
        This hub coordinates facility parameters without duplicating dedicated ERP data. Doctor allocations, prescriptions, clinical
        protocol sets, and itemized billing schedules are configured directly in their respective subsystems.
      </aside>
    </div>
  )
}

export default function BranchDetailPage() {
  const { branchId } = useParams()

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-brand">Branch configuration</span>
            <StatusPill tone="success" dot>Active</StatusPill>
            <StatusPill>Primary location</StatusPill>
          </>
        }
        title="Main Clinic"
        description="Manage the foundational configuration, operating schedules, clinical capabilities, and operational routing for this clinic location."
        actions={
          <>
            <ActionButton icon={Pencil}>Edit branch</ActionButton>
            <ActionButton aria-label="More branch actions">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            icon={Building2}
            title="Branch information"
            subtitle="Physical facility identity, registry credentials, and regional contact endpoints."
            action={
              <ActionButton variant="soft" size="sm">
                Edit branch information <ArrowRight className="size-3" aria-hidden="true" />
              </ActionButton>
            }
          >
            <DetailList items={BRANCH_INFO} />
            <p className="mt-5 flex flex-wrap justify-between gap-2 border-t border-dashed border-slate-200 pt-3 font-mono text-[11px] text-outline">
              <span>ABDM Registry Node: HFR-HYD-001 · Facility PIN: 500034</span>
              <span>Initialized on Sep 14, 2024</span>
            </p>
          </Panel>
          <OperatingConfiguration branchId={branchId} />
          <Capabilities />
          <DeactivateBranch branchName="Main Clinic" />
        </div>
        <SidePanels branchId={branchId} />
      </div>
    </ConfigPage>
  )
}
