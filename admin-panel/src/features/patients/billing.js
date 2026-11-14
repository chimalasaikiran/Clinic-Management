// Billing arithmetic for the patient ledger. Everything here is pure so it can be tested without the UI.
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100
const total = (items, pick) => round2(items.reduce((sum, item) => sum + pick(item), 0))

export function lineAmounts(line) {
  const gross = round2(line.qty * line.price)
  const discount = round2((gross * (line.discountPct ?? 0)) / 100)
  const taxable = round2(gross - discount)
  const tax = round2((taxable * (line.gstPct ?? 0)) / 100)
  return { gross, discount, taxable, tax, total: round2(taxable + tax) }
}

// Exempt healthcare services and taxable consumables are reported separately; GST splits evenly into CGST and SGST.
export function invoiceTotals(lines) {
  const amounts = lines.map((line) => ({ line, ...lineAmounts(line) }))
  const taxableLines = amounts.filter((entry) => entry.line.gstPct > 0)
  const tax = total(taxableLines, (entry) => entry.tax)
  return {
    gross: total(amounts, (entry) => entry.gross),
    discount: total(amounts, (entry) => entry.discount),
    exemptBase: total(amounts.filter((entry) => !(entry.line.gstPct > 0)), (entry) => entry.taxable),
    taxableBase: total(taxableLines, (entry) => entry.taxable),
    cgst: round2(tax / 2),
    sgst: round2(tax / 2),
    tax,
    total: total(amounts, (entry) => entry.total),
  }
}

export const invoiceTotal = (invoice) => invoiceTotals(invoice.lines).total

export function allocatedToInvoice(invoiceId, payments) {
  return total(
    payments.flatMap((payment) => payment.allocations).filter((allocation) => allocation.invoiceId === invoiceId),
    (allocation) => allocation.amount,
  )
}

export const invoiceBalance = (invoice, payments) => round2(invoiceTotal(invoice) - allocatedToInvoice(invoice.id, payments))

export function invoiceStatus(invoice, payments) {
  if (invoiceBalance(invoice, payments) <= 0) return 'Paid in Full'
  return allocatedToInvoice(invoice.id, payments) > 0 ? 'Partially Paid' : 'Issued'
}

export const refundedAgainst = (paymentId, refunds) =>
  total(
    refunds.filter((refund) => refund.paymentId === paymentId),
    (refund) => refund.amount,
  )

export const allocatedFromPayment = (payment) => total(payment.allocations, (allocation) => allocation.amount)

// Money received that is neither applied to an invoice nor refunded: the patient's credit vault.
export const paymentUnallocated = (payment, refunds) =>
  round2(payment.amount - allocatedFromPayment(payment) - refundedAgainst(payment.id, refunds))

export function ledgerSummary({ invoices, payments, refunds }) {
  const received = total(payments, (payment) => payment.amount)
  const refunded = total(refunds, (refund) => refund.amount)
  const open = invoices.filter((invoice) => invoiceBalance(invoice, payments) > 0)
  const nextDue = open.map((invoice) => invoice.dueDate).sort()[0] ?? null
  return {
    outstanding: total(invoices, (invoice) => Math.max(invoiceBalance(invoice, payments), 0)),
    invoiced: total(invoices, invoiceTotal),
    paid: round2(received - refunded),
    unallocated: total(payments, (payment) => paymentUnallocated(payment, refunds)),
    refunded,
    nextDue,
    openInvoices: open.length,
  }
}

// Returns an error message, or null when `amount` can be applied.
export function allocationError({ amount, available, balance }) {
  if (!(amount > 0)) return 'Enter an amount greater than zero.'
  if (amount > available) return 'Amount exceeds the unallocated payment credit.'
  if (amount > balance) return 'Amount exceeds the invoice balance.'
  return null
}

export function applyAllocation(payment, invoiceId, amount) {
  const existing = payment.allocations.find((allocation) => allocation.invoiceId === invoiceId)
  const allocations = existing
    ? payment.allocations.map((allocation) => (allocation.invoiceId === invoiceId ? { ...allocation, amount: round2(allocation.amount + amount) } : allocation))
    : [...payment.allocations, { invoiceId, amount }]
  return { ...payment, allocations }
}

