import { describe, expect, it } from 'vitest'
import { availableOf, batchLabel, BatchStock, fefoPlan, totalAvailable } from '../../src/modules/inventory/fefo'
import { itemSchema, receiptSchema } from '../../src/modules/inventory/inventory.schemas'

const ITEM = '01930000-0000-7000-8000-000000000001'
const SUPPLIER = '01930000-0000-7000-8000-000000000002'
const batch = (id: string, expiry: string, posted: number, extra: Partial<BatchStock> = {}): BatchStock => ({ id, batchNo: id.toUpperCase(), expiry, posted, reserved: 0, quarantine: 0, bin: '', ...extra })

describe('stock availability', () => {
  it('excludes reserved, quarantined and expired stock', () => {
    expect(availableOf(batch('a', '2027-01-01', 100, { reserved: 30, quarantine: 10 }), '2026-11-18')).toBe(60)
    expect(availableOf(batch('b', '2026-11-17', 100), '2026-11-18')).toBe(0)
    expect(totalAvailable([batch('a', '2027-01-01', 10), batch('b', '2026-01-01', 50)], '2026-11-18')).toBe(10)
  })
})

describe('first expiry first out', () => {
  it('takes from the batch that expires first, then the next', () => {
    const plan = fefoPlan([batch('late', '2028-01-01', 50), batch('soon', '2027-01-01', 20), batch('gone', '2026-01-01', 99)], 30, '2026-11-18')
    expect(plan.picks.map((pick) => [pick.batchId, pick.qty])).toEqual([['soon', 20], ['late', 10]])
    expect(plan.short).toBe(0)
  })

  it('reports how much it could not find', () => {
    expect(fefoPlan([batch('a', '2027-01-01', 5, { reserved: 2 })], 10, '2026-11-18')).toMatchObject({ short: 7, picks: [{ qty: 3 }] })
  })

  it('labels picks by batch number once each', () => {
    expect(batchLabel([{ batchNo: 'A' }, { batchNo: 'B' }, { batchNo: 'A' }])).toBe('A / B')
  })
})

describe('inventory requests', () => {
  const item = { code: 'med-1', name: 'Paracetamol 500mg', category: 'Analgesic', unit: 'tablet', unitPlural: 'tablets', unitPrice: 1.2, safetyLevel: 10, reorderLevel: 50, targetLevel: 200 }

  it('upper-cases item codes and needs a strength for a formulary-linked medicine', () => {
    expect(itemSchema.parse(item).code).toBe('MED-1')
    expect(itemSchema.safeParse({ ...item, medicineCode: 'paracetamol' }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, medicineCode: 'paracetamol', strength: '500 mg' }).success).toBe(true)
    expect(itemSchema.safeParse({ ...item, targetLevel: 20 }).success).toBe(false)
  })

  it('requires batch quantities to add up to the accepted units of a recorded receipt', () => {
    const receipt = { mode: 'record', supplierId: SUPPLIER, storeId: SUPPLIER, lines: [{ itemId: ITEM, received: 100, rejected: 10, batches: [{ batchNo: 'B1', expiry: '2027-01-01', qty: 80 }] }] }
    expect(receiptSchema.safeParse(receipt).success).toBe(false)
    expect(receiptSchema.safeParse({ ...receipt, lines: [{ ...receipt.lines[0], batches: [{ batchNo: 'B1', expiry: '2027-01-01', qty: 90 }] }] }).success).toBe(true)
    expect(receiptSchema.safeParse({ ...receipt, mode: 'draft' }).success).toBe(true)
  })
})
