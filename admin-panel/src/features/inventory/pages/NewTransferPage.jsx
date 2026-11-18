import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import { ROUTES } from '../../../config/routes'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import DetailFrame from '../components/DetailFrame'
import { Section } from '../components/shared'
import { centralId, dispensaryId, locationName, LOCATIONS, NOW, TRANSFER_REASONS } from '../constants'
import { useStock } from '../context/useStock'
import { ITEMS, itemById } from '../data/items'
import { formatDate, qty } from '../format'
import { availableOf, fefoPlan } from '../stockLogic'
import { validateTransfer } from '../validation'

// Arriving from an item page starts the transfer with that item's earliest-expiry batch already on it.
function presetLine(batches, itemId) {
  const first = itemId ? fefoPlan(batches, itemId, centralId(), 1).picks[0] : null
  return first ? [{ batchId: first.batchId, qty: '' }] : []
}

export default function NewTransferPage() {
  const { state, run } = useStock()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draft = state.transfers.find((transfer) => transfer.id === params.get('draft') && transfer.status === 'Draft')
  const [values, setValues] = useState({
    from: draft?.from ?? centralId() ?? '', to: draft?.to ?? dispensaryId() ?? '', planned: NOW.date, reason: draft?.reason ?? TRANSFER_REASONS[0], notes: draft?.notes ?? '',
    lines: draft ? draft.lines.map((line) => ({ batchId: line.batchId, qty: String(line.qty) })) : presetLine(state.batches, params.get('item')),
  })
  const [search, setSearch] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateTransfer(values, state.batches) : {}

  const batchOf = (id) => state.batches.find((batch) => batch.id === id)
  const sourceItems = ITEMS.filter((item) => state.batches.some((batch) => batch.itemId === item.id && batch.loc === values.from && availableOf(batch) > 0))
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const editLine = (index, change) => setValues((current) => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...change } : line)) }))

  const addItem = (itemId) => {
    const needle = (itemId ?? search).trim().toLowerCase()
    const match = sourceItems.find((item) => item.id.toLowerCase() === needle || item.name.toLowerCase() === needle) ?? sourceItems.find((item) => needle && item.name.toLowerCase().includes(needle))
    if (!match) return setLookupError(`No item with available stock at ${locationName(values.from)} matches that.`)
    const first = fefoPlan(state.batches, match.id, values.from, 1).picks[0]
    if (values.lines.some((line) => batchOf(line.batchId).itemId === match.id)) return setLookupError(`${match.name} is already on the transfer.`)
    setLookupError('')
    setSearch('')
    setValues((current) => ({ ...current, lines: [...current.lines, { batchId: first.batchId, qty: '' }] }))
  }

  const submit = async (mode) => {
    setSubmitted(true)
    if (mode === 'create' && Object.keys(validateTransfer(values, state.batches)).length) return
    if (mode === 'draft' && (!values.lines.length || values.to === values.from)) return
    const created = await run('transfer/save', { id: draft?.id, from: values.from, to: values.to, lines: values.lines.map((line) => ({ batchId: line.batchId, qty: Number(line.qty) || 0 })), reason: values.reason, notes: values.notes, planned: values.planned, mode })
    if (created.error) return
    navigate(`${ROUTES.stockTransfers}?transfer=${created.id}`)
  }

  const totals = values.lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0)
  const allWithin = values.lines.length > 0 && values.lines.every((line) => Number(line.qty) > 0 && Number(line.qty) <= availableOf(batchOf(line.batchId)))

  return (
    <DetailFrame
      crumbs={[{ label: 'Stock transfers', to: ROUTES.stockTransfers }, { label: 'New transfer' }]}
      title="New stock transfer"
      subtitle="Move stock between locations. Select available batches, confirm quantities and review before creating."
      aside={<span className="text-[11px] text-outline">{formatDate(NOW.date)} · Aura Health</span>}
    >
      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Transfer locations">
            <p className="mb-3 text-xs text-on-surface-variant">Choose where stock will leave from and where it will be received.</p>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <OptionSelect label="Source location" required value={values.from} onChange={(event) => setValues((current) => ({ ...current, from: event.target.value, lines: [] }))} error={errors.from} options={LOCATIONS.map((location) => ({ value: location.id, label: location.name }))} />
              <ArrowRight className="mb-3 hidden size-5 text-brand sm:block" aria-hidden="true" />
              <OptionSelect label="Destination location" required value={values.to} onChange={(event) => set('to', event.target.value)} error={errors.to} options={LOCATIONS.map((location) => ({ value: location.id, label: location.name }))} />
            </div>
            <p className="mt-2 text-[11px] text-outline">Available stock is shown for the source location. Stock will be available at the destination after receipt is posted.</p>
          </Section>

          <Section title="Items to transfer" aside={`${values.lines.length} items`}>
            <div className="mb-3 flex gap-2">
              <input list="transfer-items" aria-label="Search by item name, SKU or batch to add stock" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addItem()} placeholder="Search by item name, SKU or batch to add stock" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand" />
              <datalist id="transfer-items">{sourceItems.map((item) => <option key={item.id} value={item.name}>{item.id}</option>)}</datalist>
              <ActionButton onClick={() => addItem()}>Browse items</ActionButton>
            </div>
            {lookupError && <p role="alert" className="mb-2 text-xs text-rose-600">{lookupError}</p>}
            {values.lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-on-surface-variant">No items added yet. Search for an item above to add stock from {locationName(values.from)}.</p>
            ) : (
              <ul className="flex flex-col">
                {values.lines.map((line, index) => {
                  const batch = batchOf(line.batchId)
                  const item = itemById(batch.itemId)
                  return (
                    <li key={batch.itemId} className="grid items-start gap-3 border-t border-slate-100 py-4 first:border-0 md:grid-cols-[2fr_1.5fr_1fr_1fr_auto]">
                      <div><p className="font-semibold">{item.name}</p><p className="text-[11px] text-outline">{item.id}</p></div>
                      <OptionSelect label="Batch / expiry" aria-label={`Batch for ${item.name}`} value={line.batchId} onChange={(event) => editLine(index, { batchId: event.target.value })} options={state.batches.filter((entry) => entry.itemId === item.id && entry.loc === values.from && availableOf(entry) > 0).map((entry) => ({ value: entry.id, label: `${entry.batchNo} · exp ${formatDate(entry.expiry)}` }))} />
                      <div className="text-xs"><p className="text-outline">Available</p><p className="font-semibold">{qty(availableOf(batch))}</p><p className="text-outline">{item.unitPlural}</p></div>
                      <TextInput label="Quantity" aria-label={`Quantity for ${item.name}`} inputMode="numeric" value={line.qty} onChange={(event) => editLine(index, { qty: event.target.value })} hint={item.unitPlural} />
                      <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((_, at) => at !== index) }))} className="mt-7 text-outline hover:text-danger"><X className="size-4" aria-hidden="true" /></button>
                    </li>
                  )
                })}
              </ul>
            )}
            {errors.lines && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.lines}</p>}
            {allWithin && <p className="mt-2 text-xs text-emerald-700">All quantities are within available stock at {locationName(values.from)}.</p>}
          </Section>

          <Section title="Transfer details">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Planned dispatch date" required type="date" value={values.planned} onChange={(event) => set('planned', event.target.value)} error={errors.planned} />
              <OptionSelect label="Reason for transfer" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} options={TRANSFER_REASONS.map((reason) => ({ value: reason, label: reason }))} />
            </div>
            <div className="mt-4"><TextArea label="Notes" rows={3} value={values.notes} onChange={(event) => set('notes', event.target.value)} hint="Optional" /></div>
          </Section>
        </div>

        <div className="flex flex-col gap-5 self-start">
          <Section title="Transfer summary">
            <div className="text-xs"><p className="text-[10px] tracking-wide text-outline uppercase">From</p><p className="text-base font-semibold">{locationName(values.from)}</p></div>
            <div className="mt-3 text-xs"><p className="text-[10px] tracking-wide text-outline uppercase">To</p><p className="text-base font-semibold">{locationName(values.to)}</p></div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
              <p className="flex justify-between"><span className="font-semibold">{values.lines.length} items</span><span className="text-outline">{values.lines.length} batches</span></p>
              {values.lines.map((line) => <p key={line.batchId} className="mt-1.5 flex justify-between text-xs"><span>{itemById(batchOf(line.batchId).itemId).name}</span><span className="font-semibold">{qty(Number(line.qty) || 0)} {itemById(batchOf(line.batchId).itemId).unitPlural}</span></p>)}
            </div>
            <dl className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between"><dt className="text-outline">Planned dispatch</dt><dd className="font-semibold">{formatDate(values.planned)}</dd></div>
              <div className="flex justify-between"><dt className="text-outline">Created by</dt><dd className="font-semibold">Dr. Siddharth Verma</dd></div>
            </dl>
            <p className="mt-3 text-[11px] text-outline">A transfer number is assigned when you save.</p>
          </Section>
          <div className="px-1 text-xs">
            <p className="mb-2 font-semibold">What happens next?</p>
            <ol className="flex flex-col gap-3 text-on-surface-variant">
              <li><span className="font-semibold text-on-surface">Create &amp; reserve</span><br />Transfer becomes ready for dispatch. Selected quantities are reserved at source.</li>
              <li><span className="font-semibold text-on-surface">Dispatch stock</span><br />Confirm handover to move stock from {locationName(values.from)} to in transit.</li>
              <li><span className="font-semibold text-on-surface">Receive at destination</span><br />{locationName(values.to)} verifies and posts accepted quantities to available stock.</li>
            </ol>
            <p className="mt-3 text-[11px] text-outline">Not ready yet? Save as a draft without reserving or moving any stock.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-xs"><p className="font-semibold">Ready to create · {values.lines.length} items selected ({qty(totals)} units)</p><p className="text-outline">Creating reserves stock. Dispatch is a separate step.</p></div>
        <div className="flex items-center gap-2">
          <ActionButton to={ROUTES.stockTransfers}>Cancel</ActionButton>
          <ActionButton onClick={() => submit('draft')}>Save as draft</ActionButton>
          <ActionButton variant="brand" onClick={() => submit('create')}>Create transfer →</ActionButton>
        </div>
      </div>
    </DetailFrame>
  )
}
