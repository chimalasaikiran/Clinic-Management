import { allocatedToInvoice, invoiceBalance, invoiceStatus, invoiceTotal, paymentUnallocated } from '../patients/billing'
import { TODAY } from '../patients/format'

const stamp = (item) => `${item.date} ${item.time ?? '00:00'}`
const inRange = (item, range) => item.date >= range.from && item.date <= range.to
const sum = (rows, pick) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100

// Figures for the Billing & Finance overview, taken from the invoices, payments and refunds held in the workspace.
export function billingOverview({ invoices, payments, refunds }, range) {
  const scopedInvoices = invoices.filter((invoice) => inRange(invoice, range))
  const scopedPayments = payments.filter((payment) => inRange(payment, range))
  return {
    collections: sum(scopedPayments, (payment) => payment.amount) - sum(refunds.filter((refund) => inRange(refund, range)), (refund) => refund.amount),
    outstanding: sum(scopedInvoices, (invoice) => invoiceBalance(invoice, payments)),
    unallocated: sum(scopedPayments, (payment) => paymentUnallocated(payment, refunds)),
    pendingRefunds: refunds.filter((refund) => refund.status === 'Pending').length,
    invoiceCount: scopedInvoices.length,
  }
}

// What needs a person next: invoices with a balance and payments with credit not yet applied.
export function priorityQueue({ invoices, payments, refunds }, range, patientName) {
  const open = invoices.filter((invoice) => inRange(invoice, range) && invoiceBalance(invoice, payments) > 0).sort((a, b) => stamp(b).localeCompare(stamp(a)))
  const credit = payments.filter((payment) => inRange(payment, range) && paymentUnallocated(payment, refunds) > 0).sort((a, b) => stamp(b).localeCompare(stamp(a)))
  return [
    ...open.map((invoice) => ({ kind: 'invoice', id: invoice.id, status: invoiceStatus(invoice, payments), amount: invoiceBalance(invoice, payments), patientId: invoice.patientId, name: patientName(invoice.patientId), branch: invoice.branch ?? invoice.location, note: `Total ${invoiceTotal(invoice).toLocaleString('en-IN')} · Allocated paid ${allocatedToInvoice(invoice.id, payments).toLocaleString('en-IN')}`, date: invoice.date, time: invoice.time })),
    ...credit.map((payment) => ({ kind: 'payment', id: payment.id, status: 'Partially allocated', amount: paymentUnallocated(payment, refunds), patientId: payment.patientId, name: patientName(payment.patientId), branch: payment.desk ?? 'Cashier desk', note: `${payment.amount.toLocaleString('en-IN')} received · ${(payment.amount - paymentUnallocated(payment, refunds)).toLocaleString('en-IN')} allocated`, date: payment.date, time: payment.time })),
  ]
}

export function recentActivity({ invoices, payments, refunds }, range, patientName, limit = 6) {
  const rows = [
    ...payments.map((payment) => ({ kind: 'payment', id: payment.id, label: `Payment · ${payment.instrument}`, amount: payment.amount, patientId: payment.patientId, name: patientName(payment.patientId), date: payment.date, time: payment.time, status: paymentUnallocated(payment, refunds) > 0 ? 'Partially allocated' : 'Settled', related: [payment.receiptId && ['Receipt', payment.receiptId]].filter(Boolean) })),
    ...invoices.map((invoice) => ({ kind: 'invoice', id: invoice.id, label: `Invoice · ${invoice.title}`, amount: invoiceTotal(invoice), patientId: invoice.patientId, name: patientName(invoice.patientId), date: invoice.date, time: invoice.time, status: invoiceStatus(invoice, payments), related: [] })),
    ...refunds.map((refund) => ({ kind: 'refund', id: refund.id, label: `Refund · ${refund.reason}`, amount: refund.amount, patientId: refund.patientId, name: patientName(refund.patientId), date: refund.date, time: refund.time, status: 'Refunded', related: [['Original payment', refund.paymentId]] })),
  ]
  return rows.filter((row) => inRange(row, range)).sort((a, b) => stamp(b).localeCompare(stamp(a))).slice(0, limit)
}

export function invoiceRows({ invoices, payments }, range, { query = '', status = '', patientName }) {
  const needle = query.trim().toLowerCase()
  return invoices
    .filter((invoice) => inRange(invoice, range))
    .map((invoice) => ({ invoice, status: invoiceStatus(invoice, payments), total: invoiceTotal(invoice), paid: allocatedToInvoice(invoice.id, payments), balance: invoiceBalance(invoice, payments), name: patientName(invoice.patientId) }))
    .filter((row) => (!status || row.status === status) && (!needle || `${row.invoice.id} ${row.name} ${row.invoice.patientId} ${row.invoice.title}`.toLowerCase().includes(needle)))
    .sort((a, b) => stamp(b.invoice).localeCompare(stamp(a.invoice)))
}

export const isOverdue = (invoice, payments) => Boolean(invoice.dueDate) && invoice.dueDate < TODAY && invoiceBalance(invoice, payments) > 0
