import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, supplyReducer } from './supplyReducer'
import { orderStatus, receiptState } from './selectors'
import { summarise } from './stockLogic'

function runner(initial = INITIAL_STATE) {
  let state = initial
  const run = (type, payload) => {
    const outcome = supplyReducer(state, { type, payload })
    state = outcome.state
    return outcome.result
  }
  return { run, get: () => state }
}

const central = (state, itemId) => summarise(state.batches, itemId, 'central')

describe('stock request → transfer → receipt chain', () => {
  it('reserves on approval, deducts on dispatch and posts at the pharmacy on receipt', () => {
    const { run, get } = runner()

    run('request/review', { id: 'SR-261020-07', decision: 'Approve partial', approveNow: { 'MED-00124': 1200, 'MED-00172': 200 }, reason: 'Retain a safety buffer.' })
    let request = get().requests.find((row) => row.id === 'SR-261020-07')
    expect(request.status).toBe('Partially approved')
    expect(central(get(), 'MED-00124')).toMatchObject({ posted: 1600, reserved: 1600, available: 0 })
    expect(request.lines[0].allocations.map((pick) => [pick.batchNo, pick.qty])).toEqual([['P26A', 400], ['P26B', 800]])

    const { id } = run('transfer/save', {
      from: 'central', to: 'opd', mode: 'create', requestId: request.id, alreadyReserved: true, reason: 'Routine replenishment', notes: '',
      lines: request.lines.flatMap((line) => line.allocations.map((pick) => ({ batchId: pick.batchId, qty: pick.qty }))),
    })
    expect(get().transfers.find((row) => row.id === id).status).toBe('Ready for dispatch')
    expect(central(get(), 'MED-00124').reserved).toBe(1600)

    run('transfer/dispatch', { id })
    expect(central(get(), 'MED-00124')).toMatchObject({ posted: 400, reserved: 400 })
    request = get().requests.find((row) => row.id === 'SR-261020-07')
    expect(request.status).toBe('Dispatched')
    expect(request.lines[0].issued).toBe(1200)

    run('transfer/receive', { id, received: { 0: 400, 1: 800, 2: 200 } })
    expect(summarise(get().batches, 'MED-00124', 'opd').posted).toBe(200 + 1200)
    request = get().requests.find((row) => row.id === 'SR-261020-07')
    expect(request.status).toBe('Partially fulfilled')
    expect(get().movements[0]).toMatchObject({ kind: 'Receipt', loc: 'opd' })
  })

  it('rejects a request without reserving anything', () => {
    const { run, get } = runner()
    run('request/review', { id: 'SR-261020-08', decision: 'Reject request', reason: 'Duplicate of SR-261017-02.' })
    expect(get().requests.find((row) => row.id === 'SR-261020-08')).toMatchObject({ status: 'Rejected', decisionNote: 'Duplicate of SR-261017-02.' })
    expect(get().batches).toBe(INITIAL_STATE.batches)
  })

  it('reserves a new transfer, and releases the reservation when it is cancelled', () => {
    const { run, get } = runner()
    const { id } = run('transfer/save', { from: 'central', to: 'main', mode: 'create', reason: 'Routine replenishment', notes: '', lines: [{ batchId: 'BAT-003', qty: 50 }] })
    expect(get().batches.find((row) => row.id === 'BAT-003').reserved).toBe(50)
    run('transfer/cancel', { id })
    expect(get().batches.find((row) => row.id === 'BAT-003').reserved).toBe(0)
    expect(get().transfers.find((row) => row.id === id).status).toBe('Cancelled')
  })
})

