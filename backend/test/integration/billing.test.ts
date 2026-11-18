import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, localDate } from '../../src/modules/scheduling/clinic-time'
import { Browser, createOwner, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp()
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
})

const today = () => localDate(new Date(), 'Asia/Kolkata')

// An organisation with a patient and two active services: an exempt consultation and a taxable supply.
async function clinic() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    patch: (url: string) => b.patch(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const patient = (await owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: branchId }).expect(201)).body.data
  const consult = (await owner.post('/v1/billing/services').send({
    code: 'srv-gmed-01', name: 'General Physician Consultation', category: 'Consultation', status: 'active', price: 1000, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId, price: null }],
  }).expect(201)).body.data.id as string
  const kit = (await owner.post('/v1/billing/services').send({
    code: 'SUP-ECG-KIT', name: 'ECG electrode kit', category: 'Consumables & Supplies', status: 'active', price: 450, taxTreatment: 'taxable', taxConfig: 'Standard rate 18% — Taxable', prices: [{ branchId, price: 500 }],
  }).expect(201)).body.data.id as string
  const ledger = async () => (await owner.get('/v1/billing/ledger').expect(200)).body.data
  return { owner, orgId, branchId, patient, consult, kit, ledger, as }
}

async function member(c: Awaited<ReturnType<typeof clinic>>, email: string, role: string) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email, roleIds: [roles.find((entry) => entry.name === role)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: 'Kavya Menon', password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return c.as(browser)
}

describe('service catalogue', () => {
  it('keeps codes unique, blocks activation until tax and a location are set, and records changes', async () => {
    const c = await clinic()
    const taken = await c.owner.post('/v1/billing/services').send({ code: 'SRV-GMED-01', name: 'Copy', category: 'Consultation', status: 'inactive', price: 0, taxTreatment: 'not_configured', prices: [] }).expect(409)
    expect(taken.body.error.code).toBe('SERVICE_CODE_TAKEN')

    const draft = (await c.owner.post('/v1/billing/services').send({ code: 'SRV-PHYS-01', name: 'Physiotherapy session', category: 'Therapy & Allied Health', status: 'inactive', price: 700, taxTreatment: 'not_configured', prices: [] }).expect(201)).body.data.id
    expect((await c.owner.post(`/v1/billing/services/${draft}/status`).send({ status: 'active', reason: '', version: 1 }).expect(422)).body.error.code).toBe('SERVICE_INCOMPLETE')

    await c.owner.patch(`/v1/billing/services/${draft}`).send({ version: 1, service: { code: 'SRV-PHYS-01', name: 'Physiotherapy session', category: 'Therapy & Allied Health', status: 'inactive', price: 750, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId: c.branchId, price: null }] } }).expect(200)
    expect((await c.owner.patch(`/v1/billing/services/${draft}`).send({ version: 1, service: { code: 'SRV-PHYS-01', name: 'X', category: 'Consultation', status: 'inactive', price: 1, taxTreatment: 'no_tax', prices: [] } }).expect(409)).body.error.code).toBe('STALE_RECORD')
    await c.owner.post(`/v1/billing/services/${draft}/status`).send({ status: 'active', reason: '', version: 2 }).expect(200)

    const service = (await c.ledger()).services.find((entry: { id: string }) => entry.id === draft)
    expect(service).toMatchObject({ status: 'active', price: 750, taxTreatment: 'exempt', version: 3 })
    expect(service.events.map((event: { action: string; note: string }) => [event.action, event.note])).toEqual([['Activated', ''], ['Service updated', 'price, tax treatment, tax configuration, locations & prices'], ['Service created', '']])
  })
})

