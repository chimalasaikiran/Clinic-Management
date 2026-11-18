import { ApiError } from '../../lib/api'
import { invoiceTotals, lineAmounts } from '../../features/patients/billing'
import { PATIENTS, SEED_CHARGES, SEED_INVOICES, SEED_PAYMENTS, SEED_REFUNDS } from './patients'

// An in-memory stand-in for the billing API (backend/src/modules/billing), for page tests. It returns the
// ledger in the API's shape, so the screens are exercised through the same adapters as in production, and it
// applies the main server rules (unique codes, versions, balances, refund holds). The real rules are tested
// against the database in backend/test/integration/billing.test.ts.

export const LEDGER_BRANCHES = [
  { id: 'b-main', code: 'HQ', name: 'Main Clinic (HQ)', status: 'active' },
  { id: 'b-kondapur', code: 'KDP', name: 'Kondapur', status: 'active' },
  { id: 'b-banjara', code: 'BJH', name: 'Banjara Hills', status: 'active' },
]

const stamp = (date, time = '09:00') => ({ date, time, at: `${date}T${time}:00.000Z` })
const event = (action, at, note = '', actor = 'Siddharth Verma') => ({ action, note, actor, at })
const clone = (value) => JSON.parse(JSON.stringify(value))
const pad = (value) => String(value).padStart(6, '0')
const round2 = (value) => Math.round(value * 100) / 100
const fail = (status, code, message, details = []) => {
  throw new ApiError(status, code, message, details)
}

const offered = (price = null) => ({ price })
const service = (code, name, category, department, price, taxTreatment, status, prices, extras = {}) => ({
  id: code.toLowerCase(), code, name, category, department, description: '', unit: null, status, price, taxTreatment,
  taxConfig: taxTreatment === 'exempt' ? 'Healthcare services — Exempt' : taxTreatment === 'taxable' ? 'Standard rate 18% — Taxable' : null,
  gstRate: taxTreatment === 'taxable' ? 18 : 0, prices: Object.entries(prices).map(([branchId, entry]) => ({ branchId, price: entry.price })),
  updated: stamp('2026-10-01'), version: 1, events: [], ...extras,
})

export const API_SERVICES = [
  service('SRV-CARD-01', 'Cardiology Consultation (Initial OPD)', 'Consultation', 'Cardiology', 1000, 'exempt', 'active', { 'b-main': offered(), 'b-kondapur': offered() }, { description: 'Comprehensive initial cardiac clinical assessment by a consultant cardiologist.', unit: 'consultation' }),
  service('SRV-CARD-02', 'Cardiac Follow-up', 'Consultation', 'Cardiology', 600, 'not_configured', 'active', { 'b-main': offered(), 'b-kondapur': offered() }),
  service('SRV-DIAG-03', '12-Lead Electrocardiogram (ECG)', 'Diagnostic & Lab', 'Diagnostic & Imaging', 450, 'not_configured', 'active', { 'b-main': offered(), 'b-kondapur': offered(), 'b-banjara': offered() }),
  service('SRV-CARD-04', '2D Transthoracic Echocardiography', 'Diagnostic & Lab', 'Cardiology', 2800, 'not_configured', 'active', { 'b-main': offered() }),
  service('SRV-CARD-05', 'Treadmill Stress Test (TMT)', 'Diagnostic & Lab', 'Cardiology', 2200, 'not_configured', 'active', { 'b-main': offered() }),
  service('SRV-GMED-01', 'General Physician Consultation', 'Consultation', 'General Medicine', 500, 'exempt', 'active', { 'b-main': offered(), 'b-kondapur': offered(450), 'b-banjara': offered(450) }),
  service('SRV-DIAG-08', 'Comprehensive Diabetic Health Panel', 'Diagnostic & Lab', 'Diagnostic & Imaging', 1800, 'not_configured', 'active', { 'b-main': offered(), 'b-kondapur': offered() }),
  service('SRV-PED-01', 'Pediatric Well-Baby Examination', 'Consultation', 'Pediatrics', 750, 'not_configured', 'active', { 'b-main': offered(), 'b-banjara': offered() }),
  service('SRV-PHYS-01', 'Physiotherapy & Musculoskeletal Rehab', 'Therapy & Allied Health', 'Physiotherapy', 700, 'not_configured', 'active', { 'b-main': offered(), 'b-kondapur': offered() }),
  service('SRV-DIAG-14', 'Sleep Study & Overnight Polysomnography', 'Diagnostic & Lab', null, 6500, 'not_configured', 'inactive', {}),
]

