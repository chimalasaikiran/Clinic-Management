import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check, OptionSelect, TextArea } from '../../patients/components/parts'
import DetailFrame from '../components/DetailFrame'
import { Pill, Section } from '../components/shared'
import { REF_CLASS } from '../components/tones'
import { BINS, DISCREPANCY_REASONS, DISCREPANCY_RESOLUTIONS, LOCATIONS, NOW } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, formatTime, money, qty } from '../format'
import { isOpenOrder, orderProgress, orderStatus } from '../selectors'
import { validateReceipt } from '../validation'

const RECEIVERS = ['N. Desai', 'K. Rao']
const blankBatch = () => ({ batchNo: '', expiry: '', qty: '', bin: BINS[0] })

// One receiving line per purchase-order item: what is still outstanding after earlier receipts.
function linesFor(order, receipts) {
  return orderProgress(order, receipts).map((line) => ({ itemId: line.itemId, ordered: line.ordered, rate: line.rate, outstanding: line.ordered - line.received, received: '', rejected: '0', batches: [blankBatch()] }))
}

const num = (value) => Number(value) || 0

export default function ReceiveStockPage() {
  const { state, run } = useStock()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preset = state.orders.find((order) => order.id === params.get('order'))
  const [values, setValues] = useState({
    supplierId: preset?.supplierId ?? '', orderId: preset?.id ?? '', store: 'central', challan: '', receivedBy: RECEIVERS[0], reason: '', resolution: '', note: '', verified: false, evidence: '',
    lines: preset ? linesFor(preset, state.receipts) : [],
  })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateReceipt(values) : {}
  const order = state.orders.find((entry) => entry.id === values.orderId)
  const openOrders = state.orders.filter((entry) => entry.supplierId === values.supplierId && isOpenOrder(orderStatus(entry, state.receipts)))
  const supplier = state.suppliers.find((entry) => entry.id === values.supplierId)

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const pickSupplier = (supplierId) => setValues((current) => ({ ...current, supplierId, orderId: '', lines: [] }))
  const pickOrder = (orderId) => {
    const next = state.orders.find((entry) => entry.id === orderId)
    setValues((current) => ({ ...current, orderId, lines: next ? linesFor(next, state.receipts) : [] }))
  }
  const editLine = (index, change) => setValues((current) => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...change } : line)) }))
  const editBatch = (index, at, change) => editLine(index, { batches: values.lines[index].batches.map((batch, position) => (position === at ? { ...batch, ...change } : batch)) })

  const totals = values.lines.reduce((sum, line) => ({ received: sum.received + num(line.received), rejected: sum.rejected + num(line.rejected), value: sum.value + (num(line.received) - num(line.rejected)) * line.rate, batches: sum.batches + line.batches.filter((batch) => batch.batchNo).length }), { received: 0, rejected: 0, value: 0, batches: 0 })
  const accepted = totals.received - totals.rejected
  const short = values.lines.some((line) => num(line.received) < line.outstanding && values.lines.some((entry) => num(entry.received) > 0))
  const differs = short || totals.rejected > 0

  const submit = (mode) => {
    setSubmitted(true)
    if (mode === 'post' && Object.keys(validateReceipt(values)).length) return
    if (mode === 'draft' && !values.supplierId) return
    const lines = values.lines.map((line) => ({ itemId: line.itemId, ordered: line.ordered, received: num(line.received), rejected: num(line.rejected), accepted: num(line.received) - num(line.rejected), short: Math.max(0, line.outstanding - num(line.received)), batches: line.batches.filter((batch) => num(batch.qty) > 0).map((batch) => ({ ...batch, qty: num(batch.qty) })) }))
    const discrepancies = differs ? lines.flatMap((line) => [
      line.short > 0 && { kind: 'Short delivery', qty: line.short, state: 'Documented', note: values.note || values.reason, resolution: values.resolution },
      line.rejected > 0 && { kind: 'Damaged packs', qty: line.rejected, state: 'Documented', note: values.note || values.reason, resolution: values.resolution },
    ].filter(Boolean)) : []
    const created = run('receipt/save', { mode, supplierId: values.supplierId, orderId: values.orderId, store: values.store, challan: values.challan.trim(), invoice: '', bay: 'C-01', date: NOW.date, time: NOW.time, receivedBy: values.receivedBy, verified: values.verified, lines, discrepancies, attachments: values.evidence ? 1 : 0 })
    navigate(pathFor(ROUTES.inventoryReceipt, { receiptId: created.id }))
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Receiving / GRNs', to: ROUTES.inventoryReceiving }, { label: 'Receive Stock' }]}
      title="Receive Stock"
      badge={<Pill>Draft · not posted</Pill>}
      subtitle="Check the delivery, record batches and reconcile differences before adding stock to Central Stores."
      actions={<ActionButton to={ROUTES.inventoryReceiving}>← Back to receiving</ActionButton>}
    >
      <InfoNote tone="brand" className="mb-5">Incoming quantities are not available stock. Save a draft without changing balances; Post receipt adds only accepted quantities to the stock ledger.</InfoNote>

      <Section title="Supplier & delivery" aside="* Required fields" className="mb-5">
        <div className="grid gap-4 md:grid-cols-3">
          <OptionSelect label="Supplier" required placeholder="Select supplier" value={values.supplierId} onChange={(event) => pickSupplier(event.target.value)} error={errors.supplierId} options={state.suppliers.filter((entry) => entry.active).map((entry) => ({ value: entry.id, label: entry.name }))} />
          <OptionSelect label="Purchase order" required placeholder={values.supplierId ? 'Select open purchase order' : 'Select a supplier first'} value={values.orderId} onChange={(event) => pickOrder(event.target.value)} error={errors.orderId} options={openOrders.map((entry) => ({ value: entry.id, label: entry.id }))} />
          <OptionSelect label="Receiving store" required value={values.store} onChange={(event) => set('store', event.target.value)} options={LOCATIONS.filter((entry) => entry.kind === 'store').map((entry) => ({ value: entry.id, label: entry.name }))} />
          <TextInput label="Delivery note / challan" required value={values.challan} onChange={(event) => set('challan', event.target.value)} error={errors.challan} />
          <TextInput label="Received on" readOnly value={`${formatDate(NOW.date)}, ${formatTime(NOW.time)}`} />
          <OptionSelect label="Received by" required value={values.receivedBy} onChange={(event) => set('receivedBy', event.target.value)} error={errors.receivedBy} options={RECEIVERS.map((name) => ({ value: name, label: name }))} />
        </div>
        {order && (
          <p className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-lowest px-3 py-2 text-xs text-on-surface-variant">
            <span><Pill tone="neutral">{orderStatus(order, state.receipts)}</Pill> Ordered {formatDate(order.date)} · {order.lines.length} item · {supplier?.name}</span>
            <Link to={pathFor(ROUTES.inventoryOrder, { orderId: order.id })} className={REF_CLASS}>View purchase order ↗</Link>
          </p>
        )}
      </Section>

      <Section title="Items to receive" aside={`${values.lines.length} item${values.lines.length === 1 ? '' : 's'} · All quantities in base units`} className="mb-5">
        {values.lines.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Choose a supplier and an open purchase order to list the items expected.</p>
        ) : (
          values.lines.map((line, index) => {
            const item = itemById(line.itemId)
            const lineAccepted = num(line.received) - num(line.rejected)
            const allocated = line.batches.reduce((sum, batch) => sum + num(batch.qty), 0)
            return (
              <div key={line.itemId} className="mb-5 border-b border-slate-100 pb-5 last:mb-0 last:border-0 last:pb-0">
                <div className="grid items-end gap-3 md:grid-cols-[2fr_repeat(3,1fr)_repeat(3,1.2fr)]">
                  <div><p className="font-semibold">{item.name}</p><p className="text-[11px] text-outline">{item.id} · {item.unitPlural}</p></div>
                  <div className="text-xs"><p className="text-outline">Ordered</p><p className="font-semibold">{qty(line.ordered)}</p></div>
                  <div className="text-xs"><p className="text-outline">Prev. received</p><p className="font-semibold">{qty(line.ordered - line.outstanding)}</p></div>
                  <div className="text-xs"><p className="text-outline">Outstanding</p><p className="font-semibold">{qty(line.outstanding)}</p></div>
                  <TextInput label="Received now" inputMode="numeric" value={line.received} onChange={(event) => editLine(index, { received: event.target.value })} />
                  <div className="text-xs"><p className="text-outline">Accepted</p><p className="h-10 rounded-md bg-teal-50 px-3 py-2.5 text-[13px] font-semibold text-brand">{qty(lineAccepted)}</p></div>
                  <TextInput label="Rejected" inputMode="numeric" value={line.rejected} onChange={(event) => editLine(index, { rejected: event.target.value })} />
                </div>
                {errors[`line${index}`] && <p role="alert" className="mt-2 text-xs text-rose-600">{errors[`line${index}`]}</p>}

                <p className="mt-4 text-xs font-semibold">Batch &amp; expiry · {item.name}</p>
                {line.batches.map((batch, at) => (
                  <div key={at} className="mt-2 grid gap-3 md:grid-cols-4">
                    <TextInput label={at === 0 ? 'Batch number' : undefined} aria-label={`Batch number ${at + 1} for ${item.name}`} value={batch.batchNo} onChange={(event) => editBatch(index, at, { batchNo: event.target.value })} />
                    <TextInput label={at === 0 ? 'Expiry date' : undefined} aria-label={`Expiry date ${at + 1} for ${item.name}`} type="date" value={batch.expiry} onChange={(event) => editBatch(index, at, { expiry: event.target.value })} />
                    <TextInput label={at === 0 ? 'Accepted qty' : undefined} aria-label={`Accepted quantity ${at + 1} for ${item.name}`} inputMode="numeric" value={batch.qty} onChange={(event) => editBatch(index, at, { qty: event.target.value })} />
                    <OptionSelect label={at === 0 ? 'Bin / shelf' : undefined} aria-label={`Bin ${at + 1} for ${item.name}`} value={batch.bin} onChange={(event) => editBatch(index, at, { bin: event.target.value })} options={BINS.map((bin) => ({ value: bin, label: bin }))} />
                  </div>
                ))}
                <div className="mt-2 flex flex-wrap items-center justify-between text-xs">
                  <button type="button" onClick={() => editLine(index, { batches: [...line.batches, blankBatch()] })} className="font-semibold text-brand hover:underline">+ Add batch</button>
                  <span className={allocated === lineAccepted && lineAccepted > 0 ? 'text-emerald-700' : 'text-on-surface-variant'}>{qty(allocated)} / {qty(lineAccepted)} allocated{allocated === lineAccepted && lineAccepted > 0 ? ' · expiry checks passed' : ''}</span>
                </div>
              </div>
            )
          })
        )}
        {errors.lines && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.lines}</p>}
      </Section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Section title="Delivery discrepancy" aside={differs ? <Pill tone="warning">Difference recorded</Pill> : 'None detected'}>
          {differs ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-on-surface-variant">{totals.rejected > 0 ? `${totals.rejected} rejected. ` : ''}{short ? 'Fewer units were received than are outstanding; the missing units are not part of this receipt.' : ''}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <OptionSelect label="Reason" required placeholder="Select a reason" value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} options={DISCREPANCY_REASONS.map((entry) => ({ value: entry, label: entry }))} />
                <OptionSelect label="Resolution" required placeholder="Select a resolution" value={values.resolution} onChange={(event) => set('resolution', event.target.value)} error={errors.resolution} options={DISCREPANCY_RESOLUTIONS.map((entry) => ({ value: entry, label: entry }))} />
              </div>
              <TextArea label="Receiving note" rows={2} value={values.note} onChange={(event) => set('note', event.target.value)} />
              <label className="flex items-center justify-between gap-2 text-xs"><span>{values.evidence || 'No evidence attached'}</span><span className="font-semibold text-brand">Attach evidence<input type="file" className="sr-only" aria-label="Attach evidence" onChange={(event) => set('evidence', event.target.files[0]?.name ?? '')} /></span></label>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Received quantities match what is outstanding and nothing was rejected.</p>
          )}
        </Section>

        <Section title="Receipt summary">
          <p className="font-semibold">{supplier?.name ?? 'No supplier selected'}</p>
          <p className="mb-3 text-[11px] text-outline">{values.orderId || '—'} · Central Stores</p>
          <dl className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs">
            {[['Received this delivery', `${qty(totals.received)}`], ['Rejected', `${qty(totals.rejected)}`], ['Accepted for posting', `${qty(accepted)}`], ['Batches', `${totals.batches}`], ['Receipt value', money(totals.value)]].map(([label, value]) => (
              <div key={label} className="flex justify-between"><dt className="text-on-surface-variant">{label}</dt><dd className="font-semibold">{value}</dd></div>
            ))}
          </dl>
          <div className="mt-4 rounded-md bg-teal-50/60 p-3 text-xs">
            <p className="font-semibold">Stock ledger impact</p>
            <p className="mt-1 flex justify-between"><span className="text-on-surface-variant">On posting</span><span className="font-semibold text-brand">+{qty(accepted)}</span></p>
            <p className="mt-2 text-[11px] text-outline">Posting creates a GRN and adds accepted batches to available stock.</p>
          </div>
        </Section>
      </div>

      <Check checked={values.verified} onChange={(event) => set('verified', event.target.checked)} label="I have verified the physical quantities, batch numbers, expiry dates and delivery discrepancies." />
      {errors.verified && <p role="alert" className="mt-1 text-xs text-rose-600">{errors.verified}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="text-xs"><p className="font-semibold">Draft · no stock changes made</p><p className="text-outline">Posting records the receiver and time in an immutable audit trail.</p></div>
        <div className="flex items-center gap-2">
          <ActionButton to={ROUTES.inventoryReceiving}>Cancel</ActionButton>
          <ActionButton onClick={() => submit('draft')}>Save draft</ActionButton>
          <ActionButton variant="brand" onClick={() => submit('post')}>Post receipt</ActionButton>
        </div>
      </div>
    </DetailFrame>
  )
}
