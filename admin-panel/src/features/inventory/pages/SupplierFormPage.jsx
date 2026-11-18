import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check, OptionSelect, TextArea } from '../../patients/components/parts'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { Section } from '../components/shared'
import { PAYMENT_TERMS, SUPPLIER_CATEGORIES } from '../constants'
import { useStock } from '../context/useStock'
import { validateDeactivation, validateSupplier } from '../validation'

const BLANK = { name: '', code: '', contact: '', email: '', phone: '', categories: [], address: '', city: '', state: '', postal: '', country: '', gstin: '', registration: '', terms: '', active: true, notes: '' }
const COUNTRIES = ['India', 'United Arab Emirates', 'Singapore', 'United States']

// One form for adding and editing a shared supplier record; editing also exposes deactivation.
export default function SupplierFormPage() {
  const { supplierId } = useParams()
  const { state, run } = useStock()
  const navigate = useNavigate()
  const editing = state.suppliers.find((row) => row.id === supplierId)
  const [values, setValues] = useState(() => (editing ? { ...BLANK, ...editing } : BLANK))
  const [submitted, setSubmitted] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonSubmitted, setReasonSubmitted] = useState(false)
  if (supplierId && !editing) return <MissingRecord what="supplier" backTo={ROUTES.suppliers} backLabel="Back to suppliers" />

  const errors = submitted ? validateSupplier(values, state.suppliers, editing?.id) : {}
  const reasonErrors = reasonSubmitted ? validateDeactivation({ reason }) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)
  const toggleCategory = (category) => set('categories', values.categories.includes(category) ? values.categories.filter((entry) => entry !== category) : [...values.categories, category])
  const detail = editing ? pathFor(ROUTES.supplier, { supplierId: editing.id }) : ROUTES.suppliers
  const hasTransactions = editing && (state.orders.some((order) => order.supplierId === editing.id) || state.receipts.some((receipt) => receipt.supplierId === editing.id))

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(validateSupplier(values, state.suppliers, editing?.id)).length) return
    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
    const outcome = await run('supplier/save', { ...trimmed, gstin: trimmed.gstin.toUpperCase(), id: editing?.id })
    if (outcome.error) return
    navigate(pathFor(ROUTES.supplier, { supplierId: outcome.id }))
  }

  const deactivate = async () => {
    setReasonSubmitted(true)
    if (Object.keys(validateDeactivation({ reason })).length) return
    const outcome = await run('supplier/active', { id: editing.id, active: false, reason: reason.trim() })
    if (outcome.error) return
    navigate(detail)
  }

  return (
    <DetailFrame
      crumbs={editing ? [{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Suppliers', to: ROUTES.suppliers }, { label: editing.name, to: detail }, { label: 'Edit' }] : [{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Suppliers', to: ROUTES.suppliers }, { label: 'Add Supplier' }]}
      title={editing ? 'Edit Supplier' : 'Add Supplier'}
      subtitle={editing ? `Update ${editing.name}’s shared supplier record. Changes are recorded in the audit history.` : 'Create a shared supplier record for use across inventory and purchasing.'}
    >
      <InfoNote tone="brand" className="mb-5">
        <p className="text-sm font-semibold text-on-surface">{editing ? 'Existing transactions stay unchanged' : 'Check before creating a new record'}</p>
        <p className="mt-1">{editing ? 'Updates apply to this supplier record. Existing purchase orders, receipts, returns and payments are not automatically modified.' : 'Search the supplier directory first. Duplicate names and codes are checked on save; reuse a matching supplier rather than creating another record.'}</p>
      </InfoNote>

      <div className="flex flex-col gap-5">
        <Section title="Supplier information" aside="* Required fields">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Supplier name" name="name" required placeholder="Enter supplier name" value={values.name} onChange={update} error={errors.name} />
            <TextInput label="Supplier code (optional)" name="code" placeholder="Enter code, if used" value={values.code} onChange={update} error={errors.code} hint="Use a unique code only if configured for your organisation." />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Contact person (optional)" name="contact" placeholder="Full name" value={values.contact} onChange={update} />
            <TextInput label="Email (optional)" name="email" type="email" placeholder="name@company.com" value={values.email} onChange={update} error={errors.email} hint="Use a valid email address when provided." />
            <TextInput label="Phone (optional)" name="phone" placeholder="+91 80 5550 0100" value={values.phone} onChange={update} error={errors.phone} hint="Include country code when applicable." />
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-[13px] font-semibold text-slate-800">Supported categories (optional)</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">{SUPPLIER_CATEGORIES.map((category) => <Check key={category} checked={values.categories.includes(category)} onChange={() => toggleCategory(category)} label={category} />)}</div>
          </fieldset>
        </Section>

        <Section title="Address" aside="Optional">
          <TextInput label="Address line" name="address" placeholder="Street, building or area" value={values.address} onChange={update} />
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <TextInput label="City" name="city" placeholder="Enter city" value={values.city} onChange={update} />
            <TextInput label="State / region" name="state" placeholder="Enter state or region" value={values.state} onChange={update} />
            <TextInput label="Postal code" name="postal" placeholder="Enter postal code" value={values.postal} onChange={update} error={errors.postal} />
            <OptionSelect label="Country" placeholder="Select country" value={values.country} onChange={(event) => set('country', event.target.value)} options={COUNTRIES.map((country) => ({ value: country, label: country }))} />
          </div>
        </Section>

        <Section title="Business and payment information" aside="Optional unless required by configuration">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Tax identifier / GSTIN (if applicable)" name="gstin" placeholder="Enter applicable tax identifier" value={values.gstin} onChange={update} error={errors.gstin} hint="Validated for the selected identifier type and country." />
            <TextInput label="Business registration identifier (if applicable)" name="registration" placeholder="Enter business registration identifier" value={values.registration} onChange={update} hint="Provide only identifiers applicable to this supplier." />
            <OptionSelect label="Payment terms" placeholder="Select configured payment terms" value={values.terms} onChange={(event) => set('terms', event.target.value)} options={PAYMENT_TERMS.map((term) => ({ value: term, label: term }))} hint="Choose from your organisation’s configured terms." />
            <div><p className="mb-1.5 text-[13px] font-semibold">Active status</p><Check checked={values.active} onChange={(event) => set('active', event.target.checked)} label="Active · available for new purchase orders" /><p className="mt-1 text-[11px] text-outline">{editing ? 'To make inactive, review Deactivate Supplier below.' : 'Inactive records remain searchable but cannot be used for new orders.'}</p></div>
          </div>
        </Section>

        <Section title="Internal notes" aside="Optional">
          <TextArea label="Notes" name="notes" rows={3} placeholder="Add internal supplier notes…" value={values.notes} onChange={update} hint="For your team only. Do not include sensitive payment credentials." />
        </Section>

        {editing && editing.active && (
          <Section title="Supplier lifecycle">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">Keep the record. Stop using it for new orders.</p><p className="text-xs text-on-surface-variant">{hasTransactions ? 'This supplier has linked transactions and cannot be deleted. ' : ''}Deactivation requires confirmation and a reason.</p></div>
              {!deactivating && <ActionButton onClick={() => setDeactivating(true)}>Deactivate Supplier</ActionButton>}
            </div>
            {deactivating && (
              <div className="mt-4 max-w-lg">
                <TextArea label="Reason for deactivating" required rows={2} value={reason} onChange={(event) => setReason(event.target.value)} error={reasonErrors.reason} />
                <div className="mt-3 flex gap-2"><ActionButton variant="danger" onClick={deactivate}>Confirm deactivation</ActionButton><ActionButton onClick={() => setDeactivating(false)}>Keep active</ActionButton></div>
              </div>
            )}
          </Section>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs text-on-surface-variant">{editing ? 'Saved changes include who changed what and when.' : 'Supplier name is required. Other requirements follow existing configuration.'}</p>
        <div className="flex items-center gap-2"><ActionButton to={detail}>Cancel</ActionButton><ActionButton variant="brand" onClick={save}>{editing ? 'Save changes' : 'Save Supplier'}</ActionButton></div>
      </div>
    </DetailFrame>
  )
}
