import { ApiError } from '../../lib/api'
import { localToday } from '../../features/patients/format'

// An in-memory stand-in for the inventory and pharmacy API (backend/src/modules/inventory), for page tests. It
// returns state in the API's shape, so the screens go through the production adapters, and applies the main
// server rules (reservations, FEFO, guards, workflow states). The real rules are tested against the database in
// backend/test/integration/inventory-pharmacy.test.ts. Dates are relative to today so expiry checks stay stable.

const clone = (value) => JSON.parse(JSON.stringify(value))
const pad = (value) => String(value).padStart(6, '0')
const fail = (status, code, message) => {
  throw new ApiError(status, code, message)
}
const daysFrom = (count, today = localToday()) => {
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + count))
  return date.toISOString().slice(0, 10)
}
const stamp = (date, time = '09:00') => ({ date, time, at: `${date}T${time}:00.000Z` })
const event = (action, at, note = '', actor = 'Siddharth Verma') => ({ action, note, actor, at })

export const LOCATION = { central: 'loc-central', main: 'loc-main', opd: 'loc-opd' }
export const ITEM = { para: 'item-para', cet: 'item-cet', nap: 'item-nap', amx: 'item-amx', glove: 'item-glove', met: 'item-met' }

const item = (id, code, name, category, unit, unitPlural, levels, extras = {}) => ({
  id, code, name, category, unit, unitPlural, dosageForm: null, brand: null, pack: null, storage: null, schedule: null, medicineCode: null, strength: null, unitPrice: 1,
  safetyLevel: levels[0], reorderLevel: levels[1], targetLevel: levels[2], preferredSupplierId: null, active: true, version: 1, supplierIds: [], ...extras,
})
const batch = (id, itemId, locationId, batchNo, days, posted, extras = {}) => ({ id, itemId, locationId, batchNo, expiry: daysFrom(days), posted, reserved: 0, quarantine: 0, bin: 'A-01', ...extras })

