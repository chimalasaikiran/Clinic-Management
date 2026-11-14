import { nextId } from '../patients/format'
import { NOW } from './constants'
import { itemById } from './data/items'
import { SEED_BATCHES } from './data/seedStock'
import { SEED_SUPPLIERS } from './data/seedSuppliers'
import { SEED_ADJUSTMENTS, SEED_MOVEMENTS, SEED_ORDERS, SEED_RECEIPTS, SEED_REQUESTS, SEED_TRANSFERS } from './data/seedTransactions'
import { SEED_CASES, SEED_DISPENSES, SEED_RX } from '../pharmacy/data/seedPharmacy'
import { dispenseRx } from '../pharmacy/dispensing'
import { consumePicks, fefoPlan, issuePicks, postBatch, releasePicks, reservePicks, stamp, summarise } from './stockLogic'
import { unresolvedOf } from './selectors'

export const INITIAL_STATE = {
  batches: SEED_BATCHES,
  requests: SEED_REQUESTS,
  transfers: SEED_TRANSFERS,
  orders: SEED_ORDERS,
  receipts: SEED_RECEIPTS,
  adjustments: SEED_ADJUSTMENTS,
  suppliers: SEED_SUPPLIERS,
  movements: SEED_MOVEMENTS,
  rxQueue: SEED_RX,
  dispenses: SEED_DISPENSES,
  cases: SEED_CASES,
}

const ACTOR = 'Dr. Siddharth Verma'
const event = (text, by) => ({ date: NOW.date, time: NOW.time, text, by })
const idsOf = (rows) => rows.map((row) => row.id)
const newId = (state, collection, prefix, width = 2) => nextId(prefix, idsOf(state[collection]), width)
const replace = (rows, id, change) => rows.map((row) => (row.id === id ? { ...row, ...(typeof change === 'function' ? change(row) : change) } : row))

function movement(state, { itemId, loc, kind, ref, batchLabel, delta, reason, actor = ACTOR }) {
  const available = summarise(state.batches, itemId, loc).available
  const id = `MOV-${state.movements.length + 1}`
  return { ...state, movements: [{ id, date: NOW.date, time: NOW.time, actor, kind, ref, itemId, loc, batchLabel, delta, availableAfter: available, reason }, ...state.movements] }
}

const labelOf = (picks) => picks.map((pick) => pick.batchNo).join(' / ')
const fail = (state, error) => ({ state, result: { error } })
const done = (state, result = {}) => ({ state, result })

// ── stock requests ─────────────────────────────────────────────────────────────
function saveRequest(state, payload) {
  const { id, submit, ...fields } = payload
  const status = submit ? 'Submitted' : 'Draft'
  const activity = submit ? [event(`Submitted by ${fields.requestedBy}`, `${fields.role} · ${fields.lines.length} lines`)] : []
  const lines = fields.lines.map((line) => ({ itemId: line.itemId, requested: Number(line.requested), approved: 0, issued: 0, received: 0 }))
  if (id) return done({ ...state, requests: replace(state.requests, id, (row) => ({ ...fields, lines, status, activity: [...activity, ...row.activity] })) }, { id })
  const created = { ...fields, lines, id: newId(state, 'requests', `SR-${stamp()}-`), date: NOW.date, time: NOW.time, status, decision: null, transferIds: [], activity }
  return done({ ...state, requests: [created, ...state.requests] }, { id: created.id })
}