const DEFAULT_SETTINGS = { billingModel: 'Pay-as-you-go', cashEnabled: true, bankEnabled: true, upiEnabled: true, advancePolicy: '', partialPolicy: '', allocationPolicy: '', invoiceDocument: '', receiptDocument: '', version: null, events: [] }

// The view-shaped billing fixtures (test/fixtures/patients/admin.js) in the API's shape.
const branchOf = (name) => ({ id: LEDGER_BRANCHES.find((branch) => branch.name === name)?.id ?? `branch:${name}`, name })
const lineOf = (line, extra = {}) => ({ id: `${line.code}-${Math.random().toString(36).slice(2, 8)}`, chargeId: null, serviceId: null, code: line.code, name: line.name, note: line.note, quantity: line.qty, unitPrice: line.price, discountPct: line.discountPct ?? 0, gstPct: line.gstPct ?? 0, total: lineAmounts(line).total, ...extra })

export const apiInvoiceFrom = (invoice) => {
  const totals = invoiceTotals(invoice.lines)
  return {
    id: `u-${invoice.id}`, reference: invoice.id, patientId: invoice.patientId, branch: branchOf(invoice.branch), encounterId: null, encounterReference: invoice.encounterId ?? null,
    payer: invoice.payer, model: invoice.model ?? 'Consolidated', date: invoice.date, dueDate: invoice.dueDate, created: stamp(invoice.date, invoice.time), title: invoice.title,
    publicNote: invoice.publicNote ?? '', internalNote: invoice.internalNote ?? '', gross: totals.gross, discount: totals.discount, tax: totals.tax, total: totals.total, createdBy: invoice.cashier ?? 'Billing desk',
    lines: invoice.lines.map((line) => lineOf(line)),
  }
}

export const apiPaymentFrom = (payment) => ({
  id: `u-${payment.id}`, reference: payment.id, receiptNumber: payment.receiptId, patientId: payment.patientId, branch: branchOf(payment.desk), amount: payment.amount, channel: payment.channel,
  payer: payment.payer, purpose: payment.allocations.length ? 'charges' : 'advance', txnReference: payment.reference, narration: payment.context ?? '', received: stamp(payment.date, payment.time), recordedBy: payment.cashier,
  allocations: payment.allocations.map((allocation, index) => ({ id: `u-${payment.id}-${index}`, reference: `ALC-${payment.id.slice(-3)}${index + 1}`, invoiceId: `u-${allocation.invoiceId}`, invoiceReference: allocation.invoiceId, amount: allocation.amount, refundId: null, at: stamp(payment.date, payment.time), by: payment.cashier })),
})

export const apiChargeFrom = (charge) => ({
  id: `u-${charge.id}`, reference: charge.id, patientId: charge.patientId, branch: branchOf(charge.branch), encounterId: null, encounterReference: null, serviceId: null, payer: 'Patient Direct (Self)', model: 'Consolidated',
  date: charge.date, created: stamp(charge.date, charge.time), status: charge.status.toLowerCase(), invoiceId: charge.invoiceId ? `u-${charge.invoiceId}` : null, invoiceReference: charge.invoiceId,
  note: charge.note ?? '', code: charge.lines[0].code, name: charge.title, category: charge.lines[0].note, department: charge.location, quantity: charge.lines[0].qty, unitPrice: charge.lines[0].price,
  discountPct: charge.lines[0].discountPct ?? 0, gstPct: charge.lines[0].gstPct ?? 0, total: lineAmounts(charge.lines[0]).total, version: 1, createdBy: 'Billing desk', events: [],
})

const refund = (reference, payment, patientId, amount, reason, status, date, extras = {}) => ({
  id: `u-${reference}`, reference, paymentId: `u-${payment}`, paymentReference: payment, patientId, amount, reason, method: 'Original payment method', internalReference: `RF-${reference.slice(-3)}`,
  notes: '', releasesAllocations: false, status, outcomeReference: status === 'processed' ? `RFND-${reference.slice(-3)}` : null, outcomeNote: null, requested: stamp(date, '10:00'), requestedBy: 'Kavya Menon',
  decidedAt: status === 'pending' ? null : `${date}T11:00:00.000Z`, completedAt: ['processed', 'failed'].includes(status) ? `${date}T12:00:00.000Z` : null, version: 1, events: [event('Refund requested', stamp(date, '10:00'), '', 'Kavya Menon')], ...extras,
})

