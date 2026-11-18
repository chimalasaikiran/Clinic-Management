import { useState } from 'react'
import { AlertTriangle, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import { Pill } from '../../inventory/components/shared'
import DetailFrame from '../../inventory/components/DetailFrame'
import { LOCATIONS, locationName } from '../../inventory/constants'
import { useStock } from '../../inventory/context/useStock'
import { ITEMS, itemById } from '../../inventory/data/items'
import { formatDate } from '../../inventory/format'
import { DISCREPANCY_CATEGORIES, dispensedOn, PACKAGING_CONDITIONS, RETURN_REASONS, RETURN_SOURCES, validateCase } from '../validation'

const DISCREPANCY_REASONS = ['Count variance', 'Cracked vials', 'Water-damaged strip', 'Batch differs', 'Expired in storage']
const CASE_TYPES = [
  { id: 'Return', icon: RotateCcw, hint: 'Patient returns or unused ward stock.' },
  { id: 'Discrepancy', icon: AlertTriangle, hint: 'Shortage, damage or batch / count mismatch.' },
]

const BLANK = { itemId: '', batchId: '', source: RETURN_SOURCES[0], receiving: '', reference: '', qty: '', reason: '', condition: '', notes: '', location: '', storage: '', category: '', expected: '', observed: '', explanation: '', assignee: '' }

export default function NewReturnPage() {
  const { state, run, members } = useStock()
  const navigate = useNavigate()
  // Reviewers are the organisation's active members; locations are its stock locations.
  const REVIEWERS = members.map((member) => ({ value: member.userId, label: member.roles.length ? `${member.name} · ${member.roles.join(', ')}` : member.name }))
  const RECEIVING_LOCATIONS = LOCATIONS.filter((location) => location.active).map((location) => location.name)
  const [params] = useSearchParams()
  const [type, setType] = useState(params.get('type') === 'Discrepancy' ? 'Discrepancy' : 'Return')
  const [values, setValues] = useState(BLANK)
  const [evidence, setEvidence] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const full = { ...values, type }
  const errors = submitted ? validateCase(full, state.rxQueue) : {}
  const item = itemById(values.itemId)
  const batches = state.batches.filter((batch) => batch.itemId === values.itemId)
  const batch = state.batches.find((entry) => entry.id === values.batchId)
  const match = type === 'Return' && values.source === 'Patient return' && item && values.reference ? dispensedOn(state.rxQueue, values.reference, item.id) : null
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)

  const submit = async (draft) => {
    setSubmitted(true)
    if (Object.keys(validateCase(full, state.rxQueue, { draft })).length) return
    // The reporter is the signed-in person; the API records them.
    const common = { type, draft, itemId: item.id, batchId: values.batchId || null, notes: values.notes.trim() || values.explanation.trim(), evidence: evidence.length, assigneeId: values.assignee || null }
    const payload = type === 'Return'
      ? { ...common, subtype: values.source, qty: Number(values.qty) || 0, origin: values.reference.trim() || 'Not recorded', originNote: values.receiving, reason: values.reason || 'Not recorded', reasonNote: values.condition, location: values.receiving || 'Not recorded' }
      : { ...common, subtype: values.category || 'Not recorded', qty: Math.abs((Number(values.expected) || 0) - (Number(values.observed) || 0)), origin: values.storage.trim() || values.location || 'Not recorded', originNote: values.location, reason: values.reason || 'Count variance', reasonNote: `${values.expected} expected · ${values.observed} found`, location: values.location || 'Not recorded', expected: values.expected === '' ? null : Number(values.expected), observed: values.observed === '' ? null : Number(values.observed) }
    const created = await run('case/create', payload)
    if (created.error) return
    navigate(pathFor(ROUTES.pharmacyReturn, { caseId: created.id }))
  }

  const summary = type === 'Return'
    ? [['Medicine', item?.name], ['Batch', batch?.batchNo], ['Affected qty', values.qty && item ? `${values.qty} ${item.unitPlural}` : null], ['Origin', values.reference && `${values.source} · ${values.reference}`], ['Location', values.receiving]]
    : [['Medicine', item?.name], ['Batch', batch?.batchNo], ['Variance', values.expected && values.observed ? `${Number(values.observed) - Number(values.expected)} ${item?.unitPlural ?? ''}` : null], ['Category', values.category], ['Location', values.location]]

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Returns & Discrepancies', to: ROUTES.pharmacyReturns }, { label: 'New case' }]}
      title="Create return / Report discrepancy"
      subtitle="Record a medicine return or stock issue and send it for review."
      aside={<Pill>Unsaved draft</Pill>}
    >
      <p className="mb-5 flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs text-on-surface-variant"><ShieldCheck className="size-4 text-brand" aria-hidden="true" />Returns remain off available stock until reviewed. Approved returns require a separate inventory posting.</p>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <header className="mb-3 flex justify-between"><h2 className="text-lg font-semibold">Case type</h2><span className="text-[11px] text-outline">* Required fields</span></header>
            <div role="radiogroup" aria-label="Case type" className="grid gap-3 sm:grid-cols-2">
              {CASE_TYPES.map(({ id, icon: Icon, hint }) => (
                <label key={id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-4', type === id ? 'border-brand bg-teal-50/60' : 'border-slate-200')}>
                  <input type="radio" name="case-type" value={id} checked={type === id} onChange={() => { setType(id); setSubmitted(false) }} className="mt-1 accent-[#006a61]" />
                  <span><span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="size-3.5" aria-hidden="true" />{id}</span><span className="text-xs text-on-surface-variant">{hint}</span></span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Medicine &amp; batch</h2>
            <p className="mb-3 text-xs text-on-surface-variant">Select the medicine and the batch {type === 'Return' ? 'being returned' : 'affected'}.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionSelect label="Medicine" required placeholder="Select a medicine" value={values.itemId} onChange={(event) => setValues((current) => ({ ...current, itemId: event.target.value, batchId: '' }))} error={errors.itemId} options={ITEMS.map((entry) => ({ value: entry.id, label: entry.name }))} />
              <OptionSelect label="Batch" required placeholder={values.itemId ? 'Select a batch' : 'Choose a medicine first'} value={values.batchId} onChange={(event) => set('batchId', event.target.value)} error={errors.batchId} options={batches.map((entry) => ({ value: entry.id, label: `${entry.batchNo} · ${locationName(entry.loc)}` }))} />
            </div>
            {batch && <p className="mt-3 rounded-md bg-surface-lowest px-3 py-2 text-xs text-on-surface-variant">{item.dose ?? 'Oral'} · Expiry: {formatDate(batch.expiry)} · Stock unit: {item.unit}</p>}
          </section>

          {type === 'Return' ? (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold">Origin &amp; affected quantity</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <OptionSelect label="Return source" required value={values.source} onChange={(event) => set('source', event.target.value)} error={errors.source} hint="Use Unused ward stock for ward-issued medicine." options={RETURN_SOURCES.map((entry) => ({ value: entry, label: entry }))} />
                  <OptionSelect label="Receiving location" required value={values.receiving} onChange={(event) => set('receiving', event.target.value)} error={errors.receiving} options={RECEIVING_LOCATIONS.map((entry) => ({ value: entry, label: entry }))} />
                  <TextInput label={values.source === 'Patient return' ? 'Prescription reference' : 'Issue reference'} required name="reference" placeholder={values.source === 'Patient return' ? 'RX-10276' : 'ISS-0816'} value={values.reference} onChange={update} error={errors.reference} hint={match?.dispensed ? `Matched prescription · ${match.dispensed} ${item.unitPlural} dispensed` : undefined} />
                  <TextInput label="Quantity returned" required name="qty" inputMode="numeric" value={values.qty} onChange={update} error={errors.qty} hint="Enter individual units, not packs." />
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold">Reason &amp; condition</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <OptionSelect label="Return reason" required placeholder="Select a reason" value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} options={RETURN_REASONS.map((entry) => ({ value: entry, label: entry }))} />
                  <OptionSelect label="Packaging condition" required placeholder="Select a condition" value={values.condition} onChange={(event) => set('condition', event.target.value)} error={errors.condition} options={PACKAGING_CONDITIONS.map((entry) => ({ value: entry, label: entry }))} />
                </div>
                <div className="mt-4"><TextArea label="Notes for reviewer (optional)" name="notes" rows={3} value={values.notes} onChange={update} hint="Condition is an observation, not approval for restocking." /></div>
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold">Location &amp; variance</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <OptionSelect label="Branch / location" required placeholder="Select a location" value={values.location} onChange={(event) => set('location', event.target.value)} error={errors.location} options={RECEIVING_LOCATIONS.map((entry) => ({ value: entry, label: entry }))} />
                <TextInput label="Storage location (optional)" name="storage" placeholder="Rack A-03" value={values.storage} onChange={update} />
                <TextInput label="Expected quantity" required name="expected" inputMode="numeric" value={values.expected} onChange={update} error={errors.expected} />
                <TextInput label="Observed quantity" required name="observed" inputMode="numeric" value={values.observed} onChange={update} error={errors.observed} />
                <OptionSelect label="Category" required placeholder="Select a category" value={values.category} onChange={(event) => set('category', event.target.value)} error={errors.category} options={DISCREPANCY_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} />
                <OptionSelect label="Reason" placeholder="Select a reason" value={values.reason} onChange={(event) => set('reason', event.target.value)} options={DISCREPANCY_REASONS.map((entry) => ({ value: entry, label: entry }))} />
              </div>
              <div className="mt-4"><TextArea label="Explanation" required name="explanation" rows={3} value={values.explanation} onChange={update} error={errors.explanation} /></div>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Supporting evidence</h2>
            <p className="mb-3 text-xs text-on-surface-variant">Attach packaging photos or relevant documents. Optional for this case.</p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-slate-300 py-6 text-xs text-on-surface-variant">
              <Upload className="size-4" aria-hidden="true" />
              <span><span className="font-semibold text-brand">Choose files</span> or drag and drop</span>
              <span className="text-[11px] text-outline">JPG, PNG or PDF · Up to 10 MB per file</span>
              <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" aria-label="Choose files" className="sr-only" onChange={(event) => setEvidence([...event.target.files].filter((file) => file.size <= 10 * 1024 * 1024).map((file) => file.name))} />
            </label>
            {evidence.length > 0 && <ul className="mt-2 text-xs text-on-surface-variant">{evidence.map((name) => <li key={name}>{name}</li>)}</ul>}
          </section>
        </div>

        <div className="flex flex-col gap-5 self-start">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Review assignment</h2>
            <p className="mb-3 text-xs text-on-surface-variant">Choose who will assess this case.</p>
            <OptionSelect label="Assign reviewer" required placeholder="Select a reviewer" value={values.assignee} onChange={(event) => set('assignee', event.target.value)} error={errors.assignee} options={REVIEWERS.map((entry) => ({ value: entry.value, label: entry.label }))} />
            <p className="mt-4 mb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">{type} summary</p>
            <dl className="flex flex-col gap-1.5 text-xs">{summary.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-outline">{label}</dt><dd className="font-semibold">{value || '—'}</dd></div>)}</dl>
            <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-900"><strong className="block">Awaiting review on submission</strong>{type === 'Return' ? 'Returned medicine must stay quarantined and off available stock.' : 'The variance is a report only; no stock adjustment is posted from here.'}</p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-xs">
            <h2 className="mb-3 text-lg font-semibold">What happens next</h2>
            <ol className="flex flex-col gap-3 text-on-surface-variant">
              <li><strong className="block text-on-surface">Submit for review</strong>Creates a case and notifies the assigned reviewer. Inventory is unchanged.</li>
              <li><strong className="block text-on-surface">Assess the case</strong>The reviewer checks the batch, condition and eligibility before deciding.</li>
              <li><strong className="block text-on-surface">Post inventory separately</strong>An approved case still requires a separate, authorized inventory posting.</li>
            </ol>
          </section>
          <p className="px-1 text-[11px] text-outline">Not ready to submit? Save a draft to complete the details later. Drafts do not enter the review queue.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs"><span className="font-semibold">Submission creates an Awaiting review case.</span><br /><span className="text-outline">No stock adjustment or restocking is posted at this step.</span></p>
        <div className="flex items-center gap-2"><ActionButton to={ROUTES.pharmacyReturns} className="border-transparent">Cancel</ActionButton><ActionButton onClick={() => submit(true)}>Save draft</ActionButton><ActionButton variant="primary" onClick={() => submit(false)}>Submit for review</ActionButton></div>
      </div>
    </DetailFrame>
  )
}
