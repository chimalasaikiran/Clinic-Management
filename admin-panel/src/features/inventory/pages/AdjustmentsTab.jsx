import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { InfoNote } from '../../../components/workspace/controls'
import ActionButton from '../../../components/workspace/ActionButton'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { ListCard, ListFooter, NextLink, Pill, Toolbar } from '../components/shared'
import { REF_CLASS } from '../components/tones'
import { ADJUSTMENT_REASONS, centralId } from '../constants'
import { useStock } from '../context/useStock'
import RecordAdjustmentDrawer from '../drawers/RecordAdjustmentDrawer'
import { itemById } from '../data/items'
import { shortDateTime } from '../format'

const TONE = { Draft: 'neutral', Posted: 'success', Rejected: 'neutral' }
const NEXT = { Draft: 'Continue draft', Posted: 'View audit trail', Rejected: 'View history' }
const signed = (value) => (value > 0 ? `+${value}` : `${value}`)

export default function AdjustmentsTab() {
  const { state, run } = useStock()
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')
  const [drawer, setDrawer] = useState(null)
  const all = state.adjustments
  const needle = query.trim().toLowerCase()
  const rows = all.filter(
    (entry) =>
      (!reason || entry.reason.startsWith(reason.split(' ')[0])) &&
      (!status || entry.status === status) &&
      (!needle || `${entry.id} ${itemById(entry.itemId).name} ${entry.batchNo} ${entry.evidence}`.toLowerCase().includes(needle)),
  )
  const latestPosted = all.find((entry) => entry.status === 'Posted')
  const summary = ['Draft', 'Posted', 'Rejected'].map((label) => ({ label, count: all.filter((entry) => entry.status === label).length })).filter((entry) => entry.count)

  const download = () => exportCsv('adjustments.csv', [['Adjustment', 'Item', 'Batch', 'Change', 'Reason', 'Status'], ...rows.map((entry) => [entry.id, itemById(entry.itemId).name, entry.batchNo, entry.proposed, entry.reason, entry.status])])

  return (
    <>
      <ListCard
        title="Adjustments"
        count={summary.map((entry) => `${entry.count} ${entry.label.toLowerCase()}`).join(' · ')}
        onExport={download}
        action={<ActionButton onClick={() => setDrawer({})}>Record adjustment</ActionButton>}
      >
        <Toolbar
          search={query}
          onSearch={setQuery}
          placeholder="Search adjustment, item, batch or evidence"
          filters={[
            { label: 'Reason', value: reason, onChange: setReason, all: 'All reasons', options: ADJUSTMENT_REASONS },
            { label: 'Status', value: status, onChange: setStatus, all: 'All statuses', options: ['Draft', 'Posted', 'Rejected'] },
          ]}
        />
        <Table headings={['Adjustment / Recorded', 'Item / Batch', 'Posted Δ', 'Reason / Evidence', 'Approval / Status', 'Next step']} minWidth={900} empty={rows.length ? null : 'No adjustments match the current filters.'}>
          {rows.map((entry) => {
            const item = itemById(entry.itemId)
            return (
              <Row key={entry.id}>
                <Cell><span className="font-semibold text-brand">{entry.id}</span><p className="text-[11px] text-outline">{shortDateTime(entry.date, entry.time)} · {entry.recordedBy}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{item.name}</p><p className="text-outline">{entry.batchNo} · {item.unitPlural}</p></Cell>
                <Cell className="text-xs"><p className="font-semibold">{signed(entry.posted)}</p><p className="text-outline">{entry.status === 'Posted' ? 'Posted' : `Proposed ${signed(entry.proposed)}`}</p></Cell>
                <Cell className="max-w-64 text-xs"><p>{entry.reason}</p><p className="text-outline">{entry.evidence}</p></Cell>
                <Cell><Pill tone={TONE[entry.status]}>{entry.status === 'Draft' ? 'Draft · not posted' : entry.status === 'Rejected' ? 'Rejected · not posted' : 'Posted'}</Pill><p className="mt-1 text-[11px] text-outline">{entry.approvedBy ? `${entry.status === 'Posted' ? 'Approved' : 'Reviewed'} by ${entry.approvedBy} · ${entry.approvedAt.slice(5, 10)}` : 'Not submitted for approval'}</p></Cell>
                <Cell>
                  {entry.status === 'Draft' ? (
                    <button type="button" onClick={() => setDrawer({ id: entry.id, itemId: entry.itemId, batchId: entry.batchId, proposed: String(entry.proposed), reason: entry.reason, evidence: entry.evidence })} className="text-xs font-semibold text-brand hover:underline">
                      Continue draft
                    </button>
                  ) : (
                    <NextLink to={pathFor(ROUTES.inventoryItem, { itemId: entry.itemId })}>{NEXT[entry.status]}</NextLink>
                  )}
                </Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={all.length} noun="adjustments">{' · Central Stores'}</ListFooter>
      </ListCard>
      <p className="mt-4 text-[11px] text-outline">Posted Δ is the actual stock ledger impact. Draft and rejected adjustments do not change quantities. Approved write-offs remain in history, not in pending work.</p>
      {latestPosted && (
        <InfoNote tone="brand" className="mt-4">
          <p className="text-sm font-semibold text-on-surface">Every stock change retains its source.</p>
          <p className="mt-1">
            {latestPosted.id} is already posted: {signed(latestPosted.posted)} {itemById(latestPosted.itemId).name}, {latestPosted.batchNo}, evidence {latestPosted.evidence}; approved by {latestPosted.approvedBy}. Reason, evidence, approver and time are retained. Corrections append a new audit entry; they never overwrite the original.{' '}
            <Link to={pathFor(ROUTES.inventoryItem, { itemId: latestPosted.itemId })} className={REF_CLASS}>Open the item audit trail</Link>
          </p>
        </InfoNote>
      )}
      <RecordAdjustmentDrawer key={drawer?.id ?? (drawer ? 'new' : 'closed')} open={Boolean(drawer)} onClose={() => setDrawer(null)} batches={state.batches.filter((batch) => batch.loc === centralId())} initial={drawer} onSave={(payload) => run('adjustment/save', payload)} />
    </>
  )
}
