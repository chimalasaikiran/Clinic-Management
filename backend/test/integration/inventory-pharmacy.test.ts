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

const NAPROXEN = { medicineCode: 'naproxen', name: 'Naproxen Sodium', strength: '250 mg', form: 'Tablet', route: 'Oral', drugClass: 'nsaid', dose: 1, frequency: 'Twice daily (1-0-1)', frequencyPerDay: 2, food: 'After food', durationDays: 5, indication: 'Low back pain' }

// An organisation with a central store, a pharmacy, a supplier and a stocked medicine linked to the formulary.
async function pharmacy() {
  const { browser, orgId } = await createOwner(ctx)
  const as = (b: Browser) => ({
    get: (url: string) => b.get(url).set('X-Org-Id', orgId),
    post: (url: string) => b.post(url).set('X-Org-Id', orgId),
    put: (url: string) => b.put(url).set('X-Org-Id', orgId),
  })
  const owner = as(browser)
  const branchId = (await owner.get('/v1/branches').expect(200)).body.data[0].id as string
  const store = (await owner.post('/v1/inventory/locations').send({ branchId, code: 'central', name: 'Central Stores', kind: 'store' }).expect(201)).body.data.id as string
  const dispensary = (await owner.post('/v1/inventory/locations').send({ branchId, code: 'main-rx', name: 'Main Pharmacy', kind: 'pharmacy' }).expect(201)).body.data.id as string
  const supplier = (await owner.post('/v1/inventory/suppliers').send({ name: 'Medline Healthcare', categories: ['Medicines'] }).expect(201)).body.data.id as string
  const item = (await owner.post('/v1/inventory/items').send({
    code: 'med-nap-250', name: 'Naproxen 250mg', category: 'Analgesic', unit: 'tablet', unitPlural: 'tablets', medicineCode: 'naproxen', strength: '250 mg', unitPrice: 2.5,
    safetyLevel: 20, reorderLevel: 50, targetLevel: 200, supplierIds: [supplier], preferredSupplierId: supplier,
  }).expect(201)).body.data.id as string
  const state = async () => (await owner.get('/v1/inventory/state').expect(200)).body.data
  // Receives two batches at the central store: one expiring sooner than the other.
  const stock = async (lines = [{ batchNo: 'NP-A', expiry: addDays(today(), 200), qty: 30 }, { batchNo: 'NP-B', expiry: addDays(today(), 400), qty: 70 }]) => {
    const total = lines.reduce((sum, line) => sum + line.qty, 0)
    return (await owner.post('/v1/inventory/receipts').send({ mode: 'post', supplierId: supplier, storeId: store, challan: 'DC-1', lines: [{ itemId: item, received: total, batches: lines.map((line) => ({ ...line, bin: 'A-01' })) }] }).expect(201)).body.data
  }
  return { owner, orgId, branchId, store, dispensary, supplier, item, state, stock, as }
}

async function member(c: Awaited<ReturnType<typeof pharmacy>>, email: string, role: string) {
  const roles = (await c.owner.get('/v1/roles').expect(200)).body.data as Array<{ id: string; name: string }>
  await c.owner.post('/v1/invitations').send({ email, roleIds: [roles.find((entry) => entry.name === role)!.id] }).expect(201)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token: ctx.mail.lastInvitationToken(email), fullName: 'Ramesh Pillai', password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return c.as(browser)
}

describe('master data and receiving', () => {
  it('keeps codes unique and adds stock only when a receipt with resolved discrepancies is posted', async () => {
    const c = await pharmacy()
    expect((await c.owner.post('/v1/inventory/items').send({ code: 'MED-NAP-250', name: 'Copy', category: 'Analgesic', unit: 'tablet', unitPlural: 'tablets', unitPrice: 1, safetyLevel: 0, reorderLevel: 0, targetLevel: 0 }).expect(409)).body.error.code).toBe('ITEM_CODE_TAKEN')

    const order = (await c.owner.post('/v1/inventory/orders').send({ supplierId: c.supplier, storeId: c.store, lines: [{ itemId: c.item, ordered: 100, rate: 2 }] }).expect(201)).body.data
    const receipt = (await c.owner.post('/v1/inventory/receipts').send({
      mode: 'post', supplierId: c.supplier, orderId: order.id, storeId: c.store, challan: 'DC-9', lines: [{ itemId: c.item, ordered: 100, received: 90, batches: [{ batchNo: 'NP-1', expiry: addDays(today(), 300), qty: 90, bin: 'A-02' }] }],
      discrepancies: [{ kind: 'Short delivery', qty: 10, state: 'Unresolved', note: 'Challan shows 100.' }],
    }).expect(201)).body.data
    expect((await c.state()).batches).toEqual([])
    expect((await c.owner.post(`/v1/inventory/receipts/${receipt.id}/post`).expect(409)).body.error.code).toBe('RECEIPT_NOT_READY')

    const discrepancy = (await c.state()).receipts[0].discrepancies[0]
    await c.owner.post(`/v1/inventory/receipts/${receipt.id}/resolve`).send({ discrepancyId: discrepancy.id, disposition: 'Close PO as short', note: 'Supplier will not ship the balance.' }).expect(200)
    await c.owner.post(`/v1/inventory/receipts/${receipt.id}/post`).expect(200)

    const state = await c.state()
    expect(state.batches).toEqual([expect.objectContaining({ batchNo: 'NP-1', posted: 90, reserved: 0, locationId: c.store })])
    expect(state.orders[0]).toMatchObject({ reference: 'PO-000001', closed: true })
    expect(state.movements[0]).toMatchObject({ kind: 'Receipt', reference: receipt.reference, delta: 90, availableAfter: 90 })
  })
})

