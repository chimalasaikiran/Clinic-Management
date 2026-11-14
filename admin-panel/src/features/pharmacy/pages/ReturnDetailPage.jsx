import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import DetailFrame, { MissingRecord } from '../../inventory/components/DetailFrame'
import { useStock } from '../../inventory/context/useStock'
import { formatDate, formatTime } from '../../inventory/format'
import { CASE_TONE } from '../caseTones'

const NOT_RECORDED = 'Not recorded'
// Signed variance with a real minus sign, e.g. "−10 capsules".
const variance = (entry) => {
  const difference = entry.observed - entry.expected
  return `${difference < 0 ? '−' : difference > 0 ? '+' : ''}${Math.abs(difference)} ${entry.unit}`
}
const value = (input) => (input === undefined || input === null || input === '' ? NOT_RECORDED : input)

function Rows({ rows }) {
  return (
    <dl>
      {rows.map(([label, content, strong]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
          <dt className="text-on-surface-variant">{label}</dt>
          <dd className={content === NOT_RECORDED ? 'text-outline' : strong ? 'font-semibold' : 'font-medium'}>{content}</dd>
        </div>
      ))}
    </dl>
  )
}

const OUTCOME = {
  'Awaiting review': ['Awaiting Inventory Review', 'Quarantined · off available stock', 'bg-amber-50 text-amber-900', 'Return remains off available stock while Inventory review is pending. No completed stock adjustment or Inventory transaction is documented.'],
  Investigating: ['Investigating', 'Recount in progress', 'bg-sky-50 text-sky-900', 'The reported variance is not a posted adjustment. Inventory review remains in progress; no completed stock adjustment or Inventory transaction is documented.'],
  Approved: ['Approved', 'Stock posting pending', 'bg-emerald-50 text-emerald-900', 'Approval is a review outcome only. Do not treat the returned units as an approved quantity or available stock. No completed stock adjustment or Inventory transaction is documented.'],
  Rejected: ['Rejected', 'Not eligible for restock', 'bg-red-50 text-red-800', 'Rejected medicine is not eligible for restock. No disposal, write-off or other stock movement is documented.'],
  Resolved: ['Resolved', 'Closed', 'bg-emerald-50 text-emerald-900', 'The case is closed. The linked Inventory adjustment holds the stock movement.'],
  Draft: ['Draft', 'Not submitted', 'bg-slate-100 text-slate-700', 'This case is a draft and has not entered the review queue.'],
}

