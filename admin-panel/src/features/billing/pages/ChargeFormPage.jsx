import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check, OptionSelect, TextArea } from '../../patients/components/parts'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { clinicalApi } from '../../patients/api'
import { invoiceTotals } from '../../patients/billing'
import { formatDate, localToday } from '../../patients/format'
import PatientPicker from '../components/PatientPicker'
import { usePickedPatient } from '../patientChoice'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, Section } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { BILLING_MODELS } from '../constants'
import { useBilling } from '../context/useBilling'
import { branchPrice, chargeRequest, chargeSetupIssues, draftBreakdown, validateCharge } from '../financeLogic'
import { PAYERS } from '../invoiceLogic'

const DISCOUNTS = [['0', 'None selected'], ['5', '5% courtesy'], ['10', '10% staff / family']]

export default function ChargeFormPage() {
  const { chargeId } = useParams()
  const { records } = useBilling()
  const existing = chargeId ? records.charges.find((charge) => charge.id === chargeId) : null

  if (chargeId && !existing) {
    return (
      <BillingFrame back={{ to: ROUTES.billingCharges, label: 'Charge Register' }} crumb="Billing & Finance / Charges" code="Billing & Finance" title="Charge not found" scope={false}>
        <Banner tone="warning" title="No charge matches this link">Open the Charge Register to find the record.</Banner>
      </BillingFrame>
    )
  }
  return <ChargeForm key={chargeId ?? 'new'} existing={existing} />
}

