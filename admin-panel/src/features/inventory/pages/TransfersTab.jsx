import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { InfoNote } from '../../../components/workspace/controls'
import { ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { ListCard, ListFooter, NextLink, Pill, Toolbar } from '../components/shared'
import { REF_CLASS, TRANSFER_TONE } from '../components/tones'
import { locationName } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { qty, shortDate, shortDateTime } from '../format'
import { transferNote } from '../selectors'

const NEXT = { 'In transit': 'Track receipt', 'Ready for dispatch': 'Dispatch', Draft: 'Edit draft', Received: 'View receipt', Cancelled: 'View history' }

export default function TransfersTab() {
  const { state } = useStock()
  const [query, setQuery] = useState('')
  const [destination, setDestination] = useState('')
  const [status, setStatus] = useState('')
  const all = state.transfers
  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (transfer) =>
      (!destination || locationName(transfer.to) === destination) &&
      (!status || transfer.status === status) &&
      (!needle || `${transfer.id} ${transfer.issueId ?? ''} ${transfer.requestId ?? ''} ${transfer.lines.map((line) => itemById(line.itemId).name).join(' ')}`.toLowerCase().includes(needle)),
  )
  const pending = all.filter((transfer) => transfer.status === 'In transit')
  const focus = pending[0]

  const download = () => exportCsv('transfers.csv', [['Transfer', 'From', 'To', 'Status'], ...rows.map((transfer) => [transfer.id, locationName(transfer.from), locationName(transfer.to), transfer.status])])

  return (
    <>
      <ListCard title="Transfers" count={`${pending.length} branch receipt pending`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search transfer, issue, request or item"
          filters={[
            { label: 'Destination', value: destination, onChange: setDestination, all: 'All destinations', options: [...new Set(all.map((transfer) => locationName(transfer.to)))] },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: [...new Set(all.map((transfer) => transfer.status))] },
          ]}
        />
        <Table headings={['Transfer / Issue', 'Route / Items', 'Quantity', 'Dispatch', 'Status', 'Next step']} minWidth={900} empty={rows.length ? null : 'No transfers match the current filters.'}>
          {rows.map((transfer) => {
            const first = transfer.lines[0]
            const item = itemById(first.itemId)
            return (
              <Row key={transfer.id}>
                <Cell>
                  <Link to={`${ROUTES.stockTransfers}?transfer=${transfer.id}`} className={REF_CLASS}>{transfer.id}</Link>
                  <p className="text-[11px] text-outline">{transfer.issueId ?? 'No issue yet'}{transfer.requestId ? ` · ${transfer.requestId}` : ''}</p>
                </Cell>
                <Cell className="text-xs"><p className="font-semibold">{locationName(transfer.from)} → {locationName(transfer.to)}</p><p className="text-outline">{item.name} · {first.batchNo}{transfer.lines.length > 1 ? ` +${transfer.lines.length - 1} more` : ''}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{qty(transfer.lines.reduce((sum, line) => sum + line.qty, 0))}</p><p className="text-outline">{item.unitPlural} · {transfer.lines.length} {transfer.lines.length === 1 ? 'item' : 'items'}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{transfer.dispatched ? shortDateTime(transfer.dispatched, transfer.dispatchedTime) : 'Not dispatched'}</p><p className="text-outline">{transfer.dispatched ? `Issued by ${transfer.createdBy}` : `Created ${shortDate(transfer.created)}`}</p></Cell>
                <Cell><Pill tone={TRANSFER_TONE[transfer.status]}>{transfer.status === 'In transit' ? 'Dispatched · not received' : transfer.status}</Pill><p className="mt-1 text-[11px] text-outline">{transferNote(transfer)}</p></Cell>
                <Cell><NextLink to={`${ROUTES.stockTransfers}?transfer=${transfer.id}`}>{NEXT[transfer.status]}</NextLink></Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="transfers">{' · originating at Central Stores'}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Stock is deducted from the source store at issue, not again at dispatch. In-transit units are excluded from available stock at both stores until the destination accepts and posts them.</p>
      {focus && (
        <InfoNote tone="brand" className="mt-4">
          <p className="text-sm font-semibold text-on-surface">{focus.id} · dispatch is not receipt</p>
          <p className="mt-1">
            {qty(focus.lines[0].qty)} {itemById(focus.lines[0].itemId).name} units from {focus.lines[0].batchNo} left {locationName(focus.from)} on {shortDateTime(focus.dispatched, focus.dispatchedTime)}. The source is already deducted; {locationName(focus.to)} has not accepted or posted these units, so the transfer remains open.{' '}
            <Link to={`${ROUTES.stockTransfers}?transfer=${focus.id}`} className={REF_CLASS}>Track branch receipt</Link>
          </p>
        </InfoNote>
      )}
    </>
  )
}
