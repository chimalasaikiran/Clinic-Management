import { daysBetween } from '../patients/format'
import { NOW } from '../inventory/constants'
import { itemById } from '../inventory/data/items'
import { nearExpiry, stockStatus, summarise } from '../inventory/stockLogic'
import { remainingOf } from './dispensing'

const DISPENSARY = 'main'

// Medicines the dispensary carries; stock exceptions are only raised for these.
export const FORMULARY = [
  'MED-EM-ATR-006', 'MED-CV-TEL-040', 'MED-CV-RAM-005', 'MED-CV-ATV-040', 'MED-CV-ECO-075', 'MED-GI-OMP-020', 'MED-GI-SUC-010',
  'MED-RS-LVX-500', 'MED-RS-AMB-030', 'MED-DM-MSR-500', 'MED-DM-GLM-001', 'MED-EN-ACT-012', 'MED-00124',
]

export const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export function minutesAgoLabel(date, time) {
  const minutes = (daysBetween(date, NOW.date) * 1440) + minutesOf(NOW.time) - minutesOf(time)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} mins ago`
  return minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`
}

const SLA_TARGET_MINUTES = 15

// How long an unstarted prescription has against the 15-minute dispensing target, measured from when it was issued.
export function slaLabel(rx) {
  if (rx.status !== 'Awaiting dispensing') return rx.status
  const left = SLA_TARGET_MINUTES - (minutesOf(NOW.time) - minutesOf(rx.time))
  return left >= 0 ? `SLA < ${left}m left` : `SLA breached by ${-left}m`
}

export const isOpenRx = (rx) => rx.status !== 'Dispensed'

export function queueCounts(rxQueue) {
  const count = (status) => rxQueue.filter((rx) => rx.status === status).length
  const open = rxQueue.filter(isOpenRx)
  const waits = rxQueue.filter((rx) => rx.status === 'Awaiting dispensing').map((rx) => minutesOf(NOW.time) - minutesOf(rx.time))
  return {
    queued: open.length,
    awaiting: count('Awaiting dispensing'),
    stat: rxQueue.filter((rx) => rx.status === 'Awaiting dispensing' && rx.priority === 'STAT').length,
    partial: count('Partially dispensed'),
    hold: count('On hold') + count('Blocked'),
    completed: count('Dispensed'),
    averageWait: waits.length ? (waits.reduce((sum, wait) => sum + wait, 0) / waits.length).toFixed(1) : '0',
  }
}

// Stock and expiry exceptions at the dispensary: stockouts, items below the safety buffer and FEFO rotation candidates.
export function stockExceptions(batches, today = NOW.date) {
  return FORMULARY.flatMap((itemId) => {
    const item = itemById(itemId)
    const stock = summarise(batches, itemId, DISPENSARY, today)
    const status = stockStatus(stock, item.safety, today)
    if (status === 'Available') return []
    const soonest = stock.rows.find((batch) => nearExpiry(batch, today))
    return [{ item, stock, status, batch: soonest ?? null, days: soonest ? daysBetween(today, soonest.expiry) : null }]
  })
}

export function nearExpiryValue(batches, today = NOW.date) {
  const rows = batches.filter((batch) => ['main', 'opd', 'er'].includes(batch.loc) && nearExpiry(batch, today))
  return { count: rows.length, value: rows.reduce((sum, batch) => sum + batch.posted * (itemById(batch.itemId)?.price ?? 0), 0) }
}

export function activityLedger(state) {
  const dispenses = state.dispenses.map((record) => {
    const rx = state.rxQueue.find((entry) => entry.id === record.rxId)
    const complete = rx?.status === 'Dispensed'
    return { key: record.id, date: record.date, time: record.time, title: complete ? `Rx #${record.rxId} dispensed & verified` : 'Partial dispensing logged', detail: `${rx?.patient.name} (${rx?.patient.uhid}) · handled by ${record.by}`, seal: `Dispense ${record.id}` }
  })
  const receipts = state.transfers.filter((transfer) => transfer.status === 'Received' && transfer.to === DISPENSARY).map((transfer) => ({ key: transfer.id, date: transfer.received, time: transfer.receivedTime ?? '00:00', title: `Transfer ${transfer.id} received`, detail: transfer.lines.map((line) => `${itemById(line.itemId).name} · ${line.received} accepted`).join(', '), seal: 'Branch receipt posted' }))
  const cases = state.cases.filter((entry) => entry.date === NOW.date).map((entry) => ({ key: entry.id, date: entry.date, time: entry.time, title: `${entry.type === 'Return' ? 'Return' : 'Discrepancy'} ${entry.id} reported`, detail: `${entry.medicine} · ${entry.qty} ${entry.unit} · ${entry.reason}`, seal: entry.statusNote }))
  return [...dispenses, ...receipts, ...cases].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}

export const pendingOf = (rx) => rx.lines.reduce((sum, line) => sum + remainingOf(line), 0)
