import { invoiceBalance, invoiceTotal } from '../patients/billing'

const round = (value, places = 1) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)
const inRange = (item, range) => item.date >= range.from && item.date <= range.to

// ---- Operations -----------------------------------------------------------------------------------------

export function operationsFigures(operations) {
  const total = (key) => sum(operations.windows, (window) => window[key])
  const completed = total('completed')
  const cancelled = total('cancelled')
  const noShow = total('noShow')
  const rescheduled = total('rescheduled')
  const scheduled = completed + cancelled + noShow + rescheduled
  const assessable = completed + noShow // cancelled and rescheduled slots had no attendance to assess
  const consult = sum(operations.doctors, (doctor) => doctor.consultMinutes)
  const available = sum(operations.doctors, (doctor) => doctor.availableMinutes)
  const { replaced, mature } = operations.rebooking
  return {
    scheduled, completed, cancelled, noShow, rescheduled, assessable,
    noShowRate: assessable ? round((noShow / assessable) * 100) : null,
    noShowExact: assessable ? round((noShow / assessable) * 100, 2) : null,
    cancellationRate: scheduled ? round((cancelled / scheduled) * 100) : null,
    meanWait: operations.waitPairs ? round(operations.waitMinutes / operations.waitPairs, 0) : null,
    utilization: available ? round((consult / available) * 100, 0) : null,
    consultMinutes: consult, availableMinutes: available,
    rebookingRate: mature ? round((replaced / mature) * 100, 0) : null,
    waitCoverage: round((operations.waitPairs / completed) * 100, 0),
  }
}

export const windowTotal = (window) => window.completed + window.cancelled + window.noShow + window.rescheduled

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

export function pharmacyFigures(pharmacy) {
  const statusCount = (status) => pharmacy.items.filter((item) => item.status === status).length
  const nearExpiry = pharmacy.items.filter((item) => item.status === 'Near expiry')
  const sales = sum(pharmacy.categories, (category) => category.sales)
  const cogs = sum(pharmacy.categories, (category) => category.cogs)
  return {
    dispensed: sum(pharmacy.dispensing, (point) => point.value),
    purchases: sum(pharmacy.purchases, (point) => point.value),
    nearExpiryValue: sum(nearExpiry, (item) => item.stock * item.buy),
    nearExpirySkus: nearExpiry.length,
    stockouts: pharmacy.exceptions.filter((entry) => entry.urgency === 'Urgent' || entry.urgency === 'Resolved').length,
    openStockouts: pharmacy.exceptions.filter((entry) => entry.urgency === 'Urgent').length,
    status: { 'In stock': statusCount('In stock'), 'Low stock': statusCount('Low stock'), 'Near expiry': statusCount('Near expiry'), 'Out of stock': statusCount('Out of stock') },
    sales, cogs, grossProfit: sales - cogs, margin: sales ? round(((sales - cogs) / sales) * 100) : null,
    categoryPurchases: sum(pharmacy.categories, (category) => category.purchases),
  }
}