describe('stock requests and transfers', () => {
  it('reserves approved stock earliest expiry first, then moves it to the pharmacy, recording a shortage', async () => {
    const c = await pharmacy()
    await c.stock()
    const request = (await c.owner.post('/v1/inventory/requests').send({ submit: true, locationId: c.dispensary, priority: 'Normal', reason: 'Routine replenishment', lines: [{ itemId: c.item, requested: 50 }] }).expect(201)).body.data
    expect((await c.owner.post(`/v1/inventory/requests/${request.id}/review`).send({ decision: 'approve', approve: { [c.item]: 200 }, version: 1 }).expect(422)).body.error.code).toBe('APPROVAL_EXCEEDS_REQUEST')
    await c.owner.post(`/v1/inventory/requests/${request.id}/review`).send({ decision: 'approve', approve: { [c.item]: 40 }, version: 1 }).expect(200)

    let state = await c.state()
    // 30 from the batch expiring first, then 10 from the next.
    expect(state.batches.map((batch: { batchNo: string; reserved: number }) => [batch.batchNo, batch.reserved])).toEqual([['NP-A', 30], ['NP-B', 10]])
    expect(state.requests[0]).toMatchObject({ status: 'partially_approved', lines: [{ requested: 50, approved: 40 }] })

    const transfer = (await c.owner.post(`/v1/inventory/requests/${request.id}/transfer`).expect(201)).body.data
    await c.owner.post(`/v1/inventory/requests/${request.id}/transfer`).expect(409)
    await c.owner.post(`/v1/inventory/transfers/${transfer.id}/dispatch`).send({ version: 1 }).expect(200)
    await c.owner.post(`/v1/inventory/transfers/${transfer.id}/receive`).send({ received: [30, 8], version: 2 }).expect(200)

    state = await c.state()
    const at = (locationId: string) => state.batches.filter((batch: { locationId: string }) => batch.locationId === locationId).map((batch: { batchNo: string; posted: number; reserved: number }) => [batch.batchNo, batch.posted, batch.reserved])
    expect(at(c.store)).toEqual([['NP-A', 0, 0], ['NP-B', 60, 0]])
    expect(at(c.dispensary)).toEqual([['NP-A', 30, 0], ['NP-B', 8, 0]])
    expect(state.requests[0]).toMatchObject({ status: 'partially_fulfilled', lines: [{ issued: 40, received: 38 }] })
    expect(state.transfers[0].events.map((event: { action: string }) => event.action)).toEqual(['Created & reserved', 'Dispatched', 'Received with shortage'])
  })

  it('refuses to reserve stock another transfer already holds, and gives it back when cancelled', async () => {
    const c = await pharmacy()
    await c.stock([{ batchNo: 'NP-A', expiry: addDays(today(), 200), qty: 30 }])
    const batch = (await c.state()).batches[0].id
    const first = (await c.owner.post('/v1/inventory/transfers').send({ mode: 'create', fromLocationId: c.store, toLocationId: c.dispensary, reason: 'Rebalancing', lines: [{ batchId: batch, qty: 25 }] }).expect(201)).body.data
    expect((await c.owner.post('/v1/inventory/transfers').send({ mode: 'create', fromLocationId: c.store, toLocationId: c.dispensary, reason: 'Rebalancing', lines: [{ batchId: batch, qty: 10 }] }).expect(409)).body.error.code).toBe('STOCK_CHANGED')
    await c.owner.post(`/v1/inventory/transfers/${first.id}/cancel`).send({ version: 1 }).expect(200)
    expect((await c.state()).batches[0]).toMatchObject({ posted: 30, reserved: 0 })
  })
})