describe('charges, invoices and payments', () => {
  it('invoices confirmed charges once, applies payments within the balance and keeps the ledger consistent', async () => {
    const c = await clinic()
    const draft = (await c.owner.post('/v1/billing/charges').send({ patientId: c.patient.id, serviceId: c.consult, payer: 'Patient Direct (Self)', model: 'Consolidated', quantity: 1, discountPct: 10, note: '', confirm: false }).expect(201)).body.data
    expect(draft.reference).toBe('CHG-000001')
    const notReady = await c.owner.post('/v1/billing/invoices').send({ patientId: c.patient.id, payer: 'Patient Direct (Self)', model: 'Consolidated', invoiceDate: today(), dueDate: addDays(today(), 7), chargeIds: [draft.id] }).expect(409)
    expect(notReady.body.error.code).toBe('CHARGE_NOT_BILLABLE')
    await c.owner.patch(`/v1/billing/charges/${draft.id}`).send({ serviceId: c.consult, payer: 'Patient Direct (Self)', model: 'Consolidated', quantity: 1, discountPct: 10, note: 'Follow-up', confirm: true, version: 1 }).expect(200)

    // ₹1,000 consult less 10% = ₹900, plus 2 kits at the branch price ₹500 with 18% GST = ₹1,180.
    const invoice = (await c.owner.post('/v1/billing/invoices').send({ patientId: c.patient.id, payer: 'Patient Direct (Self)', model: 'Consolidated', invoiceDate: today(), dueDate: addDays(today(), 7), chargeIds: [draft.id], items: [{ serviceId: c.kit, quantity: 2 }] }).expect(201)).body.data
    expect(invoice.reference).toBe('INV-000001')
    await c.owner.post('/v1/billing/invoices').send({ patientId: c.patient.id, payer: 'Patient Direct (Self)', model: 'Consolidated', invoiceDate: today(), dueDate: today(), chargeIds: [draft.id] }).expect(409)

    const over = await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 3000, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'charges', txnReference: 'UTR-5001', allocations: [{ invoiceId: invoice.id, amount: 2500 }] }).expect(422)
    expect(over.body.error.code).toBe('ALLOCATION_EXCEEDS_BALANCE')
    const payment = (await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 3000, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'charges', txnReference: 'UTR-5001', allocations: [{ invoiceId: invoice.id, amount: 1000 }] }).expect(201)).body.data
    expect((await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 10, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'advance', txnReference: 'utr-5001' }).expect(409)).body.error.code).toBe('DUPLICATE_PAYMENT')
    await c.owner.post(`/v1/billing/payments/${payment.id}/allocations`).send({ invoiceId: invoice.id, amount: 1080 }).expect(201)
    expect((await c.owner.post(`/v1/billing/payments/${payment.id}/allocations`).send({ invoiceId: invoice.id, amount: 0.01 }).expect(422)).body.error.code).toBe('ALLOCATION_EXCEEDS_BALANCE')

    const ledger = await c.ledger()
    expect(ledger.charges[0]).toMatchObject({ status: 'invoiced', invoiceReference: 'INV-000001', total: 900 })
    expect(ledger.invoices[0]).toMatchObject({ gross: 2000, discount: 100, tax: 180, total: 2080, lines: [{ code: 'SRV-GMED-01', total: 900 }, { code: 'SUP-ECG-KIT', unitPrice: 500, gstPct: 18, total: 1180 }] })
    expect(ledger.payments[0]).toMatchObject({ reference: 'PAY-000001', receiptNumber: 'REC-000001', amount: 3000, allocations: [{ reference: 'ALC-000001', amount: 1000 }, { reference: 'ALC-000002', amount: 1080 }] })
    expect(ledger.patients).toEqual([expect.objectContaining({ id: c.patient.id, name: 'Ananya Sharma', mrn: c.patient.mrn })])
  })

  it('follows the billing configuration: switched-off methods, oldest-first allocation and credit applied to the next invoice', async () => {
    const c = await clinic()
    await c.owner.put('/v1/billing/settings').send({ billingModel: 'Pay-as-you-go', cashEnabled: false, bankEnabled: true, upiEnabled: true, advancePolicy: 'Apply to the next invoice', partialPolicy: '', allocationPolicy: 'Apply to the oldest invoice first', invoiceDocument: '', receiptDocument: '', version: null }).expect(200)
    expect((await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 100, channel: 'Cash Desk', payer: 'Patient Direct (Self)', purpose: 'advance' }).expect(422)).body.error.code).toBe('METHOD_DISABLED')

    const advance = (await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 600, channel: 'NEFT / IMPS', payer: 'Patient Direct (Self)', purpose: 'advance', txnReference: 'NEFT-1' }).expect(201)).body.data
    const issue = () => c.owner.post('/v1/billing/invoices').send({ patientId: c.patient.id, payer: 'Patient Direct (Self)', model: 'Pay-as-you-go', invoiceDate: today(), dueDate: today(), items: [{ serviceId: c.consult, quantity: 1 }] }).expect(201)
    const first = (await issue()).body.data
    await issue()
    await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 1200, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'charges', txnReference: 'UPI-77' }).expect(201)

    const ledger = await c.ledger()
    const advanceRow = ledger.payments.find((entry: { id: string }) => entry.id === advance.id)
    // The ₹600 advance went to the first invoice when it was issued; the ₹1,200 paid its remaining ₹400 first, then ₹800 of the second.
    expect(advanceRow.allocations).toEqual([expect.objectContaining({ invoiceId: first.id, amount: 600 })])
    const collection = ledger.payments.find((entry: { txnReference: string }) => entry.txnReference === 'UPI-77')
    expect(collection.allocations.map((entry: { invoiceReference: string; amount: number }) => [entry.invoiceReference, entry.amount])).toEqual([['INV-000001', 400], ['INV-000002', 800]])
  })
})

