import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Modal from '../../../components/workspace/Modal'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { MissingRecord } from '../../inventory/components/DetailFrame'
import { TextArea } from '../../patients/components/parts'
import { formatINR } from '../../patients/format'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { useBilling } from '../context/useBilling'
import { activationBlockers, effectivePrice } from '../serviceLogic'

const Field = ({ label, children }) => <div><dt className="text-xs text-outline">{label}</dt><dd className="mt-1 text-sm font-medium">{children}</dd></div>

export default function BillingServiceDetailPage() {
  const { serviceId } = useParams()
  const { services, branches: BRANCHES, setServiceStatus } = useBilling()
  const [saving, setSaving] = useState(false)
  const location = useLocation()
  const [dialog, setDialog] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const service = services.find((entry) => entry.id === serviceId)
  if (!service) return <MissingRecord what="service" backTo={ROUTES.billingServices} backLabel="Back to Services & Pricing" />

  const active = service.status === 'Active'
  const blockers = active ? [] : activationBlockers(service)
  const back = `${ROUTES.billingServices}${location.state?.search ?? ''}`

  const change = async (status, text) => {
    setSaving(true)
    try {
      await setServiceStatus(service.id, { status, reason: text, version: service.version })
      return true
    } catch (failure) {
      setError(failure.message)
      setNotice('')
      return false
    } finally {
      setSaving(false)
    }
  }
  const deactivate = async () => {
    if (reason.trim().length < 3) return setError('Enter a reason for the audit trail.')
    if (!(await change('inactive', reason.trim()))) return
    setDialog(false)
    setReason('')
    setError('')
    setNotice(`${service.code} is now inactive. New records can no longer select it; existing records are unchanged.`)
  }
  const activate = async () => {
    setError('')
    if (await change('active', '')) setNotice(`${service.code} is active and can be selected for new records.`)
  }

  return (
    <BillingFrame back={{ to: back, label: 'Back to Services & Pricing' }} crumb="Owner Panel / Billing & Finance / Services & Pricing" code={`BF-02 / Service details · ${service.code}`} title={service.name} description={`Reusable service definition · ${service.category}${service.department ? ` · ${service.department}` : ''}`} actions={<><ActionButton variant="primary" to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })}>Edit service</ActionButton>{active ? <ActionButton onClick={() => setDialog(true)}>Deactivate</ActionButton> : <ActionButton onClick={activate} disabled={blockers.length > 0} title={blockers.join('; ') || undefined}>Activate</ActionButton>}</>}>
      {notice && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">{notice}</p>}
      {error && !dialog && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">{error}</p>}
      {blockers.length > 0 && <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs">Before this service can be activated: {blockers.join('; ').toLowerCase()}. <ActionButton size="sm" to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })} className="ml-2">Edit service</ActionButton></p>}

      <Card title="Service definition" aside="Organization-level catalog record" className="mb-5">
        <dl className="grid gap-5 sm:grid-cols-3">
          <Field label="Service name">{service.name}</Field><Field label="Unique code"><span className="text-brand">{service.code}</span></Field><Field label="Status"><StatusPill tone={active ? 'success' : 'neutral'} dot>{service.status}</StatusPill></Field>
          <Field label="Category">{service.category}</Field><Field label="Department / specialty (optional)">{service.department || 'Unassigned'}</Field><Field label="Default price">{formatINR(service.price)}{service.unit ? ` per ${service.unit}` : ''}</Field>
          <Field label="Tax treatment">{service.tax === 'Exempt' ? `Exempt · ${service.taxConfig.split(' — ')[0]}` : service.tax}</Field>
        </dl>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-outline">Clinical description</p>
        <p className="text-sm">{service.description || 'No description provided.'}</p>
        <p className="mt-3 text-[11px] text-outline">{service.tax === 'Exempt' ? 'The exemption is configured for this record only. It is not a blanket organization exemption and does not imply a universal tax rate.' : service.tax === 'Not configured' ? 'No tax treatment has been decided for this service; no rate or exemption is assumed.' : ''}</p>
      </Card>

      <Card title="Branch applicability & pricing" aside="Default price unless a custom override is set" className="mb-5">
        <table className="w-full text-left text-xs"><thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-outline uppercase"><tr><th className="px-4 py-3">Location</th><th>Availability</th><th>Price source</th><th className="pr-4 text-right">Price (INR)</th></tr></thead><tbody>
          {BRANCHES.map((branch) => { const entry = service.branches[branch.id]; const price = effectivePrice(service, branch.id); return <tr key={branch.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{branch.name}</td><td className={entry ? 'text-brand' : 'text-outline'}>{entry ? 'Available' : 'Not configured'}</td><td>{!entry ? 'No branch configuration' : entry.price == null ? 'Default price' : 'Custom override'}</td><td className="pr-4 text-right text-sm font-semibold">{price == null ? '—' : formatINR(price)}</td></tr> })}
        </tbody></table>
        <p className="mt-3 text-[11px] text-outline">Future locations are not automatically enabled.</p>
      </Card>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card title="Audit history" aside="Recorded changes">
          {service.audit.length === 0 ? <p className="rounded-md bg-surface-lowest p-4 text-xs text-on-surface-variant"><strong className="block">Audit history unavailable</strong>No changes have been recorded for this service yet. Future changes record the actor, time and what changed.</p> : <ol className="flex flex-col gap-3 text-xs">{service.audit.map((entry, index) => <li key={`${entry.at}-${index}`}><strong>{entry.text}</strong><br /><span className="text-outline">{entry.at} · {entry.by}</span></li>)}</ol>}
        </Card>
        <Card title="Downstream record references" aside="Conceptual relationship">
          <p className="text-xs text-on-surface-variant">Financial records reference the applicable service and price. Price changes affect future selection only; finalized records keep their references. Deactivating removes the service from future selection.</p>
        </Card>
      </div>
      <Note title="Owner actions require authorization" tone="brand">Edit opens the persisted values of this service. Deactivate asks for a reason that is kept in the audit history. Inactive services can be activated once their configuration is complete.</Note>

      <Modal open={dialog} onClose={() => setDialog(false)} eyebrow="BF-02 / Deactivate service" title="Deactivate this service?" footer={<div className="flex justify-end gap-2"><ActionButton onClick={() => setDialog(false)}>Cancel</ActionButton><ActionButton variant="danger" disabled={saving} onClick={deactivate}>Deactivate service</ActionButton></div>}>
        <div className="flex flex-col gap-4 px-6 py-5 text-xs">
          <p className="rounded-md bg-surface-lowest p-4 text-sm font-semibold">{service.name}<br /><span className="font-mono text-xs font-normal text-brand">{service.code}</span></p>
          <ul className="list-disc pl-5 text-on-surface-variant"><li>New records cannot select this inactive service.</li><li>Existing records are not deleted, rewritten or repriced.</li><li>Authorized managers can activate it again after configuration checks.</li></ul>
          <TextArea label="Reason for deactivation" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} error={error} hint="Recorded in the audit history." />
        </div>
      </Modal>
    </BillingFrame>
  )
}