// Splits a received amount across open invoices in order, returning the allocations it could place.
export function autoAllocate(amount, openInvoices) {
  let remaining = amount
  const allocations = []
  openInvoices.forEach(({ invoiceId, balance }) => {
    if (remaining <= 0) return
    const applied = Math.min(remaining, balance)
    allocations.push({ invoiceId, amount: applied })
    remaining = round2(remaining - applied)
  })
  return allocations
}

// Most that can still be refunded against a payment: what was received less earlier refunds.
export const refundCeiling = (payment, refunds) => round2(payment.amount - refundedAgainst(payment.id, refunds))

// A refund is paid from the unallocated vault first; any remainder unlinks allocations, newest invoice first.
export function unlinkForRefund(payment, refunds, amount) {
  let needed = round2(amount - paymentUnallocated(payment, refunds))
  if (needed <= 0) return payment.allocations
  return [...payment.allocations]
    .reverse()
    .map((allocation) => {
      if (needed <= 0) return allocation
      const take = Math.min(allocation.amount, needed)
      needed = round2(needed - take)
      return { ...allocation, amount: round2(allocation.amount - take) }
    })
    .reverse()
    .filter((allocation) => allocation.amount > 0)
}

const LEDGER_TONES = { 'Paid in Full': 'success', 'Partially Paid': 'warning', Issued: 'neutral', Settled: 'success', 'Partial Alloc': 'info', Credit: 'info', Invoiced: 'neutral', Unbilled: 'warning', Refunded: 'brand' }

// One chronological list of invoices, payments, charges and refunds for the billing overview.
export function buildLedger({ invoices, payments, refunds, charges }) {
  const rows = [
    ...invoices.map((invoice) => ({
      kind: 'invoice', id: invoice.id, date: invoice.date, time: invoice.time, badge: 'INV', title: invoice.title, context: `Encounter #${invoice.encounterId} · ${invoice.provider}`,
      location: invoice.location, branch: invoice.branch, amount: invoiceTotal(invoice), status: invoiceStatus(invoice, payments), objectNote: invoice.kind,
      amountNote: invoiceBalance(invoice, payments) > 0 ? `Paid ${fmt(allocatedToInvoice(invoice.id, payments))} · Due ${fmt(invoiceBalance(invoice, payments))}` : `Settled ${fmt(invoiceTotal(invoice))} (Due ₹0)`,
    })),
    ...payments.map((payment) => {
      const unallocated = paymentUnallocated(payment, refunds)
      const refunded = refundedAgainst(payment.id, refunds)
      const status = refunded >= payment.amount ? 'Refunded' : unallocated > 0 ? (allocatedFromPayment(payment) > 0 ? 'Partial Alloc' : 'Credit') : 'Settled'
      return {
        kind: 'payment', id: payment.id, date: payment.date, time: payment.time, badge: 'PAY', title: payment.context, context: `Allocated: ${fmt(allocatedFromPayment(payment))}${unallocated > 0 ? ` · Unallocated: ${fmt(unallocated)}` : ''}`,
        location: payment.desk, branch: payment.payer, amount: payment.amount, status, objectNote: payment.instrument,
        amountNote: unallocated > 0 ? `Credit: ${fmt(unallocated)} avail.` : refunded ? `Refunded ${fmt(refunded)}` : `Allocated to ${payment.allocations.map((allocation) => allocation.invoiceId).join(', ')}`,
      }
    }),
    ...charges.map((charge) => ({
      kind: 'charge', id: charge.id, date: charge.date, time: charge.time, badge: 'CHG', title: charge.title, context: charge.reference, location: charge.location, branch: charge.branch,
      amount: total(charge.lines, (line) => lineAmounts(line).total), status: charge.status, objectNote: 'Standard Tariff Billing', amountNote: charge.invoiceId ? `Billed in ${charge.invoiceId}` : 'Awaiting invoice',
    })),
    ...refunds.map((refund) => ({
      kind: 'refund', id: refund.id, date: refund.date, time: refund.time, badge: 'REF', title: refund.title ?? 'Payment refund', context: `Clinical cancellation: ${refund.reason}`, location: refund.location ?? 'Billing desk', branch: '',
      amount: refund.amount, status: 'Refunded', objectNote: 'Payment Reversal Audit', amountNote: `Reversal on ${refund.paymentId}`,
    })),
  ]
  return rows.map((row) => ({ ...row, tone: LEDGER_TONES[row.status] ?? 'neutral' })).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}

function fmt(value) {
  return `₹${Number(value).toLocaleString('en-IN')}`
}