// Read-only case view: the report as filed, the Inventory outcome, and an audit trail built from what is recorded.
export default function ReturnDetailPage() {
  const { caseId } = useParams()
  const { state } = useStock()
  const location = useLocation()
  const entry = state.cases.find((row) => row.id === caseId)
  const back = `${ROUTES.pharmacyReturns}${location.state?.search ?? ''}`
  if (!entry) return <MissingRecord what="case" backTo={ROUTES.pharmacyReturns} backLabel="Back to Returns & Discrepancies" />

  const isReturn = entry.type === 'Return'
  const [outcomeTitle, outcomeNote, outcomeTone, outcomeText] = OUTCOME[entry.status]
  const reported = `${formatDate(entry.date)} · ${formatTime(entry.time)} IST`
  const detailRows = isReturn
    ? [[entry.reference?.startsWith('ISS') ? 'Issue reference' : 'Dispensing reference', value(entry.reference ?? entry.origin), true], [entry.reference?.startsWith('ISS') ? 'Original issued quantity' : 'Original quantity', entry.original ? `${entry.original} ${entry.unit}` : NOT_RECORDED], ['Returned quantity', `${entry.qty} ${entry.unit}`, true], ['Expiry', entry.expiry ? formatDate(entry.expiry) : NOT_RECORDED], ['Reason', entry.reason, true], ['Physical condition', value(entry.reasonNote), true]]
    : [['Branch', entry.originNote, true], ['Storage location', entry.origin, true], ['Expected quantity', entry.expected !== undefined ? `${entry.expected} ${entry.unit}` : NOT_RECORDED], ['Observed quantity', entry.observed !== undefined ? `${entry.observed} ${entry.unit}` : NOT_RECORDED], ['Difference', entry.expected !== undefined ? variance(entry) : NOT_RECORDED, true], ['Category', entry.subtype, true]]

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Returns & Discrepancies', to: back }, { label: entry.id }]}
      title={entry.id}
      badge={<StatusPill tone={CASE_TONE[entry.status]} dot>{entry.status}</StatusPill>}
      subtitle={`${entry.type} / ${entry.subtype} · Case detail`}
      actions={<ActionButton icon={ArrowLeft} to={back}>Back to Returns &amp; Discrepancies</ActionButton>}
    >
      <dl className="mb-5 grid gap-x-8 gap-y-4 sm:grid-cols-3 text-sm">
        {[['Reported', reported], ['Last updated', NOT_RECORDED], ['Reporting staff', value(entry.reportedBy)], ['Branch / location', entry.location], ['Assigned to', `${entry.assignee} · ${entry.assigneeRole}`], ['Stage', entry.stage]].map(([label, content]) => (
          <div key={label}><dt className="text-xs text-outline">{label}</dt><dd className={content === NOT_RECORDED ? 'text-outline' : 'font-medium'}>{content}</dd></div>
        ))}
      </dl>

      <p className="mb-5 flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs text-on-surface-variant"><ShieldCheck className="size-4 text-brand" aria-hidden="true" />Inventory owns stock balances and movements. Approval does not post stock; a separate authorized inventory posting is required.</p>

      <section className="mb-5 grid overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-2">
        <div className="p-5 lg:border-r lg:border-slate-200">
          <header className="mb-3 flex justify-between"><h2 className="text-lg font-semibold">{isReturn ? 'Return' : 'Discrepancy'} details</h2><span className="text-[11px] text-outline">Recorded case information</span></header>
          <div className="mb-3 rounded-md bg-surface-lowest p-4"><p className="text-lg font-semibold">{entry.medicine}</p><p className="text-xs text-on-surface-variant">Batch {entry.batchNo}</p></div>
          <Rows rows={detailRows} />
          <p className="mt-4 text-[10px] font-semibold tracking-wide text-outline uppercase">{isReturn ? 'Review notes' : 'Explanation'}</p>
          <p className="mt-1 text-sm">{entry.notes || `${NOT_RECORDED}.`}</p>
          {isReturn && entry.reference && <p className="mt-3 rounded-md bg-surface-lowest p-3 text-xs"><strong className="block">{entry.reference} · Linked record unavailable</strong><span className="text-on-surface-variant">No matching dispensing record destination is available. Reference shown as recorded; no link is provided.</span></p>}
        </div>
        <div className="border-t border-slate-200 p-5 lg:border-t-0">
          <header className="mb-3 flex justify-between"><h2 className="text-lg font-semibold">Inventory review &amp; outcome</h2><span className="text-[11px] text-outline">Read-only</span></header>
          <div className={`mb-3 rounded-md p-4 ${outcomeTone}`}><p className="text-sm font-semibold">{outcomeTitle}</p><p className="text-xs">{entry.statusNote || outcomeNote}</p></div>
          <Rows rows={[['Linked review decision', 'No completed decision recorded', true], ['Approved quantity', NOT_RECORDED], ['Rejected quantity', NOT_RECORDED], ['Decision actor / time', NOT_RECORDED], ['Decision reason', NOT_RECORDED], ['Stock adjustment ref.', 'Not linked', true], ['Transaction status', entry.status === 'Approved' ? 'Stock posting pending' : 'Pending review · not linked', true]]} />
          <p className="mt-4 text-xs text-on-surface-variant">{outcomeText}</p>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <header className="mb-3 flex justify-between"><h2 className="text-lg font-semibold">Audit timeline</h2><span className="text-[11px] text-outline">Oldest first · All times IST</span></header>
        <ol className="flex flex-col gap-4 text-sm">
          <li className="flex justify-between gap-4"><div><p className="font-semibold">Case reported</p><p className="text-xs text-on-surface-variant">{entry.type} / {entry.subtype} · {entry.medicine} · Batch {entry.batchNo}</p></div><div className="text-right text-xs"><p>{reported}</p><p className="text-outline">{entry.reportedBy ? `Actor ${entry.reportedBy}` : 'Actor not recorded'}</p></div></li>
          <li className="flex justify-between gap-4"><div><p className="font-semibold">{entry.status} · {(entry.statusNote || '').toLowerCase()}</p><p className="text-xs text-on-surface-variant">Current state: {entry.status.toLowerCase()}. {entry.status === 'Awaiting review' ? 'No review decision is recorded.' : 'Review timing and decision details are not recorded.'}</p></div><div className="text-right text-xs"><p className="text-outline">Time not recorded</p><p className="text-outline">Actor not recorded</p></div></li>
        </ol>
        <p className="mt-4 text-[11px] text-outline">Current review state is shown after the report; review timing and intermediate event order are not recorded.</p>
      </section>
      <p className="flex items-center gap-2 text-xs text-on-surface-variant"><Lock className="size-3.5" aria-hidden="true" />Read-only case view. Follow-up and withdrawal are unavailable; no supported workflow or permission is recorded.</p>
    </DetailFrame>
  )
}