function reviewRequest(state, { id, decision, approveNow = {}, reason, actor = 'R. Shah' }) {
  const request = state.requests.find((row) => row.id === id)
  if (decision === 'Reject request') {
    const next = replace(state.requests, id, { status: 'Rejected', decision, decisionNote: reason, activity: [event(`Rejected by ${actor}`, reason), ...request.activity] })
    return done({ ...state, requests: next })
  }
  let batches = state.batches
  let next = state
  const lines = request.lines.map((line) => {
    const qty = Number(approveNow[line.itemId] ?? 0)
    if (!qty) return line
    const plan = fefoPlan(batches, line.itemId, 'central', qty)
    if (plan.short > 0) return line
    batches = reservePicks(batches, plan.picks)
    next = { ...next, batches }
    next = movement(next, { itemId: line.itemId, loc: 'central', kind: 'Reservation created', ref: `RSV-${stamp()}-${request.id.slice(-2)}`, batchLabel: labelOf(plan.picks), delta: 0, reason: `${qty.toLocaleString('en-IN')} reserved for ${request.id}. Posted stock unchanged.`, actor: `${actor} · Inventory manager` })
    return { ...line, approved: line.approved + qty, allocations: [...(line.allocations ?? []), ...plan.picks] }
  })
  const complete = lines.every((line) => line.approved >= line.requested)
  const status = complete ? 'Approved' : 'Partially approved'
  const note = decision === 'Approve in full' ? 'Approved in full' : 'Approved partially'
  const requests = replace(next.requests, id, { lines, status, decision, decisionNote: reason ?? '', activity: [event(`${note} by ${actor}`, reason || 'Inventory manager'), ...request.activity] })
  return done({ ...next, requests })
}

function cancelRequest(state, { id, reason }) {
  const request = state.requests.find((row) => row.id === id)
  return done({ ...state, requests: replace(state.requests, id, { status: 'Cancelled', activity: [event('Cancelled by requester', reason || 'No stock movement'), ...request.activity] }) })
}

// ── transfers ─────────────────────────────────────────────────────────────────
function saveTransfer(state, { id, from, to, lines, reason, notes, planned, mode, requestId, alreadyReserved }) {
  const rows = lines.map((line) => {
    const batch = state.batches.find((entry) => entry.id === line.batchId)
    return { itemId: batch.itemId, batchId: batch.id, batchNo: batch.batchNo, expiry: batch.expiry, qty: Number(line.qty), received: 0 }
  })
  const create = mode === 'create'
  let batches = state.batches
  if (create && !alreadyReserved) batches = reservePicks(batches, rows)
  const history = [event(create ? 'Created & reserved' : 'Draft saved', create ? 'Quantity reserved at the source store' : 'No stock reserved')]
  const status = create ? 'Ready for dispatch' : 'Draft'
  if (id) {
    const existing = state.transfers.find((row) => row.id === id)
    return done({ ...state, batches, transfers: replace(state.transfers, id, { from, to, lines: rows, reason, notes, planned, status, history: [...history, ...existing.history] }) }, { id })
  }
  const created = { id: newId(state, 'transfers', `TR-${stamp()}-`), issueId: null, requestId: requestId ?? null, from, to, status, created: NOW.date, dispatched: null, received: null, reason, notes, planned, createdBy: 'N. Desai', lines: rows, history }
  const requests = requestId ? replace(state.requests, requestId, (row) => ({ transferIds: [...row.transferIds, created.id] })) : state.requests
  return done({ ...state, batches, requests, transfers: [created, ...state.transfers] }, { id: created.id })
}

function dispatchTransfer(state, { id }) {
  const transfer = state.transfers.find((row) => row.id === id)
  let next = { ...state, batches: issuePicks(state.batches, transfer.lines) }
  const issueId = `ISS-${transfer.id.slice(3)}`
  transfer.lines.forEach((line) => {
    next = movement(next, { itemId: line.itemId, loc: transfer.from, kind: 'Issue', ref: transfer.id, batchLabel: line.batchNo, delta: -line.qty, reason: `${itemById(line.itemId).name} · ${line.qty} dispatched to the destination; receipt pending.`, actor: 'N. Desai · Store officer' })
  })
  next = { ...next, transfers: replace(next.transfers, id, { status: 'In transit', issueId, dispatched: NOW.date, dispatchedTime: NOW.time, history: [...next.transfers.find((row) => row.id === id).history, event('Dispatched', 'Stock left the source store')] }) }
  if (transfer.requestId) {
    next = { ...next, requests: replace(next.requests, transfer.requestId, (row) => ({ status: 'Dispatched', lines: row.lines.map((line) => ({ ...line, issued: line.issued + transfer.lines.filter((entry) => entry.itemId === line.itemId).reduce((sum, entry) => sum + entry.qty, 0) })), activity: [event(`Dispatched on ${transfer.id}`, 'Central Stores'), ...row.activity] })) }
  }
  return done(next)
}