describe('refunds', () => {
  it('holds requested amounts, needs a decision, and releases applied money only when allowed', async () => {
    const c = await clinic()
    const invoice = (await c.owner.post('/v1/billing/invoices').send({ patientId: c.patient.id, payer: 'Patient Direct (Self)', model: 'Pay-as-you-go', invoiceDate: today(), dueDate: today(), items: [{ serviceId: c.consult, quantity: 1 }] }).expect(201)).body.data
    const payment = (await c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 1500, channel: 'Card / POS', payer: 'Patient Direct (Self)', purpose: 'charges', txnReference: 'AUTH-1', allocations: [{ invoiceId: invoice.id, amount: 1000 }] }).expect(201)).body.data
    const refund = (body: object) => c.owner.post('/v1/billing/refunds').send({ paymentId: payment.id, reason: 'Service cancelled', method: 'Original payment method', internalReference: 'RF-1', ...body })

    expect((await refund({ amount: 600 }).expect(422)).body.error.code).toBe('REFUND_EXCEEDS_ELIGIBLE')
    const small = (await refund({ amount: 300 }).expect(201)).body.data
    // ₹300 is held, so only ₹200 of the credit is left to allocate or refund.
    expect((await refund({ amount: 300 }).expect(422)).body.error.code).toBe('REFUND_EXCEEDS_ELIGIBLE')
    expect((await c.owner.post(`/v1/billing/refunds/${small.id}/process`).send({ outcomeReference: 'RFND-1', version: 1 }).expect(409)).body.error.code).toBe('REFUND_STATE_CHANGED')
    await c.owner.post(`/v1/billing/refunds/${small.id}/approve`).send({ version: 1 }).expect(200)
    await c.owner.post(`/v1/billing/refunds/${small.id}/process`).send({ outcomeReference: 'RFND-1', note: 'Card reversal', version: 2 }).expect(200)

    // Taking back money already applied reopens the invoice: ₹200 free credit + ₹500 released from INV-000001.
    const full = (await refund({ amount: 700, releasesAllocations: true }).expect(201)).body.data
    await c.owner.post(`/v1/billing/refunds/${full.id}/approve`).send({ version: 1 }).expect(200)
    await c.owner.post(`/v1/billing/refunds/${full.id}/process`).send({ outcomeReference: 'RFND-2', version: 2 }).expect(200)
    const rejected = (await refund({ amount: 100, releasesAllocations: true }).expect(201)).body.data
    await c.owner.post(`/v1/billing/refunds/${rejected.id}/reject`).send({ note: 'Raised in error by the desk.', version: 1 }).expect(200)

    const ledger = await c.ledger()
    const row = ledger.payments[0]
    expect(row.allocations.map((entry: { amount: number; refundId: string | null }) => [entry.amount, entry.refundId])).toEqual([[1000, null], [-500, full.id]])
    expect(ledger.refunds.map((entry: { status: string }) => entry.status)).toEqual(['rejected', 'processed', 'processed'])
    expect(ledger.refunds[1].events.map((event: { action: string }) => event.action)).toEqual(['Refund processed · money returned', 'Refund approved', 'Refund requested'])
  })
})