// Payments of a second patient, each with a refund in a different state.
const OTHER_PATIENT = 'pt-000219'
const otherPayment = (reference, amount, channel, txn, date) => ({
  id: `u-${reference}`, reference, receiptNumber: `REC-${reference.slice(-3)}`, patientId: OTHER_PATIENT, branch: branchOf('Main Clinic (HQ)'), amount, channel, payer: 'Patient Direct (Self)', purpose: 'advance',
  txnReference: txn, narration: '', received: stamp(date, '10:05'), recordedBy: 'Kavya Menon', allocations: [],
})

export function ledgerSeed() {
  const processed = SEED_REFUNDS.map((entry) => refund(entry.id, entry.paymentId, entry.patientId, entry.amount, entry.reason, 'processed', entry.date))
  return {
    branches: clone(LEDGER_BRANCHES),
    services: clone(API_SERVICES),
    settings: clone(DEFAULT_SETTINGS),
    charges: SEED_CHARGES.map(apiChargeFrom),
    invoices: SEED_INVOICES.map(apiInvoiceFrom),
    payments: [...SEED_PAYMENTS.map(apiPaymentFrom), otherPayment('PAY-2026-117', 2400, 'UPI / QR', 'UPI-117', '2026-10-19'), otherPayment('PAY-2026-119', 800, 'UPI / QR', 'UPI-119', '2026-10-19'), otherPayment('PAY-2026-115', 1200, 'NEFT / IMPS', 'NEFT-115', '2026-10-17')],
    refunds: [
      refund('REF-2026-018', 'PAY-2026-112', 'pt-000184', 1500, 'Unused advance', 'pending', '2026-10-21'),
      refund('REF-2026-017', 'PAY-2026-112', 'pt-000184', 500, 'Unused advance', 'processed', '2026-10-18'),
      refund('REF-2026-016', 'PAY-2026-117', OTHER_PATIENT, 2400, 'Service cancelled', 'approved', '2026-10-20'),
      refund('REF-2026-015', 'PAY-2026-119', OTHER_PATIENT, 800, 'Duplicate payment', 'failed', '2026-10-20', { outcomeNote: 'The gateway declined the refund. No money was returned.' }),
      refund('REF-2026-014', 'PAY-2026-115', OTHER_PATIENT, 1200, 'Payer adjustment', 'rejected', '2026-10-19', { outcomeNote: 'Adjustment belongs to a different claim.' }),
      ...processed,
    ],
    statementImports: [{ id: 'imp-1', reference: 'IMP-000001', source: 'Gateway', fileName: 'gateway-oct.csv', lineCount: 4, importedBy: 'Kavya Menon', at: stamp('2026-10-21', '10:35') }],
    statementLines: [
      { id: 'line-1', importReference: 'IMP-000001', source: 'Gateway', reference: 'UPI-20261006-9948102948', date: '2026-10-06', time: '14:28', amount: 7000, narration: '', paymentId: 'u-PAY-2026-112', paymentReference: 'PAY-2026-112', state: 'matched', exceptionId: null },
      { id: 'line-2', importReference: 'IMP-000001', source: 'Gateway', reference: 'UPI-117', date: '2026-10-19', time: '10:06', amount: 2350, narration: 'Net of fee', paymentId: 'u-PAY-2026-117', paymentReference: 'PAY-2026-117', state: 'exception', exceptionId: 'exc-1' },
      { id: 'line-3', importReference: 'IMP-000001', source: 'Bank', reference: 'BANK-629328', date: '2026-10-21', time: '09:40', amount: 2000, narration: 'Unknown credit', paymentId: null, paymentReference: null, state: 'exception', exceptionId: 'exc-2' },
      { id: 'line-4', importReference: 'IMP-000001', source: 'Gateway', reference: 'RZP-88', date: '2026-10-19', time: '12:21', amount: 800, narration: '', paymentId: 'u-PAY-2026-119', paymentReference: 'PAY-2026-119', state: 'candidate', exceptionId: null },
    ],
    exceptions: [
      { id: 'exc-1', reference: 'EXC-000001', lineId: 'line-2', kind: 'Amount mismatch', reason: 'The reference matches, but the statement differs from the recorded payment by −₹50.', status: 'in_review', owner: 'Kavya Menon', evidence: null, resolutionType: null, resolutionNote: null, resolvedAt: null, created: stamp('2026-10-21', '10:36'), version: 2, events: [event('Review started · In review', stamp('2026-10-21', '10:41'), '', 'Kavya Menon'), event('Exception created · Open', stamp('2026-10-21', '10:36'), 'Amount mismatch · IMP-000001 · Gateway', null)] },
      { id: 'exc-2', reference: 'EXC-000002', lineId: 'line-3', kind: 'Missing ClinicOS record', reason: 'No recorded payment carries this reference or matches its amount and date.', status: 'open', owner: null, evidence: null, resolutionType: null, resolutionNote: null, resolvedAt: null, created: stamp('2026-10-21', '10:36'), version: 1, events: [event('Exception created · Open', stamp('2026-10-21', '10:36'), 'Missing ClinicOS record · IMP-000001 · Bank', null)] },
    ],
    patients: PATIENTS.map((patient) => ({ id: patient.id, mrn: patient.mrn, name: patient.name, mobile: patient.mobile.replace(/\D/g, '').slice(-10), dateOfBirth: patient.dob ?? `${2026 - patient.age}-01-01`, branch: branchOf('Main Clinic (HQ)') })),
  }
}