export function inventorySeed() {
  const today = localToday()
  const earlier = daysFrom(-1)
  return {
    today,
    branches: [{ id: 'b-main', name: 'Main Clinic' }],
    locations: [
      { id: LOCATION.central, code: 'CENTRAL', name: 'Central Stores', detail: 'Receiving bay', kind: 'store', active: true, branch: { id: 'b-main', name: 'Main Clinic' } },
      { id: LOCATION.main, code: 'MAIN-RX', name: 'Main Pharmacy', detail: '', kind: 'pharmacy', active: true, branch: { id: 'b-main', name: 'Main Clinic' } },
      { id: LOCATION.opd, code: 'OPD-RX', name: 'OPD Pharmacy', detail: '', kind: 'pharmacy', active: true, branch: { id: 'b-main', name: 'Main Clinic' } },
    ],
    suppliers: [
      { id: 'sup-medline', code: 'SUP-0018', name: 'Medline Healthcare', contact: '', phone: '', email: '', categories: ['Medicines'], address: '', city: '', state: '', postal: '', country: '', gstin: '', registration: '', terms: '', notes: '', active: true, version: 1, created: stamp(earlier), events: [event('Supplier record created · Status: Active', stamp(earlier))] },
      { id: 'sup-apex', code: null, name: 'Apex Medical Distributors', contact: 'Neha Shah', phone: '', email: '', categories: ['Medicines'], address: '', city: '', state: '', postal: '', country: '', gstin: '', registration: '', terms: '', notes: '', active: true, version: 1, created: stamp(earlier), events: [] },
      { id: 'sup-unity', code: null, name: 'Unity Life Sciences', contact: '', phone: '', email: '', categories: ['Medicines'], address: '', city: '', state: '', postal: '', country: '', gstin: '', registration: '', terms: '', notes: '', active: false, version: 2, created: stamp(earlier), events: [] },
    ],
    items: [
      item(ITEM.para, 'MED-00124', 'Paracetamol 500mg', 'Analgesic', 'tablet', 'tablets', [150, 500, 2000], { medicineCode: 'paracetamol', strength: '500 mg', unitPrice: 1.2, supplierIds: ['sup-medline'], preferredSupplierId: 'sup-medline' }),
      item(ITEM.cet, 'MED-00218', 'Cetirizine 10mg', 'Antihistamine', 'tablet', 'tablets', [100, 200, 800], { unitPrice: 1.5, supplierIds: ['sup-apex'] }),
      item(ITEM.nap, 'MED-NAP-250', 'Naproxen 250mg', 'Analgesic', 'tablet', 'tablets', [20, 50, 200], { medicineCode: 'naproxen', strength: '250 mg', unitPrice: 2.5 }),
      item(ITEM.amx, 'MED-AMX-500', 'Amoxicillin 500mg', 'Antibiotic / Anti-infective', 'capsule', 'capsules', [30, 100, 400], { medicineCode: 'amoxicillin', strength: '500 mg', schedule: 'H1', unitPrice: 7 }),
      item(ITEM.met, 'MED-00172', 'Metformin 500mg', 'Antidiabetic', 'tablet', 'tablets', [100, 400, 1200], { unitPrice: 1.8, supplierIds: ['sup-medline'] }),
      item(ITEM.glove, 'CON-00042', 'Examination gloves · M', 'Consumables', 'box', 'boxes', [20, 100, 400], { unitPrice: 240 }),
    ],
    batches: [
      batch('bat-p26a', ITEM.para, LOCATION.central, 'P26A', 60, 600, { reserved: 200 }),
      batch('bat-p26b', ITEM.para, LOCATION.central, 'P26B', 600, 1000),
      batch('bat-cet', ITEM.cet, LOCATION.central, 'CT26C', 600, 80),
      batch('bat-glove', ITEM.glove, LOCATION.central, 'GL26F', 900, 350),
      batch('bat-met', ITEM.met, LOCATION.central, 'MF26B', 700, 640),
      batch('bat-para-rx', ITEM.para, LOCATION.main, 'P26B', 600, 100),
      batch('bat-nap-a', ITEM.nap, LOCATION.main, 'NP-A', 60, 30),
      batch('bat-nap-b', ITEM.nap, LOCATION.main, 'NP-B', 400, 50),
      batch('bat-amx', ITEM.amx, LOCATION.main, 'AX-1', 300, 40),
    ],
    movements: [{ id: 'mov-1', itemId: ITEM.para, locationId: LOCATION.central, kind: 'Receipt', reference: 'GRN-000001', batchLabel: 'P26A / P26B', delta: 1600, availableAfter: 1400, reason: 'Accepted, reconciled and posted.', actor: 'Siddharth Verma', at: stamp(earlier) }],
    requests: [
      { id: 'req-1', reference: 'SR-000001', locationId: LOCATION.opd, priority: 'Normal', requiredBy: daysFrom(2), reason: 'Routine replenishment', notes: '', status: 'submitted', decision: null, decisionNote: null, requestedBy: 'Ramesh Pillai', created: stamp(today, '08:30'), version: 1, transferIds: [], lines: [{ itemId: ITEM.para, requested: 1500, approved: 0, issued: 0, received: 0 }], events: [event('Submitted', stamp(today, '08:30'), '1 line', 'Ramesh Pillai')] },
      { id: 'req-3', reference: 'SR-000003', locationId: LOCATION.main, priority: 'Normal', requiredBy: null, reason: 'Routine replenishment', notes: '', status: 'submitted', decision: null, decisionNote: null, requestedBy: 'Ramesh Pillai', created: stamp(today, '08:55'), version: 1, transferIds: [], lines: [{ itemId: ITEM.glove, requested: 40, approved: 0, issued: 0, received: 0 }], events: [event('Submitted', stamp(today, '08:55'))] },
      { id: 'req-2', reference: 'SR-000002', locationId: LOCATION.main, priority: 'Normal', requiredBy: null, reason: 'Routine replenishment', notes: '', status: 'dispatched', decision: 'Approve in full', decisionNote: '', requestedBy: 'Ramesh Pillai', created: stamp(earlier, '10:00'), version: 3, transferIds: ['tr-1'], lines: [{ itemId: ITEM.cet, requested: 20, approved: 20, issued: 20, received: 0 }], events: [event('Submitted', stamp(earlier, '10:00')), event('Approved in full', stamp(earlier, '11:00')), event('Dispatched on TR-000001', stamp(earlier, '12:00'))] },
    ],
    transfers: [
      { id: 'tr-1', reference: 'TR-000001', requestId: 'req-2', fromLocationId: LOCATION.central, toLocationId: LOCATION.main, status: 'in_transit', reason: 'Routine replenishment', notes: '', plannedOn: null, createdBy: 'Siddharth Verma', created: stamp(earlier, '11:00'), dispatched: stamp(earlier, '12:00'), received: null, version: 2, lines: [{ itemId: ITEM.cet, batchId: 'bat-cet', batchNo: 'CT26C', expiry: daysFrom(600), qty: 20, received: 0 }], events: [event('Created & reserved', stamp(earlier, '11:00')), event('Dispatched', stamp(earlier, '12:00'))] },
    ],
    orders: [
      { id: 'po-1', reference: 'PO-000001', supplierId: 'sup-medline', storeId: LOCATION.central, orderedOn: earlier, expectedOn: daysFrom(3), supplierRef: '', terms: '', notes: '', draft: false, closed: false, createdBy: 'Siddharth Verma', lines: [{ itemId: ITEM.para, ordered: 1000, rate: 1.2 }], events: [] },
      { id: 'po-2', reference: 'PO-000002', supplierId: 'sup-apex', storeId: LOCATION.central, orderedOn: earlier, expectedOn: null, supplierRef: '', terms: '', notes: '', draft: false, closed: false, createdBy: 'Siddharth Verma', lines: [{ itemId: ITEM.cet, ordered: 500, rate: 1.5 }], events: [] },
    ],
    receipts: [
      { id: 'grn-1', reference: 'GRN-000001', orderId: 'po-1', supplierId: 'sup-medline', storeId: LOCATION.central, challan: 'DC-39811', invoice: '', bay: 'C-01', verified: true, attachments: 1, status: 'reconciliation_required', receivedBy: 'Siddharth Verma', created: stamp(today, '09:40'), version: 1,
        lines: [{ itemId: ITEM.para, ordered: 1000, received: 960, rejected: 0, batches: [{ batchNo: 'P26C', expiry: daysFrom(700), qty: 960, bin: 'A-04' }] }],
        discrepancies: [{ id: 'dsc-1', reference: 'DSC-000001', kind: 'Short delivery', qty: 40, state: 'Unresolved', note: 'Challan records 1,000.', resolution: null }], events: [event('Receipt recorded', stamp(today, '09:40'), '960 counted')] },
    ],
    adjustments: [{ id: 'adj-1', reference: 'ADJ-000001', itemId: ITEM.glove, batchId: 'bat-glove', proposed: -2, reason: 'Count variance', evidence: 'CS-110 · recount pending', status: 'draft', recordedBy: 'Siddharth Verma', decidedBy: null, decided: null, created: stamp(today, '10:45'), version: 1 }],
    cases: [
      { id: 'case-1', reference: 'RET-000001', type: 'Return', subtype: 'Patient return', itemId: ITEM.nap, batchId: 'bat-nap-a', qty: 4, origin: 'RX-000003', originNote: 'Main Pharmacy', reason: 'Therapy changed', reasonNote: 'Unopened strips', location: 'Main Pharmacy', expected: null, observed: null, notes: 'Two unopened strips returned.', evidence: 0, status: 'awaiting_review', statusNote: 'Reported · not yet reviewed', assigneeId: null, assignee: null, reportedBy: 'Ramesh Pillai', created: stamp(today, '10:42'), version: 1, events: [event('Return reported', stamp(today, '10:42'), '4 tablets · Therapy changed', 'Ramesh Pillai')] },
      { id: 'case-2', reference: 'DIS-000001', type: 'Discrepancy', subtype: 'Shortage', itemId: ITEM.para, batchId: 'bat-p26b', qty: 10, origin: 'Rack A-03', originNote: 'Central Stores', reason: 'Count variance', reasonNote: '100 expected · 90 found', location: 'Central Stores', expected: 100, observed: 90, notes: 'Recount in progress.', evidence: 0, status: 'awaiting_review', statusNote: 'Reported · not yet reviewed', assigneeId: null, assignee: null, reportedBy: 'Ramesh Pillai', created: stamp(earlier, '09:30'), version: 1, events: [event('Discrepancy reported', stamp(earlier, '09:30'), '10 tablets · Count variance', 'Ramesh Pillai')] },
    ],
    members: [{ userId: 'u-1', name: 'Siddharth Verma', roles: ['Super Admin'] }, { userId: 'u-2', name: 'Ramesh Pillai', roles: ['Pharmacist'] }],
    rxQueue: [
      rx('rx-1', 'RX-000001', 'active', stamp(today, '10:40'), { name: 'Ananya Sharma', mrn: 'PT-000184' }, [rxLine('rxl-1', ITEM.nap, 'MED-NAP-250', 'Naproxen Sodium 250 mg', 10, 'nsaid'), rxLine('rxl-2', ITEM.para, 'MED-00124', 'Paracetamol 500 mg', 6, 'analgesic')]),
      rx('rx-2', 'RX-000002', 'active', stamp(today, '10:15'), { name: 'Ravi Kumar', mrn: 'PT-000219' }, [rxLine('rxl-3', ITEM.amx, 'MED-AMX-500', 'Amoxicillin 500 mg', 15, 'penicillin', 'H1')]),
      rx('rx-3', 'RX-000003', 'completed', stamp(earlier, '09:55'), { name: 'Farida Khan', mrn: 'PT-000305' }, [rxLine('rxl-4', ITEM.nap, 'MED-NAP-250', 'Naproxen Sodium 250 mg', 10, 'nsaid', null, 10)], [{ id: 'dsp-1', reference: 'DSP-000001', at: stamp(earlier, '10:20'), by: 'Ramesh Pillai', lines: [{ prescriptionItemId: 'rxl-4', itemId: ITEM.nap, batchNo: 'NP-A', expiry: daysFrom(200), bin: 'A-01', qty: 10, unitPrice: 2.5 }] }]),
    ],
  }
}

