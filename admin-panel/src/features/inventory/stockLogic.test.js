import { describe, expect, it } from 'vitest'
import { SEED_BATCHES } from './data/seedStock'
import { availableOf, consumePicks, fefoPlan, issuePicks, postBatch, releasePicks, reservePicks, stockStatus, summarise } from './stockLogic'

describe('summarise', () => {
  it('nets reservations and quarantine out of available stock', () => {
    const paracetamol = summarise(SEED_BATCHES, 'MED-00124', 'central')
    expect(paracetamol).toMatchObject({ posted: 1600, reserved: 400, quarantine: 0, available: 1200, earliestExpiry: '2027-01-15' })
    expect(paracetamol.rows.map((row) => row.batchNo)).toEqual(['P26A', 'P26B'])
  })

  it('never counts an expired batch as available', () => {
    const ramipril = summarise(SEED_BATCHES, 'MED-CV-RAM-005', 'main')
    expect(ramipril.rows.find((row) => row.batchNo === 'BT-RAM-2025-04')).toBeTruthy()
    expect(ramipril.available).toBe(180 + 120)
    expect(availableOf(SEED_BATCHES.find((row) => row.batchNo === 'BT-RAM-2025-04'))).toBe(0)
  })
})

describe('stockStatus', () => {
  it('ranks out of stock, low stock, near expiry and available', () => {
    const level = 500
    expect(stockStatus(summarise(SEED_BATCHES, 'MED-00124', 'central'), level)).toBe('Near expiry')
    expect(stockStatus(summarise(SEED_BATCHES, 'MED-00218', 'central'), 200)).toBe('Low stock')
    expect(stockStatus(summarise(SEED_BATCHES, 'MED-00172', 'central'), 400)).toBe('Available')
    expect(stockStatus(summarise(SEED_BATCHES, 'MED-EM-ATR-006', 'main'), 10)).toBe('Out of stock')
  })
})

describe('fefoPlan', () => {
  it('draws from the earliest expiry first and spills into the next batch', () => {
    const plan = fefoPlan(SEED_BATCHES, 'MED-00124', 'central', 700)
    expect(plan.picks.map((pick) => [pick.batchNo, pick.qty])).toEqual([['P26A', 400], ['P26B', 300]])
    expect(plan.short).toBe(0)
  })

  it('reports the shortfall when stock runs out', () => {
    expect(fefoPlan(SEED_BATCHES, 'MED-00124', 'central', 1500).short).toBe(300)
  })
})

describe('batch updates', () => {
  const picks = [{ batchId: 'BAT-001', qty: 100 }]

  it('reserves, releases and issues without touching other batches', () => {
    const reserved = reservePicks(SEED_BATCHES, picks)
    expect(reserved[0]).toMatchObject({ posted: 600, reserved: 300 })
    expect(releasePicks(reserved, picks)[0].reserved).toBe(200)
    expect(issuePicks(reserved, picks)[0]).toMatchObject({ posted: 500, reserved: 200 })
    expect(reserved[1]).toBe(SEED_BATCHES[1])
  })

  it('consumes posted stock directly for dispensing', () => {
    expect(consumePicks(SEED_BATCHES, picks)[0]).toMatchObject({ posted: 500, reserved: 200 })
  })

  it('posts into an existing batch or creates a new one', () => {
    const merged = postBatch(SEED_BATCHES, { itemId: 'MED-00124', loc: 'central', batchNo: 'P26A', expiry: '2027-01-15', qty: 50 })
    expect(merged.find((row) => row.id === 'BAT-001').posted).toBe(650)
    const created = postBatch(SEED_BATCHES, { itemId: 'MED-00124', loc: 'central', batchNo: 'P26C', expiry: '2028-08-31', qty: 960, bin: 'A-04' })
    expect(created).toHaveLength(SEED_BATCHES.length + 1)
    expect(created.at(-1)).toMatchObject({ batchNo: 'P26C', posted: 960, reserved: 0 })
  })
})
