import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import { MissingRecord } from '../../inventory/components/DetailFrame'
import { pathFor, ROUTES } from '../../../config/routes'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import { formatINR } from '../../patients/format'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { toServiceRequest } from '../adapters'
import { useDepartmentNames } from '../../configuration/useDepartments'
import { SERVICE_CATEGORIES, TAX_CONFIGS, TAX_TREATMENTS } from '../constants'
import { useBilling } from '../context/useBilling'
import { blankService, buildService, effectivePrice, formFromService, validateService } from '../serviceLogic'

// One form for adding and editing a catalogue service. Nothing is saved until Save succeeds.
export default function ServiceFormPage() {
  const { serviceId } = useParams()
  const { services, saveService, branches: allBranches } = useBilling()
  // Inactive branches are listed only where a service is already offered there.
  const BRANCHES = allBranches.filter((branch) => branch.active || services.find((entry) => entry.id === serviceId)?.branches[branch.id])
  const navigate = useNavigate()
  const editing = services.find((entry) => entry.id === serviceId)
  const departments = useDepartmentNames(editing?.department).names
  const [values, setValues] = useState(() => (editing ? formFromService(editing, BRANCHES) : blankService(BRANCHES)))
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  if (serviceId && !editing) return <MissingRecord what="service" backTo={ROUTES.billingServices} backLabel="Back to Services & Pricing" />

  const errors = submitted ? validateService(values, services, editing?.id, BRANCHES) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const setBranch = (id, change) => setValues((current) => ({ ...current, branches: { ...current.branches, [id]: { ...current.branches[id], ...change } } }))
  const back = editing ? pathFor(ROUTES.billingService, { serviceId: editing.id }) : ROUTES.billingServices
  const draft = Number(values.price)
  const preview = (id) => { const entry = values.branches[id]; return !entry.offered ? '—' : entry.mode === 'custom' ? (entry.price === '' ? '—' : formatINR(Number(entry.price))) : formatINR(draft || 0) }

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(validateService(values, services, editing?.id, BRANCHES)).length) return
    const built = buildService(values, BRANCHES)
    setSaving(true)
    setServerError('')
    try {
      await saveService(toServiceRequest(built), editing ? { id: editing.id, version: editing.version } : {})
      navigate(editing ? back : ROUTES.billingServices, { state: { saved: built.code } })
    } catch (error) {
      setServerError(error.message)
      setSaving(false)
    }
  }

  return (
    <BillingFrame back={{ to: back, label: editing ? 'Back to Services & Pricing' : 'Back to Services & Pricing' }} crumb="Owner Panel / Billing & Finance / Services & Pricing" code={editing ? `Edit · ${editing.code}` : 'New service · unsaved'} title={editing ? 'Edit Service' : 'Add Service'} description={editing ? `${editing.name} · ${editing.code}. Review changes before saving; the original record is unchanged until you save.` : 'Create a service definition for your organisation. Required fields are marked *; department and branch price overrides are optional.'}>
      <div className="flex flex-col gap-5">
        <Card title="Service information" aside="A service is not a Charge, Invoice, Payment or Receipt.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Service name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} hint="Use a clear name for clinical and billing teams." placeholder="Enter service name" />
            <TextInput label="Unique service code" required value={values.code} onChange={(event) => set('code', event.target.value)} error={errors.code} hint="Must be unique across your organisation; checked again on save." placeholder="e.g. SRV-CARD-NEW" />
            <OptionSelect label="Category" required placeholder="Select category" value={values.category} onChange={(event) => set('category', event.target.value)} error={errors.category} options={SERVICE_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} />
            <OptionSelect label="Department / specialty (optional)" placeholder="Unassigned" value={values.department} onChange={(event) => set('department', event.target.value)} hint="From Configuration › Departments. Leave unassigned if your organization does not use departments." options={departments.map((entry) => ({ value: entry, label: entry }))} />
          </div>
          <div className="mt-4">
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={values.patientBookable} onChange={(event) => set('patientBookable', event.target.checked)} className="mt-0.5 accent-[#006a61]" />
              <span><strong>Patients can book this in the patient app</strong><br /><span className="text-outline">Needs a department. Therapists in it who accept app bookings take these visits, at locations listed in the app. The branch price is shown to patients.</span></span>
            </label>
            {values.patientBookable && !values.department && <p role="alert" className="mt-1 text-xs text-rose-600">Choose a department for a service patients can book.</p>}
          </div>
          <div className="mt-4"><TextArea label="Description (optional)" rows={3} value={values.description} onChange={(event) => set('description', event.target.value)} /></div>
          <fieldset className="mt-4 flex flex-wrap items-center gap-5 text-xs"><legend className="sr-only">Service status</legend><span className="font-semibold">Service status</span>{['Active', 'Inactive'].map((status) => <label key={status} className="flex items-center gap-1.5"><input type="radio" name="status" value={status} checked={values.status === status} onChange={() => set('status', status)} className="accent-[#006a61]" />{status}</label>)}<span className="text-outline">{values.status === 'Inactive' ? 'Inactive drafts are not selectable for new records.' : 'Active services need a tax decision and a location.'}</span></fieldset>
        </Card>

        <Card title="Default pricing & tax" aside="Prices are in INR. Zero is allowed only as an explicit free service.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Default price (INR)" required inputMode="decimal" prefix="₹" value={values.price} onChange={(event) => set('price', event.target.value)} error={errors.price} hint="Enter 0 for a free service; a default price is required." />
            <OptionSelect label="Tax treatment" value={values.tax} onChange={(event) => setValues((current) => ({ ...current, tax: event.target.value, taxConfig: '' }))} error={errors.tax} hint="Exempt is distinct from no tax. Not configured is not a tax decision." options={TAX_TREATMENTS.map(([, label]) => ({ value: label, label }))} />
          </div>
          <div className="mt-4"><OptionSelect label="Applicable organization tax configuration (when required)" placeholder={TAX_CONFIGS[values.tax] ? 'Choose a configuration' : 'Choose treatment to see applicable choices'} disabled={!TAX_CONFIGS[values.tax]} value={values.taxConfig} onChange={(event) => set('taxConfig', event.target.value)} error={errors.taxConfig} options={(TAX_CONFIGS[values.tax] ?? []).map((entry) => ({ value: entry, label: entry }))} /></div>
        </Card>

        <Card title="Branch applicability & optional overrides" aside="Select only the locations where this service will be available.">
          <table className="w-full text-left text-xs"><thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-outline uppercase"><tr><th className="px-4 py-3">Available at</th><th>Price mode</th><th>Effective price (INR)</th></tr></thead><tbody>
            {BRANCHES.map((branch) => { const entry = values.branches[branch.id]; return (
              <tr key={branch.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3"><label className="flex items-start gap-2"><input type="checkbox" checked={entry.offered} onChange={(event) => setBranch(branch.id, { offered: event.target.checked })} className="mt-0.5 accent-[#006a61]" /><span><strong>{branch.name}</strong><br /><span className="text-outline">{entry.offered ? 'Available for future selection' : 'Not configured · not available'}</span></span></label></td>
                <td className="py-3 pr-4"><select aria-label={`Price mode for ${branch.name}`} disabled={!entry.offered} value={entry.mode} onChange={(event) => setBranch(branch.id, { mode: event.target.value })} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none disabled:bg-surface-low"><option value="default">{entry.offered ? 'Inherit default price' : 'No branch price'}</option><option value="custom">Custom override</option></select>{entry.offered && entry.mode === 'custom' && <input aria-label={`Custom price for ${branch.name}`} inputMode="decimal" value={entry.price} onChange={(event) => setBranch(branch.id, { price: event.target.value })} placeholder="₹ amount" className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-brand" />}</td>
                <td className="py-3"><strong className="text-sm">{preview(branch.id)}</strong><br /><span className="text-outline">{entry.offered ? (entry.mode === 'custom' ? 'Custom override' : 'Uses the default price') : 'Select availability before setting a price'}</span></td>
              </tr>) })}
          </tbody></table>
          {errors.branches && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.branches}</p>}
          <p className="mt-3 text-[11px] text-outline">Overrides are optional. Unselected and future locations are never enabled automatically.{editing && ` Currently ${BRANCHES.filter((branch) => effectivePrice(editing, branch.id) != null).map((branch) => branch.short).join(', ') || 'no location'} offered.`}</p>
        </Card>

        <Note tone="brand" title="Forward-looking pricing · historical records protected">A successful save updates the catalogue for future use. Finalized charges, invoices, payments and receipts are never silently repriced; meaningful changes are audited after saving.</Note>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs"><strong>{editing ? 'Original record unchanged until save' : 'New service · not yet created'}</strong><br /><span className="text-outline">Save → catalogue with “Service saved.” feedback. Cancel → catalogue unchanged.</span></p>
        <div className="flex items-center gap-2"><ActionButton to={back}>Cancel</ActionButton><ActionButton variant="primary" disabled={saving} onClick={save}>{editing ? 'Save changes' : 'Save service'}</ActionButton></div>
        {serverError && <p role="alert" className="w-full text-xs text-rose-600">{serverError}</p>}
      </div>
    </BillingFrame>
  )
}
