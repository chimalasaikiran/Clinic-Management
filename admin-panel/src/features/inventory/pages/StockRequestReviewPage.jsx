import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import { pathFor, ROUTES } from '../../../config/routes'
import { TextArea } from '../../patients/components/parts'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { FactGrid, Pill, Section } from '../components/shared'
import { REF_CLASS } from '../components/tones'
import { centralId, locationName, REQUEST_STATUS_TONE } from '../constants'
import { useStock } from '../context/useStock'
import { itemById } from '../data/items'
import { formatDate, qty, shortDateTime } from '../format'
import { requestLabel, unissuedPicks } from '../selectors'
import { fefoPlan, summarise } from '../stockLogic'
import { validateReview } from '../validation'

const DECISIONS = [
  { id: 'Approve in full', hint: (short) => (short ? `Unavailable: ${short} request exceeds the tablets available.` : 'Reserve every requested quantity at Central Stores.') },
  { id: 'Approve partial', hint: (_short, now) => (now ? `Approve ${now} now. Keep any balance open.` : 'Approve what is available now and keep the balance open.') },
  { id: 'Reject request', hint: () => 'No allocation. A rejection reason is required and shared with Pharmacy.' },
]

const CHAIN = [
  ['Review', 'Approval + reservation'],
  ['Picking', 'Batch and picker recorded'],
  ['Issue', 'Issue ref · stock deducted'],
  ['Dispatch', 'Transfer + carrier ref'],
  ['Branch receipt', 'Accepted qty posted'],
]

function chainStage(request, transfers) {
  if (['Fulfilled', 'Partially fulfilled'].includes(request.status)) return 4
  if (request.status === 'Dispatched') return 3
  if (transfers.some((transfer) => transfer.requestId === request.id && transfer.status === 'Ready for dispatch')) return 2
  if (['Approved', 'Partially approved'].includes(request.status)) return 1
  return 0
}

