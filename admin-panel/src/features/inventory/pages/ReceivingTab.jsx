import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { ListCard, ListFooter, NextLink, Pill, Toolbar } from '../components/shared'
import { RECEIPT_TONE, REF_CLASS } from '../components/tones'
import { locationName } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { qty, shortDate, shortDateTime } from '../format'
import { receiptState, supplierOf, unresolvedOf } from '../selectors'

const TYPES = ['Supplier receipt', 'Branch transfer']

// Supplier receipts (GRNs) and branch transfers waiting to be received, newest first.
function receivingRows(state) {
  const receipts = state.receipts.map((receipt) => ({ kind: 'Supplier receipt', id: receipt.id, date: receipt.date, time: receipt.time, receipt }))
  const transfers = state.transfers
    .filter((transfer) => ['In transit', 'Received'].includes(transfer.status))
    .map((transfer) => ({ kind: 'Branch transfer', id: transfer.id, date: transfer.dispatched ?? transfer.created, time: transfer.dispatchedTime ?? '00:00', transfer }))
  return [...receipts, ...transfers].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}

export default function ReceivingTab() {
  const { state } = useStock()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const all = receivingRows(state)
  const needle = query.trim().toLowerCase()
  const label = (row) => (row.receipt ? receiptState(row.receipt) : row.transfer.status === 'In transit' ? 'Awaiting branch receipt' : 'Received')
  const rows = all.filter((row) => (!type || row.kind === type) && (!status || label(row) === status) && (!needle || `${row.id} ${row.receipt ? supplierOf(state, row.receipt.supplierId).name : ''}`.toLowerCase().includes(needle)))
  const pending = all.filter((row) => (row.receipt ? !row.receipt.posted : row.transfer.status === 'In transit'))
  const blocked = state.receipts.find((receipt) => unresolvedOf(receipt).length)

  const download = () => exportCsv('receiving.csv', [['Reference', 'Type', 'Status'], ...rows.map((row) => [row.id, row.kind, label(row)])])

  return (
    <>
      <ListCard title="Receiving / GRNs" count={`${pending.length} pending receipts`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search GRN, PO, transfer or supplier"
          filters={[
            { label: 'Receipt type', value: type, onChange: setType, all: 'All receipt types', options: TYPES },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: [...new Set(all.map(label))] },
          ]}
        />
        <Table headings={['Receipt / Source ref', 'Source / Receiving store', 'Received', 'Accepted / Posted', 'Status', 'Next step']} minWidth={900} empty={rows.length ? null : 'No receipts match the current filters.'}>
          {rows.map((row) => {
            if (row.receipt) {
              const { receipt } = row
              const state$ = receiptState(receipt)
              const line = receipt.lines[0]
              return (
                <Row key={row.id}>
                  <Cell><Link to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })} className={REF_CLASS}>{receipt.id}</Link><p className="text-[11px] text-outline">{shortDateTime(receipt.date, receipt.time)} · {receipt.receivedBy}</p></Cell>
                  <Cell className="text-xs"><p className="font-semibold">{supplierOf(state, receipt.supplierId).name}</p><p className="text-outline">Supplier · {locationName(receipt.store)} · {receipt.orderId} · {itemById(line.itemId).name}</p></Cell>
                  <Cell className="text-xs"><p className="font-semibold">{qty(receipt.lines.reduce((sum, entry) => sum + entry.received, 0))}</p><p className="text-outline">{itemById(line.itemId).unitPlural}</p></Cell>
                  <Cell className="text-xs"><p className="font-semibold">{qty(receipt.lines.reduce((sum, entry) => sum + entry.accepted, 0))} accepted</p><p className="text-outline">{receipt.posted ? 'Posted' : '0 posted'} · batch {line.batches.map((entry) => entry.batchNo).join(' / ')}</p></Cell>
                  <Cell><Pill tone={RECEIPT_TONE[state$]}>{state$}</Pill><p className="mt-1 text-[11px] text-outline">{receipt.posted ? `${shortDate(receipt.date)} · no discrepancy` : unresolvedOf(receipt).length ? `Posting blocked · ${unresolvedOf(receipt).length} unresolved` : 'Ready to post'}</p></Cell>
                  <Cell><NextLink to={pathFor(ROUTES.inventoryReceipt, { receiptId: receipt.id })}>{receipt.posted ? 'View audit trail' : 'Reconcile receipt'}</NextLink></Cell>
                </Row>
              )
            }
            const { transfer } = row
            const inTransit = transfer.status === 'In transit'
            return (
              <Row key={row.id}>
                <Cell><Link to={`${ROUTES.stockTransfers}?transfer=${transfer.id}`} className={REF_CLASS}>{transfer.id}</Link><p className="text-[11px] text-outline">Dispatched {shortDateTime(transfer.dispatched, transfer.dispatchedTime)}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{locationName(transfer.from)} → {locationName(transfer.to)}</p><p className="text-outline">Branch transfer · {transfer.lines.map((line) => itemById(line.itemId).name).join(', ')}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{inTransit ? '—' : qty(transfer.lines.reduce((sum, line) => sum + line.received, 0))}</p><p className="text-outline">{inTransit ? `${qty(transfer.lines.reduce((sum, line) => sum + line.qty, 0))} in transit` : 'received'}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{inTransit ? 'Not accepted' : 'Accepted'}</p><p className="text-outline">{inTransit ? '0 posted at destination' : 'Posted at destination'}</p></Cell>
                <Cell><Pill tone={inTransit ? 'warning' : 'success'}>{label(row)}</Pill></Cell>
                <Cell><NextLink to={`${ROUTES.stockTransfers}?transfer=${transfer.id}`}>{inTransit ? 'Track receipt' : 'View receipt'}</NextLink></Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="entries">{' · includes outbound branch receipts'}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Accepted units become available only after reconciliation and posting at the receiving store.</p>
      {blocked && (
        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{unresolvedOf(blocked).length} unresolved discrepancy · {blocked.id} cannot be posted</p>
              <p className="mt-1">{unresolvedOf(blocked)[0].qty} units short ({unresolvedOf(blocked)[0].id}): supplier confirmation and manager approval pending. Accepted units remain unavailable until the shortage is resolved.</p>
            </div>
          </div>
          <NextLink to={pathFor(ROUTES.inventoryReceipt, { receiptId: blocked.id })}>Resolve discrepancy</NextLink>
        </section>
      )}
    </>
  )
}