function receiveTransfer(state, { id, received }) {
  const transfer = state.transfers.find((row) => row.id === id)
  let next = state
  const lines = transfer.lines.map((line, index) => {
    const qty = Math.max(0, Math.min(Number(received[index] ?? line.qty), line.qty))
    if (qty > 0) {
      next = { ...next, batches: postBatch(next.batches, { itemId: line.itemId, loc: transfer.to, batchNo: line.batchNo, expiry: line.expiry, qty, bin: 'Bay A-01' }) }
      next = movement(next, { itemId: line.itemId, loc: transfer.to, kind: 'Receipt', ref: transfer.id, batchLabel: line.batchNo, delta: qty, reason: `Transfer received from the source store; ${qty} accepted and posted.`, actor: 'Branch pharmacist' })
    }
    return { ...line, received: qty }
  })
  const short = lines.some((line) => line.received < line.qty)
  next = { ...next, transfers: replace(next.transfers, id, { status: 'Received', received: NOW.date, receivedTime: NOW.time, lines, history: [...transfer.history, event(short ? 'Received with shortage' : 'Received', short ? 'Shortage remains a traceable exception' : 'Accepted quantity posted')] }) }
  if (transfer.requestId) {
    next = { ...next, requests: replace(next.requests, transfer.requestId, (row) => {
      const updated = row.lines.map((line) => ({ ...line, received: line.received + lines.filter((entry) => entry.itemId === line.itemId).reduce((sum, entry) => sum + entry.received, 0) }))
      const fulfilled = updated.every((line) => line.received >= line.requested)
      return { lines: updated, status: fulfilled ? 'Fulfilled' : 'Partially fulfilled', activity: [event('Branch receipt posted', transfer.to), ...row.activity] }
    }) }
  }
  return done(next)
}

function cancelTransfer(state, { id }) {
  const transfer = state.transfers.find((row) => row.id === id)
  const batches = transfer.status === 'Ready for dispatch' && !transfer.requestId ? releasePicks(state.batches, transfer.lines) : state.batches
  return done({ ...state, batches, transfers: replace(state.transfers, id, { status: 'Cancelled', history: [...transfer.history, event('Cancelled', 'Reservation released')] }) })
}

// ── purchase orders and receipts ───────────────────────────────────────────────
function createOrder(state, { draft, ...fields }) {
  const order = { ...fields, id: newId(state, 'orders', `PO-${stamp()}-`), createdBy: ACTOR, closed: false, draft: Boolean(draft), lines: fields.lines.map((line) => ({ itemId: line.itemId, ordered: Number(line.ordered), rate: Number(line.rate) })) }
  return done({ ...state, orders: [order, ...state.orders] }, { id: order.id })
}

function postReceipt(state, receipt) {
  let next = state
  receipt.lines.forEach((line) => {
    line.batches.forEach((entry) => {
      next = { ...next, batches: postBatch(next.batches, { itemId: line.itemId, loc: receipt.store, batchNo: entry.batchNo, expiry: entry.expiry, qty: Number(entry.qty), bin: entry.bin }) }
      next = movement(next, { itemId: line.itemId, loc: receipt.store, kind: 'Receipt', ref: receipt.id, batchLabel: entry.batchNo, delta: Number(entry.qty), reason: `${Number(entry.qty).toLocaleString('en-IN')} accepted, reconciled and posted.`, actor: `${receipt.receivedBy} · Receiving officer` })
    })
  })
  const closes = receipt.discrepancies.some((entry) => entry.resolution === 'Close PO as short')
  const orders = closes ? replace(next.orders, receipt.orderId, { closed: true }) : next.orders
  return { ...next, orders, receipts: replace(next.receipts, receipt.id, { posted: true, status: 'Posted', audit: [...receipt.audit, event('Receipt posted', `${receipt.receivedBy} · accepted batches added to stock`)] }) }
}