describe('dispensing', () => {
  it('dispenses a signed prescription earliest expiry first, partly then in full, and completes it', async () => {
    const c = await pharmacy()
    await c.stock()
    const batch = (await c.state()).batches.find((entry: { batchNo: string }) => entry.batchNo === 'NP-A').id
    const transfer = (await c.owner.post('/v1/inventory/transfers').send({ mode: 'create', fromLocationId: c.store, toLocationId: c.dispensary, reason: 'Rebalancing', lines: [{ batchId: batch, qty: 30 }] }).expect(201)).body.data
    await c.owner.post(`/v1/inventory/transfers/${transfer.id}/dispatch`).send({ version: 1 }).expect(200)
    await c.owner.post(`/v1/inventory/transfers/${transfer.id}/receive`).send({ received: [30], version: 2 }).expect(200)

    const patient = (await c.owner.post('/v1/patients').send({ title: 'Ms.', fullName: 'Ananya Sharma', mobile: '9845211029', pinCode: '500084', dateOfBirth: '1992-04-18', gender: 'female', homeBranchId: c.branchId }).expect(201)).body.data
    const rx = (await c.owner.post(`/v1/patients/${patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Low back pain', items: [NAPROXEN] }).expect(201)).body.data
    let entry = (await c.state()).rxQueue[0]
    expect(entry).toMatchObject({ reference: rx.reference, status: 'active', lines: [{ itemId: c.item, qty: 10, dispensed: 0 }] })
    const line = entry.lines[0].id

    expect((await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line]: 11 } }).expect(422)).body.error.code).toBe('DISPENSE_EXCEEDS_PRESCRIPTION')
    expect((await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.store, quantities: { [line]: 4 } }).expect(422)).body.error.code).toBe('LOCATION_NOT_PHARMACY')
    await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line]: 4 } }).expect(201)
    const done = (await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line]: 6 } }).expect(201)).body.data
    expect(done).toMatchObject({ reference: 'DSP-000002', complete: true })

    const state = await c.state()
    entry = state.rxQueue[0]
    expect(entry).toMatchObject({ status: 'completed', lines: [{ dispensed: 10 }] })
    expect(entry.dispenses.map((dispense: { lines: Array<{ batchNo: string; qty: number }> }) => dispense.lines.map((pick) => [pick.batchNo, pick.qty]))).toEqual([[['NP-A', 4]], [['NP-A', 6]]])
    expect(state.batches.find((entry2: { locationId: string }) => entry2.locationId === c.dispensary)).toMatchObject({ posted: 20 })
    expect((await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line]: 1 } }).expect(409)).body.error.code).toBe('PRESCRIPTION_CLOSED')

    // The patient's chart shows what was handed out against each line.
    const chart = (await c.owner.get(`/v1/patients/${patient.id}/chart`).expect(200)).body.data
    const charted = chart.prescriptions.find((entry2: { id: string }) => entry2.id === rx.id)
    expect(charted).toMatchObject({ status: 'completed', items: [{ quantity: 10, dispensed: 10 }] })
    expect(charted.dispenses).toBeUndefined()
    expect(charted.events.map((event: { action: string }) => event.action)).toEqual(['dispensed', 'partially_dispensed', 'signed'])
  })

  it('needs the register entry and patient consent for a Schedule H1 medicine', async () => {
    const c = await pharmacy()
    const h1 = (await c.owner.post('/v1/inventory/items').send({ code: 'MED-AMX-500', name: 'Amoxicillin 500mg', category: 'Anti-infective', unit: 'capsule', unitPlural: 'capsules', medicineCode: 'amoxicillin', strength: '500 mg', schedule: 'H1', unitPrice: 7, safetyLevel: 0, reorderLevel: 0, targetLevel: 0 }).expect(201)).body.data.id
    await c.owner.post('/v1/inventory/receipts').send({ mode: 'post', supplierId: c.supplier, storeId: c.dispensary, lines: [{ itemId: h1, received: 30, batches: [{ batchNo: 'AX-1', expiry: addDays(today(), 300), qty: 30, bin: '' }] }] }).expect(201)
    const patient = (await c.owner.post('/v1/patients').send({ title: 'Mr.', fullName: 'Ravi Kumar', mobile: '9845211030', pinCode: '500084', dateOfBirth: '1980-01-01', gender: 'male', homeBranchId: c.branchId }).expect(201)).body.data
    const rx = (await c.owner.post(`/v1/patients/${patient.id}/prescriptions`).send({ branchId: c.branchId, indication: 'Infection', items: [{ ...NAPROXEN, medicineCode: 'amoxicillin', name: 'Amoxicillin', strength: '500 mg', form: 'Capsule', drugClass: 'penicillin', frequencyPerDay: 3, frequency: 'Thrice daily (1-1-1)' }] }).expect(201)).body.data
    const line = (await c.state()).rxQueue[0].lines[0]
    expect(line).toMatchObject({ itemId: h1, schedule: 'H1', qty: 15 })

    expect((await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line.id]: 15 }, registerConfirmed: true }).expect(422)).body.error.code).toBe('SCHEDULE_H1_UNCONFIRMED')
    await c.owner.post(`/v1/pharmacy/prescriptions/${rx.id}/dispense`).send({ locationId: c.dispensary, quantities: { [line.id]: 15 }, registerConfirmed: true, consentConfirmed: true }).expect(201)
  })
})

describe('adjustments and cases', () => {
  it('never adjusts below reserved stock, and restocks an approved return', async () => {
    const c = await pharmacy()
    await c.stock([{ batchNo: 'NP-A', expiry: addDays(today(), 200), qty: 30 }])
    const batch = (await c.state()).batches[0].id
    await c.owner.post('/v1/inventory/transfers').send({ mode: 'create', fromLocationId: c.store, toLocationId: c.dispensary, reason: 'Rebalancing', lines: [{ batchId: batch, qty: 20 }] }).expect(201)
    expect((await c.owner.post('/v1/inventory/adjustments').send({ mode: 'post', batchId: batch, proposed: -15, reason: 'Damaged packs written off', evidence: 'QA-1' }).expect(409)).body.error.code).toBe('STOCK_CHANGED')
    const draft = (await c.owner.post('/v1/inventory/adjustments').send({ mode: 'draft', batchId: batch, proposed: -5, reason: 'Count variance', evidence: 'CS-1' }).expect(201)).body.data
    await c.owner.put(`/v1/inventory/adjustments/${draft.id}`).send({ mode: 'post', batchId: batch, proposed: -5, reason: 'Count variance', evidence: 'CS-1 recount' }).expect(200)
    await c.owner.put(`/v1/inventory/adjustments/${draft.id}`).send({ mode: 'post', batchId: batch, proposed: -5, reason: 'Count variance', evidence: 'CS-1' }).expect(409)

    const returned = (await c.owner.post('/v1/pharmacy/cases').send({ type: 'Return', subtype: 'Patient return', itemId: c.item, batchId: batch, qty: 4, origin: 'RX-000001', reason: 'Therapy changed', location: 'Main Pharmacy' }).expect(201)).body.data
    expect(returned.reference).toBe('RET-000001')
    await c.owner.post(`/v1/pharmacy/cases/${returned.id}/decide`).send({ decision: 'resolve', note: 'Checked and accepted back.', version: 1 }).expect(422)
    await c.owner.post(`/v1/pharmacy/cases/${returned.id}/decide`).send({ decision: 'restock', note: 'Sealed strips, fit for restock.', locationId: c.dispensary, version: 1 }).expect(200)

    const state = await c.state()
    expect(state.batches.find((entry: { locationId: string }) => entry.locationId === c.store)).toMatchObject({ posted: 25, reserved: 20 })
    expect(state.batches.find((entry: { locationId: string }) => entry.locationId === c.dispensary)).toMatchObject({ batchNo: 'NP-A', posted: 4 })
    expect(state.cases[0]).toMatchObject({ status: 'resolved', statusNote: 'Restocked at Main Pharmacy' })
  })
})

describe('inventory access', () => {
  it('keeps stock to inventory and pharmacy roles, and dispensing to pharmacists', async () => {
    const c = await pharmacy()
    const desk = await member(c, 'desk@aura.test', 'Front Desk & Reception')
    await desk.get('/v1/inventory/state').expect(403)
    const pharmacist = await member(c, 'rx@aura.test', 'Pharmacist')
    expect((await pharmacist.get('/v1/inventory/state').expect(200)).body.data.items).toHaveLength(1)
    await pharmacist.post('/v1/inventory/requests').send({ submit: true, locationId: c.dispensary, priority: 'Urgent', reason: 'Stockout', lines: [{ itemId: c.item, requested: 10 }] }).expect(201)
    const clinician = await member(c, 'dr@aura.test', 'Clinician')
    await clinician.post('/v1/pharmacy/cases').send({}).expect(403)
  })
})
