import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import Modal from '../../../components/workspace/Modal'
import { ROUTES } from '../../../config/routes'
import { OptionSelect } from '../../patients/components/parts'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { toSettingsRequest } from '../adapters'
import { BILLING_MODELS } from '../constants'
import { useBilling } from '../context/useBilling'

const MODEL_HINT = { 'Pay-as-you-go': 'Bill services individually as they are delivered.', Consolidated: 'Group eligible charges into a consolidated invoice.', Hybrid: 'Use individual and consolidated billing where supported.' }
const METHODS = [['cash', 'Cash'], ['bank', 'Bank transfer'], ['upi', 'UPI / Card']]
const ADVANCE = ['Hold as unallocated credit', 'Apply to the next invoice']
const PARTIAL = ['Allow partial payments', 'Require full payment']
const ALLOCATION = ['Allocate manually only', 'Apply to the oldest invoice first']
const DOCS = ['Standard GST invoice', 'Summary invoice']
const RECEIPT_DOCS = ['Payment receipt', 'Receipt with allocation detail']

const Locked = ({ label, hint, value = 'Not verified' }) => <div><p className="mb-1.5 text-[13px] font-semibold">{label}</p><p className="rounded-md border border-slate-200 bg-surface-low px-3 py-2.5 text-xs text-outline">{value}</p><p className="mt-1 text-[11px] text-outline">{hint}</p></div>

// Billing defaults for future records. Existing invoices, payments and receipts are never changed by saving.
export default function BillingConfigPage() {
  const { config } = useBilling()
  const [notice, setNotice] = useState('')
  // A fresh form for each saved version, so the next save carries the version it was edited from.
  return <ConfigForm key={config.version ?? 'unsaved'} notice={notice} onSaved={setNotice} />
}