function ChargeForm({ existing }) {
  const { services, orgName, createCharge, updateCharge } = useBilling()
  const { can } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const readOnly = Boolean(existing && existing.status !== 'Draft')
  const line = existing?.lines[0]
  const [values, setValues] = useState({
    patientId: existing?.patientId ?? params.get('patient') ?? '', payer: existing?.payer ?? PAYERS[0], encounterId: existing?.encounterId ?? '', model: existing?.model ?? BILLING_MODELS[1], date: existing?.date ?? localToday(),
    serviceId: existing?.serviceId ?? '', qty: String(line?.qty ?? 1), discountPct: String(line?.discountPct ?? 0), note: existing?.note ?? '', reviewed: false,
  })
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const patient = usePickedPatient(values.patientId)
  // Encounters come with the clinical chart, for those allowed to read it.
  const chart = useApiResource(() => (values.patientId && can('clinical.read') ? clinicalApi.chart(values.patientId) : Promise.resolve(null)), `charge-chart:${values.patientId}`).data
  const encounters = chart?.encounters ?? []
  const branchId = encounters.find((encounter) => encounter.id === values.encounterId)?.branch.id ?? patient?.branchId
  const offered = services.filter((entry) => entry.status === 'Active' && (!branchId || entry.branches[branchId]))
  const service = services.find((entry) => entry.id === values.serviceId)
  const price = branchPrice(service, branchId)
  const issues = readOnly ? [] : chargeSetupIssues(service && { ...service, price })
  const errors = attempted ? validateCharge(values) : {}
  const breakdown = readOnly ? invoiceTotals(existing.lines) : draftBreakdown(service, values.qty, values.discountPct, branchId)
  const ready = !readOnly && Object.keys(validateCharge(values)).length === 0 && issues.length === 0 && values.reviewed
  const registerPath = `${ROUTES.billingCharges}${state?.search ?? ''}`
  const set = (name, value) => {
    setValues((current) => ({ ...current, [name]: value, ...(name === 'patientId' ? { encounterId: '', reviewed: false } : {}), ...(name === 'serviceId' ? { reviewed: false } : {}) }))
    setDirty(true)
  }

  const save = async (confirm) => {
    setAttempted(true)
    if (Object.keys(validateCharge(values)).length) return
    setSaving(true)
    setServerError('')
    try {
      const body = chargeRequest(values, confirm)
      if (existing) await updateCharge(existing.uuid, { ...body, version: existing.version })
      else await createCharge({ ...body, patientId: values.patientId })
      navigate(registerPath)
    } catch (error) {
      setServerError(error.message)
      setLeaving(false)
    } finally {
      setSaving(false)
    }
  }

  const leave = () => (dirty ? setLeaving(true) : navigate(registerPath))
  const checks = [
    ['Patient & payer selected', patient ? `${patient.name} · ${values.payer}` : 'Select a patient', Boolean(patient)],
    ['Encounter & branch retained', patient ? `${encounters.find((encounter) => encounter.id === values.encounterId)?.reference ?? 'No encounter linked'} · ${patient.branch}` : 'Choose a patient first', Boolean(patient)],
    ['Service & quantity selected', service ? `${service.name} · Quantity ${values.qty}` : 'Select a service', Boolean(service) && Number(values.qty) > 0],
    ['Financial configuration', issues.length ? 'Resolve price and tax, then verify subtotal, discount and final total.' : 'Price and tax verified', Boolean(service) && issues.length === 0],
  ]

  return (
    <BillingFrame back={{ to: registerPath, label: 'Back to Charge Register' }} crumb={`Billing & Finance / Charges / ${existing ? (readOnly ? 'Review' : 'Draft') : 'New'}`} code="Billing & Finance" title="Create / Review Charge" badge={dirty && <StatusPill tone="warning">Unsaved changes</StatusPill>} description="Record an amount owed against a patient and service. Review the financial breakdown before confirming." scope={false}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="flex flex-wrap items-center gap-3"><strong className="text-sm">{existing?.id ?? 'New charge'}</strong><StatusPill>{readOnly ? 'Finalized' : 'Draft'}{existing?.invoiceId ? ' · Invoiced' : ' · Uninvoiced'}</StatusPill>{dirty && <span className="text-outline">Changes since last draft save</span>}</p>
        <span className="text-outline">{orgName} · INR (₹)</span>
      </div>

      <ol className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-slate-200 bg-white p-4 text-[13px]">
        <li className="font-semibold text-brand">✓ Patient & encounter</li>
        <li className="font-semibold">2 Charge details</li>
        <li className="text-outline">3 Review & confirm</li>
        {issues.length > 0 && <li className="ml-auto"><StatusPill tone="warning">{issues.length} setup issue{issues.length === 1 ? '' : 's'}</StatusPill></li>}
      </ol>

      {issues.length > 0 && (
        <Banner tone="warning" title="Draft can be saved; confirmation is blocked" className="mb-6" action={<ActionButton to={ROUTES.billingServices}>Services & Pricing ↗</ActionButton>}>
          {service ? `${service.name} has no verified configured ${issues.join(' or ').toLowerCase().replace(' missing', '')}.` : 'No service selected.'} Select a configured service or request authorized setup. No totals are inferred.
        </Banner>
      )}

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_356px]">
        <div className="space-y-6">
          <Section title="Patient & billing context" aside="Required fields *">
            <div className="grid gap-4 sm:grid-cols-2">
              <PatientPicker value={values.patientId} onChange={(id) => set('patientId', id)} error={errors.patientId} disabled={readOnly || Boolean(existing)} />
              <SelectInput label="Payer" required value={values.payer} onChange={(event) => set('payer', event.target.value)} options={PAYERS} disabled={readOnly} hint="Verify the responsible payer before confirming." />
              <OptionSelect label="Linked encounter" required value={values.encounterId} onChange={(event) => set('encounterId', event.target.value)} placeholder={encounters.length ? 'Select an encounter' : 'No encounters on file'} disabled={readOnly || !encounters.length} options={encounters.map((encounter) => ({ value: encounter.id, label: `${encounter.reference} · ${formatDate(encounter.started.date)}` }))} hint={values.encounterId ? formatDate(encounters.find((encounter) => encounter.id === values.encounterId)?.date ?? localToday()) : undefined} />
              <TextInput label="Branch" required value={patient?.branch ?? existing?.branch ?? ''} readOnly disabled hint="Inherited from the patient record · Within your access." />
              <SelectInput label="Billing model" required value={values.model} onChange={(event) => set('model', event.target.value)} options={BILLING_MODELS} disabled={readOnly} hint="Switching billing model never invoices this charge." />
              <TextInput label="Charge date" required value={formatDate(values.date)} readOnly disabled hint="Date recorded in IST." />
            </div>
          </Section>

          <Section title="Service / item" aside="1 line item">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <OptionSelect label="Service / item" required value={values.serviceId} onChange={(event) => set('serviceId', event.target.value)} placeholder={line && !service ? line.name : patient ? 'Select a configured service' : 'Choose a patient first'} disabled={readOnly || !patient} error={errors.serviceId} options={(readOnly && service ? [service] : offered).map((entry) => ({ value: entry.id, label: entry.name }))} hint={patient && offered.length === 0 ? `No active service is offered at ${patient.branch}.` : undefined} />
              </div>
              <TextInput label="Quantity" required type="number" min="1" value={values.qty} onChange={(event) => set('qty', event.target.value)} error={errors.qty} disabled={readOnly} />
              <TextInput label="Unit price (INR)" required readOnly disabled value={readOnly ? money(line.price) : price > 0 ? money(price) : '—  Not configured'} hint="From the permitted branch price list; no manual override." />
              <OptionSelect label="Discount" value={values.discountPct} onChange={(event) => set('discountPct', event.target.value)} disabled={readOnly} options={DISCOUNTS.map(([value, label]) => ({ value, label }))} hint="Any permitted discount cannot exceed subtotal." />
              <TextInput label="Configured tax" required readOnly disabled value={readOnly ? (line.gstPct ? `GST ${line.gstPct}%` : 'Exempt') : service && service.tax !== 'Not configured' ? (service.gstRate ? `${service.tax} · GST ${service.gstRate}%` : service.tax) : '—  Not configured'} hint={issues.includes('Tax treatment missing') ? 'Tax applicability and rate are not verified.' : undefined} />
            </div>
            {issues.length > 0 && service && <Banner tone="warning" title={issues.join(' · ')} className="mt-4">Select a configured service or ask an authorized administrator. Do not substitute invoice or payment amounts.</Banner>}
          </Section>

          <Section title="Internal note" aside="Optional · Not an invoice note">
            <TextArea label="Note" rows={3} value={values.note} disabled={readOnly} onChange={(event) => set('note', event.target.value)} hint="Draft edits are attributable to your user. Finalization preserves the reviewed values." />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Financial breakdown">
            <p className="mb-4 text-xs text-outline">INR (₹) · 1 service / item</p>
            <dl className="space-y-3 text-xs">
              {[['Quantity', values.qty || '—'], ['Unit price', breakdown ? money(readOnly ? line.price : price) : '—'], ['Subtotal', breakdown ? money(breakdown.gross) : '—'], ['Discount', breakdown ? (breakdown.discount ? `− ${money(breakdown.discount)}` : 'None selected') : 'None selected'], ['Taxable basis', breakdown ? money(breakdown.taxableBase) : '—'], ['Configured tax', breakdown ? money(breakdown.tax) : '—']].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between"><dt className="text-on-surface-variant">{label}</dt><dd className="text-[13px] font-medium">{value}</dd></div>
              ))}
            </dl>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="flex items-center justify-between font-semibold"><span className="text-sm">Final total</span><span className="text-2xl">{breakdown ? money(breakdown.total) : '—'}</span></p>
              {!breakdown && <StatusPill tone="warning" className="mt-3">Total unavailable</StatusPill>}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-outline">Subtotal = quantity × configured unit price. Final total = subtotal − permitted discount + configured tax. Missing setup is not treated as zero or tax-exempt.</p>
          </Section>

          <Section title="Review before confirming">
            <ul className="space-y-4">
              {checks.map(([title, detail, ok]) => (
                <li key={title} className="flex gap-2.5 text-xs"><span className={cn('font-semibold', ok ? 'text-brand' : 'text-amber-700')} aria-hidden="true">{ok ? '✓' : '○'}</span><span><strong className="block">{title}</strong><span className="text-outline">{detail}</span></span></li>
              ))}
            </ul>
            <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
              <Check checked={values.reviewed} disabled={readOnly || issues.length > 0 || !service} onChange={(event) => set('reviewed', event.target.checked)} label={`I have reviewed the complete charge.${issues.length ? ' Available after setup is resolved.' : ''}`} />
            </div>
          </Section>

          <div className="rounded-md bg-teal-50 p-5 text-xs leading-6 text-on-surface-variant">
            <p className="text-[13px] font-semibold text-brand">A charge is not a payment</p>
            Confirm records the amount owed only. Invoice creation, collection, receipts and allocation are separate workflows.
            <p className="mt-2 text-[11px] text-outline">Invoiced portions are locked. Only verified remaining eligible balances can enter an invoice; duplicate portions are blocked.</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{readOnly ? 'Finalized charges are read-only' : 'Save your progress without confirming'}</strong>{readOnly ? 'Corrections use a separate, auditable record.' : 'Save Draft keeps the missing configuration visible and returns to the register.'}</p>
          <ActionButton onClick={leave}>{readOnly ? 'Back' : 'Cancel'}</ActionButton>
          {!readOnly && <ActionButton variant="primary" disabled={saving} onClick={() => save(false)}>Save Draft</ActionButton>}
          {!readOnly && <ActionButton variant="brand" disabled={!ready || saving} onClick={() => save(true)}>Confirm Charge</ActionButton>}
        </div>
        {serverError && <p role="alert" className="mt-3 text-xs text-rose-600">{serverError}</p>}
        {!readOnly && !ready && <p className="mt-3 text-[11px] text-amber-700">Confirm Charge is unavailable until price, tax treatment and financial review are complete. A saved draft is not a finalized charge.</p>}
      </div>

      {leaving && (
        <Banner tone="warning" title="Leave with unsaved changes?" className="mb-6" action={<div className="flex flex-col items-start gap-2"><div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="primary" onClick={() => save(false)}>Save draft & return</ActionButton></div><Link to={registerPath} className="text-xs text-danger hover:underline">Discard unsaved changes & return</Link></div>}>
          Keep editing, save the draft and return, or explicitly discard only unsaved edits. Register filters and selection are retained.
        </Banner>
      )}

      <GovernanceFooter>Charge ≠ Invoice ≠ Payment ≠ Receipt ≠ Allocation ≠ Refund. Branch access and authorization are checked on save. Finalized records are read-only; corrections require a permitted, auditable workflow.</GovernanceFooter>
    </BillingFrame>
  )
}
