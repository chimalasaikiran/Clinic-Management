import { useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { daysBetween } from '../../patients/format'
import { ListCard, ListFooter, Pill, Toolbar } from '../components/shared'
import { REF_CLASS, STOCK_TONE } from '../components/tones'
import { locationName, NOW } from '../constants'
import { useStock } from '../context/useStock'
import { ITEMS } from '../data/items'
import { formatDate, qty } from '../format'
import { stockStatus, summarise } from '../stockLogic'

const STATUSES = ['Available', 'Low stock', 'Near expiry', 'Out of stock']
const EXPIRY_WINDOWS = { 'Within 90 days': 90, 'Within 180 days': 180 }

export default function StockOnHandTab() {
  const { loc } = useOutletContext()
  const { state } = useStock()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : ''
  const [expiry, setExpiry] = useState('')

  const all = ITEMS.map((item) => {
    const stock = summarise(state.batches, item.id, loc)
    const level = loc === 'central' ? item.reorder : item.safety
    return { item, stock, level, status: stockStatus(stock, level) }
  }).filter((row) => row.stock.rows.length > 0)

  // The status filter lives in the address so the Needs attention links can set it from anywhere on the page.
  const setStatus = (value) => {
    const next = new URLSearchParams(params)
    if (value) next.set('status', value)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (row) =>
      (!category || row.item.category === category) &&
      (!status || row.status === status) &&
      (!expiry || (row.stock.earliestExpiry && daysBetween(NOW.date, row.stock.earliestExpiry) <= EXPIRY_WINDOWS[expiry])) &&
      (!needle || `${row.item.name} ${row.item.id} ${row.stock.rows.map((batch) => batch.batchNo).join(' ')}`.toLowerCase().includes(needle)),
  )

  const download = () =>
    exportCsv('stock-on-hand.csv', [['Item', 'SKU', 'Category', 'Location', 'Available', 'Reserved', 'Earliest expiry', 'Reorder level', 'Status'], ...rows.map((row) => [row.item.name, row.item.id, row.item.category, locationName(loc), row.stock.available, row.stock.reserved, row.stock.earliestExpiry ?? '', row.level, row.status])])

  return (
    <>
      <ListCard title="Stock on hand" count={`${all.length} items`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search item, SKU or batch"
          filters={[
            { label: 'Category', value: category, onChange: setCategory, all: 'All categories', options: [...new Set(all.map((row) => row.item.category))] },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: STATUSES },
            { label: 'Expiry', value: expiry, onChange: setExpiry, all: 'Expiry: Any date', options: Object.keys(EXPIRY_WINDOWS) },
          ]}
        />
        <Table headings={['Item / SKU', 'Category', 'Store / branch', 'Available', 'Batch', 'Earliest expiry', loc === 'central' ? 'Reorder' : 'Safety buffer', 'Status']} minWidth={900} empty={rows.length ? null : 'No items match the current filters.'}>
          {rows.map(({ item, stock, level, status: label }) => (
            <Row key={item.id}>
              <Cell>
                <Link to={pathFor(ROUTES.inventoryItem, { itemId: item.id })} className={REF_CLASS}>{item.name}</Link>
                <p className="text-[11px] text-outline">{item.id} · {item.unitPlural}</p>
              </Cell>
              <Cell className="text-xs">{item.category}</Cell>
              <Cell className="text-xs">{locationName(loc)}</Cell>
              <Cell>
                <p className="font-semibold">{qty(stock.available)}</p>
                <p className="text-[11px] text-outline">{stock.reserved ? `${qty(stock.reserved)} reserved` : 'Base units'}</p>
              </Cell>
              <Cell className="font-mono text-xs font-semibold">{stock.rows.length > 1 ? `${stock.rows.length} batches` : stock.rows[0].batchNo}</Cell>
              <Cell className="text-xs">{stock.earliestExpiry ? formatDate(stock.earliestExpiry) : '—'}</Cell>
              <Cell className="text-xs">{qty(level)}</Cell>
              <Cell><Pill tone={STOCK_TONE[label]}>{label}</Pill></Cell>
            </Row>
          ))}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="items">{` · ${locationName(loc)} only`}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Available = accepted and posted stock − reservations − quarantine. Purchase orders, in-transit transfers and unreconciled receipts are excluded. Select an item to inspect its batches and movement history.</p>
    </>
  )
}