export const emptyLedger = () => ({ ...ledgerSeed(), services: [], charges: [], invoices: [], payments: [], refunds: [], statementImports: [], statementLines: [], exceptions: [] })

export function createBillingApi({ seed = ledgerSeed(), today = '2026-10-21', actor = 'Siddharth Verma' } = {}) {
  const state = clone(seed)
  const calls = []
  const counters = {}
  const next = (prefix) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return `${prefix}${pad(counters[prefix])}`
  }
  const now = () => stamp(today, '11:30')
  const find = (list, id, what) => state[list].find((entry) => entry.id === id) ?? fail(404, 'NOT_FOUND', `${what} not found.`)
  const allocated = (payment) => round2(payment.allocations.reduce((sum, entry) => sum + entry.amount, 0))
  const position = (payment, exclude) => {
    const refunds = state.refunds.filter((entry) => entry.paymentId === payment.id && entry.id !== exclude)
    const total = (...statuses) => round2(refunds.filter((entry) => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry.amount, 0))
    const unallocated = round2(payment.amount - allocated(payment) - total('processed'))
    return { unallocated, available: round2(unallocated - total('pending', 'approved')), refundable: round2(payment.amount - total('processed', 'pending', 'approved')) }
  }
  const balance = (invoice) => round2(invoice.total - state.payments.flatMap((payment) => payment.allocations).filter((entry) => entry.invoiceId === invoice.id).reduce((sum, entry) => sum + entry.amount, 0))
  const patientOf = (id) => state.patients.find((patient) => patient.id === id) ?? fail(404, 'NOT_FOUND', 'Patient not found.')
  const priced = (serviceId, branchId) => {
    const entry = find('services', serviceId, 'Service')
    if (entry.status !== 'active') fail(422, 'SERVICE_INACTIVE', `${entry.name} is inactive and cannot be selected for new records.`)
    const offer = entry.prices.find((price) => price.branchId === branchId)
    if (!offer) fail(422, 'SERVICE_NOT_OFFERED', `${entry.name} is not offered at this patient’s branch.`)
    return { ...entry, unitPrice: offer.price ?? entry.price }
  }
  const allocate = (payment, invoiceId, amount) => {
    const invoice = find('invoices', invoiceId, 'Invoice')
    if (amount > position(payment).available) fail(422, 'ALLOCATION_EXCEEDS_CREDIT', `Only ₹${position(payment).available} of ${payment.reference} is free to allocate.`)
    if (amount > balance(invoice)) fail(422, 'ALLOCATION_EXCEEDS_BALANCE', `${invoice.reference} has ₹${balance(invoice)} outstanding.`)
    payment.allocations.push({ id: `u-alc-${payment.allocations.length}-${payment.id}`, reference: next('ALC-'), invoiceId, invoiceReference: invoice.reference, amount, refundId: null, at: now(), by: actor })
  }
  const record = (name, ...args) => calls.push([name, ...args])

  const api = {
    ledger: async (patientId) => {
      record('ledger', patientId)
      const own = (list) => (patientId ? list.filter((entry) => entry.patientId === patientId) : list)
      const data = clone({ ...state, charges: own(state.charges), invoices: own(state.invoices), payments: own(state.payments), refunds: own(state.refunds) })
      if (patientId) Object.assign(data, { statementImports: [], statementLines: [], exceptions: [] })
      const used = new Set([patientId, ...data.charges.map((e) => e.patientId), ...data.invoices.map((e) => e.patientId), ...data.payments.map((e) => e.patientId), ...data.refunds.map((e) => e.patientId)])
      data.patients = data.patients.filter((patient) => used.has(patient.id))
      return data
    },
    createService: async (body) => {
      record('createService', body)
      if (state.services.some((entry) => entry.code === body.code.toUpperCase())) fail(409, 'SERVICE_CODE_TAKEN', 'This service code is already used in your organisation.')
      const created = { ...body, id: body.code.toLowerCase(), code: body.code.toUpperCase(), gstRate: body.taxConfig === 'Reduced rate 5% — Taxable' ? 5 : body.taxTreatment === 'taxable' ? 18 : 0, updated: now(), version: 1, events: [event('Service created', now(), '', actor)] }
      state.services.push(created)
      return { id: created.id }
    },
    updateService: async (id, version, body) => {
      record('updateService', id, version, body)
      const current = find('services', id, 'Service')
      if (current.version !== version) fail(409, 'STALE_RECORD', 'This service was changed by someone else. Reload it and try again.')
      const labels = { name: 'name', price: 'price', taxTreatment: 'tax treatment', taxConfig: 'tax configuration', status: 'status', prices: 'locations & prices', description: 'description', category: 'category' }
      const changed = Object.keys(labels).filter((key) => JSON.stringify(current[key] ?? null) !== JSON.stringify(body[key] ?? null)).map((key) => labels[key])
      Object.assign(current, body, { version: version + 1, updated: now(), events: [...(changed.length ? [event('Service updated', now(), changed.join(', '), actor)] : []), ...current.events] })
      return { id }
    },
    setServiceStatus: async (id, { status, reason, version }) => {
      record('setServiceStatus', id, status, reason)
      const current = find('services', id, 'Service')
      if (status === 'active' && (current.taxTreatment === 'not_configured' || current.prices.length === 0)) fail(422, 'SERVICE_INCOMPLETE', 'Choose a tax treatment and a location before activating this service.')
      if (current.version !== version) fail(409, 'STALE_RECORD', 'This service was changed by someone else.')
      Object.assign(current, { status, version: version + 1, events: [event(status === 'active' ? 'Activated' : 'Deactivated', now(), reason, actor), ...current.events] })
      return { id }
    },
    saveSettings: async (body) => {
      record('saveSettings', body)
      if ((state.settings.version ?? null) !== body.version) fail(409, 'STALE_RECORD', 'The billing configuration was changed by someone else.')
      const { version, ...values } = body
      const labels = { billingModel: 'billing model', cashEnabled: 'cash', bankEnabled: 'bank transfer', upiEnabled: 'UPI / card', advancePolicy: 'advance handling', partialPolicy: 'partial payments', allocationPolicy: 'allocation', invoiceDocument: 'invoice document', receiptDocument: 'receipt document' }
      const changed = Object.keys(values).filter((key) => state.settings[key] !== values[key]).map((key) => labels[key])
      state.settings = { ...state.settings, ...values, version: (version ?? 0) + 1, events: [event('Configuration updated', now(), changed.join(', '), actor), ...state.settings.events] }
      return { saved: true }
    },
    createCharge: async (body) => {
      record('createCharge', body)
      const entry = priced(body.serviceId, patientOf(body.patientId).branch.id)
      const ready = entry.unitPrice > 0 && entry.taxTreatment !== 'not_configured'
      if (body.confirm && !ready) fail(422, 'SERVICE_INCOMPLETE', `${entry.name} cannot be confirmed.`)
      const line = { qty: body.quantity, price: entry.unitPrice, discountPct: body.discountPct, gstPct: entry.gstRate }
      const reference = next('CHG-')
      state.charges.unshift({
        id: `u-${reference}`, reference, patientId: body.patientId, branch: patientOf(body.patientId).branch, encounterId: body.encounterId ?? null, encounterReference: null, serviceId: entry.id, payer: body.payer, model: body.model,
        date: today, created: now(), status: body.confirm ? 'unbilled' : 'draft', invoiceId: null, invoiceReference: null, note: body.note, code: entry.code, name: entry.name, category: entry.category, department: entry.department,
        quantity: body.quantity, unitPrice: entry.unitPrice, discountPct: body.discountPct, gstPct: entry.gstRate, total: lineAmounts(line).total, version: 1, createdBy: actor, events: [],
      })
      return { id: `u-${reference}`, reference }
    },
    updateCharge: async (id, body) => {
      record('updateCharge', id, body)
      const charge = find('charges', id, 'Charge')
      if (charge.status !== 'draft') fail(409, 'CHARGE_FINAL', 'Confirmed charges are read-only.')
      Object.assign(charge, { status: body.confirm ? 'unbilled' : 'draft', quantity: body.quantity, discountPct: body.discountPct, note: body.note, version: charge.version + 1 })
      return { id }
    },
    createInvoice: async (body) => {
      record('createInvoice', body)
      const charges = body.chargeIds.map((id) => find('charges', id, 'Charge'))
      const blocked = charges.find((charge) => charge.status !== 'unbilled')
      if (blocked) fail(409, 'CHARGE_NOT_BILLABLE', `${blocked.reference} is not billable.`)
      const items = (body.items ?? []).map((item) => ({ item, entry: priced(item.serviceId, patientOf(body.patientId).branch.id) }))
      const lines = [
        ...charges.map((charge) => ({ code: charge.code, name: charge.name, note: charge.category, qty: charge.quantity, price: charge.unitPrice, discountPct: body.discountPct ?? charge.discountPct, gstPct: charge.gstPct, chargeId: charge.id })),
        ...items.map(({ item, entry }) => ({ code: entry.code, name: entry.name, note: entry.category, qty: item.quantity, price: entry.unitPrice, discountPct: body.discountPct ?? 0, gstPct: entry.gstRate, serviceId: entry.id })),
      ]
      const totals = invoiceTotals(lines)
      const reference = next('INV-')
      const id = `u-${reference}`
      state.invoices.unshift({
        id, reference, patientId: body.patientId, branch: patientOf(body.patientId).branch, encounterId: body.encounterId ?? null, encounterReference: null, payer: body.payer, model: body.model, date: body.invoiceDate, dueDate: body.dueDate,
        created: now(), title: lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0].name, publicNote: body.publicNote ?? '', internalNote: body.internalNote ?? '', ...totals, createdBy: actor,
        lines: lines.map((line) => lineOf(line, { chargeId: line.chargeId ?? null, serviceId: line.serviceId ?? null })),
      })
      for (const charge of charges) Object.assign(charge, { status: 'invoiced', invoiceId: id, invoiceReference: reference })
      return { id, reference }
    },
    recordPayment: async (body) => {
      record('recordPayment', body)
      const reference = next('PAY-')
      const payment = {
        id: `u-${reference}`, reference, receiptNumber: next('REC-'), patientId: body.patientId, branch: patientOf(body.patientId).branch, amount: body.amount, channel: body.channel, payer: body.payer, purpose: body.purpose,
        txnReference: body.txnReference ?? null, narration: body.narration ?? '', received: now(), recordedBy: actor, allocations: [],
      }
      for (const entry of body.allocations ?? []) allocate(payment, entry.invoiceId, entry.amount)
      state.payments.unshift(payment)
      return { id: payment.id, reference }
    },
    allocate: async (paymentId, body) => {
      record('allocate', paymentId, body)
      allocate(find('payments', paymentId, 'Payment'), body.invoiceId, body.amount)
      return { id: paymentId }
    },
    requestRefund: async (body) => {
      record('requestRefund', body)
      const payment = find('payments', body.paymentId, 'Payment')
      const limit = body.releasesAllocations ? position(payment).refundable : position(payment).available
      if (body.amount > limit) fail(422, 'REFUND_EXCEEDS_ELIGIBLE', `Only ₹${limit} of ${payment.reference} can be refunded.`)
      const reference = next('RFD-')
      state.refunds.unshift({ ...refund(reference, payment.reference, payment.patientId, body.amount, body.reason, 'pending', today), paymentId: payment.id, method: body.method, internalReference: body.internalReference, notes: body.notes ?? '', releasesAllocations: body.releasesAllocations ?? false, requestedBy: actor })
      return { id: `u-${reference}`, reference }
    },
    approveRefund: async (id, body) => decide('approve', id, body, 'pending', 'approved', 'Refund approved'),
    rejectRefund: async (id, body) => decide('reject', id, body, 'pending', 'rejected', 'Refund rejected'),
    failRefund: async (id, body) => decide('fail', id, body, 'approved', 'failed', 'Refund failed · no money returned'),
    processRefund: async (id, body) => decide('process', id, body, 'approved', 'processed', 'Refund processed · money returned'),
    importStatement: async (body) => {
      record('importStatement', body)
      const rows = body.csv.trim().split(/\r?\n/).slice(1).filter(Boolean)
      if (!rows.length) fail(422, 'STATEMENT_EMPTY', 'The statement has no transaction rows.')
      const reference = next('IMP-')
      state.statementImports.unshift({ id: `u-${reference}`, reference, source: body.source, fileName: body.fileName, lineCount: rows.length, importedBy: actor, at: now() })
      rows.forEach((row, index) => {
        const [date, ref, amount] = row.split(',')
        state.statementLines.unshift({ id: `u-${reference}-${index}`, importReference: reference, source: body.source, reference: ref, date, time: null, amount: Number(amount), narration: '', paymentId: null, paymentReference: null, state: 'exception', exceptionId: null })
      })
      return { id: `u-${reference}`, reference, imported: rows.length, skipped: 0, matched: 0, candidate: 0, exception: rows.length }
    },
    confirmLine: async (id) => {
      record('confirmLine', id)
      const line = find('statementLines', id, 'Statement line')
      if (line.state !== 'candidate') fail(409, 'LINE_STATE_CHANGED', 'This statement line is no longer awaiting review.')
      line.state = 'matched'
      return { id }
    },
    rejectLine: async (id) => {
      record('rejectLine', id)
      const line = find('statementLines', id, 'Statement line')
      Object.assign(line, { state: 'exception', paymentId: null, paymentReference: null })
      return { id }
    },
    reviewException: async (id, version) => change(id, version, ['open'], { status: 'in_review', owner: actor }, 'Review started · In review', ''),
    recordEvidence: async (id, body) => change(id, body.version, ['open', 'in_review'], { evidence: body.evidence }, 'Evidence recorded', body.evidence),
    resolveException: async (id, body) => {
      const result = change(id, body.version, ['open', 'in_review'], { status: 'resolved', evidence: body.evidence, resolutionType: body.resolutionType, resolutionNote: body.note, resolvedAt: `${today}T11:30:00.000Z`, owner: actor }, 'Exception resolved', `${body.resolutionType} · ${body.note}`)
      const exception = find('exceptions', id, 'Exception')
      find('statementLines', exception.lineId, 'Statement line').state = 'resolved'
      return result
    },
  }

  function decide(action, id, body, from, to, title) {
    record(`${action}Refund`, id, body)
    const entry = find('refunds', id, 'Refund')
    if (entry.status !== from || entry.version !== body.version) fail(409, 'REFUND_STATE_CHANGED', `This refund is no longer ${from}.`)
    Object.assign(entry, { status: to, version: entry.version + 1, outcomeReference: body.outcomeReference ?? entry.outcomeReference, outcomeNote: action === 'process' ? entry.outcomeNote : body.note || entry.outcomeNote, events: [event(title, now(), body.note ?? body.outcomeReference ?? '', actor), ...entry.events] })
    return { id }
  }

  function change(id, version, from, data, action, note) {
    record(action, id)
    const exception = find('exceptions', id, 'Exception')
    if (exception.version !== version || !from.includes(exception.status)) fail(409, 'STALE_RECORD', 'This exception was changed by someone else or is already resolved.')
    Object.assign(exception, data, { version: version + 1, events: [event(action, now(), note, actor), ...exception.events] })
    return { id }
  }

  return { api, state, calls }
}
