import { ageFrom, formatDate, localToday } from '../patients/format'
import { GST_RATE, TAX_LABEL, TAX_VALUE } from './constants'

// Maps the API ledger (backend/src/modules/billing/ledger.service.ts) onto the shapes the billing screens use.
// Financial documents are shown and linked by their number (INV-000001), so a view's `id` is that number and
// `uuid` is the API identifier used for changes.

const capital = (value) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ')
const when = (stamp) => `${formatDate(stamp.date)} · ${stamp.time} IST`
const eventText = (event) => (event.note ? `${event.action} · ${event.note}` : event.action)
const audit = (events) => events.map((event) => ({ at: when(event.at), by: event.actor ?? 'System', text: eventText(event) }))

export const CHARGE_STATUS = { draft: 'Draft', unbilled: 'Unbilled', invoiced: 'Invoiced' }
export const EXCEPTION_STATUS = { open: 'Open', in_review: 'In review', resolved: 'Resolved' }

export const toBranchView = (branch) => ({ id: branch.id, name: branch.name, short: branch.name, code: branch.code, active: branch.status === 'active' })

export const toPatientView = (patient, today = localToday()) => ({
  id: patient.id, name: patient.name, mrn: patient.mrn, mobile: patient.mobile, age: ageFrom(patient.dateOfBirth, today), branch: patient.branch.name, branchId: patient.branch.id,
})

export function toServiceView(service) {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    category: service.category,
    department: service.department ?? '',
    description: service.description,
    unit: service.unit ?? '',
    status: service.status === 'active' ? 'Active' : 'Inactive',
    price: service.price,
    tax: TAX_LABEL[service.taxTreatment],
    taxConfig: service.taxConfig ?? '',
    gstRate: service.gstRate,
    branches: Object.fromEntries(service.prices.map((entry) => [entry.branchId, { available: true, price: entry.price }])),
    updated: when(service.updated),
    audit: audit(service.events),
    version: service.version,
  }
}

// The request body for a service form, as the API expects it.
export function toServiceRequest(view) {
  return {
    code: view.code, name: view.name, category: view.category, department: view.department || null, description: view.description, unit: view.unit || null,
    status: view.status === 'Active' ? 'active' : 'inactive', price: view.price, taxTreatment: TAX_VALUE[view.tax], taxConfig: view.taxConfig || null,
    prices: Object.entries(view.branches).map(([branchId, entry]) => ({ branchId, price: entry.price })),
  }
}

export const gstRateOf = (service) => (service.tax === 'Taxable' ? GST_RATE[service.taxConfig] ?? 0 : 0)

export function toConfigView(settings) {
  return {
    model: settings.billingModel,
    methods: { cash: settings.cashEnabled, bank: settings.bankEnabled, upi: settings.upiEnabled },
    advance: settings.advancePolicy,
    partial: settings.partialPolicy,
    allocation: settings.allocationPolicy,
    invoiceDoc: settings.invoiceDocument,
    receiptDoc: settings.receiptDocument,
    audit: audit(settings.events),
    version: settings.version,
  }
}

export const toSettingsRequest = (config) => ({
  billingModel: config.model, cashEnabled: config.methods.cash, bankEnabled: config.methods.bank, upiEnabled: config.methods.upi, advancePolicy: config.advance,
  partialPolicy: config.partial, allocationPolicy: config.allocation, invoiceDocument: config.invoiceDoc, receiptDocument: config.receiptDoc, version: config.version,
})

const line = (row) => ({ code: row.code, name: row.name, note: row.note ?? row.category, qty: row.quantity, price: row.unitPrice, discountPct: row.discountPct, gstPct: row.gstPct })

export function toChargeView(charge) {
  return {
    id: charge.reference,
    uuid: charge.id,
    patientId: charge.patientId,
    date: charge.date,
    time: charge.created.time,
    title: charge.name,
    reference: `${charge.code} · ${charge.model}`,
    status: CHARGE_STATUS[charge.status],
    invoiceId: charge.invoiceReference,
    note: charge.note,
    location: charge.department ?? charge.category,
    branch: charge.branch.name,
    branchId: charge.branch.id,
    payer: charge.payer,
    model: charge.model,
    serviceId: charge.serviceId,
    encounterId: charge.encounterId,
    encounterReference: charge.encounterReference,
    createdBy: charge.createdBy,
    version: charge.version,
    audit: audit(charge.events),
    lines: [line(charge)],
  }
}