function saveReceipt(state, { id, mode, ...fields }) {
  const taken = state.receipts.flatMap((row) => row.discrepancies.map((entry) => entry.id))
  const discrepancies = (fields.discrepancies ?? []).map((entry) => {
    if (entry.id) return entry
    const assigned = nextId(`DSC-${stamp()}-`, taken, 2)
    taken.push(assigned)
    return { ...entry, id: assigned }
  })
  const base = { ...fields, discrepancies, posted: false, attachments: fields.attachments ?? 0, audit: [event(mode === 'draft' ? 'Draft saved' : 'Receipt recorded', `${fields.receivedBy} · ${fields.lines.reduce((sum, line) => sum + line.received, 0)} counted`)] }
  const receipt = { id: id ?? newId(state, 'receipts', `GRN-${stamp()}-`), ...base, status: mode === 'draft' ? 'Draft' : 'Reconciliation required' }
  const exists = state.receipts.some((row) => row.id === receipt.id)
  const receipts = exists ? replace(state.receipts, receipt.id, receipt) : [receipt, ...state.receipts]
  const next = { ...state, receipts }
  if (mode === 'post' && !unresolvedOf(receipt).length) return done(postReceipt(next, receipt), { id: receipt.id })
  return done(next, { id: receipt.id })
}

function resolveDiscrepancy(state, { id, discrepancyId, disposition, note, actor = 'R. Shah' }) {
  const receipt = state.receipts.find((row) => row.id === id)
  const discrepancies = receipt.discrepancies.map((entry) => (entry.id === discrepancyId ? { ...entry, state: 'Resolved', resolution: disposition, note: `${note}` } : entry))
  const status = discrepancies.some((entry) => entry.state === 'Unresolved') ? 'Reconciliation required' : 'Ready to post'
  return done({ ...state, receipts: replace(state.receipts, id, { discrepancies, status, audit: [...receipt.audit, event('Supplier response recorded', `${actor} · ${disposition}`)] }) })
}

function postExistingReceipt(state, { id }) {
  const receipt = state.receipts.find((row) => row.id === id)
  if (unresolvedOf(receipt).length) return fail(state, 'Resolve every discrepancy before posting.')
  return done(postReceipt(state, receipt))
}

// ── adjustments and suppliers ──────────────────────────────────────────────────
function saveAdjustment(state, { id, mode, itemId, batchId, proposed, reason, evidence }) {
  const batch = state.batches.find((entry) => entry.id === batchId)
  const base = { itemId, batchId, batchNo: batch.batchNo, proposed: Number(proposed), reason, evidence, date: NOW.date, time: NOW.time, recordedBy: 'N. Desai' }
  const status = { draft: 'Draft', post: 'Posted', reject: 'Rejected' }[mode]
  const adjustment = { ...base, id: id ?? newId(state, 'adjustments', `ADJ-${stamp()}-`), status, posted: mode === 'post' ? base.proposed : 0, approvedBy: mode === 'draft' ? '' : 'R. Shah', approvedAt: mode === 'draft' ? '' : `${NOW.date} ${NOW.time}` }
  const adjustments = state.adjustments.some((row) => row.id === adjustment.id) ? replace(state.adjustments, adjustment.id, adjustment) : [adjustment, ...state.adjustments]
  let next = { ...state, adjustments }
  if (mode === 'post') {
    next = { ...next, batches: next.batches.map((entry) => (entry.id === batchId ? { ...entry, posted: entry.posted + adjustment.proposed } : entry)) }
    next = movement(next, { itemId, loc: batch.loc, kind: 'Adjustment', ref: adjustment.id, batchLabel: batch.batchNo, delta: adjustment.proposed, reason: `${reason}. Evidence ${evidence}.`, actor: 'R. Shah · Approved' })
  }
  return done(next, { id: adjustment.id })
}

