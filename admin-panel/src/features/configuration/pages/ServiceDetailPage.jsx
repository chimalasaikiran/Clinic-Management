import { useState } from 'react'
import { ArrowRight, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import DetailList from '../../../components/workspace/DetailList'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { billingApi } from '../../billing/api'
import { money } from '../../billing/financeFormat'
import { activationBlockers, effectivePrice } from '../../billing/serviceLogic'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { AddServiceLocationsDrawer, SetBranchPriceDrawer } from '../components/ServiceDrawers'
import { BRANCH_STATUS } from '../configView'
import { useCatalogue } from '../useCatalogue'

function Lifecycle({ service, onChanged }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const active = service.status === 'Active'
  const blockers = active ? [] : activationBlockers(service)
  const count = Object.keys(service.branches).length

  const change = async () => {
    if (active && reason.trim().length < 3) return setFailure('Enter a reason for the audit trail.')
    setPending(true)
    setFailure('')
    try {
      await billingApi.setServiceStatus(service.id, { status: active ? 'inactive' : 'active', reason: active ? reason.trim() : '', version: service.version })
      setConfirming(false)
      setReason('')
      onChanged(active ? `${service.code} is now inactive. New charges can no longer select it; existing records are unchanged.` : `${service.code} is active and can be charged.`)
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel tone={active ? 'danger' : undefined} title="Service lifecycle & status">
      <p className="text-xs"><span className="text-outline">Availability</span> <strong className="float-right text-brand">{active ? `Active across ${count} branch${count === 1 ? '' : 'es'}` : 'Inactive'}</strong></p>
      <p className="mt-3 text-xs leading-5 text-on-surface-variant">
        {active ? 'Deactivating stops new charges for this service. Past charges, invoices and the audit trail are kept.' : blockers.length ? `Before activating: ${blockers.join('; ')}.` : 'Activate to allow new charges for this service.'}
      </p>
      {failure && <p role="alert" className="mt-2 text-xs text-danger">{failure}</p>}
      {confirming ? (
        <div className="mt-3 flex flex-col gap-2">
          {active && <TextInput label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />}
          <div className="flex gap-2">
            <ActionButton size="sm" onClick={() => setConfirming(false)}>Keep {active ? 'active' : 'inactive'}</ActionButton>
            <ActionButton variant={active ? 'danger' : 'primary'} size="sm" onClick={change} disabled={pending}>Confirm {active ? 'deactivation' : 'activation'}</ActionButton>
          </div>
        </div>
      ) : (
        <ActionButton variant={active ? 'danger' : 'primary'} className="mt-3 w-full" disabled={blockers.length > 0} onClick={() => setConfirming(true)}>{active ? 'Deactivate service' : 'Activate service'}</ActionButton>
      )}
    </Panel>
  )
}

export default function ServiceDetailPage() {
  const { serviceId } = useParams()
  const { can } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const catalogue = useCatalogue(attempt)
  const departments = useApiResource(() => configApi.departments(), 'departments').data ?? []
  const [drawer, setDrawer] = useState(null)
  const [notice, setNotice] = useState('')

  if (!catalogue.ready) {
    return (
      <ConfigPage>
        <PageIntro title="Service" />
        <LoadingState label="Loading service…" error={catalogue.error} onRetry={catalogue.reload} />
      </ConfigPage>
    )
  }

  const service = catalogue.services.find((entry) => entry.id === serviceId)
  if (!service) {
    return (
      <ConfigPage>
        <PageIntro title="Service not found" description="It may have been removed, or the link is wrong." actions={<ActionButton to={ROUTES.services}>Back to services</ActionButton>} />
      </ConfigPage>
    )
  }

  const manage = can('accounting.invoices')
  const { branches } = catalogue
  const department = departments.find((entry) => entry.name.toLowerCase() === service.department.toLowerCase())
  const offered = branches.filter((branch) => service.branches[branch.id])
  const saved = (text) => {
    setNotice(text)
    setAttempt((count) => count + 1)
  }
  const active = service.status === 'Active'
  const info = [
    { label: 'Service name', value: service.name },
    { label: 'Service code', value: service.code },
    { label: 'Category', value: service.category },
    { label: 'Department', value: service.department || 'Unassigned' },
    { label: 'Unit / duration', value: service.unit || '—' },
    { label: 'Last changed', value: service.updated },
    { label: 'Description', value: service.description || 'No description', full: true },
  ]

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-on-surface-variant">Service configuration</span>
            <span className="font-mono text-brand">{service.code}</span>
          </>
        }
        title={
          <span className="flex items-center gap-3">
            {service.name}
            <StatusPill tone={active ? 'success' : 'neutral'} dot>{service.status}</StatusPill>
          </span>
        }
        description={service.description || `${service.category}${service.department ? ` · ${service.department}` : ''}`}
        actions={manage && <ActionButton variant="primary" icon={Pencil} to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })}>Edit service</ActionButton>}
      />

      {notice && <Banner tone="brand" title={notice} className="mb-5" />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Service information" action={manage && <ActionButton variant="soft" size="sm" to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })}>Edit details <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
            <DetailList items={info} />
          </Panel>

          <Panel
            title="Locations & availability"
            subtitle="Branches where this service can be charged. The definition is shared across the organization; the price can differ per branch."
            action={<StatusPill>{offered.length} of {branches.length} Branches</StatusPill>}
            bodyClassName="p-0"
          >
            <InfoNote tone="brand" className="m-5 mb-0">
              <strong className="text-brand">Single service object:</strong> Changes to the definition apply at every location, while branch prices are local.
            </InfoNote>
            <Table headings={['Branch / facility', 'Branch status', 'Offered', 'Price', '']} minWidth={640}>
              {branches.map((branch) => {
                const entry = service.branches[branch.id]
                return (
                  <Row key={branch.id} muted={!entry}>
                    <Cell>
                      <p className="font-semibold">{branch.name}</p>
                      <p className="text-[11px] text-outline">{branch.code}</p>
                    </Cell>
                    <Cell><StatusPill tone={BRANCH_STATUS[branch.status][1]} dot>{BRANCH_STATUS[branch.status][0]}</StatusPill></Cell>
                    <Cell className="text-xs">{entry ? 'Yes' : 'No'}</Cell>
                    <Cell>
                      {entry ? (
                        <>
                          <p className="font-semibold">{money(effectivePrice(service, branch.id))}</p>
                          <p className="text-[11px] text-outline">{entry.price == null ? 'Default price' : 'Branch price'}</p>
                        </>
                      ) : '—'}
                    </Cell>
                    <Cell>
                      {manage && branch.status !== 'inactive' && <button type="button" onClick={() => setDrawer(branch.id)} className="text-xs font-semibold text-brand hover:underline">{entry ? 'Edit' : 'Assign'}</button>}
                    </Cell>
                  </Row>
                )
              })}
            </Table>
            {manage && (
              <div className="flex justify-end gap-4 border-t border-slate-100 px-5 py-3">
                <button type="button" onClick={() => setDrawer('locations')} className="text-xs font-semibold text-brand hover:underline">Manage location availability →</button>
              </div>
            )}
          </Panel>

          <Panel title="Standard tariff & fee structure" action={manage && <ActionButton variant="soft" size="sm" to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })}>Edit pricing structure</ActionButton>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="text-[11px] text-outline">Default price</p>
                <p className="text-2xl font-bold text-on-surface">{money(service.price)} {service.unit && <span className="text-xs font-normal text-outline">/ {service.unit}</span>}</p>
                <p className="text-[11px] text-outline">Used wherever no branch price is set</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="text-[11px] text-outline">Tax treatment</p>
                <p className="text-[13px] font-semibold text-on-surface">{service.tax}</p>
                <p className="text-[11px] text-outline">{service.taxConfig || (service.tax === 'Not configured' ? 'Choose one before activating' : 'No configuration needed')}{service.gstRate ? ` · GST ${service.gstRate}%` : ''}</p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Used across ClinicOS" subtitle="The same record is used everywhere:">
            <ol className="space-y-3 text-xs leading-5 text-on-surface-variant">
              {[
                ['Charges', 'Added to a visit at the branch price.'],
                ['Invoices', 'Invoiced with the tax treatment above.'],
                ['Insurance', 'Claimed under the payer’s agreement where one applies.'],
                ['Reports', 'Revenue is reported by service and department.'],
              ].map(([title, detail], index) => (
                <li key={title}>
                  <strong className="text-on-surface">{index + 1}. {title}</strong>
                  <br />
                  {detail}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Related configuration" bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              <li className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <span><span className="block text-outline">Department</span><span className="font-semibold text-on-surface">{service.department || 'Unassigned'}</span></span>
                {department && <Link to={pathFor(ROUTES.department, { departmentId: department.id })} className="font-semibold text-brand hover:underline">Open department</Link>}
              </li>
              <li className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <span><span className="block text-outline">Billing record</span><span className="font-semibold text-on-surface">{service.code}</span></span>
                <Link to={pathFor(ROUTES.billingService, { serviceId: service.id })} className="font-semibold text-brand hover:underline">Open in Billing</Link>
              </li>
              <li className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <span><span className="block text-outline">History</span><span className="font-semibold text-on-surface">{service.audit.length} changes</span></span>
                {service.audit[0] && <span className="text-outline">{service.audit[0].at}</span>}
              </li>
            </ul>
          </Panel>

          {manage && <Lifecycle service={service} onChanged={saved} />}
        </div>
      </div>

      {manage && (
        <>
          <AddServiceLocationsDrawer open={drawer === 'locations'} onClose={() => setDrawer(null)} service={service} branches={branches} onSaved={saved} />
          <SetBranchPriceDrawer key={`${drawer}:${service.version}`} open={Boolean(drawer && drawer !== 'locations')} onClose={() => setDrawer(null)} service={service} branch={branches.find((branch) => branch.id === drawer)} onSaved={saved} />
        </>
      )}
    </ConfigPage>
  )
}
