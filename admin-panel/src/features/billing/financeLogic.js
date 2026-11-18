import { allocatedFromPayment, invoiceBalance, invoiceTotals, lineAmounts, paymentUnallocated } from '../patients/billing'

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100
const sum = (rows, pick) => round2(rows.reduce((total, row) => total + pick(row), 0))
const inRange = (item, range) => item.date >= range.from && item.date <= range.to
const stamp = (item) => `${item.date} ${item.time ?? '00:00'}`
const newest = (a, b) => stamp(b).localeCompare(stamp(a))
const matches = (text, query) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase())

// ---- Charges ----------------------------------------------------------------------------------------------

export const CHARGE_STATUSES = ['Draft', 'Finalized']
export const INVOICE_STATUSES = ['Uninvoiced', 'Invoiced']

export const chargeStatus = (charge) => (charge.status === 'Draft' ? 'Draft' : 'Finalized')
export const chargeInvoiceStatus = (charge) => (charge.invoiceId ? 'Invoiced' : 'Uninvoiced')
export const chargeTotal = (charge) => sum(charge.lines, (line) => lineAmounts(line).total)

export function chargeRows(records, { query = '', status = '', invoice = '', branch = '', range, patientName }) {
  return records.charges
    .filter((charge) => (!range || inRange(charge, range)) && (!status || chargeStatus(charge) === status) && (!invoice || chargeInvoiceStatus(charge) === invoice) && (!branch || charge.branch === branch))
    .filter((charge) => matches(`${charge.id} ${patientName(charge.patientId)} ${charge.reference} ${charge.title}`, query))
    .sort(newest)
}

// Price and tax come from the service catalogue; a service without them cannot be confirmed.
export function chargeSetupIssues(service) {
  const issues = []
  if (!service) return ['Select a service or item']
  if (!(service.price > 0)) issues.push('Price missing')
  if (!service.tax || service.tax === 'Not configured') issues.push('Tax treatment missing')
  return issues
}

export function validateCharge(values) {
  const errors = {}
  if (!values.patientId) errors.patientId = 'Select a patient.'
  if (!values.serviceId) errors.serviceId = 'Select a service or item.'
  if (!(Number(values.qty) > 0)) errors.qty = 'Quantity must be greater than 0.'
  return errors
}

// The request body for saving a charge; the API prices it from the catalogue at the patient's branch.
export const chargeRequest = (values, confirm) => ({
  serviceId: values.serviceId, encounterId: values.encounterId || null, payer: values.payer, model: values.model, quantity: Number(values.qty), discountPct: Number(values.discountPct) || 0, note: values.note.trim(), confirm,
})

// What a branch charges for a service: its override, or the default price.
export const branchPrice = (service, branchId) => service?.branches[branchId]?.price ?? service?.price ?? null

export const draftBreakdown = (service, qty, discountPct, branchId) => {
  const price = branchPrice(service, branchId)
  if (!(price > 0)) return null
  return invoiceTotals([{ qty: Number(qty) || 0, price, discountPct: Number(discountPct) || 0, gstPct: service.gstRate ?? 0 }])
}

// ---- Payments and receipts --------------------------------------------------------------------------------

export function paymentRows(records, { query = '', method = '', status = '', range, patientName }) {
  return records.payments
    .map((payment) => {
      const unallocated = paymentUnallocated(payment, records.refunds)
      const allocated = allocatedFromPayment(payment)
      return { payment, name: patientName(payment.patientId), allocated, unallocated, allocation: unallocated > 0 ? (allocated > 0 ? 'Partially allocated' : 'Unallocated') : 'Fully allocated' }
    })
    .filter(({ payment, name, allocation }) => (!range || inRange(payment, range)) && (!method || payment.channel === method) && (!status || allocation === status) && matches(`${payment.id} ${name} ${payment.payer} ${payment.reference}`, query))
    .sort((a, b) => newest(a.payment, b.payment))
}

// Allocations carry their own number (ALC-000001).
export const allocationRef = (_payment, allocation) => allocation.id

