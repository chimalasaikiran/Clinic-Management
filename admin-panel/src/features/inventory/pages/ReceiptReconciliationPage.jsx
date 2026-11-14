import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Lock, Paperclip } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import { OptionSelect, TextArea } from '../../patients/components/parts'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { FactGrid, Pill, Section } from '../components/shared'
import { RECEIPT_TONE, REF_CLASS } from '../components/tones'
import { DISCREPANCY_RESOLUTIONS, locationName } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, qty, shortDateTime } from '../format'
import { receiptState, supplierOf, unresolvedOf } from '../selectors'
import { summarise } from '../stockLogic'
import { validateResolution } from '../validation'

const STATE_TONE = { Unresolved: 'danger', Documented: 'success', Resolved: 'success' }

function Check({ ok, children }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle
  return (
    <li className={`flex items-start gap-2 text-xs ${ok ? 'text-on-surface-variant' : 'text-danger'}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

export default function ReceiptReconciliationPage() {
  const { receiptId } = useParams()
  const { state, run } = useStock()
  const [values, setValues] = useState({ disposition: DISCREPANCY_RESOLUTIONS[0], note: '' })
  const [submitted, setSubmitted] = useState(false)
  const [postError, setPostError] = useState('')
  const receipt = state.receipts.find((row) => row.id === receiptId)
  if (!receipt) return <MissingRecord what="receipt" backTo={ROUTES.inventoryReceiving} backLabel="Back to receiving" />

  const supplier = supplierOf(state, receipt.supplierId)
  const current = receiptState(receipt)
  const unresolved = unresolvedOf(receipt)
  const first = unresolved[0]
  const errors = submitted ? validateResolution(values) : {}
  const sum = (key) => receipt.lines.reduce((total, line) => total + line[key], 0)
  const line = receipt.lines[0]
  const item = itemById(line.itemId)
  const available = summarise(state.batches, line.itemId, receipt.store).available
  const reconciled = sum('received') === sum('accepted') + sum('rejected')
  const rejectedDocumented = receipt.discrepancies.filter((entry) => entry.kind === 'Damaged packs').every((entry) => entry.state !== 'Unresolved')

  const record = () => {
    setSubmitted(true)
    if (Object.keys(validateResolution(values)).length) return
    run('receipt/resolve', { id: receipt.id, discrepancyId: first.id, disposition: values.disposition, note: values.note.trim() })
    setSubmitted(false)
    setValues({ disposition: DISCREPANCY_RESOLUTIONS[0], note: '' })
  }

  const post = () => {
    const outcome = run('receipt/post', { id: receipt.id })
    setPostError(outcome.error ?? '')
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Receiving / GRNs', to: ROUTES.inventoryReceiving }, { label: receipt.id }]}
      title="Receiving reconciliation"
      badge={<Pill tone={RECEIPT_TONE[current]}>{current === 'Reconciliation required' ? 'Posting blocked' : current}</Pill>}
      subtitle={`${receipt.id} · Supplier receipt · Received ${formatDate(receipt.date)}, ${shortDateTime(receipt.date, receipt.time).split('· ')[1]} by ${receipt.receivedBy}`}
      actions={receipt.attachments ? <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium"><Paperclip className="size-3.5" aria-hidden="true" />{receipt.attachments} attachments</span> : null}
    >
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <FactGrid columns={4} facts={[
          ['Supplier', supplier.name, `${supplier.id} · Approved supplier`],
          ['Purchase order', <Link key="po" to={pathFor(ROUTES.inventoryOrder, { orderId: receipt.orderId })} className={REF_CLASS}>{receipt.orderId} ↗</Link>, `${formatDate(state.orders.find((order) => order.id === receipt.orderId).date)} · ${qty(line.ordered)} ${item.unitPlural}`],
          ['Receiving store', locationName(receipt.store), `Receiving bay · ${receipt.bay}`],
          ['Supplier references', `${receipt.challan} · Delivery challan`, `Invoice ${receipt.invoice || 'not recorded'}`],
        ]} />
      </section>

      {unresolved.length > 0 && (
        <section role="alert" className="mb-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{unresolved.length} unresolved discrepancy · accepted stock is not yet available.</p>
            <p className="mt-1">{first.qty} {item.unitPlural} are short against the purchase order. Record a supplier-backed resolution and approval before posting the {qty(sum('accepted'))} accepted {item.unitPlural}. Original ordered and received quantities remain unchanged.</p>
          </div>
        </section>
      )}

      <Section title="Receipt lines" aside={receipt.posted ? 'Posted' : 'Not posted'} className="mb-5">
        <Table headings={['Item / SKU', 'Ordered', 'Received', 'Accepted¹', 'Rejected', 'Short', 'Batch / Expiry', 'Status']} minWidth={860}>
          {receipt.lines.map((entry) => (
            <Row key={entry.itemId}>
              <Cell><Link to={pathFor(ROUTES.inventoryItem, { itemId: entry.itemId })} className={REF_CLASS}>{itemById(entry.itemId).name}</Link><p className="text-[11px] text-outline">{entry.itemId} · {itemById(entry.itemId).unit}</p></Cell>
              <Cell>{qty(entry.ordered)}</Cell>
              <Cell>{qty(entry.received)}</Cell>
              <Cell><p className="font-semibold">{qty(entry.accepted)}</p><p className="text-[11px] text-outline">{receipt.posted ? 'Posted' : 'Pending posting'}</p></Cell>
              <Cell><p className="font-semibold">{qty(entry.rejected)}</p><p className="text-[11px] text-outline">{entry.rejected ? 'Damaged' : ''}</p></Cell>
              <Cell>{qty(entry.short)}</Cell>
              <Cell className="text-xs">{entry.batches.map((batch) => <p key={batch.batchNo}><span className="font-mono font-semibold">{batch.batchNo}</span> · {formatDate(batch.expiry)}</p>)}</Cell>
              <Cell>{receipt.posted ? <Pill tone="success">Posted</Pill> : unresolved.length ? <Pill tone="danger">Discrepancy open</Pill> : <Pill tone="info">Reconciled</Pill>}</Cell>
            </Row>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-outline">{qty(sum('received'))} received = {qty(sum('accepted'))} accepted + {qty(sum('rejected'))} rejected. Ordered {qty(line.ordered)} − received {qty(sum('received'))} = {qty(sum('short'))} short. Purchase order balance is not silently closed.<br />¹ Accepted units await reconciliation and posting. Rejected units are segregated, linked to a return and never included in available stock.</p>
      </Section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Discrepancy register" aside={unresolved.length ? <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-danger">{unresolved.length} unresolved</span> : 'All documented'}>
            <Table headings={['Exception', 'Qty', 'Resolution / Evidence', 'State']} minWidth={640} empty={receipt.discrepancies.length ? null : 'No discrepancies were recorded for this receipt.'}>
              {receipt.discrepancies.map((entry) => (
                <Row key={entry.id}>
                  <Cell><p className="font-semibold">{entry.kind}</p><p className="text-[11px] text-outline">{entry.id}</p></Cell>
                  <Cell>{entry.qty}</Cell>
                  <Cell className="text-xs"><p className="font-semibold">{entry.resolution ?? 'Awaiting supplier response'}</p><p className="text-outline">{entry.note}</p></Cell>
                  <Cell><Pill tone={STATE_TONE[entry.state]}>{entry.state}</Pill></Cell>
                </Row>
              ))}
            </Table>
          </Section>

          {first && (
            <Section title="Resolve short delivery" aside={<Pill tone="warning">Awaiting supplier</Pill>}>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <OptionSelect label="Proposed disposition" value={values.disposition} onChange={(event) => setValues((currentValues) => ({ ...currentValues, disposition: event.target.value }))} error={errors.disposition} options={DISCREPANCY_RESOLUTIONS.map((entry) => ({ value: entry, label: entry }))} />
                <div><p className="text-xs text-outline">Short quantity</p><p className="mt-2 text-sm font-semibold">{first.qty} {item.unitPlural}</p></div>
              </div>
              <div className="mt-4">
                <TextArea label="Resolution note" required rows={3} value={values.note} onChange={(event) => setValues((currentValues) => ({ ...currentValues, note: event.target.value }))} error={errors.note} hint="Required: supplier response + Inventory manager approval" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <ActionButton variant="brand" onClick={record}>Record supplier response</ActionButton>
                <p className="max-w-md text-[11px] text-outline">An approved disposition is appended with its actor, time and evidence; the original counts stay visible.</p>
              </div>
            </Section>
          )}
        </div>

        <Section title="Reconcile before posting" className="self-start">
          <ul className="mb-4 flex flex-col gap-2">
            <Check ok={reconciled}>Received = accepted + rejected</Check>
            <Check ok={receipt.verified}>Batch and expiry verified</Check>
            <Check ok={rejectedDocumented}>Rejected quantity documented and return created</Check>
            <Check ok={unresolved.length === 0}>Short delivery resolved and approved</Check>
          </ul>
          <div className="rounded-md bg-surface-lowest p-3 text-xs">
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-outline uppercase">Proposed stock impact · {item.unitPlural}</p>
            <dl className="flex flex-col gap-1.5">
              <div className="flex justify-between"><dt className="text-on-surface-variant">Available now</dt><dd className="font-semibold">{qty(available)}</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Accepted to post</dt><dd className="font-semibold">+{qty(receipt.posted ? 0 : sum('accepted'))}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-semibold">Available after posting</dt><dd className="text-lg font-semibold text-brand">{qty(receipt.posted ? available : available + sum('accepted'))}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-outline">Illustrative impact only. Assumes reservations and other movements remain unchanged.</p>
          </div>
          <ActionButton variant="secondary" className="mt-4 w-full justify-center" icon={unresolved.length || receipt.posted ? Lock : undefined} disabled={unresolved.length > 0 || receipt.posted} onClick={post}>{receipt.posted ? 'Posted to stock' : `Post accepted stock · ${qty(sum('accepted'))}`}</ActionButton>
          {postError && <p role="alert" className="mt-2 text-xs text-rose-600">{postError}</p>}
          <p className="mt-3 text-[11px] text-outline">{unresolved.length ? 'Blocked until the shortage is resolved and approved. No stock ledger entry has been created.' : receipt.posted ? 'Posting added the accepted units to Central Stores and linked this receipt to its purchase order.' : 'Posting adds only accepted units to Central Stores, creates a batch ledger entry and links this receipt to the existing purchase order.'}</p>
        </Section>
      </div>

      <Section title="Receiving audit trail" aside={<Link to={pathFor(ROUTES.inventoryItem, { itemId: line.itemId })} className={REF_CLASS}>Full history ↗</Link>}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {receipt.audit.map((entry, index) => (
            <li key={`${entry.time}-${index}`} className="text-xs">
              <p className="text-[11px] text-outline">{entry.time} · {entry.by.split(' · ')[0]}</p>
              <p className="mt-1 font-semibold text-on-surface">{entry.text}</p>
              <p className="text-outline">{entry.by.split(' · ').slice(1).join(' · ')}</p>
            </li>
          ))}
        </ol>
      </Section>
    </DetailFrame>
  )
}
