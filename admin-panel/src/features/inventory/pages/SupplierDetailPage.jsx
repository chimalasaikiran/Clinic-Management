import { useState } from 'react'
import { AlertCircle, Pencil, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { FilterTabs } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { FactGrid, NextLink, Pill, Section } from '../components/shared'
import { ORDER_TONE, RECEIPT_TONE } from '../components/tones'
import { locationName } from '../constants'
import { useStock } from '../context/useStock'
import { formatDate } from '../format'
import { orderStatus, receiptState, supplierIssues } from '../selectors'

export default function SupplierDetailPage() {
  const { supplierId } = useParams()
  const { state } = useStock()
  const [tab, setTab] = useState('all')
  const supplier = state.suppliers.find((row) => row.id === supplierId)
  if (!supplier) return <MissingRecord what="supplier" backTo={ROUTES.suppliers} backLabel="Back to suppliers" />

  const orders = state.orders.filter((order) => order.supplierId === supplier.id && !order.draft).map((order) => ({ kind: 'po', ref: order.id, type: 'Purchase order', date: order.date, store: order.store, status: orderStatus(order, state.receipts), tone: ORDER_TONE[orderStatus(order, state.receipts)], action: <NextLink to={pathFor(ROUTES.inventoryOrder, { orderId: order.id })}>View purchase order</NextLink> }))
  const receipts = state.receipts.filter((receipt) => receipt.supplierId === supplier.id).map((receipt) => ({ kind: 'grn', ref: receipt.id, type: 'Goods received note', date: receipt.date, store: receipt.store, status: receiptState(receipt), tone: RECEIPT_TONE[receiptState(receipt)], action: <NextLink to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })}>{receipt.posted ? 'View receipt' : 'Review receipt'}</NextLink> }))
  const all = [...orders, ...receipts].sort((a, b) => b.date.localeCompare(a.date))
  const rows = tab === 'all' ? all : all.filter((row) => row.kind === tab)
  const issues = supplierIssues(state, supplier.id)
  const address = [supplier.address, supplier.city, supplier.state, supplier.postal, supplier.country].filter(Boolean).join(', ')

  return (
    <DetailFrame
      crumbs={[{ label: 'Suppliers', to: ROUTES.suppliers }, { label: supplier.name }]}
      title={supplier.name}
      badge={<Pill tone={supplier.active ? 'success' : 'neutral'}>{supplier.active ? 'Active' : 'Inactive'}</Pill>}
      subtitle={`${supplier.id} · Shared supplier record · All locations`}
      actions={
        <>
          <ActionButton icon={Pencil} to={pathFor(ROUTES.supplierEdit, { supplierId: supplier.id })}>Edit Supplier</ActionButton>
          <ActionButton variant="brand" icon={Plus} disabled={!supplier.active} to={supplier.active ? `${ROUTES.inventoryOrderNew}?supplier=${supplier.id}` : undefined}>Create Purchase Order</ActionButton>
        </>
      }
    >
      {issues.map((receipt) => (
        <section key={receipt.id} className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">1 linked receipt requires reconciliation</p>
            <p className="mt-1">{receipt.id}: {receipt.lines[0].short} tablets short and {receipt.lines[0].rejected} rejected. Review the linked receipt in the existing receiving workflow.</p>
          </div>
        </section>
      ))}

      <Section title="Saved supplier information" aside="Shared with inventory and purchasing" className="mb-5">
        <FactGrid facts={[['Supplier name', supplier.name], ['Supplier code', supplier.code], ['Supported categories', supplier.categories.join(', ')], ['Contact person', supplier.contact], ['Email', supplier.email], ['Phone', supplier.phone], ['Address', address], ['Payment terms', supplier.terms || 'Not set'], ['Active status', supplier.active ? 'Active' : 'Inactive'], ['Tax identifier / GSTIN', supplier.gstin], ['Business registration identifier', supplier.registration], ['Internal notes', supplier.notes || 'No notes provided']]} />
      </Section>

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Linked transactions</h2>
          <span className="text-[11px] text-outline">Open references in existing workflows</span>
        </header>
        <div className="px-5 pb-3">
          <FilterTabs label="Transaction type" value={tab} onChange={setTab} options={[{ id: 'all', label: 'All transactions', count: all.length }, { id: 'po', label: 'Purchase orders', count: orders.length }, { id: 'grn', label: 'GRNs', count: receipts.length }, { id: 'return', label: 'Purchase returns', count: 0 }]} />
        </div>
        <Table headings={['Reference / Type', 'Date', 'Store / Branch', 'Status', 'Action']} minWidth={720} empty={rows.length ? null : 'No linked transactions of this type.'}>
          {rows.map((row) => (
            <Row key={row.ref}>
              <Cell><p className="font-mono text-xs font-semibold text-brand">{row.ref}</p><p className="text-[11px] text-outline">{row.type}</p></Cell>
              <Cell className="text-xs">{formatDate(row.date)}</Cell>
              <Cell className="text-xs">{locationName(row.store)}</Cell>
              <Cell><Pill tone={row.tone}>{row.status}</Pill></Cell>
              <Cell>{row.action}</Cell>
            </Row>
          ))}
        </Table>
        <div className="border-t border-slate-100 px-5 py-4 text-xs"><p className="font-semibold">No linked purchase returns</p><p className="text-outline">Purchase returns appear here when recorded against this supplier.</p></div>
      </section>

      <Section title="Available performance history" aside="Based only on linked records" className="mb-5">
        <FactGrid columns={4} facts={[['Purchasing activity', `${orders.length} purchase order · ${receipts.length} GRN`], ['On-time delivery', 'Not available · expected delivery date not recorded'], ['Open operational issue', issues.length ? `${issues.length} receipt awaiting reconciliation` : 'None'], ['Supplier rating', 'Not available · no scored history']]} />
      </Section>

      <Section title="Audit history" aside="Recorded changes">
        <ol className="flex flex-col gap-3 text-xs">
          {supplier.audit.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <span className="text-outline">{entry.at}</span>
              <span><span className="font-semibold text-on-surface">{entry.text}</span><br /><span className="text-outline">{entry.by}</span></span>
            </li>
          ))}
        </ol>
      </Section>
      <p className="mt-4 text-[11px] text-outline">Create Purchase Order opens the existing order form with this shared supplier selected. <Link to={ROUTES.suppliers} className="font-semibold text-brand hover:underline">Back to Suppliers</Link></p>
    </DetailFrame>
  )
}