export function validatePayment(values) {
  const errors = {}
  const amount = Number(values.amount)
  if (!values.patientId) errors.patientId = 'Select a patient.'
  if (!(amount > 0)) errors.amount = 'Enter an amount greater than ₹0.'
  if (!values.channel) errors.channel = 'Choose a payment method.'
  if (values.channel && values.channel !== 'Cash Desk' && !values.reference.trim()) errors.reference = 'Enter the transaction reference for this method.'
  if (values.channel && values.enabled && !values.enabled(values.channel)) errors.channel = 'This payment method is switched off in the billing configuration.'
  if (values.purpose === 'charges' && values.invoiceId && amount > Number(values.outstanding)) errors.amount = 'Amount exceeds the outstanding balance.'
  else if (values.purpose === 'charges' && values.invoiceId && values.fullPayment && amount > 0 && amount < Number(values.outstanding)) errors.amount = 'The billing configuration requires the full outstanding balance.'
  return errors
}

export const receiptRows = (records, { query = '', status = '', patientName }) =>
  records.payments
    .filter((payment) => payment.receiptId)
    .map((payment) => ({ payment, receiptId: payment.receiptId, name: patientName(payment.patientId) }))
    .filter((row) => (!status || status === 'issued') && matches(`${row.receiptId} ${row.name} ${row.payment.id}`, query))
    .sort((a, b) => newest(a.payment, b.payment))

// ---- Refunds ----------------------------------------------------------------------------------------------

export const REFUND_STATUSES = ['Pending', 'Approved', 'Processed', 'Failed', 'Rejected']

// Refunds already processed with the patient records have no workflow state of their own.
export const allRefunds = (records, requests) => [...requests, ...records.refunds.map((refund) => ({ ...refund, status: 'Processed' }))]

export const allPayments = (records) => records.payments

// The same position the API checks a refund against. `refundable` also counts money already applied to
// invoices, which a refund may take back when it is allowed to release allocations.
export function refundBalance(payment, refunds) {
  const linked = refunds.filter((refund) => refund.paymentId === payment.id)
  const total = (...states) => sum(linked.filter((refund) => states.includes(refund.status)), (refund) => refund.amount)
  const allocated = allocatedFromPayment(payment)
  const processed = total('Processed')
  const reserved = total('Pending', 'Approved')
  const eligible = round2(payment.amount - allocated - processed)
  return { received: payment.amount, allocated, processed, reserved, eligible, remaining: round2(eligible - reserved), refundable: round2(payment.amount - processed - reserved) }
}

export function validateRefund(values, remaining) {
  const errors = {}
  const amount = Number(values.amount)
  if (!values.paymentId) errors.paymentId = 'Select the original payment.'
  if (!(amount > 0)) errors.amount = 'Enter an amount greater than ₹0.'
  else if (amount > remaining) errors.amount = `Exceeds ₹${remaining.toLocaleString('en-IN')} remaining by ₹${round2(amount - remaining).toLocaleString('en-IN')}. Submission blocked.`
  if (!values.reference.trim()) errors.reference = 'Enter an internal reference.'
  return errors
}

export function refundSummary(refunds) {
  const by = (state) => refunds.filter((refund) => refund.status === state)
  return Object.fromEntries(REFUND_STATUSES.map((state) => [state, { count: by(state).length, amount: sum(by(state), (refund) => refund.amount) }]))
}

// ---- Reconciliation ---------------------------------------------------------------------------------------

// Statement lines beside the payments they point at. `payment` is the recorded payment, when there is one.
export function reconRows({ lines, exceptions, payments }, { source = '', state = '', range } = {}) {
  return lines
    .map((line) => {
      const payment = line.paymentId ? payments.find((entry) => entry.id === line.paymentId) ?? null : null
      const exception = exceptions.find((entry) => entry.lineId === line.id) ?? null
      return { line, payment, exception, clinicos: payment?.amount ?? null, difference: round2(line.amount - (payment?.amount ?? 0)), state: line.state }
    })
    .filter((row) => (!source || row.line.source === source) && (!state || (state === 'Matched' ? row.state === 'Matched' : row.state !== 'Matched')) && (!range || inRange(row.line, range)))
}

export function reconSummary(rows) {
  const matched = rows.filter((row) => row.state === 'Matched')
  const source = sum(rows, (row) => row.line.amount)
  const clinicos = sum(rows, (row) => row.clinicos ?? 0)
  return {
    source, clinicos, net: round2(source - clinicos), matched: matched.length, unmatched: rows.length - matched.length, matchedAmount: sum(matched, (row) => row.line.amount),
    exceptions: rows.filter((row) => row.exception && row.state !== 'Resolved').length, candidates: rows.filter((row) => row.state === 'Candidate').length, linked: rows.filter((row) => row.clinicos !== null).length,
  }
}