export function toInvoiceView(invoice, chargeReferences) {
  return {
    id: invoice.reference,
    uuid: invoice.id,
    patientId: invoice.patientId,
    date: invoice.date,
    time: invoice.created.time,
    title: invoice.title,
    encounterId: invoice.encounterReference ?? '—',
    provider: invoice.createdBy,
    location: invoice.branch.name,
    branch: invoice.branch.name,
    payer: invoice.payer,
    model: invoice.model,
    kind: 'Invoice',
    status: 'Issued',
    cashier: invoice.createdBy,
    publicNote: invoice.publicNote,
    internalNote: invoice.internalNote,
    dueDate: invoice.dueDate,
    chargeIds: invoice.lines.filter((entry) => entry.chargeId).map((entry) => chargeReferences.get(entry.chargeId) ?? entry.chargeId),
    lines: invoice.lines.map(line),
  }
}

export function toPaymentView(payment) {
  return {
    id: payment.reference,
    uuid: payment.id,
    patientId: payment.patientId,
    date: payment.received.date,
    time: payment.received.time,
    amount: payment.amount,
    instrument: payment.channel,
    channel: payment.channel,
    payer: payment.payer,
    purpose: payment.purpose,
    cashier: payment.recordedBy,
    desk: payment.branch.name,
    branch: payment.branch.name,
    reference: payment.txnReference ?? 'Not supplied',
    txnReference: payment.txnReference,
    context: payment.narration || (payment.purpose === 'advance' ? 'Advance / on account' : 'Collection against charges'),
    note: payment.narration,
    receiptId: payment.receiptNumber,
    allocations: payment.allocations.map((entry) => ({
      id: entry.reference, invoiceId: entry.invoiceReference, invoiceUuid: entry.invoiceId, amount: entry.amount, date: entry.at.date, time: entry.at.time, by: entry.by, refundId: entry.refundId,
    })),
  }
}

export function toRefundView(refund) {
  return {
    id: refund.reference,
    uuid: refund.id,
    patientId: refund.patientId,
    paymentId: refund.paymentReference,
    paymentUuid: refund.paymentId,
    date: refund.requested.date,
    time: refund.requested.time,
    amount: refund.amount,
    reason: refund.reason,
    justification: refund.notes,
    notes: refund.notes,
    method: refund.method,
    reference: refund.internalReference,
    releasesAllocations: refund.releasesAllocations,
    status: capital(refund.status),
    outcomeReference: refund.outcomeReference,
    note: refund.outcomeNote,
    requestedBy: refund.requestedBy,
    title: `Refund against ${refund.paymentReference}`,
    location: 'Billing desk',
    version: refund.version,
    audit: audit(refund.events),
  }
}

export function toStatementLineView(line, exceptionReferences) {
  return {
    id: line.id,
    source: line.source,
    reference: line.reference,
    date: line.date,
    time: line.time ?? '—',
    amount: line.amount,
    paymentId: line.paymentReference,
    note: line.narration,
    state: capital(line.state),
    exceptionId: line.exceptionId ? exceptionReferences.get(line.exceptionId) : null,
    batch: line.importReference,
  }
}

export function toExceptionView(exception, linesById) {
  const line = linesById.get(exception.lineId)
  return {
    id: exception.reference,
    uuid: exception.id,
    lineId: exception.lineId,
    kind: exception.kind,
    detected: when(exception.created),
    owner: exception.owner ?? 'Unassigned',
    status: EXCEPTION_STATUS[exception.status],
    batch: line?.importReference ?? '',
    evidence: exception.evidence ?? '',
    evidenceAttached: Boolean(exception.evidence),
    reason: exception.reason,
    resolution: exception.resolutionType ? { type: exception.resolutionType, note: exception.resolutionNote, evidence: exception.evidence } : null,
    version: exception.version,
    // Oldest first, as an audit trail reads.
    audit: [...exception.events].reverse().map((event) => [when(event.at), event.actor ?? 'System · Statement matching', event.action, event.note]),
  }
}

export function toLedgerView(data) {
  const chargeReferences = new Map(data.charges.map((charge) => [charge.id, charge.reference]))
  const exceptionReferences = new Map(data.exceptions.map((exception) => [exception.id, exception.reference]))
  const linesById = new Map(data.statementLines.map((line) => [line.id, line]))
  const refunds = data.refunds.map(toRefundView)
  return {
    branches: data.branches.map(toBranchView),
    patients: data.patients.map((patient) => toPatientView(patient)),
    services: data.services.map(toServiceView),
    config: toConfigView(data.settings),
    records: {
      charges: data.charges.map(toChargeView),
      invoices: data.invoices.map((invoice) => toInvoiceView(invoice, chargeReferences)),
      payments: data.payments.map(toPaymentView),
      // Only money that went back reduces a payment; requests still in the workflow are listed separately.
      refunds: refunds.filter((refund) => refund.status === 'Processed'),
    },
    refundRequests: refunds.filter((refund) => refund.status !== 'Processed'),
    statementLines: data.statementLines.map((line) => toStatementLineView(line, exceptionReferences)),
    exceptions: data.exceptions.map((exception) => toExceptionView(exception, linesById)),
    imports: data.statementImports.map((entry) => ({ ...entry, when: when(entry.at) })),
  }
}