function ConfigForm({ notice, onSaved }) {
  const { config, saveConfig } = useBilling()
  const [draft, setDraft] = useState(config)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const changes = [draft.model !== config.model && 'billing model', JSON.stringify(draft.methods) !== JSON.stringify(config.methods) && 'payment methods', ['advance', 'partial', 'allocation', 'invoiceDoc', 'receiptDoc'].some((key) => draft[key] !== config[key]) && 'financial rules and document defaults'].filter(Boolean)
  const dirty = changes.length > 0
  const set = (name, value) => setDraft((current) => ({ ...current, [name]: value }))

  const commit = async () => {
    setSaving(true)
    setError('')
    try {
      await saveConfig(toSettingsRequest(draft))
      onSaved(`Billing configuration saved: ${changes.join(', ')}. Existing financial records are unchanged.`)
    } catch (failure) {
      setError(failure.message)
      setSaving(false)
    }
    setConfirming(false)
  }
  const save = () => (draft.model !== config.model ? setConfirming(true) : commit())
  const option = (list) => list.map((entry) => ({ value: entry, label: entry }))

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Billing & Finance' }} crumb="Billing & Finance / Billing Configuration" code="Organization defaults" title="Billing Configuration" badge={dirty && <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-normal text-amber-800">Unsaved changes</span>} description="Manage prospective billing defaults. Financial records remain in their own workflows.">
      {notice && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">{notice}</p>}
      <div className="flex flex-col gap-5">
        <Card title="Billing model" aside="Organization default">
          <p className="mb-3 text-xs text-on-surface-variant">Choose how future billing is organized. This does not change settlement or collection policies.</p>
          <div role="radiogroup" aria-label="Billing model" className="grid gap-3 sm:grid-cols-3">
            {BILLING_MODELS.map((model) => <label key={model} className={`cursor-pointer rounded-md border p-4 text-xs ${draft.model === model ? 'border-brand bg-teal-50/60' : 'border-slate-200'}`}><input type="radio" name="model" value={model} checked={draft.model === model} onChange={() => set('model', model)} className="mr-2 accent-[#006a61]" /><strong className="text-[13px]">{model}</strong><span className="mt-1 block text-on-surface-variant">{MODEL_HINT[model]}</span></label>)}
          </div>
          {draft.model !== config.model && <p className="mt-3 text-[11px] text-amber-800">Changing the model is consequential: you will be asked to confirm before it is saved.</p>}
        </Card>

        <Card title="Invoice preferences" aside="Organization default · branch details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Locked label="Invoice prefix" value="INV-" hint="Invoices are numbered INV-000001, INV-000002 and so on." />
            <Locked label="Numbering sequence" value="Gap-free, per organisation" hint="Sequence resets are not offered here." />
            <OptionSelect label="Invoice document default" placeholder="Select an option" value={draft.invoiceDoc} onChange={(event) => set('invoiceDoc', event.target.value)} options={option(DOCS)} />
            <OptionSelect label="Receipt document default" placeholder="Select an option" value={draft.receiptDoc} onChange={(event) => set('receiptDoc', event.target.value)} options={option(RECEIPT_DOCS)} />
          </div>
          <p className="mt-3 text-[11px] text-outline">Invoice and receipt defaults are separate. Finalized documents are never renumbered.</p>
        </Card>

        <Card title="Tax / GST" aside="Organization or selected branch">
          <div className="grid gap-4 sm:grid-cols-2"><Locked label="Jurisdiction" hint="Select after a verified jurisdiction is provided." /><Locked label="Tax registration identifier" hint="Required only where applicable." /></div>
          <Note title="Service-specific tax treatment stays intact">No universal tax rate is applied here. Each service keeps its own treatment, and defaults affect future documents only.</Note>
        </Card>

        <Card title="Payment preferences" aside={JSON.stringify(draft.methods) === JSON.stringify(config.methods) ? 'Saved' : 'Changed'}>
          <p className="mb-2 text-[13px] font-semibold">Enabled payment methods</p>
          <div className="flex flex-wrap gap-5 text-xs">{METHODS.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={draft.methods[key]} onChange={(event) => set('methods', { ...draft.methods, [key]: event.target.checked })} className="accent-[#006a61]" />{label}</label>)}</div>
          <p className="mt-4 text-[13px] font-semibold">Payment gateway</p><p className="text-xs text-on-surface-variant">Connection status is unavailable. Online methods depend on a verified integration.</p>
        </Card>

        <Card title="Financial rules" aside="Organization default">
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionSelect label="Advance handling default" placeholder="Select an option" value={draft.advance} onChange={(event) => set('advance', event.target.value)} options={option(ADVANCE)} />
            <OptionSelect label="Partial payment default" placeholder="Select an option" value={draft.partial} onChange={(event) => set('partial', event.target.value)} options={option(PARTIAL)} />
          </div>
          <div className="mt-4"><OptionSelect label="Allocation default" placeholder="Select an option" value={draft.allocation} onChange={(event) => set('allocation', event.target.value)} hint="A default does not allocate an existing payment to an invoice." options={option(ALLOCATION)} /></div>
        </Card>

        <Note title="Charge ≠ Invoice ≠ Payment ≠ Receipt ≠ Allocation ≠ Refund">Only future defaults change. Finalized history, paid invoices, recorded payments, receipts, allocations and refunds remain unchanged. Meaningful changes are audited with the actor, time and before/after values.</Note>
        {config.audit.length > 0 && <Card title="Configuration audit"><ol className="flex flex-col gap-2 text-xs">{config.audit.map((entry, index) => <li key={`${entry.at}-${index}`}><strong>{entry.text}</strong> <span className="text-outline">· {entry.at} · {entry.by}</span></li>)}</ol></Card>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs"><strong>{dirty ? 'Unsaved changes' : 'No changes'}</strong><br /><span className="text-outline">Save validates the choices and asks to confirm consequential changes.</span></p>
        <div className="flex items-center gap-2"><ActionButton onClick={() => setDraft(config)} disabled={!dirty}>Cancel</ActionButton><ActionButton variant="brand" onClick={save} disabled={!dirty || saving}>Save Changes</ActionButton></div>
        {error && <p role="alert" className="w-full text-xs text-rose-600">{error}</p>}
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} eyebrow="Consequential change" title={`Change the billing model to ${draft.model}?`} footer={<div className="flex justify-end gap-2"><ActionButton onClick={() => setConfirming(false)}>Keep {config.model}</ActionButton><ActionButton variant="brand" disabled={saving} onClick={commit}>Confirm change</ActionButton></div>}>
        <p className="px-6 py-5 text-sm text-on-surface-variant">The new model applies to invoices created from now on. Invoices already issued keep the model they were created under, and no payment or allocation is changed.</p>
      </Modal>
    </BillingFrame>
  )
}