// The API also asks for a note of at least 10 characters.
export const canResolve = ({ evidenceAttached, confirmed, note }) => evidenceAttached && confirmed && note.trim().length >= 10

// ---- Advances and balances --------------------------------------------------------------------------------

// Funds held for a patient on payments that still carry unapplied credit, kept apart from invoice receivables.
export function patientBalances(records, refunds, patientId) {
  const payments = records.payments.filter((payment) => payment.patientId === patientId)
  const slice = payments.map((payment) => ({ payment, ...refundBalance(payment, refunds) })).filter((entry) => entry.eligible > 0)
  const held = sum(slice, (entry) => entry.eligible)
  const reserve = sum(slice, (entry) => entry.reserved)
  const invoices = records.invoices.filter((invoice) => invoice.patientId === patientId)
  const owed = sum(invoices, (invoice) => Math.max(invoiceBalance(invoice, records.payments), 0))
  const openInvoice = invoices.filter((invoice) => invoiceBalance(invoice, records.payments) > 0).sort(newest)[0] ?? null
  return {
    slice, held, reserve, spendable: Math.max(round2(held - reserve), 0), used: sum(slice, (entry) => entry.allocated), owed, openInvoice,
    history: slice.flatMap(({ payment }) => [
      { kind: 'payment', id: payment.id, date: payment.date, time: payment.time, amount: payment.amount, label: payment.instrument, effect: 'Verified collection', paymentId: payment.id },
      ...payment.allocations.map((allocation) => ({ kind: 'allocation', id: allocationRef(payment, allocation), date: null, time: null, amount: allocation.amount, label: `Applied to ${allocation.invoiceId}`, effect: 'Applied to invoice', paymentId: payment.id })),
      ...refunds.filter((refund) => refund.paymentId === payment.id).map((refund) => ({ kind: 'refund', id: refund.id, date: refund.date, time: refund.time ?? null, amount: refund.amount, label: `${refund.status} refund · ${refund.reason}`, effect: refund.status === 'Processed' ? 'Confirmed returned' : 'Reserved, not returned', paymentId: payment.id })),
    ]).sort((a, b) => (b.date ? stamp(b) : '').localeCompare(a.date ? stamp(a) : '')),
  }
}

// ---- Finance reports --------------------------------------------------------------------------------------

export const REPORT_CATALOG = [
  { name: 'Collections', source: 'payments' },
  { name: 'Outstanding balances', source: 'invoices' },
  { name: 'Refunds', source: 'refunds' },
  { name: 'Revenue', note: 'No revenue-recognition data supplied', detail: 'A collected payment does not establish recognized revenue.' },
  { name: 'Discounts', note: 'No verified discount records supplied', detail: 'No amount or discount rate can be reported.' },
  { name: 'Doctor settlements', note: 'Configuration and settlement records unavailable', detail: 'No doctor payees, periods or rules have been assumed.' },
  { name: 'Branch revenue', note: 'No branch revenue ledger supplied', detail: 'Known collection branch is not evidence of branch revenue.' },
  { name: 'Expenses', note: 'No verified expense records supplied', detail: 'Deductions or refunds are not inferred as operating expenses.' },
  { name: 'Profitability', note: 'Revenue and expense coverage unavailable', detail: 'No margin, profit or net collection value can be calculated.' },
]

export function reportFigures(records, refunds, range) {
  const payments = records.payments.filter((payment) => inRange(payment, range))
  const invoices = records.invoices.filter((invoice) => inRange(invoice, range))
  const open = invoices.filter((invoice) => invoiceBalance(invoice, records.payments) > 0)
  const processed = refunds.filter((refund) => refund.status === 'Processed' && inRange(refund, range))
  return {
    collections: { amount: sum(payments, (payment) => payment.amount), count: payments.length },
    outstanding: { amount: sum(open, (invoice) => invoiceBalance(invoice, records.payments)), count: open.length, invoice: open[0] ?? null },
    refunds: { amount: sum(processed, (refund) => refund.amount), count: processed.length, all: refunds.filter((refund) => inRange(refund, range)) },
  }
}
