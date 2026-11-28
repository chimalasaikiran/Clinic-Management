import { useState } from 'react'
import { AlertTriangle, Circle, CheckCircle2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { useDraft } from '../../../lib/useDraft'
import { FieldError, OptionSelect } from '../../patients/components/parts'
import { useBilling } from '../context/useBilling'
import { formatINR, localToday } from '../../patients/format'
import PatientPicker from '../components/PatientPicker'
import { usePickedPatient } from '../patientChoice'
import { addDays } from '../../appointments/logic'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { BILLING_MODELS } from '../constants'
import { draftTotals, eligibleCharges, invoiceRequest, PAYERS, validateInvoiceDraft } from '../invoiceLogic'

const STEPS = [['Draft', 'Select recipient and eligible charges'], ['Review', 'Validate source, pricing and totals'], ['Issue / finalize', 'Locks financial fields']]

export default function CreateInvoicePage() {
  const { records, createInvoice } = useBilling()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draft = useDraft('invoice-draft', { patientId: params.get('patient') ?? '', payer: '', date: localToday(), dueDate: addDays(localToday(), 7), model: '', discount: '', chargeIds: [] })
  const values = draft.value
  const [step, setStep] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [query, setQuery] = useState('')
  const patient = usePickedPatient(values.patientId)
  const [issuing, setIssuing] = useState(false)
  const [serverError, setServerError] = useState('')
  const charges = values.patientId ? eligibleCharges(records.charges, values.patientId) : []
  const shown = charges.filter((charge) => `${charge.id} ${charge.title}`.toLowerCase().includes(query.trim().toLowerCase()))
  const errors = attempted ? validateInvoiceDraft(values, { review: step > 0 || attempted === 'review' }) : {}
  const totals = draftTotals(charges, values.chargeIds, values.discount)
  const invoiced = patient ? records.charges.filter((charge) => charge.patientId === patient.id && charge.status !== 'Unbilled') : []
  const set = (name, value) => draft.setValue((current) => ({ ...current, [name]: value }))
  const toggle = (id) => set('chargeIds', values.chargeIds.includes(id) ? values.chargeIds.filter((entry) => entry !== id) : [...values.chargeIds, id])
  const readiness = [
    ['Recipient and invoice dates', Boolean(values.patientId && values.payer && values.date && values.dueDate)],
    ['Verified, eligible charges selected', values.chargeIds.length > 0],
    ['Billing model chosen', Boolean(values.model)],
    ['Discount within policy (0–100%)', !validateInvoiceDraft(values).discount],
  ]
  const ready = readiness.every(([, ok]) => ok)

  const review = () => {
    setAttempted('review')
    if (Object.keys(validateInvoiceDraft(values, { review: true })).length) return
    setStep(1)
  }

  const issue = async () => {
    setIssuing(true)
    setServerError('')
    try {
      const invoice = await createInvoice(invoiceRequest(values, charges))
      draft.clear()
      navigate(pathFor(ROUTES.billingInvoice, { invoiceId: invoice.reference }))
    } catch (error) {
      setServerError(error.message)
      setIssuing(false)
    }
  }

  return (
    <BillingFrame back={{ to: ROUTES.billingInvoices, label: 'Invoice Register' }} crumb="Billing & Finance / Invoices / New invoice" code="Billing & Finance" title="Create / Review Invoice" badge={<span className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-normal text-on-surface-variant">{draft.savedAt ? `Draft saved ${draft.savedAt}` : 'Draft · not saved'}</span>} description="Build an invoice only from verified, eligible charges. A draft is not an issued invoice." scope={false}>
      <ol className="mb-5 grid overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-3">
        {STEPS.map(([title, hint], index) => <li key={title} aria-current={index === step ? 'step' : undefined} className={cn('border-b-2 px-5 py-3 text-xs', index === step ? 'border-brand' : 'border-transparent text-outline')}><strong className="block text-[13px] text-on-surface">{index + 1} {title}</strong>{hint}</li>)}
      </ol>

      {draft.restored && <p className="mb-4 text-xs text-on-surface-variant">Restored from your saved draft.</p>}
      {values.patientId && charges.length === 0 && <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" /><div><p className="text-[13px] font-semibold">No verified eligible charges</p><p className="text-on-surface-variant">{patient?.name} has no unbilled charges. Charges that were already invoiced are listed below and cannot be invoiced again.</p></div></div>}

      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card title="Recipient & invoice dates" aside="New invoice · no number assigned">
            <div className="grid gap-4 sm:grid-cols-2">
              <PatientPicker label="Patient context" placeholder="Select the patient" value={values.patientId} onChange={(id) => draft.setValue((current) => ({ ...current, patientId: id, chargeIds: [] }))} error={errors.patientId} />
              <OptionSelect label="Invoice recipient / payer" required placeholder="Select recipient" value={values.payer} onChange={(event) => set('payer', event.target.value)} error={errors.payer} options={PAYERS.map((entry) => ({ value: entry, label: entry }))} />
              <TextInput label="Branch" readOnly value={patient?.branch ?? ''} />
              <span />
              <TextInput label="Invoice date · IST" required type="date" value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} />
              <TextInput label="Due date" required type="date" value={values.dueDate} onChange={(event) => set('dueDate', event.target.value)} error={errors.dueDate} />
            </div>
          </Card>

          <Card title="Eligible charge selection" aside={`${values.chargeIds.length} selected`}>
            <TextInput label="Find charges" placeholder="Search charge or source record…" value={query} onChange={(event) => setQuery(event.target.value)} />
            {!values.patientId ? <p className="mt-4 rounded-md bg-surface-lowest p-6 text-center text-sm text-on-surface-variant">Choose a patient to load their unbilled charges.</p> : (
              <ul className="mt-4 flex flex-col gap-2">
                {shown.map((charge) => (
                  <li key={charge.id}><label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3 text-xs', values.chargeIds.includes(charge.id) ? 'border-brand bg-teal-50/60' : 'border-slate-200')}>
                    <input type="checkbox" aria-label={`${charge.id} ${charge.title}`} checked={values.chargeIds.includes(charge.id)} onChange={() => toggle(charge.id)} className="mt-0.5 accent-[#006a61]" />
                    <span className="flex-1"><strong className="text-[13px]">{charge.title}</strong><br /><span className="font-mono text-outline">{charge.id}</span> · {charge.reference}</span>
                    <span className="font-semibold">{formatINR(draftTotals([charge], [charge.id], 0).total, 2)}</span>
                  </label></li>
                ))}
              </ul>
            )}
            <FieldError>{errors.charges}</FieldError>
          </Card>

          {invoiced.length > 0 && (
            <Card title="Excluded source references" aside="Not selectable">
              <ul className="flex flex-col gap-2 text-xs">{invoiced.map((charge) => <li key={charge.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3"><span><strong className="font-mono">{charge.id}</strong><br /><span className="text-on-surface-variant">{charge.title}</span></span><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium">Already invoiced · {charge.invoiceId}</span></li>)}</ul>
            </Card>
          )}

          {step === 1 && (
            <Card title="Linked invoice line items" aside={`${values.chargeIds.length} charge${values.chargeIds.length === 1 ? '' : 's'}`}>
              <table className="w-full text-left text-xs"><thead className="text-[10px] font-semibold tracking-wide text-outline uppercase"><tr><th className="py-2">Charge / service</th><th>Qty</th><th>Unit price</th><th className="text-right">Amount</th></tr></thead><tbody>
                {charges.filter((charge) => values.chargeIds.includes(charge.id)).flatMap((charge) => charge.lines.map((line) => <tr key={`${charge.id}-${line.code}`} className="border-t border-slate-100"><td className="py-2">{line.name}<br /><span className="font-mono text-outline">{charge.id}</span></td><td>{line.qty}</td><td>{formatINR(line.price, 2)}</td><td className="text-right font-semibold">{formatINR(line.qty * line.price, 2)}</td></tr>))}
              </tbody></table>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5 self-start">
          <Card title="Invoice summary" aside="INR (₹)">
            <OptionSelect label="Billing model" required placeholder="Select model" value={values.model} onChange={(event) => set('model', event.target.value)} error={errors.model} hint="No model is inferred. Immediate billing, grouped charges or a mixed workflow needs an explicit choice." options={BILLING_MODELS.map((entry) => ({ value: entry, label: entry }))} />
            <div className="mt-4"><TextInput label="Invoice discount (%)" inputMode="decimal" value={values.discount} onChange={(event) => set('discount', event.target.value)} error={errors.discount} hint="Apply only an authorized discount policy." /></div>
            <dl className="mt-4 flex flex-col gap-2 text-xs"><div className="flex justify-between"><dt className="text-outline">Subtotal</dt><dd>{values.chargeIds.length ? formatINR(totals.gross, 2) : '—'}</dd></div><div className="flex justify-between"><dt className="text-outline">Discounts</dt><dd>{values.chargeIds.length ? formatINR(totals.discount, 2) : '—'}</dd></div><div className="flex justify-between"><dt className="text-outline">Tax</dt><dd>{values.chargeIds.length ? formatINR(totals.tax, 2) : '—'}</dd></div><div className="flex items-baseline justify-between border-t border-slate-200 pt-3"><dt className="text-sm font-semibold">Final total</dt><dd className="text-2xl font-semibold">{values.chargeIds.length ? formatINR(totals.total, 2) : '—'}</dd></div></dl>
          </Card>
          <Card title="Review readiness" aside={ready ? 'Ready' : 'Blocked'}>
            <ul className="flex flex-col gap-2 text-xs">{readiness.map(([label, ok]) => <li key={label} className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" /> : <Circle className="size-3.5 text-amber-600" aria-hidden="true" />}{label}</li>)}</ul>
          </Card>
          <Note tone="brand" title="Issue is a separate decision">Saving a draft does not issue an invoice. Review checks the totals; issuing locks the financial fields and corrections then need a separate governed record.</Note>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs"><strong>{step === 1 ? 'Review complete — ready to issue' : 'Draft can retain unresolved context'}</strong><br /><span className="text-outline">{step === 1 ? 'Issuing creates the invoice and marks the selected charges as invoiced.' : 'Issue is blocked until the required checks pass.'}</span></p>
        <div className="flex items-center gap-2">
          <ActionButton onClick={() => { draft.clear(); navigate(ROUTES.billingInvoices) }}>Cancel</ActionButton>
          <ActionButton onClick={() => draft.setValue((current) => ({ ...current }))}>Save draft</ActionButton>
          {step === 0 ? <ActionButton variant="primary" onClick={review}>Review invoice</ActionButton> : <><ActionButton onClick={() => setStep(0)}>Back to draft</ActionButton><ActionButton variant="primary" onClick={issue} disabled={!ready || issuing}>Issue / finalize</ActionButton></>}
        </div>
        {serverError && <p role="alert" className="w-full text-xs text-rose-600">{serverError}</p>}
      </div>
    </BillingFrame>
  )
}
