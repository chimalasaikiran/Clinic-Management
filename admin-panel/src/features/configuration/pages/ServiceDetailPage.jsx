import { useState } from 'react'
import { ArrowRight, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import DetailList from '../../../components/workspace/DetailList'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import ConfigPage from '../components/ConfigPage'
import DetailUnavailable from '../components/DetailUnavailable'
import { AddServiceLocationsDrawer, SetBranchPriceDrawer } from '../components/ServiceDrawers'
import { CARDIOLOGY_CONSULT as service } from '../data/services'

export default function ServiceDetailPage() {
  const { serviceId } = useParams()
  const [drawer, setDrawer] = useState(null)
  const [confirming, setConfirming] = useState(false)

  if (serviceId !== service.id) {
    return <DetailUnavailable title="Service" backTo={ROUTES.services} backLabel="Back to services" />
  }

  const closeDrawer = () => setDrawer(null)
  const departmentPath = pathFor(ROUTES.department, { departmentId: 'cardiology' })

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
            <StatusPill tone="success" dot>Active</StatusPill>
          </span>
        }
        description={service.description}
        actions={<ActionButton variant="primary" icon={Pencil}>Edit service</ActionButton>}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Service information" action={<ActionButton variant="soft" size="sm">Edit details <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
            <DetailList items={service.info} />
          </Panel>

          <Panel title="Service delivery & scheduling" action={<ActionButton variant="soft" size="sm">Configure slots</ActionButton>}>
            <dl className="grid gap-3 sm:grid-cols-3">
              {service.delivery.map(([label, value, hint]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <dt className="text-[11px] text-outline">{label}</dt>
                  <dd className="text-lg font-bold text-on-surface">{value}</dd>
                  <p className="text-[11px] text-outline">{hint}</p>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-on-surface-variant">
              {service.deliveryNotes.map(([label, value, detail]) => (
                <li key={label}>
                  <strong className="text-on-surface">{label}: {value}</strong> — {detail}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Locations & availability"
            subtitle="Branches where this service is available. The clinical definition is shared across the organization while local tariffs can be customized per branch."
            action={<StatusPill>2 of 3 Branches Active</StatusPill>}
            bodyClassName="p-0"
          >
            <InfoNote tone="brand" className="m-5 mb-0">
              <strong className="text-brand">Single service object:</strong> Changes to clinical definition cascade across all locations, while branch tariffs are localized.
            </InfoNote>
            <Table headings={['Branch / facility', 'Operational status', 'Capacity', 'Local tariff', '']} minWidth={640}>
              {service.branches.map((branch) => (
                <Row key={branch.id}>
                  <Cell>
                    <p className="font-semibold">{branch.name}</p>
                    <p className="text-[11px] text-outline">{branch.note}</p>
                  </Cell>
                  <Cell><StatusPill tone={branch.status === 'Available' ? 'success' : 'warning'} dot>{branch.status}</StatusPill></Cell>
                  <Cell className="text-xs">{branch.capacity}</Cell>
                  <Cell>
                    <p className="font-semibold">{branch.tariff}</p>
                    {branch.tariffNote && <p className="text-[11px] text-outline">{branch.tariffNote}</p>}
                  </Cell>
                  <Cell>
                    <button type="button" onClick={() => setDrawer('price')} className="text-xs font-semibold text-brand hover:underline">
                      {branch.status === 'Available' ? 'Edit' : 'Assign'}
                    </button>
                  </Cell>
                </Row>
              ))}
            </Table>
            <div className="flex justify-end gap-4 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setDrawer('locations')} className="text-xs font-semibold text-brand hover:underline">Manage location availability →</button>
            </div>
          </Panel>

          <Panel title="Standard tariff & fee structure" action={<ActionButton variant="soft" size="sm" onClick={() => setDrawer('price')}>Edit pricing structure</ActionButton>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="text-[11px] text-outline">Base standard tariff</p>
                <p className="text-2xl font-bold text-on-surface">{service.tariff.base} <span className="text-xs font-normal text-outline">INR / consultation</span></p>
                <p className="text-[11px] text-outline">Standard fixed fee per visit</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                <p className="text-[11px] text-outline">Tax & regulatory category</p>
                <p className="text-[13px] font-semibold text-on-surface">{service.tariff.tax}</p>
                <p className="text-[11px] text-outline">GST Act Section 12 · Non-taxable</p>
              </div>
            </div>
            <InfoNote tone="brand" className="mt-3"><strong className="text-brand">14-day clinical follow-up window:</strong> {service.tariff.followUp}</InfoNote>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Used across ClinicOS" subtitle="Single source of truth propagation across operational pipelines:">
            <ol className="space-y-3 text-xs leading-5 text-on-surface-variant">
              {service.pipeline.map(([title, detail], index) => (
                <li key={title}>
                  <strong className="text-on-surface">{index + 1}. {title}</strong>
                  <br />
                  {detail}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Related configuration" action={<StatusPill>5 Linked Entities</StatusPill>} bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              {service.related.map(([label, value, action, target]) => (
                <li key={label} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                  <span>
                    <span className="block text-outline">{label}</span>
                    <span className="font-semibold text-on-surface">{value}</span>
                  </span>
                  {target === 'department' ? (
                    <Link to={departmentPath} className="font-semibold text-brand hover:underline">{action}</Link>
                  ) : target === 'service' ? (
                    <Link to={pathFor(ROUTES.service, { serviceId: 'srv-card-02' })} className="font-semibold text-brand hover:underline">{action}</Link>
                  ) : target ? (
                    <Link to={pathFor(ROUTES[target], { departmentId: 'cardiology' })} className="font-semibold text-brand hover:underline">{action}</Link>
                  ) : (
                    <button type="button" onClick={() => setDrawer('locations')} className="font-semibold text-brand hover:underline">{action}</button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel tone="danger" title="Service lifecycle & status" action={<span className="font-mono text-[10px] text-outline">SCH/DEACT-AUDIT</span>}>
            <p className="text-xs"><span className="text-outline">Global availability</span> <strong className="float-right text-brand">Active across 2 branches</strong></p>
            <p className="mt-3 text-xs leading-5 text-on-surface-variant">
              Deactivating this service removes it from active appointment booking and new encounter generation. All historical patient encounters, past invoices, audit logs, and ABDM compliance archives remain permanently preserved.
            </p>
            {confirming ? (
              <div className="mt-3 flex gap-2">
                <ActionButton size="sm" onClick={() => setConfirming(false)}>Keep active</ActionButton>
                <ActionButton variant="danger" size="sm" onClick={() => setConfirming(false)}>Confirm deactivation</ActionButton>
              </div>
            ) : (
              <ActionButton variant="danger" className="mt-3 w-full" onClick={() => setConfirming(true)}>Deactivate service</ActionButton>
            )}
          </Panel>
        </div>
      </div>

      <AddServiceLocationsDrawer open={drawer === 'locations'} onClose={closeDrawer} />
      <SetBranchPriceDrawer open={drawer === 'price'} onClose={closeDrawer} />
    </ConfigPage>
  )
}
