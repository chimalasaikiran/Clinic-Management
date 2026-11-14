import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { InfoNote } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { ListCard, ListFooter, NextLink, Pill, Toolbar } from '../components/shared'
import { REF_CLASS } from '../components/tones'
import { locationName, PHARMACIES, REQUEST_STATUS_TONE } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, shortDateTime } from '../format'
import { itemCountLabel, quantityLabel, requestLabel } from '../selectors'
import { summarise } from '../stockLogic'

const NEXT = {
  Submitted: ['Review request', (id) => pathFor(ROUTES.inventoryRequest, { requestId: id })],
  Approved: ['Continue to issue', (id) => pathFor(ROUTES.inventoryRequest, { requestId: id })],
  'Partially approved': ['Continue to issue', (id) => pathFor(ROUTES.inventoryRequest, { requestId: id })],
  Dispatched: ['Track transfer', (id, request) => `${ROUTES.stockTransfers}?transfer=${request.transferIds.at(-1)}`],
}

function subNote(request) {
  if (request.status === 'Submitted') return 'No allocation yet'
  if (request.status === 'Dispatched') return `${request.transferIds.at(-1)} · receipt pending`
  if (request.status === 'Cancelled') return 'No stock movement'
  if (request.status === 'Rejected') return request.decisionNote ?? ''
  return request.decisionNote || (request.activity[0]?.by ?? '')
}

export default function RequestsTab() {
  const { state } = useStock()
  const [query, setQuery] = useState('')
  const [pharmacy, setPharmacy] = useState('')
  const [status, setStatus] = useState('')
  const all = state.requests.filter((request) => request.status !== 'Draft')
  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (request) =>
      (!pharmacy || locationName(request.pharmacy) === pharmacy) &&
      (!status || requestLabel(request.status) === status) &&
      (!needle || `${request.id} ${locationName(request.pharmacy)} ${request.lines.map((line) => itemById(line.itemId).name).join(' ')}`.toLowerCase().includes(needle)),
  )
  const awaiting = all.filter((request) => request.status === 'Submitted')
  const focus = awaiting[0]

  const download = () => exportCsv('stock-requests.csv', [['Request', 'Pharmacy', 'Items', 'Required', 'Priority', 'Status'], ...rows.map((request) => [request.id, locationName(request.pharmacy), request.lines.length, request.required, request.priority, request.status])])

  return (
    <>
      <ListCard title="Stock Requests" count={`${awaiting.length} awaiting review`} onExport={download}>
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search request, pharmacy or item"
          filters={[
            { label: 'Pharmacy', value: pharmacy, onChange: setPharmacy, all: 'All pharmacies', options: PHARMACIES.map((entry) => entry.name) },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: [...new Set(all.map((request) => requestLabel(request.status)))] },
          ]}
        />
        <Table headings={['Request / Submitted', 'Requesting pharmacy', 'Requested', 'Required / Priority', 'Status', 'Next step']} minWidth={880} empty={rows.length ? null : 'No stock requests match the current filters.'}>
          {rows.map((request) => {
            const next = NEXT[request.status]
            return (
              <Row key={request.id}>
                <Cell>
                  <Link to={pathFor(ROUTES.inventoryRequest, { requestId: request.id })} className={REF_CLASS}>{request.id}</Link>
                  <p className="text-[11px] text-outline">{shortDateTime(request.date, request.time)}</p>
                </Cell>
                <Cell className="text-xs"><p className="font-semibold">{locationName(request.pharmacy)}</p><p className="text-outline">{request.requestedBy}{request.notes ? ` · ${request.notes.slice(0, 40)}` : ''}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{itemCountLabel(request.lines.length)}</p><p className="text-outline">{quantityLabel(request.lines)}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{formatDate(request.required)}</p><p className="text-outline">{request.priority}</p></Cell>
                <Cell><Pill tone={REQUEST_STATUS_TONE[request.status]}>{requestLabel(request.status)}</Pill><p className="mt-1 text-[11px] text-outline">{subNote(request)}</p></Cell>
                <Cell>{next ? <NextLink to={next[1](request.id, request)}>{next[0]}</NextLink> : <NextLink to={pathFor(ROUTES.inventoryRequest, { requestId: request.id })}>View history</NextLink>}</Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="requests">{' · supplied by Central Stores'}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Approval reserves stock only when confirmed. Picking, issue, dispatch and branch receipt remain separately traceable; a proposal is not an allocation.</p>
      {focus && (
        <InfoNote tone="brand" className="mt-4">
          <p className="text-sm font-semibold text-on-surface">{focus.id} · review in progress, no decision recorded</p>
          <p className="mt-1">
            Requested: {focus.lines.map((line) => `${line.requested.toLocaleString('en-IN')} ${itemById(line.itemId).name}`).join(' + ')}. Available at Central Stores: {focus.lines.map((line) => summarise(state.batches, line.itemId, 'central').available.toLocaleString('en-IN')).join(' + ')}. Existing reservations belong to other approved requests.{' '}
            <Link to={pathFor(ROUTES.inventoryRequest, { requestId: focus.id })} className={REF_CLASS}>Continue review</Link>
          </p>
        </InfoNote>
      )}
    </>
  )
}
