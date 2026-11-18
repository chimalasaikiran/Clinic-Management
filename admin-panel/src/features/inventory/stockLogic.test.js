import { describe, expect, it } from 'vitest'
import { availableOf, consumePicks, fefoPlan, issuePicks, postBatch, releasePicks, reservePicks, stockStatus, summarise } from './stockLogic'

const TODAY = '2026-11-18'
const BATCHES = [
  { id: 'BAT-001', itemId: 'MED-1', loc: 'CENTRAL', batchNo: 'P26A', expiry: '2027-01-15', posted: 600, reserved: 200, quarantine: 0, bin: 'A-03' },
  { id: 'BAT-002', itemId: 'MED-1', loc: 'CENTRAL', batchNo: 'P26B', expiry: '2028-07-31', posted: 1000, reserved: 200, quarantine: 0, bin: 'A-04' },
  { id: 'BAT-003', itemId: 'MED-2', loc: 'CENTRAL', batchNo: 'CT26C', expiry: '2028-06-30', posted: 80, reserved: 0, quarantine: 0, bin: 'B-01' },
  { id: 'BAT-004', itemId: 'MED-3', loc: 'MAIN-RX', batchNo: 'OLD-1', expiry: '2026-10-01', posted: 40, reserved: 0, quarantine: 0, bin: '' },
  { id: 'BAT-005', itemId: 'MED-3', loc: 'MAIN-RX', batchNo: 'NEW-1', expiry: '2028-01-01', posted: 180, reserved: 0, quarantine: 30, bin: '' },
]

describe('summarise', () => {
  it('nets reservations and quarantine out of available stock', () => {
    const summary = summarise(BATCHES, 'MED-1', 'CENTRAL', TODAY)
    expect(summary).toMatchObject({ posted: 1600, reserved: 400, quarantine: 0, available: 1200, earliestExpiry: '2027-01-15' })
    expect(summary.rows.map((row) => row.batchNo)).toEqual(['P26A', 'P26B'])
  })

  it('never counts an expired batch as available', () => {
    expect(summarise(BATCHES, 'MED-3', 'MAIN-RX', TODAY).available).toBe(150)
    expect(availableOf(BATCHES[3], TODAY)).toBe(0)
  })
})

describe('stockStatus', () => {
  it('ranks out of stock, low stock, near expiry and available', () => {
    expect(stockStatus(summarise(BATCHES, 'MED-1', 'CENTRAL', TODAY), 500, TODAY)).toBe('Near expiry')
    expect(stockStatus(summarise(BATCHES, 'MED-2', 'CENTRAL', TODAY), 200, TODAY)).toBe('Low stock')
    expect(stockStatus(summarise(BATCHES, 'MED-3', 'MAIN-RX', TODAY), 100, TODAY)).toBe('Available')
    expect(stockStatus(summarise(BATCHES, 'MED-9', 'MAIN-RX', TODAY), 10, TODAY)).toBe('Out of stock')
  })
})

describe('fefoPlan', () => {
  it('draws from the earliest expiry first and spills into the next batch', () => {
    const plan = fefoPlan(BATCHES, 'MED-1', 'CENTRAL', 700, TODAY)
    expect(plan.picks.map((pick) => [pick.batchNo, pick.qty])).toEqual([['P26A', 400], ['P26B', 300]])
    expect(plan.short).toBe(0)
  })

  it('reports the shortfall when stock runs out', () => {
    expect(fefoPlan(BATCHES, 'MED-1', 'CENTRAL', 1500, TODAY).short).toBe(300)
  })
})

describe('batch updates', () => {
  const picks = [{ batchId: 'BAT-001', qty: 100 }]

  it('reserves, releases and issues without touching other batches', () => {
    const reserved = reservePicks(BATCHES, picks)
    expect(reserved[0]).toMatchObject({ posted: 600, reserved: 300 })
    expect(releasePicks(reserved, picks)[0].reserved).toBe(200)
    expect(issuePicks(reserved, picks)[0]).toMatchObject({ posted: 500, reserved: 200 })
    expect(reserved[1]).toBe(BATCHES[1])
  })

  it('consumes posted stock directly for dispensing', () => {
    expect(consumePicks(BATCHES, picks)[0]).toMatchObject({ posted: 500, reserved: 200 })
  })

  it('posts into an existing batch or creates a new one', () => {
    const merged = postBatch(BATCHES, { itemId: 'MED-1', loc: 'CENTRAL', batchNo: 'P26A', expiry: '2027-01-15', qty: 50 })
    expect(merged.find((row) => row.id === 'BAT-001').posted).toBe(650)
    const created = postBatch(BATCHES, { itemId: 'MED-1', loc: 'CENTRAL', batchNo: 'P26C', expiry: '2028-08-31', qty: 960, bin: 'A-04' })
    expect(created).toHaveLength(BATCHES.length + 1)
    expect(created.at(-1)).toMatchObject({ batchNo: 'P26C', posted: 960, reserved: 0 })
  })
})
