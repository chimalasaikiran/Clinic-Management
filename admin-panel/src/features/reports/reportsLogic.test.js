import { describe, expect, it } from 'vitest'
import { allRefunds } from '../billing/financeLogic'
import { billingViews } from '../../test/fixtures/billingViews'
import { OPERATIONS, REPORT_PERIOD } from './data/sampleReports'
import { financialFigures, operationsFigures, pharmacyReport, windowTotal } from './reportsLogic'

describe('operations report', () => {
  const figures = operationsFigures(OPERATIONS)

  it('adds the windows up to the closed cohort', () => {
    expect(OPERATIONS.windows.map(windowTotal)).toEqual([50, 50, 50, 50])
    expect(figures).toMatchObject({ scheduled: 200, completed: 150, cancelled: 20, noShow: 10, rescheduled: 20 })
  })

  it('divides no-show by attendance-assessable appointments, not by everything scheduled', () => {
    expect(figures.assessable).toBe(160)
    expect(figures.noShowRate).toBe(6.3)
    expect(figures.noShowExact).toBe(6.25)
    expect(figures.cancellationRate).toBe(10)
  })

  it('derives wait, utilization and rebooking from their own denominators', () => {
    expect(figures.meanWait).toBe(15)
    expect(figures.utilization).toBe(75)
    expect(figures.rebookingRate).toBe(50)
    expect(figures.waitCoverage).toBe(80)
  })

  it('reports an unavailable rate as null instead of zero when there is no denominator', () => {
    const empty = operationsFigures({ ...OPERATIONS, windows: [], waitPairs: 0, doctors: [], rebooking: { replaced: 0, mature: 0, immature: 0 } })
    expect(empty).toMatchObject({ noShowRate: null, cancellationRate: null, meanWait: null, utilization: null, rebookingRate: null })
  })
})

describe('financial report', () => {
  const ledger = billingViews()
  const figures = financialFigures(ledger.records, allRefunds(ledger.records, ledger.refundRequests), REPORT_PERIOD)

  it('keeps billed, collected and outstanding as separate record sets for October', () => {
    expect(figures.billed.amount).toBe(8500)
    expect(figures.collected.amount).toBe(7000 + 2400 + 800 + 1200)
    expect(figures.outstanding.amount).toBe(3500)
  })

  it('counts only requests created in the period and excludes an earlier completed refund', () => {
    expect(figures.refundsCreated).toHaveLength(5)
    expect(figures.completedRefunds).toBe(500)
    expect(figures.excludedRefunds.map((refund) => refund.id)).toEqual(['REF-2026-004'])
    expect(Object.fromEntries(figures.refundStatus.map((entry) => [entry.status, entry.amount]))).toEqual({ Pending: 1500, Approved: 2400, Failed: 800, Rejected: 1200, Processed: 500 })
  })
})

describe('pharmacy and inventory report', () => {
  const TODAY = '2026-11-18'
  const item = (id, name, category, reorder, price) => ({ id, name, category, unitPlural: 'tablets', reorder, price, active: true })
  const batch = (id, itemId, loc, expiry, posted, reserved = 0) => ({ id, itemId, loc, batchNo: id.toUpperCase(), expiry, posted, reserved, quarantine: 0 })
  const stock = {
    locations: [{ id: 'CENTRAL', kind: 'store' }, { id: 'MAIN-RX', kind: 'pharmacy' }],
    items: [item('A', 'Paracetamol', 'Analgesic', 100, 1.5), item('B', 'Cetirizine', 'Antihistamine', 50, 2), item('C', 'Naproxen', 'Analgesic', 10, 4), item('D', 'Insulin', 'Endocrine', 5, 100)],
    state: {
      batches: [batch('a1', 'A', 'CENTRAL', '2027-06-30', 500, 100), batch('b1', 'B', 'MAIN-RX', '2027-06-30', 20), batch('c1', 'C', 'MAIN-RX', '2026-12-01', 30), batch('d1', 'D', 'MAIN-RX', '2026-11-01', 8)],
      dispenses: [{ date: '2026-11-10', lines: [{ itemId: 'A', qty: 10 }, { itemId: 'C', qty: 4 }] }, { date: '2026-09-01', lines: [{ itemId: 'A', qty: 99 }] }],
      movements: [{ kind: 'Receipt', delta: 200, loc: 'CENTRAL', itemId: 'A', date: '2026-11-05' }, { kind: 'Receipt', delta: 20, loc: 'MAIN-RX', itemId: 'B', date: '2026-11-06' }],
    },
  }
  const report = pharmacyReport(stock, TODAY)

  it('classifies each item once: out of stock, low stock, near expiry, in stock', () => {
    expect(Object.fromEntries(report.items.map((row) => [row.name, row.status]))).toEqual({ Paracetamol: 'In stock', Cetirizine: 'Low stock', Naproxen: 'Near expiry', Insulin: 'Out of stock' })
    expect(report.status).toEqual({ 'In stock': 1, 'Low stock': 1, 'Near expiry': 1, 'Out of stock': 1 })
    expect(report.items.find((row) => row.name === 'Paracetamol').stock).toBe(400)
  })

  it('counts dispensing in the last 30 days and values it at unit price', () => {
    expect(report.dispensed).toBe(14)
    expect(report.dispensedValue).toBe(10 * 1.5 + 4 * 4)
    expect(report.categories).toEqual([{ name: 'Analgesic', units: 14, value: 31 }])
  })

  it('values store receipts and near-expiry stock, and lists every item needing action', () => {
    expect(report.receivedValue).toBe(300)
    expect(report.nearExpiryValue).toBe(120)
    expect(report.stockouts).toBe(1)
    expect(report.exceptions.map((row) => row.name)).toEqual(['Cetirizine', 'Naproxen', 'Insulin'])
  })
})