describe('reconciliation', () => {
  it('imports a statement once, matches by reference, and works exceptions through to a resolution', async () => {
    const c = await clinic()
    const pay = (amount: number, txnReference: string | null, channel = 'UPI / QR') => c.owner.post('/v1/billing/payments').send({ patientId: c.patient.id, amount, channel, payer: 'Patient Direct (Self)', purpose: 'advance', txnReference }).expect(201)
    await pay(5000, 'UPI-629314')
    await pay(3200, 'UPI-629320')
    await pay(1800, 'POS-77', 'Card / POS')
    const date = today().split('-').reverse().join('/')
    const csv = ['Date,Reference,Amount,Narration', `${date},UPI-629314,"4,750",Net of fee`, `${date},UPI-629320,3200,`, `${date},BANK-1,2000,Unknown credit`, `${date},RZP-88,1800,Card settlement`].join('\n')

    const imported = (await c.owner.post('/v1/billing/statements').send({ source: 'Gateway', fileName: 'gateway.csv', csv }).expect(201)).body.data
    expect(imported).toMatchObject({ reference: 'IMP-000001', imported: 4, skipped: 0, matched: 1, candidate: 1, exception: 2 })
    expect((await c.owner.post('/v1/billing/statements').send({ source: 'Gateway', fileName: 'gateway.csv', csv }).expect(201)).body.data).toMatchObject({ imported: 0, skipped: 4 })
    const bad = await c.owner.post('/v1/billing/statements').send({ source: 'Bank', fileName: 'bank.csv', csv: 'Date,Reference,Amount\n2026-13-01,X,1\n' }).expect(422)
    expect(bad.body.error).toMatchObject({ code: 'STATEMENT_INVALID', details: [{ field: 'row 2', issue: 'The date is not a valid date.' }] })

    let ledger = await c.ledger()
    const candidate = ledger.statementLines.find((line: { state: string }) => line.state === 'candidate')
    await c.owner.post(`/v1/billing/statement-lines/${candidate.id}/confirm`).send({}).expect(200)
    const mismatch = ledger.exceptions.find((entry: { kind: string }) => entry.kind === 'Amount mismatch')
    await c.owner.post(`/v1/billing/exceptions/${mismatch.id}/review`).send({ version: 1 }).expect(200)
    await c.owner.post(`/v1/billing/exceptions/${mismatch.id}/resolve`).send({ resolutionType: 'Explained source difference', note: 'Gateway fee of ₹250 deducted.', evidence: 'Gateway fee report', version: 2 }).expect(200)
    await c.owner.post(`/v1/billing/exceptions/${mismatch.id}/resolve`).send({ resolutionType: 'Explained source difference', note: 'Second attempt here.', evidence: 'x', version: 3 }).expect(409)

    ledger = await c.ledger()
    expect(ledger.statementLines.map((line: { reference: string; state: string }) => [line.reference, line.state]).sort()).toEqual([['BANK-1', 'exception'], ['RZP-88', 'matched'], ['UPI-629314', 'resolved'], ['UPI-629320', 'matched']])
    const resolved = ledger.exceptions.find((entry: { id: string }) => entry.id === mismatch.id)
    expect(resolved).toMatchObject({ status: 'resolved', owner: 'Siddharth Verma', resolutionType: 'Explained source difference' })
    expect(resolved.events.map((event: { action: string }) => event.action)).toEqual(['Exception resolved', 'Review started · In review', 'Exception created · Open'])
  })
})

describe('finance access', () => {
  it('keeps the ledger to finance roles and refund decisions to settlement authority', async () => {
    const c = await clinic()
    const desk = await member(c, 'desk@aura.test', 'Front Desk & Reception')
    await desk.get('/v1/billing/ledger').expect(403)
    await desk.post('/v1/billing/payments').send({}).expect(403)
    const accountant = await member(c, 'accounts@aura.test', 'Accountant / Billing')
    expect((await accountant.get('/v1/billing/ledger').expect(200)).body.data.services).toHaveLength(2)
    await accountant.post('/v1/billing/payments').send({ patientId: c.patient.id, amount: 100, channel: 'Cash Desk', payer: 'Patient Direct (Self)', purpose: 'advance' }).expect(201)
    // Branch-scoped roles can never hold finance permissions, so a branch manager sees no ledger.
    const manager = await member(c, 'manager@aura.test', 'Branch Manager')
    await manager.get('/v1/billing/ledger').expect(403)
    await manager.post('/v1/billing/refunds/00000000-0000-7000-8000-000000000000/approve').send({ version: 1 }).expect(403)
  })
})