export default function StockRequestReviewPage() {
  const { requestId } = useParams()
  const { state, run } = useStock()
  const navigate = useNavigate()
  const request = state.requests.find((row) => row.id === requestId)
  const [decision, setDecision] = useState('')
  const [approveNow, setApproveNow] = useState({})
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  if (!request || request.status === 'Draft') return <MissingRecord what="stock request" backTo={ROUTES.inventoryRequests} backLabel="Back to stock requests" />

  const availability = Object.fromEntries(request.lines.map((line) => [line.itemId, summarise(state.batches, line.itemId, centralId()).available]))
  const open = request.lines.map((line) => ({ ...line, open: line.requested - line.approved }))
  const reviewing = request.status === 'Submitted' || (request.status === 'Partially approved' && open.some((line) => line.open > 0))
  const fullyAvailable = open.every((line) => line.open <= availability[line.itemId])
  const shortLine = open.find((line) => line.open > availability[line.itemId])
  const chosen = decision || (fullyAvailable ? 'Approve in full' : 'Approve partial')
  const amounts = Object.fromEntries(
    open.map((line) => [line.itemId, chosen === 'Approve in full' ? line.open : approveNow[line.itemId] ?? String(Math.min(line.open, availability[line.itemId]))]),
  )
  const values = { decision: chosen, approveNow: amounts, reason }
  const errors = submitted ? validateReview(values, open.map((line) => ({ ...line, requested: line.requested, approved: line.approved })), availability) : {}
  if (chosen === 'Approve in full' && !fullyAvailable && submitted) errors.decision = 'Not enough stock to approve in full.'

  const plan = open.map((line) => ({ line, plan: fefoPlan(state.batches, line.itemId, centralId(), Number(amounts[line.itemId]) || 0) }))
  const pending = unissuedPicks(request, state.transfers)
  const stage = chainStage(request, state.transfers)
  const proposed = open.reduce((sum, line) => sum + (Number(amounts[line.itemId]) || 0), 0)
  const unit = itemById(request.lines[0].itemId).unitPlural

  const confirm = async () => {
    setSubmitted(true)
    if (chosen === 'Approve in full' && !fullyAvailable) return
    if (Object.keys(validateReview(values, open, availability)).length) return
    const outcome = await run('request/review', { id: request.id, decision: chosen, approveNow: amounts, reason: reason.trim() })
    if (outcome.error) return
    setSubmitted(false)
    setDecision('')
    setReason('')
  }

  const issue = async () => {
    const created = await run('transfer/save', { from: centralId(), to: request.pharmacy, mode: 'create', requestId: request.id, alreadyReserved: true, reason: 'Routine replenishment', notes: `Issue for ${request.id}`, lines: pending })
    if (created.error) return
    navigate(`${ROUTES.stockTransfers}?transfer=${created.id}`)
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Stock Requests', to: ROUTES.inventoryRequests }, { label: request.id }]}
      title="Stock request review"
      badge={<Pill tone={REQUEST_STATUS_TONE[request.status]}>{requestLabel(request.status)}</Pill>}
      subtitle={`${request.id} · Internal pharmacy request · Submitted ${formatDate(request.date)}, ${shortDateTime(request.date, request.time).split('· ')[1]}`}
      actions={<ActionButton icon={Printer} onClick={() => window.print()}>Print request</ActionButton>}
    >
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <FactGrid columns={4} facts={[['Supply from', 'Central Stores', 'Available stock checked at 11:30 AM'], ['Deliver to', locationName(request.pharmacy), 'Downtown'], ['Requested by', `${request.requestedBy} · ${request.role}`, `Required by ${formatDate(request.required)}`], ['Priority', request.priority, request.reason]]} />
      </section>

      <InfoNote tone="brand" className="mb-5">
        <p className="text-sm font-semibold text-on-surface">Review quantities before committing an allocation.</p>
        <p className="mt-1">This is an Inventory review of a request submitted in Pharmacy. The proposed approval below does not reserve or move stock until confirmed. No purchase order is created here.</p>
      </InfoNote>

      <Section title="Requested items" aside={`${request.lines.length} items · base unit: ${itemById(request.lines[0].itemId).unit}`} className="mb-5">
        <Table headings={['Item / SKU', 'Requested', 'Available', 'Approved to date', 'Approve now', 'Remaining']} minWidth={760}>
          {open.map((line) => {
            const item = itemById(line.itemId)
            const now = Number(amounts[line.itemId]) || 0
            return (
              <Row key={line.itemId}>
                <Cell><Link to={pathFor(ROUTES.inventoryItem, { itemId: item.id })} className={REF_CLASS}>{item.name}</Link><p className="text-[11px] text-outline">{item.id} · Central Stores</p></Cell>
                <Cell>{qty(line.requested)}</Cell>
                <Cell>{qty(availability[line.itemId])}</Cell>
                <Cell>{qty(line.approved)}</Cell>
                <Cell>
                  {reviewing && line.open > 0 ? (
                    <input
                      type="number"
                      min="0"
                      aria-label={`Approve now ${item.name}`}
                      disabled={chosen !== 'Approve partial'}
                      value={amounts[line.itemId]}
                      onChange={(event) => setApproveNow((current) => ({ ...current, [line.itemId]: event.target.value }))}
                      className="w-24 rounded border border-brand px-2 py-1.5 text-[13px] outline-none disabled:border-slate-200 disabled:bg-surface-lowest"
                    />
                  ) : (
                    '—'
                  )}
                </Cell>
                <Cell><p className="font-semibold">{qty(Math.max(0, line.open - (reviewing ? now : 0)))}</p><p className="text-[11px] text-outline">{line.open - now > 0 && reviewing ? 'Keep open' : ''}</p></Cell>
              </Row>
            )
          })}
        </Table>
        {errors.quantities && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.quantities}</p>}
        <p className="mt-3 text-[11px] text-outline">Available = accepted, posted and net of current reservations / quarantine at Central Stores. Remaining = requested − approved to date − proposed approval; it stays open, it is not rejected.</p>
      </Section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Proposed pick plan" aside={reviewing ? 'Draft · not reserved' : 'Reserved'}>
            <Table headings={['Item / Batch', 'Expiry', 'Pick qty', 'Bin']} minWidth={520} empty={reviewing ? (proposed ? null : 'Enter an approved quantity to see the pick plan.') : null}>
              {(reviewing ? plan.flatMap((entry) => entry.plan.picks.map((pick) => ({ itemId: entry.line.itemId, ...pick }))) : request.lines.flatMap((line) => (line.allocations ?? []).map((pick) => ({ itemId: line.itemId, ...pick })))).map((pick) => (
                <Row key={`${pick.itemId}-${pick.batchId}`}>
                  <Cell><p className="font-semibold">{itemById(pick.itemId).name} · {pick.batchNo}</p><p className="text-[11px] text-outline">First expiry, first out</p></Cell>
                  <Cell>{formatDate(pick.expiry)}</Cell>
                  <Cell>{qty(pick.qty)}</Cell>
                  <Cell>{pick.bin}</Cell>
                </Row>
              ))}
            </Table>
            {reviewing && proposed > 0 && <p className="mt-3 text-[11px] text-outline">On confirmation: reserve {qty(proposed)} {unit}. Posted quantities do not change until issue.</p>}
          </Section>

          <Section title="Request activity" aside={<Link to={pathFor(ROUTES.inventoryItem, { itemId: request.lines[0].itemId })} className={REF_CLASS}>View audit trail ↗</Link>}>
            <ol className="flex flex-col gap-3 text-xs">
              {request.activity.map((entry, index) => (
                <li key={`${entry.time}-${index}`}>
                  <p className="font-semibold text-on-surface">{entry.time} · {entry.text}</p>
                  <p className="text-outline">{formatDate(entry.date)} · {entry.by}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="flex flex-col gap-5 self-start">
          {pending.length > 0 && (
            <Section title="Issue reserved stock">
              <p className="mb-3 text-xs text-on-surface-variant">{pending.reduce((sum, pick) => sum + pick.qty, 0).toLocaleString('en-IN')} reserved {unit} have not been issued yet. Creating the transfer keeps the reservation and prepares the dispatch.</p>
              <ActionButton variant="brand" onClick={issue}>Create transfer from allocation</ActionButton>
            </Section>
          )}
          <Section title="Review decision">
            {reviewing ? (
              <>
                <div role="radiogroup" aria-label="Review decision" className="flex flex-col gap-2">
                  {DECISIONS.map((option) => {
                    const disabled = option.id === 'Approve in full' && !fullyAvailable
                    const selected = chosen === option.id
                    return (
                      <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${selected ? 'border-brand bg-teal-50/60' : 'border-slate-200'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                        <input type="radio" name="decision" value={option.id} checked={selected} disabled={disabled} onChange={() => setDecision(option.id)} className="mt-1 accent-[#006a61]" />
                        <span><span className="block text-[13px] font-semibold">{option.id}</span><span className="text-xs text-on-surface-variant">{option.hint(shortLine && `${qty(shortLine.open)} ${itemById(shortLine.itemId).name}`, qty(proposed))}</span></span>
                      </label>
                    )
                  })}
                </div>
                {chosen !== 'Approve in full' && (
                  <div className="mt-4">
                    <TextArea label="Decision reason (required for partial or reject)" required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} error={errors.reason} hint="Recorded with your name and the time, and shared with Pharmacy." />
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <ActionButton variant="brand" onClick={confirm}>{chosen === 'Reject request' ? 'Confirm rejection' : chosen === 'Approve partial' ? 'Confirm partial approval' : 'Confirm approval'}</ActionButton>
                  <ActionButton to={ROUTES.inventoryRequests}>Cancel</ActionButton>
                </div>
                <p className="mt-3 text-[11px] text-outline">Confirmation records the reviewer, timestamp and reason, reserves the approved quantity, and notifies the requesting pharmacy.</p>
              </>
            ) : (
              <div className="text-sm">
                <p className="font-semibold">{request.decision ?? requestLabel(request.status)}</p>
                {request.decisionNote && <p className="mt-1 text-xs text-on-surface-variant">{request.decisionNote}</p>}
                {request.transferIds.length > 0 && <p className="mt-3 text-xs">Transfers: {request.transferIds.map((id) => <Link key={id} to={`${ROUTES.stockTransfers}?transfer=${id}`} className={`${REF_CLASS} mr-2`}>{id}</Link>)}</p>}
              </div>
            )}
          </Section>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Fulfillment chain</h2>
          <span className="text-[11px] text-outline">{request.transferIds.length ? `${request.transferIds.length} transfer reference${request.transferIds.length > 1 ? 's' : ''}` : 'No issue, transfer or receipt references yet'}</span>
        </header>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CHAIN.map(([title, hint], index) => (
            <li key={title} className={`rounded-md border p-3 text-xs ${index === stage ? 'border-brand bg-teal-50/60' : 'border-slate-200 bg-surface-lowest'}`} aria-current={index === stage ? 'step' : undefined}>
              <p className="font-semibold text-on-surface">{title}</p>
              <p className="text-outline">{index < stage ? 'Completed' : index === stage ? 'Current step' : 'Not started'}</p>
              <p className="mt-1 text-[11px] text-outline">{hint}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-outline">Dispatch is not receipt. Destination availability only appears after the branch receiving accepts and posts the units; shortages or rejected units remain traceable exceptions.</p>
      </section>
    </DetailFrame>
  )
}