function rx(id, reference, status, created, patient, lines, dispenses = []) {
  return {
    id, reference, status, created, branch: { id: 'b-main', name: 'Main Clinic' }, encounterReference: null, prescriber: 'Dr. Rahul Mehta', registration: 'TSMC/2014/1123', department: 'General Medicine', indication: 'As prescribed',
    patient: { id: `p-${id}`, mrn: patient.mrn, name: patient.name, dateOfBirth: '1990-01-01', gender: 'female', abha: null, allergies: [] }, lines, dispenses,
  }
}
function rxLine(id, itemId, itemCode, name, qty, drugClass, schedule = null, dispensed = 0) {
  return { id, itemId, itemCode, schedule, name, qty, unit: 'tablets', timing: 'Twice daily · After food', drugClass, dispensed }
}

export function createInventoryApi({ seed = inventorySeed() } = {}) {
  const state = clone(seed)
  const calls = []
  const counters = {}
  const next = (prefix) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return `${prefix}${pad(counters[prefix] + 10)}`
  }
  const now = () => stamp(state.today, '11:30')
  const find = (list, id, what) => state[list].find((entry) => entry.id === id) ?? fail(404, 'NOT_FOUND', `${what} not found.`)
  const free = (row) => (row.expiry < state.today ? 0 : row.posted - row.reserved - row.quarantine)
  const fefo = (itemId, locationId, qty) => {
    const picks = []
    let left = qty
    for (const row of state.batches.filter((entry) => entry.itemId === itemId && entry.locationId === locationId).sort((a, b) => a.expiry.localeCompare(b.expiry))) {
      if (left <= 0) break
      const take = Math.min(left, free(row))
      if (take > 0) picks.push({ row, qty: take })
      left -= Math.max(take, 0)
    }
    return { picks, short: Math.max(0, left) }
  }
  const post = (itemId, locationId, batchNo, expiry, qty) => {
    const existing = state.batches.find((row) => row.itemId === itemId && row.locationId === locationId && row.batchNo === batchNo)
    if (existing) existing.posted += qty
    else state.batches.push({ id: `bat-${state.batches.length + 1}`, itemId, locationId, batchNo, expiry, posted: qty, reserved: 0, quarantine: 0, bin: '' })
  }
  const move = (itemId, locationId, kind, reference, label, delta, reason) => {
    const available = state.batches.filter((row) => row.itemId === itemId && row.locationId === locationId).reduce((sum, row) => sum + Math.max(free(row), 0), 0)
    state.movements.unshift({ id: `mov-${state.movements.length + 1}`, itemId, locationId, kind, reference, batchLabel: label, delta, availableAfter: available, reason, actor: 'Siddharth Verma', at: now() })
  }
  const log = (entry, action, note = '') => entry.events.push(event(action, now(), note))
  const record = (name, ...args) => calls.push([name, ...args])

  const api = {
    state: async () => {
      record('state')
      return clone(state)
    },
    createItem: async (body) => {
      record('createItem', body)
      if (state.items.some((entry) => entry.code === body.code)) fail(409, 'ITEM_CODE_TAKEN', 'This item code is already used.')
      const id = `item-${state.items.length + 1}`
      state.items.push({ ...body, id, version: 1 })
      return { id }
    },
    updateItem: async (id, version, body) => {
      record('updateItem', id, body)
      const current = find('items', id, 'Item')
      if (current.version !== version) fail(409, 'STALE_RECORD', 'This item was changed by someone else.')
      Object.assign(current, body, { version: version + 1 })
      return { id }
    },
    createLocation: async (body) => {
      record('createLocation', body)
      if (state.locations.some((entry) => entry.code === body.code)) fail(409, 'LOCATION_CODE_TAKEN', 'This location code is already used.')
      const id = `loc-${state.locations.length + 1}`
      state.locations.push({ id, code: body.code, name: body.name, detail: body.detail, kind: body.kind, active: true, branch: state.branches.find((branch) => branch.id === body.branchId) })
      return { id }
    },
    setLocationActive: async (id, active) => {
      record('setLocationActive', id, active)
      if (!active && state.batches.some((row) => row.locationId === id && row.posted > 0)) fail(409, 'LOCATION_HAS_STOCK', 'Move or adjust the stock held here before closing this location.')
      find('locations', id, 'Location').active = active
      return { id }
    },
    createSupplier: async (body) => {
      record('createSupplier', body)
      if (state.suppliers.some((entry) => entry.name.toLowerCase() === body.name.toLowerCase())) fail(409, 'SUPPLIER_TAKEN', 'A supplier with this name already exists.')
      const id = `sup-${state.suppliers.length + 1}`
      state.suppliers.push({ ...body, id, version: 1, created: now(), events: [event(`Supplier record created · Status: ${body.active ? 'Active' : 'Inactive'}`, now())] })
      return { id }
    },
    updateSupplier: async (id, version, body) => {
      record('updateSupplier', id, body)
      const current = find('suppliers', id, 'Supplier')
      if (current.version !== version) fail(409, 'STALE_RECORD', 'This supplier was changed by someone else.')
      Object.assign(current, body, { version: version + 1 })
      log(current, 'Supplier updated')
      return { id }
    },
    setSupplierActive: async (id, body) => {
      record('setSupplierActive', id, body)
      const current = find('suppliers', id, 'Supplier')
      Object.assign(current, { active: body.active, version: current.version + 1 })
      log(current, `Supplier ${body.active ? 'reactivated' : 'deactivated'}`, body.reason)
      return { id }
    },
    createRequest: async (body) => {
      record('createRequest', body)
      const reference = next('SR-')
      const id = `req-${reference}`
      state.requests.unshift({ id, reference, locationId: body.locationId, priority: body.priority, requiredBy: body.requiredBy, reason: body.reason, notes: body.notes, status: body.submit ? 'submitted' : 'draft', decision: null, decisionNote: null, requestedBy: 'Siddharth Verma', created: now(), version: 1, transferIds: [], lines: body.lines.map((line) => ({ ...line, approved: 0, issued: 0, received: 0 })), events: [event(body.submit ? 'Submitted' : 'Draft saved', now())] })
      return { id, reference }
    },
    updateRequest: async (id, body) => {
      record('updateRequest', id, body)
      const current = find('requests', id, 'Request')
      if (current.status !== 'draft') fail(409, 'REQUEST_NOT_DRAFT', 'Only a draft request can be changed.')
      Object.assign(current, { locationId: body.locationId, priority: body.priority, reason: body.reason, notes: body.notes, status: body.submit ? 'submitted' : 'draft', version: current.version + 1, lines: body.lines.map((line) => ({ ...line, approved: 0, issued: 0, received: 0 })) })
      return { id }
    },
    cancelRequest: async (id) => {
      record('cancelRequest', id)
      const current = find('requests', id, 'Request')
      Object.assign(current, { status: 'cancelled', version: current.version + 1 })
      log(current, 'Cancelled by requester')
      return { id }
    },
    reviewRequest: async (id, body) => {
      record('reviewRequest', id, body)
      const current = find('requests', id, 'Request')
      if (current.version !== body.version) fail(409, 'REQUEST_STATE_CHANGED', 'This request is not awaiting review.')
      if (body.decision === 'reject') {
        Object.assign(current, { status: 'rejected', decision: 'Reject request', decisionNote: body.reason, version: current.version + 1 })
        log(current, 'Rejected', body.reason)
        return { id }
      }
      current.reservations ??= []
      for (const line of current.lines) {
        const qty = body.approve[line.itemId] ?? 0
        if (!qty) continue
        const plan = fefo(line.itemId, LOCATION.central, qty)
        if (plan.short) fail(422, 'STOCK_SHORT', `Only ${qty - plan.short} of the requested units are available at Central Stores.`)
        line.allocations ??= []
        for (const pick of plan.picks) {
          pick.row.reserved += pick.qty
          current.reservations.push({ itemId: line.itemId, batchId: pick.row.id, qty: pick.qty })
          line.allocations.push({ batchId: pick.row.id, batchNo: pick.row.batchNo, expiry: pick.row.expiry, bin: pick.row.bin, qty: pick.qty, transferId: null })
        }
        line.approved += qty
        move(line.itemId, LOCATION.central, 'Reservation created', current.reference, plan.picks.map((pick) => pick.row.batchNo).join(' / '), 0, `${qty} reserved for ${current.reference}.`)
      }
      const complete = current.lines.every((line) => line.approved >= line.requested)
      Object.assign(current, { status: complete ? 'approved' : 'partially_approved', decision: complete ? 'Approve in full' : 'Approve partially', decisionNote: body.reason, version: current.version + 1 })
      log(current, complete ? 'Approved in full' : 'Approved partially', body.reason)
      return { id }
    },
    transferForRequest: async (id) => {
      record('transferForRequest', id)
      const current = find('requests', id, 'Request')
      const pending = (current.reservations ?? []).filter((entry) => !entry.transferId)
      if (!pending.length) fail(409, 'NOTHING_TO_TRANSFER', 'Every approved quantity is already on a transfer.')
      const reference = next('TR-')
      const transferId = `tr-${reference}`
      pending.forEach((entry) => {
        entry.transferId = transferId
      })
      state.transfers.unshift({ id: transferId, reference, requestId: id, fromLocationId: LOCATION.central, toLocationId: current.locationId, status: 'ready', reason: current.reason, notes: `Fulfils ${current.reference}`, plannedOn: null, createdBy: 'Siddharth Verma', created: now(), dispatched: null, received: null, version: 1, lines: pending.map((entry) => { const row = find('batches', entry.batchId, 'Batch'); return { itemId: entry.itemId, batchId: row.id, batchNo: row.batchNo, expiry: row.expiry, qty: entry.qty, received: 0 } }), events: [event('Created & reserved', now())] })
      current.transferIds.push(transferId)
      return { id: transferId, reference }
    },
    createTransfer: async (body) => {
      record('createTransfer', body)
      const lines = body.lines.map((line) => {
        const row = find('batches', line.batchId, 'Batch')
        if (body.mode === 'create') {
          if (free(row) < line.qty) fail(409, 'STOCK_CHANGED', `Batch ${row.batchNo} no longer has ${line.qty} available.`)
          row.reserved += line.qty
        }
        return { itemId: row.itemId, batchId: row.id, batchNo: row.batchNo, expiry: row.expiry, qty: line.qty, received: 0 }
      })
      const reference = next('TR-')
      state.transfers.unshift({ id: `tr-${reference}`, reference, requestId: null, fromLocationId: body.fromLocationId, toLocationId: body.toLocationId, status: body.mode === 'create' ? 'ready' : 'draft', reason: body.reason, notes: body.notes, plannedOn: body.plannedOn, createdBy: 'Siddharth Verma', created: now(), dispatched: null, received: null, version: 1, lines, events: [event(body.mode === 'create' ? 'Created & reserved' : 'Draft saved', now())] })
      return { id: `tr-${reference}`, reference }
    },
    updateTransfer: async (id, body) => {
      record('updateTransfer', id, body)
      const current = find('transfers', id, 'Transfer')
      if (current.status !== 'draft') fail(409, 'TRANSFER_STATE_CHANGED', 'Only a draft transfer can be changed.')
      Object.assign(current, { status: body.mode === 'create' ? 'ready' : 'draft', version: current.version + 1 })
      return { id }
    },
    dispatchTransfer: async (id, version) => {
      record('dispatchTransfer', id)
      const current = find('transfers', id, 'Transfer')
      if (current.status !== 'ready' || current.version !== version) fail(409, 'TRANSFER_STATE_CHANGED', 'This transfer was changed by someone else.')
      for (const line of current.lines) {
        const row = find('batches', line.batchId, 'Batch')
        row.posted -= line.qty
        row.reserved -= line.qty
        move(line.itemId, current.fromLocationId, 'Issue', current.reference, line.batchNo, -line.qty, 'Dispatched; receipt pending.')
      }
      Object.assign(current, { status: 'in_transit', dispatched: now(), version: version + 1 })
      if (current.requestId) {
        const request = find('requests', current.requestId, 'Request')
        request.status = 'dispatched'
        for (const line of current.lines) request.lines.find((entry) => entry.itemId === line.itemId).issued += line.qty
      }
      log(current, 'Dispatched')
      return { id }
    },
    receiveTransfer: async (id, body) => {
      record('receiveTransfer', id, body)
      const current = find('transfers', id, 'Transfer')
      if (current.status !== 'in_transit') fail(409, 'TRANSFER_STATE_CHANGED', 'This transfer is not in transit.')
      current.lines.forEach((line, index) => {
        const qty = body.received[index] ?? line.qty
        line.received = qty
        if (qty > 0) {
          post(line.itemId, current.toLocationId, line.batchNo, line.expiry, qty)
          move(line.itemId, current.toLocationId, 'Receipt', current.reference, line.batchNo, qty, `${qty} of ${line.qty} accepted and posted.`)
        }
      })
      const short = current.lines.some((line) => line.received < line.qty)
      Object.assign(current, { status: 'received', received: now(), version: current.version + 1 })
      if (current.requestId) {
        const request = find('requests', current.requestId, 'Request')
        for (const line of current.lines) request.lines.find((entry) => entry.itemId === line.itemId).received += line.received
        request.status = request.lines.every((line) => line.received >= line.requested) ? 'fulfilled' : 'partially_fulfilled'
      }
      log(current, short ? 'Received with shortage' : 'Received')
      return { id }
    },
    cancelTransfer: async (id) => {
      record('cancelTransfer', id)
      const current = find('transfers', id, 'Transfer')
      if (current.status === 'ready' && !current.requestId) for (const line of current.lines) find('batches', line.batchId, 'Batch').reserved -= line.qty
      Object.assign(current, { status: 'cancelled', version: current.version + 1 })
      log(current, 'Cancelled')
      return { id }
    },
    createOrder: async (body) => {
      record('createOrder', body)
      const supplier = find('suppliers', body.supplierId, 'Supplier')
      if (!supplier.active) fail(422, 'SUPPLIER_INACTIVE', `${supplier.name} is inactive.`)
      const reference = next('PO-')
      state.orders.unshift({ id: `po-${reference}`, reference, supplierId: body.supplierId, storeId: body.storeId, orderedOn: state.today, expectedOn: body.expectedOn, supplierRef: body.supplierRef, terms: body.terms, notes: body.notes, draft: body.draft, closed: false, createdBy: 'Siddharth Verma', lines: body.lines, events: [] })
      return { id: `po-${reference}`, reference }
    },
    createReceipt: async (body) => saveReceipt(body),
    updateReceipt: async (id, body) => saveReceipt(body, id),
    resolveDiscrepancy: async (id, body) => {
      record('resolveDiscrepancy', id, body)
      const receipt = find('receipts', id, 'Receipt')
      Object.assign(receipt.discrepancies.find((entry) => entry.id === body.discrepancyId), { state: 'Resolved', resolution: body.disposition, note: body.note })
      receipt.status = receipt.discrepancies.some((entry) => entry.state === 'Unresolved') ? 'reconciliation_required' : 'ready_to_post'
      log(receipt, 'Supplier response recorded', body.disposition)
      return { id }
    },
    postReceipt: async (id) => {
      record('postReceipt', id)
      postReceipt(find('receipts', id, 'Receipt'))
      return { id }
    },
    createAdjustment: async (body) => saveAdjustment(body),
    updateAdjustment: async (id, body) => saveAdjustment(body, id),
    dispense: async (id, body) => {
      record('dispense', id, body)
      const entry = find('rxQueue', id, 'Prescription')
      if (entry.status !== 'active') fail(409, 'PRESCRIPTION_CLOSED', 'This prescription is no longer active.')
      const wanted = entry.lines.filter((line) => (body.quantities[line.id] ?? 0) > 0)
      if (!wanted.length) fail(422, 'NOTHING_TO_DISPENSE', 'Enter a quantity to dispense for at least one medicine.')
      if (wanted.some((line) => line.schedule === 'H1') && !(body.registerConfirmed && body.consentConfirmed)) fail(422, 'SCHEDULE_H1_UNCONFIRMED', 'Record the Schedule H1 register entry and the patient consent before dispensing.')
      const reference = next('DSP-')
      const dispense = { id: `dsp-${reference}`, reference, at: now(), by: 'Siddharth Verma', lines: [] }
      for (const line of wanted) {
        const qty = body.quantities[line.id]
        if (qty > line.qty - line.dispensed) fail(422, 'DISPENSE_EXCEEDS_PRESCRIPTION', `${line.name}: only ${line.qty - line.dispensed} remain to be dispensed.`)
        const plan = fefo(line.itemId, body.locationId, qty)
        if (plan.short) fail(422, 'STOCK_SHORT', `${line.name}: only ${qty - plan.short} ${line.unit} in stock.`)
        for (const pick of plan.picks) {
          pick.row.posted -= pick.qty
          dispense.lines.push({ prescriptionItemId: line.id, itemId: line.itemId, batchNo: pick.row.batchNo, expiry: pick.row.expiry, bin: pick.row.bin, qty: pick.qty, unitPrice: 1 })
        }
        line.dispensed += qty
        move(line.itemId, body.locationId, 'Dispense', reference, plan.picks.map((pick) => pick.row.batchNo).join(' / '), -qty, `Prescription ${entry.reference}`)
      }
      entry.dispenses.push(dispense)
      const complete = entry.lines.every((line) => line.dispensed >= line.qty)
      if (complete) entry.status = 'completed'
      return { id: dispense.id, reference, complete }
    },
    createCase: async (body) => {
      record('createCase', body)
      const reference = next(body.type === 'Return' ? 'RET-' : 'DIS-')
      state.cases.unshift({ ...body, id: `case-${reference}`, reference, status: body.draft ? 'draft' : 'awaiting_review', statusNote: body.draft ? 'Not submitted' : 'Reported · not yet reviewed', assignee: state.members.find((member) => member.userId === body.assigneeId)?.name ?? null, reportedBy: 'Siddharth Verma', created: now(), version: 1, events: [event(`${body.type} reported`, now())] })
      return { id: `case-${reference}`, reference }
    },
    decideCase: async (id, body) => {
      record('decideCase', id, body)
      const entry = find('cases', id, 'Case')
      if (entry.version !== body.version || !['awaiting_review', 'draft'].includes(entry.status)) fail(409, 'CASE_STATE_CHANGED', 'This case is already decided.')
      let note = body.decision === 'reject' ? 'Rejected · not restocked' : 'Resolved'
      if (body.decision === 'restock') {
        const row = find('batches', entry.batchId, 'Batch')
        post(entry.itemId, body.locationId, row.batchNo, row.expiry, entry.qty)
        note = `Restocked at ${find('locations', body.locationId, 'Location').name}`
      }
      Object.assign(entry, { status: body.decision === 'reject' ? 'rejected' : 'resolved', statusNote: note, version: entry.version + 1 })
      log(entry, note, body.note)
      return { id }
    },
  }

  function saveReceipt(body, id) {
    record(id ? 'updateReceipt' : 'createReceipt', body)
    const unresolved = body.discrepancies.some((entry) => entry.state === 'Unresolved')
    const status = body.mode === 'draft' ? 'draft' : unresolved ? 'reconciliation_required' : 'ready_to_post'
    const reference = id ? find('receipts', id, 'Receipt').reference : next('GRN-')
    const receipt = { id: id ?? `grn-${reference}`, reference, orderId: body.orderId, supplierId: body.supplierId, storeId: body.storeId, challan: body.challan, invoice: body.invoice, bay: body.bay, verified: body.verified, attachments: body.attachments, status, receivedBy: 'Siddharth Verma', created: now(), version: 1, lines: body.lines, discrepancies: body.discrepancies.map((entry, index) => ({ ...entry, id: `dsc-${reference}-${index}`, reference: `DSC-${reference.slice(-6)}${index}` })), events: [event(body.mode === 'draft' ? 'Draft saved' : 'Receipt recorded', now())] }
    state.receipts = [receipt, ...state.receipts.filter((entry) => entry.id !== receipt.id)]
    if (body.mode === 'post' && !unresolved) postReceipt(receipt)
    return { id: receipt.id, reference }
  }

  function postReceipt(receipt) {
    if (receipt.status !== 'ready_to_post') fail(409, 'RECEIPT_NOT_READY', 'Resolve every discrepancy before posting.')
    for (const line of receipt.lines) for (const entry of line.batches) {
      post(line.itemId, receipt.storeId, entry.batchNo, entry.expiry, entry.qty)
      move(line.itemId, receipt.storeId, 'Receipt', receipt.reference, entry.batchNo, entry.qty, `${entry.qty} accepted, reconciled and posted.`)
    }
    receipt.status = 'posted'
    if (receipt.orderId && receipt.discrepancies.some((entry) => entry.resolution === 'Close PO as short')) find('orders', receipt.orderId, 'Order').closed = true
    log(receipt, 'Receipt posted')
  }

  function saveAdjustment(body, id) {
    record(id ? 'updateAdjustment' : 'createAdjustment', body)
    const row = find('batches', body.batchId, 'Batch')
    if (body.mode === 'post' && row.posted + body.proposed < row.reserved + row.quarantine) fail(409, 'STOCK_CHANGED', `Batch ${row.batchNo} cannot go below the units it has reserved or quarantined.`)
    const reference = id ? find('adjustments', id, 'Adjustment').reference : next('ADJ-')
    if (body.mode === 'post') {
      row.posted += body.proposed
      move(row.itemId, row.locationId, 'Adjustment', reference, row.batchNo, body.proposed, body.reason)
    }
    const status = { draft: 'draft', post: 'posted', reject: 'rejected' }[body.mode]
    const entry = { id: id ?? `adj-${reference}`, reference, itemId: row.itemId, batchId: row.id, proposed: body.proposed, reason: body.reason, evidence: body.evidence, status, recordedBy: 'Siddharth Verma', decidedBy: status === 'draft' ? null : 'Siddharth Verma', decided: status === 'draft' ? null : now(), created: now(), version: 1 }
    state.adjustments = [entry, ...state.adjustments.filter((existing) => existing.id !== entry.id)]
    return { id: entry.id, reference }
  }

  return { api, state, calls }
}
