import { invoiceBalance, invoiceTotal } from '../patients/billing'

const round = (value, places = 1) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)
const inRange = (item, range) => item.date >= range.from && item.date <= range.to

// ---- Operations -----------------------------------------------------------------------------------------

// The periods the Operations report offers, as inclusive clinic-local dates ending today.
export function operationPeriods(today) {
  const month = today.slice(0, 7)
  const [year, index] = month.split('-').map(Number)
  const previous = index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, '0')}`
  const lastOfPrevious = addIsoDays(`${month}-01`, -1)
  return [
    { id: 'last28', label: 'Last 28 days', from: addIsoDays(today, -27), to: today },
    { id: 'last7', label: 'Last 7 days', from: addIsoDays(today, -6), to: today },
    { id: 'month', label: 'This month to date', from: `${month}-01`, to: today },
    { id: 'previous', label: 'Last month', from: `${previous}-01`, to: lastOfPrevious },
  ]
}

export const windowTotal = (window) => window.completed + window.cancelled + window.noShow + window.open

// Rates and denominators from the Operations report the API returns. A rate with no denominator is null, not zero.
export function operationsFigures(report) {
  const { scheduled, completed, cancelled, noShow, open, rescheduled } = report
  const assessable = completed + noShow // cancelled and still-open appointments had no attendance to assess
  const consult = sum(report.doctors, (doctor) => doctor.consultMinutes)
  const available = sum(report.doctors, (doctor) => doctor.availableMinutes)
  const { replaced, mature } = report.rebooking
  return {
    scheduled, completed, cancelled, noShow, open, rescheduled, assessable,
    noShowRate: assessable ? round((noShow / assessable) * 100) : null,
    noShowExact: assessable ? round((noShow / assessable) * 100, 2) : null,
    cancellationRate: scheduled ? round((cancelled / scheduled) * 100) : null,
    meanWait: report.wait.meanMinutes,
    utilization: available ? round((consult / available) * 100, 0) : null,
    consultMinutes: consult, availableMinutes: available,
    rebookingRate: mature ? round((replaced / mature) * 100, 0) : null,
    waitCoverage: completed ? round((report.wait.pairs / completed) * 100, 0) : null,
  }
}

// ---- Financial ------------------------------------------------------------------------------------------

// Billed, collected and refunded values for one period. Each is its own record set: they are never netted against each other.
export function financialFigures({ invoices, payments }, refunds, range) {
  const billed = invoices.filter((invoice) => inRange(invoice, range))
  const collected = payments.filter((payment) => inRange(payment, range))
  const created = refunds.filter((refund) => inRange(refund, range))
  const outstanding = billed.filter((invoice) => invoiceBalance(invoice, payments) > 0)
  const statusTotal = (status) => sum(created.filter((refund) => refund.status === status), (refund) => refund.amount)
  return {
    billed: { amount: sum(billed, invoiceTotal), invoices: billed },
    collected: { amount: sum(collected, (payment) => payment.amount), payments: collected },
    outstanding: { amount: sum(outstanding, (invoice) => invoiceBalance(invoice, payments)), invoices: outstanding },
    refundStatus: ['Pending', 'Approved', 'Failed', 'Rejected', 'Processed'].map((status) => ({ status, amount: statusTotal(status), count: created.filter((refund) => refund.status === status).length })),
    refundsCreated: created,
    completedRefunds: statusTotal('Processed'),
    excludedRefunds: refunds.filter((refund) => !inRange(refund, range) && refund.status === 'Processed'),
  }
}

// ---- Pharmacy & inventory -------------------------------------------------------------------------------

// Pharmacy & inventory figures from the live stock state (inventory adapters' shapes) over the last `days` days.
// Values are at the item's unit price; ClinicOS records no separate selling price, so no margin is worked out.
export function pharmacyReport({ items, state, locations }, today, days = 30) {
  const since = addIsoDays(today, -days + 1)
  const inWindow = (date) => date >= since && date <= today
  const price = new Map(items.map((item) => [item.id, item.price]))
  const pharmacies = locations.filter((location) => location.kind === 'pharmacy').map((location) => location.id)
  const nearLimit = addIsoDays(today, 30)
  const free = (batch) => (batch.expiry < today ? 0 : Math.max(0, batch.posted - batch.reserved - batch.quarantine))
  const rows = items.filter((item) => item.active !== false).map((item) => {
    const batches = state.batches.filter((batch) => batch.itemId === item.id && batch.posted > 0)
    const stock = batches.reduce((sum, batch) => sum + free(batch), 0)
    const soonest = batches.filter((batch) => batch.expiry >= today).sort((a, b) => a.expiry.localeCompare(b.expiry))[0] ?? null
    const near = soonest && soonest.expiry <= nearLimit
    const status = stock <= 0 ? 'Out of stock' : stock < item.reorder ? 'Low stock' : near ? 'Near expiry' : 'In stock'
    return { name: item.name, category: item.category, stock, unit: item.unitPlural, level: item.reorder, batch: soonest?.batchNo ?? '—', expiry: soonest?.expiry ?? null, buy: item.price, status, nearValue: near ? soonest.posted * item.price : 0, itemId: item.id }
  })
  const dispensedLines = state.dispenses.filter((dispense) => inWindow(dispense.date)).flatMap((dispense) => dispense.lines)
  const received = state.movements.filter((movement) => movement.kind === 'Receipt' && movement.delta > 0 && inWindow(movement.date) && !pharmacies.includes(movement.loc))
  const byCategory = new Map()
  for (const line of dispensedLines) {
    const category = items.find((item) => item.id === line.itemId)?.category ?? 'Other'
    const entry = byCategory.get(category) ?? { name: category, units: 0, value: 0 }
    entry.units += line.qty
    entry.value = round(entry.value + line.qty * (price.get(line.itemId) ?? 0), 2)
    byCategory.set(category, entry)
  }
  const statusCount = (status) => rows.filter((row) => row.status === status).length
  return {
    since,
    items: rows,
    dispensed: sum(dispensedLines, (line) => line.qty),
    dispensedValue: sum(dispensedLines, (line) => line.qty * (price.get(line.itemId) ?? 0)),
    receivedValue: sum(received, (movement) => movement.delta * (price.get(movement.itemId) ?? 0)),
    nearExpiryValue: sum(rows, (row) => row.nearValue),
    nearExpirySkus: statusCount('Near expiry'),
    stockouts: statusCount('Out of stock'),
    status: { 'In stock': statusCount('In stock'), 'Low stock': statusCount('Low stock'), 'Near expiry': statusCount('Near expiry'), 'Out of stock': statusCount('Out of stock') },
    categories: [...byCategory.values()].sort((a, b) => b.value - a.value),
    exceptions: rows.filter((row) => row.status !== 'In stock'),
  }
}

function addIsoDays(iso, count) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10)
}
