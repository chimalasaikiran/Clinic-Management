import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { invoiceBalance, invoiceTotal } from '../../patients/billing'
import { TextArea } from '../../patients/components/parts'
import { useBilling } from '../context/useBilling'
import { formatDate, localToday } from '../../patients/format'
import PatientPicker from '../components/PatientPicker'
import { usePickedPatient } from '../patientChoice'
import { PAYMENT_CHANNELS } from '../constants'
import BillingFrame from '../components/BillingFrame'
import { GovernanceFooter, KeyValue, Scope, Section, Steps } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { validatePayment } from '../financeLogic'
import { PAYERS } from '../invoiceLogic'

const METHODS = PAYMENT_CHANNELS.map((entry) => [entry.label, entry.channel, entry.hint, entry.group])
const PURPOSES = [['charges', 'Pay against charges'], ['advance', 'Advance / on account']]

export default function RecordPaymentPage() {
  const { records, config, scopeText, recordPayment } = useBilling()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ patientId: params.get('patient') ?? '', payer: PAYERS[0], purpose: 'charges', amount: '', channel: '', reference: '', note: '' })
  const [step, setStep] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  // Methods switched off in the billing configuration are not offered.
  const methods = METHODS.filter(([, , , group]) => config.methods[group])

  const patient = usePickedPatient(values.patientId)
  const open = patient ? records.invoices.filter((invoice) => invoice.patientId === patient.id && invoiceBalance(invoice, records.payments) > 0) : []
  const invoice = values.purpose === 'charges' ? open[0] : null
  const outstanding = invoice ? invoiceBalance(invoice, records.payments) : 0
  const method = methods.find(([, channel]) => channel === values.channel)
  const check = { ...values, invoiceId: invoice?.id, outstanding, fullPayment: config.partial === 'Require full payment' }
  const errors = attempted ? validatePayment(check) : {}
  const valid = Object.keys(validatePayment(check)).length === 0
  const registerPath = `${ROUTES.billingPayments}${state?.search ?? ''}`
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  // A collection against charges is applied to the patient's oldest open invoice; an advance stays unallocated.
  const confirm = async () => {
    setSaving(true)
    setServerError('')
    const amount = Number(values.amount)
    try {
      const payment = await recordPayment({
        patientId: values.patientId, amount, channel: values.channel, payer: values.payer, purpose: invoice ? 'charges' : 'advance', txnReference: values.reference.trim() || null, narration: values.note.trim(),
        allocations: invoice ? [{ invoiceId: invoice.uuid, amount: Math.min(amount, outstanding) }] : [],
      })
      navigate(pathFor(ROUTES.billingPayment, { paymentId: payment.reference }), { state })
    } catch (error) {
      setServerError(error.message)
      setSaving(false)
    }
  }

  const review = () => {
    setAttempted(true)
    if (valid) setStep(1)
  }

  return (
    <BillingFrame back={{ to: registerPath, label: 'Payment Register · filtered view' }} crumb="Billing & Finance / Payments / New payment" code="BF-10 / Payments & receipts" title="Record / Collect Payment" badge={<StatusPill>Unsaved payment</StatusPill>} description="Prepare a new collection. Review and validate before confirming; no payment has been recorded." scope={false}>
      <Scope left={scopeText} />
      <Steps steps={['Enter payment', 'Review & validate', 'Confirm → Payment Details']} current={step} />

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_450px]">
        <div className="space-y-6">
          <Section title="Patient, payer & purpose">
            <div className="grid gap-4 sm:grid-cols-2">
              <PatientPicker value={values.patientId} onChange={(id) => set('patientId', id)} error={errors.patientId} disabled={step === 1} />
              <SelectInput label="Payer" required value={values.payer} onChange={(event) => set('payer', event.target.value)} options={PAYERS} disabled={step === 1} />
              <div className="sm:col-span-2"><TextInput label="Receiving branch" required readOnly disabled value={patient?.branch ?? 'Select a patient'} /></div>
            </div>
            <div role="radiogroup" aria-label="Purpose" className="mt-4 flex flex-wrap gap-3">
              {PURPOSES.map(([id, label]) => (
                <label key={id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-[13px] font-semibold text-brand', values.purpose === id ? 'border-brand bg-teal-50' : 'border-slate-300 bg-white')}>
                  <input type="radio" name="purpose" value={id} checked={values.purpose === id} disabled={step === 1} onChange={() => set('purpose', id)} className="accent-[#006a61]" />{label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-outline">Advance: no charge selection required. Funds are initially unallocated and do not reduce invoice due.</p>
            {values.purpose === 'charges' && invoice && (
              <div className="mt-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs">
                <p className="flex items-center justify-between"><strong className="text-[13px] text-brand">{invoice.id}</strong><StatusPill tone="warning">Balance due</StatusPill></p>
                <p className="mt-3 text-[13px]">{invoice.title} · Invoice {money(invoiceTotal(invoice))}</p>
                <p className="mt-2 text-[13px] font-semibold">Outstanding: {money(outstanding)} · {config.partial === 'Require full payment' ? 'Full payment required by the billing configuration' : 'Partial payment supported'}</p>
                <p className="mt-2 text-outline">On confirmation the payment is applied to this invoice, up to its outstanding balance. Any remainder stays as unallocated credit.</p>
              </div>
            )}
            {values.purpose === 'charges' && patient && !invoice && <p className="mt-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs text-outline">{patient.name} has no invoice with a balance due. Record this collection as an advance instead.</p>}
          </Section>

          <Section title="Collection details" aside="Required fields are marked *. Choose one payment method for this entry.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Amount (INR)" required inputMode="decimal" prefix="₹" placeholder="Enter amount" value={values.amount} onChange={(event) => set('amount', event.target.value.replace(/[^\d.]/g, ''))} error={errors.amount} disabled={step === 1} hint="Required · Must be greater than ₹0; partial payments allowed." />
              <TextInput label="Payment date" required readOnly disabled value={formatDate(localToday())} hint="IST · New, unsaved collection" />
            </div>
            <fieldset className="mt-4" disabled={step === 1}>
              <legend className="text-xs font-medium text-on-surface-variant">Payment method *</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {methods.map(([label, channel]) => (
                  <label key={channel} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold text-brand', values.channel === channel ? 'border-brand bg-teal-50' : 'border-slate-300 bg-white')}>
                    <input type="radio" name="method" value={channel} checked={values.channel === channel} onChange={() => set('channel', channel)} className="accent-[#006a61]" />{label}
                  </label>
                ))}
              </div>
              {errors.channel && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.channel}</p>}
            </fieldset>
            <div className="mt-4 space-y-4">
              <TextInput label="Transaction reference" value={values.reference} onChange={(event) => set('reference', event.target.value)} placeholder={method ? method[2] : 'Select a method to set reference requirements'} error={errors.reference} disabled={step === 1} hint="Never enter full card details." />
              <TextArea label="Notes (optional)" rows={2} value={values.note} onChange={(event) => set('note', event.target.value)} placeholder="Add collection context or payer instructions" disabled={step === 1} hint="Methods are alternatives, not a split collection. If paid by multiple methods, record a separate payment per method with its own amount and reference." />
            </div>
          </Section>
        </div>

        <Section title="Review before confirmation" aside="">
          <p className="-mt-3 mb-5 text-xs text-outline">New payment · No finalized ID assigned</p>
          <dl className="space-y-4 text-xs">
            <KeyValue label="Patient / payer">{patient ? `${patient.name} / ${values.payer}` : 'Not selected'}</KeyValue>
            <KeyValue label="Purpose" hint={values.purpose === 'charges' ? (invoice ? `Against ${invoice.id}` : 'No eligible charges selected') : 'Held as an unallocated advance'}>{PURPOSES.find(([id]) => id === values.purpose)[1]}</KeyValue>
            <KeyValue label="Amount to collect" hint={values.amount ? undefined : 'Enter amount to calculate the collection'}>{values.amount ? money(Number(values.amount)) : '—'}</KeyValue>
            <KeyValue label="Method / reference">{method ? `${method[0]} / ${values.reference.trim() || 'No reference'}` : 'Not selected / Not entered'}</KeyValue>
          </dl>
          {!valid ? (
            <div role="note" className="mt-5 flex gap-3 rounded-md bg-amber-50 p-4 text-xs leading-5 text-on-surface-variant"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" /><div><p className="text-[13px] font-semibold text-on-surface">Not ready for review</p>Enter an amount and payment method. Verify eligible charges before collecting against charges, or explicitly select Advance.</div></div>
          ) : (
            <p className="mt-5 rounded-md bg-teal-50 p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-brand">Ready for review</strong>Required fields are complete. Confirm to record the payment; allocation and receipt are separate records.</p>
          )}
          <p className="mt-5 text-xs font-semibold">Validation at review</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-on-surface-variant"><li>Required fields and positive amount</li><li>Charge eligibility and outstanding limit</li><li>Method-specific reference validation</li><li>Duplicate transaction reference check</li><li>Explicit confirmation before recording</li></ul>
          <ActionButton variant="soft" className="mt-5" disabled={step === 1 || !valid} onClick={review}>Review payment</ActionButton>
          <p className="mt-3 text-[11px] leading-4 text-outline">After successful confirmation, open Payment Details. No success or collection is simulated here.</p>
        </Section>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline">{step === 1 ? invoice ? `Review complete · Confirm records this payment and applies it to ${invoice.id}.` : 'Review complete · Confirm records this payment as an unallocated advance.' : 'Unsaved changes · Cancel discards this entry and returns to the filtered Payment Register. Existing records stay unchanged.'}</p>
        <ActionButton onClick={() => (step === 1 ? setStep(0) : navigate(registerPath))}>{step === 1 ? 'Back to edit' : 'Cancel'}</ActionButton>
        {step === 1 ? <ActionButton variant="primary" disabled={saving} onClick={confirm}>Confirm payment</ActionButton> : <ActionButton variant="soft" disabled={!valid} onClick={review}>Review payment</ActionButton>}
        {serverError && <p role="alert" className="w-full text-xs text-rose-600">{serverError}</p>}
      </div>
      <GovernanceFooter code="BF-10">Payment ≠ Allocation ≠ Receipt. Recording a payment does not automatically finalize a receipt or apply unverified funds.</GovernanceFooter>
    </BillingFrame>
  )
}
