import { useState } from 'react'
import { Building2, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import DetailFrame from '../components/DetailFrame'
import { Section } from '../components/shared'
import { LOCATIONS, NOW, PAYMENT_TERMS } from '../constants'
import { useStock } from '../context/useStock'
import { ITEMS, itemById } from '../data/items'
import { money } from '../format'
import { validateOrder } from '../validation'

export default function CreatePurchaseOrderPage() {
  const { state, run } = useStock()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ supplierId: params.get('supplier') ?? '', date: NOW.date, reference: '', store: 'central', expected: '', terms: '', notes: '', lines: [] })
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const errors = submitted ? validateOrder(values) : {}
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const supplierOptions = state.suppliers.filter((supplier) => supplier.active).map((supplier) => ({ value: supplier.id, label: supplier.name }))
  const subtotal = values.lines.reduce((sum, line) => sum + (Number(line.ordered) || 0) * (Number(line.rate) || 0), 0)

  const addItem = () => {
    const needle = search.trim().toLowerCase()
    const match = ITEMS.find((item) => item.name.toLowerCase() === needle || item.id.toLowerCase() === needle) ?? ITEMS.find((item) => needle && item.name.toLowerCase().includes(needle))
    if (!match) return setLookupError('No item matches that name or code.')
    if (values.lines.some((line) => line.itemId === match.id)) return setLookupError(`${match.name} is already on the order.`)
    setLookupError('')
    setSearch('')
    setValues((current) => ({ ...current, lines: [...current.lines, { itemId: match.id, ordered: '', rate: String(match.price) }] }))
  }
  const editLine = (itemId, change) => setValues((current) => ({ ...current, lines: current.lines.map((line) => (line.itemId === itemId ? { ...line, ...change } : line)) }))

  const save = (draft) => {
    setSubmitted(true)
    const found = draft ? (values.supplierId ? {} : { supplierId: 'Select a supplier.' }) : validateOrder(values)
    if (Object.keys(found).length) return
    const created = run('order/create', { ...values, draft, lines: values.lines.filter((line) => line.itemId) })
    navigate(pathFor(ROUTES.inventoryOrder, { orderId: created.id }))
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Purchase Orders', to: ROUTES.inventoryOrders }, { label: 'Create purchase order' }]}
      title="Create Purchase Order"
      subtitle="Select a supplier and add the items you want to order for your store."
      aside={<span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"><Building2 className="size-4 text-outline" aria-hidden="true" />Store / branch: Central Stores</span>}
    >
      <Section title="Order details" aside="* Required fields" className="mb-5">
        <div className="grid gap-4 md:grid-cols-3">
          <OptionSelect label="Supplier" required placeholder="Search or select supplier" value={values.supplierId} onChange={(event) => set('supplierId', event.target.value)} error={errors.supplierId} options={supplierOptions} />
          <TextInput label="Order date" required type="date" value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} />
          <TextInput label="Supplier reference (optional)" placeholder="Quote or reference number" value={values.reference} onChange={(event) => set('reference', event.target.value)} />
          <OptionSelect label="Deliver to" required value={values.store} onChange={(event) => set('store', event.target.value)} options={LOCATIONS.filter((location) => location.kind === 'store').map((location) => ({ value: location.id, label: location.name }))} />
          <TextInput label="Expected delivery date" required type="date" value={values.expected} onChange={(event) => set('expected', event.target.value)} error={errors.expected} />
          <OptionSelect label="Payment terms (optional)" placeholder="Select payment terms" value={values.terms} onChange={(event) => set('terms', event.target.value)} options={PAYMENT_TERMS.map((term) => ({ value: term, label: term }))} />
        </div>
        <p className="mt-3 text-[11px] text-outline">A purchase order number will be assigned when the order is created.</p>
      </Section>

      <Section title="Line items" aside={`${values.lines.length} items · Quantities in base units · Currency: INR (₹)`} className="mb-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            list="order-items"
            aria-label="Search by item name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addItem()}
            placeholder="Search by item name or code"
            className="min-w-64 flex-1 rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
          <datalist id="order-items">{ITEMS.map((item) => <option key={item.id} value={item.name}>{item.id}</option>)}</datalist>
          <ActionButton onClick={addItem}>Add item</ActionButton>
        </div>
        {lookupError && <p role="alert" className="mb-2 text-xs text-rose-600">{lookupError}</p>}
        <Table headings={['Item / Code', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)', '']} minWidth={720} empty={values.lines.length ? null : 'No items added yet. Search for an item or use Add item to enter quantities and rates.'}>
          {values.lines.map((line) => {
            const item = itemById(line.itemId)
            return (
              <Row key={line.itemId}>
                <Cell><p className="font-semibold">{item.name}</p><p className="text-[11px] text-outline">{item.id}</p></Cell>
                <Cell><input type="number" min="1" aria-label={`Quantity for ${item.name}`} value={line.ordered} onChange={(event) => editLine(line.itemId, { ordered: event.target.value })} className="w-28 rounded border border-slate-200 px-2 py-1.5 text-[13px] outline-none focus:border-brand" /></Cell>
                <Cell>{item.unitPlural}</Cell>
                <Cell><input type="number" min="0" step="0.01" aria-label={`Rate for ${item.name}`} value={line.rate} onChange={(event) => editLine(line.itemId, { rate: event.target.value })} className="w-24 rounded border border-slate-200 px-2 py-1.5 text-[13px] outline-none focus:border-brand" /></Cell>
                <Cell className="font-semibold">{money((Number(line.ordered) || 0) * (Number(line.rate) || 0))}</Cell>
                <Cell><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setValues((current) => ({ ...current, lines: current.lines.filter((entry) => entry.itemId !== line.itemId) }))} className="text-outline hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button></Cell>
              </Row>
            )
          })}
        </Table>
        {errors.lines && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.lines}</p>}
      </Section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Section title="Notes (optional)">
          <TextArea label="Notes" rows={4} placeholder="Add delivery instructions or a note for the supplier…" value={values.notes} onChange={(event) => set('notes', event.target.value)} />
          <p className="mt-2 text-[11px] text-outline">Creating an order does not add stock. Stock becomes available after receiving and posting.</p>
        </Section>
        <Section title="Order summary">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-on-surface-variant">Items</dt><dd>{values.lines.length}</dd></div>
            <div className="flex justify-between"><dt className="text-on-surface-variant">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-on-surface-variant">Tax</dt><dd>{money(0)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3"><dt className="font-semibold">Total amount</dt><dd className="text-2xl font-semibold">{money(subtotal)}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-outline">Tax is recorded from the supplier’s invoice when the goods are received.</p>
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <p className="text-xs text-on-surface-variant">Select a supplier, set delivery details and add at least one item to create an order.</p>
        <div className="flex items-center gap-2">
          <ActionButton to={ROUTES.inventoryOrders}>Cancel</ActionButton>
          <ActionButton onClick={() => save(true)}>Save draft</ActionButton>
          <ActionButton variant="brand" onClick={() => save(false)}>Create purchase order</ActionButton>
        </div>
      </div>
    </DetailFrame>
  )
}