describe('receiving', () => {
  it('blocks posting until the short delivery is resolved, then posts the accepted batch', () => {
    const { run, get } = runner()
    expect(receiptState(get().receipts[0])).toBe('Reconciliation required')
    expect(run('receipt/post', { id: 'GRN-261020-03' }).error).toMatch(/Resolve every discrepancy/)

    run('receipt/resolve', { id: 'GRN-261020-03', discrepancyId: 'DSC-261020-03', disposition: 'Keep balance open on PO', note: 'Supplier will replace on the next delivery.' })
    expect(receiptState(get().receipts[0])).toBe('Ready to post')
    run('receipt/post', { id: 'GRN-261020-03' })
    expect(central(get(), 'MED-00124').available).toBe(1200 + 960)
    expect(get().receipts[0].status).toBe('Posted')
    expect(orderStatus(get().orders.find((row) => row.id === 'PO-261018-04'), get().receipts)).toBe('Part received · open')
  })

  it('posts a clean new receipt straight away and completes the purchase order', () => {
    const { run, get } = runner()
    run('receipt/save', {
      mode: 'post', orderId: 'PO-261019-05', supplierId: 'SUP-0006', store: 'central', challan: 'AP-77', date: '2026-10-20', time: '11:30', receivedBy: 'N. Desai',
      lines: [{ itemId: 'MED-00218', ordered: 1000, received: 1000, accepted: 1000, rejected: 0, short: 0, batches: [{ batchNo: 'CT26D', expiry: '2028-12-31', qty: 1000, bin: 'B-01' }] }],
    })
    expect(central(get(), 'MED-00218').posted).toBe(1080)
    expect(orderStatus(get().orders.find((row) => row.id === 'PO-261019-05'), get().receipts)).toBe('Completed')
  })
})

describe('adjustments and suppliers', () => {
  it('posts an approved write-off to the batch and the movement ledger', () => {
    const { run, get } = runner()
    run('adjustment/save', { mode: 'post', itemId: 'MED-00172', batchId: 'BAT-005', proposed: -40, reason: 'Count variance', evidence: 'CS-111' })
    expect(get().batches.find((row) => row.id === 'BAT-005').posted).toBe(600)
    expect(get().movements[0]).toMatchObject({ kind: 'Adjustment', delta: -40 })
    expect(get().adjustments[0]).toMatchObject({ status: 'Posted', posted: -40 })
  })

  it('numbers new suppliers and logs deactivation', () => {
    const { run, get } = runner()
    const { id } = run('supplier/save', { name: 'Northern Surgicals', code: '', contact: '', phone: '', email: '', categories: ['Equipment'], active: true })
    expect(id).toBe('SUP-0037')
    run('supplier/active', { id, active: false, reason: 'Contract ended' })
    expect(get().suppliers.find((row) => row.id === id)).toMatchObject({ active: false })
    expect(get().suppliers.find((row) => row.id === id).audit[0].text).toContain('deactivated')
  })
})

describe('dispensing', () => {
  it('takes stock from the earliest-expiry dispensary batch and marks the prescription dispensed', () => {
    const { run, get } = runner()
    const { id } = run('rx/dispense', { rxId: 'RX-10284', quantities: {}, consent: {} })
    expect(id).toBe('DSP-2026-0842')
    const rx = get().rxQueue.find((row) => row.id === 'RX-10284')
    expect(rx.status).toBe('Dispensed')
    expect(summarise(get().batches, 'MED-CV-RAM-005', 'main').rows.find((row) => row.batchNo === 'BT-RAM-2026-08').posted).toBe(180)
  })

  it('holds a Schedule H1 prescription until consent and the register entry are recorded', () => {
    const { run, get } = runner()
    expect(run('rx/dispense', { rxId: 'RX-10279', quantities: {}, consent: {} }).error).toMatch(/Schedule H1/)
    run('rx/dispense', { rxId: 'RX-10279', quantities: {}, consent: { otp: true, register: true } })
    expect(get().rxQueue.find((row) => row.id === 'RX-10279').status).toBe('Dispensed')
  })

  it('supports a partial dispense and refuses to over-dispense', () => {
    const { run, get } = runner()
    expect(run('rx/dispense', { rxId: 'RX-10284', quantities: { L1: 99 }, consent: {} }).error).toMatch(/exceeds/)
    run('rx/dispense', { rxId: 'RX-10284', quantities: { L1: 10, L2: 0, L3: 0 }, consent: {} })
    expect(get().rxQueue.find((row) => row.id === 'RX-10284').status).toBe('Partially dispensed')
  })
})

describe('returns and discrepancies', () => {
  it('numbers each case type from its own sequence', () => {
    const { run, get } = runner()
    expect(run('case/create', { type: 'Return', medicine: 'Metformin 500 mg' }).id).toBe('RET-1049')
    expect(run('case/create', { type: 'Discrepancy', medicine: 'Amoxicillin 500 mg' }).id).toBe('DIS-2074')
    expect(get().cases[0].status).toBe('Awaiting review')
  })
})
