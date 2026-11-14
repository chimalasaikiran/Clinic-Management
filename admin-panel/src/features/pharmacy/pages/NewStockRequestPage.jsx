import { useState } from 'react'
import { ArrowLeft, ArrowRightLeft, CheckCircle2, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { ROUTES } from '../../../config/routes'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import { Pill } from '../../inventory/components/shared'
import DetailFrame from '../../inventory/components/DetailFrame'
import { locationName, NOW, PHARMACIES, REQUEST_PRIORITIES, REQUEST_REASONS } from '../../inventory/constants'
import { useStock } from '../../inventory/context/useStock'
import { ITEMS, itemById } from '../../inventory/data/items'
import { formatDate, qty } from '../../inventory/format'
import { summarise } from '../../inventory/stockLogic'
import { validateRequest } from '../../inventory/validation'

const REQUESTER = { name: 'Ramesh Pillai', role: 'B.Pharm' }

// Lines prefilled from a stock exception ("Emergency Transfer", "Review Reorder") or a saved draft.
function initialLines(request, params) {
  if (request) return request.lines.map((line) => ({ itemId: line.itemId, requested: String(line.requested) }))
  const item = params.get('item')
  return item && itemById(item) ? [{ itemId: item, requested: params.get('qty') ?? '' }] : []
}

export default function NewStockRequestPage() {
  const { state, run } = useStock()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draft = state.requests.find((request) => request.id === params.get('draft') && request.status === 'Draft')
  const urgent = params.get('priority') === 'Urgent'
  const [values, setValues] = useState({
    pharmacy: draft?.pharmacy ?? 'main', priority: draft?.priority ?? (urgent ? 'Urgent' : 'Normal'), required: draft?.required ?? NOW.date, reason: draft?.reason ?? (urgent ? REQUEST_REASONS[1] : REQUEST_REASONS[0]), notes: draft?.notes ?? '',
    lines: initialLines(draft, params),
  })
  const [search, setSearch] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateRequest(values) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const editLine = (itemId, requested) => setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.itemId === itemId ? { ...line, requested } : line)) }))

  const addItem = () => {
    const needle = search.trim().toLowerCase()
    const match = ITEMS.find((item) => item.name.toLowerCase() === needle || item.id.toLowerCase() === needle) ?? ITEMS.find((item) => needle && item.name.toLowerCase().includes(needle))
    if (!match) return setLookupError('No medicine matches that name or code.')
    if (values.lines.some((line) => line.itemId === match.id)) return setLookupError(`${match.name} is already on the request.`)
    setLookupError('')
    setSearch('')
    setValues((current) => ({ ...current, lines: [...current.lines, { itemId: match.id, requested: '' }] }))
  }

  const submit = (send) => {
    setSubmitted(true)
    if (send ? Object.keys(validateRequest(values)).length : !values.lines.length) return
    const outcome = run('request/save', { id: draft?.id, submit: send, pharmacy: values.pharmacy, requestedBy: REQUESTER.name, role: REQUESTER.role, priority: values.priority, required: values.required, reason: values.reason, notes: values.notes.trim(), lines: values.lines })
    navigate(`${ROUTES.pharmacyRequests}`, { state: { saved: outcome.id, submitted: send } })
  }

  const rows = values.lines.map((line) => {
    const item = itemById(line.itemId)
    const own = summarise(state.batches, item.id, values.pharmacy)
    const central = summarise(state.batches, item.id, 'central').available
    const wanted = Number(line.requested) || 0
    return { line, item, own, central, wanted, short: wanted > central }
  })
  const anyShort = rows.some((row) => row.short)
  const totals = rows.reduce((map, row) => map.set(row.item.unitPlural, (map.get(row.item.unitPlural) ?? 0) + row.wanted), new Map())

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Request stock' }]}
      title="Request Stock"
      badge={<Pill>Draft</Pill>}
      subtitle="Request an internal stock transfer from Central Stores to your pharmacy."
      actions={<ActionButton to={ROUTES.pharmacy} icon={ArrowLeft} className="border-transparent text-brand">Back to Pharmacy</ActionButton>}
    >
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Request details</h2><span className="text-[11px] text-outline">{draft ? `Draft ${draft.id}` : 'New request'} · Reference assigned on submission</span></header>
        <div className="grid gap-4 md:grid-cols-4">
          <OptionSelect label="Requesting pharmacy" required value={values.pharmacy} onChange={(event) => set('pharmacy', event.target.value)} error={errors.pharmacy} options={PHARMACIES.map((entry) => ({ value: entry.id, label: `${entry.name} · Dispensary ${entry.detail.split('· ')[1]}` }))} />
          <OptionSelect label="Source inventory" required value="central" onChange={() => {}} options={[{ value: 'central', label: 'Central Stores' }]} />
          <OptionSelect label="Priority" required value={values.priority} onChange={(event) => set('priority', event.target.value)} options={REQUEST_PRIORITIES.map((entry) => ({ value: entry, label: entry }))} />
          <TextInput label="Required by" required type="date" min={NOW.date} value={values.required} onChange={(event) => set('required', event.target.value)} error={errors.required} />
        </div>
        <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-on-surface-variant"><ArrowRightLeft className="size-3.5" aria-hidden="true" />Central Stores → {locationName(values.pharmacy)} · Stock moves only after approval and issue by Central Stores.</p>
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5"><h2 className="flex items-center gap-2 text-lg font-semibold">Items to request <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-normal text-on-surface-variant">{values.lines.length} items</span></h2><span className="text-[11px] text-outline">Availability updated at {NOW.time}</span></header>
        <div className="flex gap-2 px-5 py-4">
          <input list="request-items" aria-label="Search medicine by name, generic or item code" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addItem()} placeholder="Search medicine by name, generic or item code" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand" />
          <datalist id="request-items">{ITEMS.map((item) => <option key={item.id} value={item.name}>{item.id}</option>)}</datalist>
          <ActionButton onClick={addItem}>+ Add Item</ActionButton>
        </div>
        {lookupError && <p role="alert" className="px-5 pb-3 text-xs text-rose-600">{lookupError}</p>}
        {rows.length === 0 ? (
          <p className="px-5 pb-8 text-center text-sm text-on-surface-variant">No medicines added yet. Search above to add the stock you need.</p>
        ) : (
          <table className="w-full min-w-[800px] text-left">
            <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Medicine / Item', 'Pharmacy stock', 'Inventory availability', 'Unit', 'Request qty *', ''].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ line, item, own, central, wanted, short }) => (
                <tr key={item.id} className="border-b border-slate-100 align-top">
                  <td className="px-5 py-3"><p className="font-semibold">{item.name}</p><p className="text-xs text-on-surface-variant">{item.dose ?? item.category}</p><p className="font-mono text-[10px] text-outline">{item.id}</p></td>
                  <td className="px-5 py-3 text-xs"><p className={own.available <= 0 ? 'font-semibold text-danger' : own.available < item.safety ? 'font-semibold text-amber-800' : 'font-semibold'}>● {qty(own.available)} {item.unitPlural}</p><p className="text-outline">Minimum: {item.safety} {item.unitPlural}</p><p className={own.available <= 0 ? 'text-danger' : own.available < item.safety ? 'text-amber-800' : 'text-emerald-700'}>{own.available <= 0 ? 'Out of stock' : own.available < item.safety ? 'Below safety buffer' : 'Above safety buffer'}</p></td>
                  <td className="px-5 py-3 text-xs"><p className="text-base font-semibold text-brand">{qty(central)} available</p><p className="text-outline">Central Stores</p></td>
                  <td className="px-5 py-3 text-xs">{item.unit}</td>
                  <td className="px-5 py-3"><input type="number" min="1" aria-label={`Request quantity for ${item.name}`} value={line.requested} onChange={(event) => editLine(item.id, event.target.value)} className="w-24 rounded border border-slate-200 px-2 py-1.5 text-[13px] outline-none focus:border-brand" /><p className={`mt-1 text-[11px] ${short ? 'text-danger' : 'text-outline'}`}>{short ? `Only ${qty(central)} available` : `After transfer: ${qty(own.available + wanted)} ${item.unitPlural}`}</p></td>
                  <td className="px-5 py-3"><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((entry) => entry.itemId !== item.id) }))} className="text-outline hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {errors.lines && <p role="alert" className="px-5 py-2 text-xs text-rose-600">{errors.lines}</p>}
        {rows.length > 0 && <p className={`flex items-center justify-end gap-1.5 px-5 py-3 text-xs ${anyShort ? 'text-amber-800' : 'text-emerald-700'}`}><CheckCircle2 className="size-3.5" aria-hidden="true" />{anyShort ? 'Some quantities exceed what Central Stores has; Inventory may approve part of the request.' : 'All requested quantities are available'}</p>}
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Request reason / notes</h2>
          <OptionSelect label="Reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} options={REQUEST_REASONS.map((entry) => ({ value: entry, label: entry }))} />
          <div className="mt-3"><TextArea label="Notes" rows={4} value={values.notes} onChange={(event) => set('notes', event.target.value)} hint="These notes will be shared with the Central Stores team." /></div>
        </section>
        <section className="self-start rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Request summary</h2>
          <div className="flex gap-8"><p className="text-3xl font-semibold">{values.lines.length}<span className="block text-[11px] font-normal text-outline">Medicine items</span></p><ul className="text-sm font-semibold">{[...totals].map(([unit, total]) => <li key={unit}>{qty(total)} {unit}</li>)}</ul></div>
          <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs"><span className={`font-semibold ${values.priority === 'Urgent' ? 'text-amber-800' : ''}`}>{values.priority}</span><span className="text-on-surface-variant">Due {formatDate(values.required)}</span></p>
          <InfoNote tone="brand" icon={CheckCircle2} className="mt-3">Sent to Central Stores for approval and issue. Submitting does not update pharmacy stock.</InfoNote>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs"><span className="font-semibold">Requested by {REQUESTER.name}, {REQUESTER.role}</span><br /><span className="text-outline">You can edit this request until it is submitted.</span></p>
        <div className="flex items-center gap-2"><ActionButton to={ROUTES.pharmacyRequests} className="border-transparent">Cancel</ActionButton><ActionButton onClick={() => submit(false)}>Save Draft</ActionButton><ActionButton variant="primary" onClick={() => submit(true)}>Submit Request</ActionButton></div>
      </div>
    </DetailFrame>
  )
}