function saveSupplier(state, { id, ...fields }) {
  if (id) {
    const before = state.suppliers.find((row) => row.id === id)
    const changed = Object.keys(fields).filter((key) => key !== 'audit' && JSON.stringify(fields[key]) !== JSON.stringify(before[key]))
    const entry = { at: `${NOW.date} ${NOW.time}`, by: ACTOR, text: changed.length ? `Updated ${changed.join(', ')}` : 'Saved without changes' }
    return done({ ...state, suppliers: replace(state.suppliers, id, { ...fields, audit: [entry, ...before.audit] }) }, { id })
  }
  const created = { ...fields, id: nextId('SUP-', idsOf(state.suppliers), 4), audit: [{ at: `${NOW.date} ${NOW.time}`, by: ACTOR, text: `Supplier record created · Status: ${fields.active ? 'Active' : 'Inactive'}` }] }
  return done({ ...state, suppliers: [...state.suppliers, created] }, { id: created.id })
}

function setSupplierActive(state, { id, active, reason }) {
  const before = state.suppliers.find((row) => row.id === id)
  const text = `Supplier ${active ? 'reactivated' : 'deactivated'}${reason ? ` · ${reason}` : ''}`
  return done({ ...state, suppliers: replace(state.suppliers, id, { active, audit: [{ at: `${NOW.date} ${NOW.time}`, by: ACTOR, text }, ...before.audit] }) })
}

// ── pharmacy ───────────────────────────────────────────────────────────────────
function dispense(state, { rxId, quantities, consent, reminders = false }) {
  const rx = state.rxQueue.find((row) => row.id === rxId)
  const outcome = dispenseRx(rx, state.batches, quantities, consent)
  if (outcome.error) return fail(state, outcome.error)
  let next = { ...state, batches: consumePicks(state.batches, outcome.picks) }
  const record = { id: newId(state, 'dispenses', `DSP-2026-`, 4), rxId, date: NOW.date, time: NOW.time, by: 'Ramesh Pillai, B.Pharm', reminders, lines: outcome.lines }
  outcome.lines.forEach((line) => {
    next = movement(next, { itemId: line.itemId, loc: 'main', kind: 'Dispense', ref: record.id, batchLabel: line.batchNo, delta: -line.qty, reason: `Outpatient prescription dispense · ${rx.patient.name} · ${rx.id}`, actor: 'Ramesh Pillai, B.Pharm' })
  })
  next = { ...next, dispenses: [record, ...next.dispenses], rxQueue: replace(next.rxQueue, rxId, outcome.rxChange) }
  return done(next, { id: record.id })
}

function createCase(state, payload) {
  const prefix = payload.type === 'Return' ? 'RET-' : 'DIS-'
  const id = nextId(prefix, idsOf(state.cases), 4)
  return done({ ...state, cases: [{ ...payload, id, date: NOW.date, time: NOW.time, status: payload.draft ? 'Draft' : 'Awaiting review', statusNote: payload.draft ? 'Not submitted' : 'Reported · not yet reviewed' }, ...state.cases] }, { id })
}

const HANDLERS = {
  'request/save': saveRequest,
  'request/review': reviewRequest,
  'request/cancel': cancelRequest,
  'transfer/save': saveTransfer,
  'transfer/dispatch': dispatchTransfer,
  'transfer/receive': receiveTransfer,
  'transfer/cancel': cancelTransfer,
  'order/create': createOrder,
  'receipt/save': saveReceipt,
  'receipt/resolve': resolveDiscrepancy,
  'receipt/post': postExistingReceipt,
  'adjustment/save': saveAdjustment,
  'supplier/save': saveSupplier,
  'supplier/active': setSupplierActive,
  'rx/dispense': dispense,
  'case/create': createCase,
}

// Applies one operation to the whole stock state: { state, result }. Pure, so the provider and the tests share it.
export function supplyReducer(state, action) {
  const handler = HANDLERS[action.type]
  if (!handler) throw new Error(`Unknown stock action: ${action.type}`)
  return handler(state, action.payload)
}
