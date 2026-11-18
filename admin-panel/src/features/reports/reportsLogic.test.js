import { describe, expect, it } from 'vitest'
import { allRefunds } from '../billing/financeLogic'
import { billingViews } from '../../test/fixtures/billingViews'
import { OPERATIONS, PHARMACY, REPORT_PERIOD } from './data/sampleReports'
import { financialFigures, operationsFigures, pharmacyFigures, windowTotal } from './reportsLogic'

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
  const figures = pharmacyFigures(PHARMACY)

  it('totals dispensing and purchases from the trend buckets', () => {
    expect(figures.dispensed).toBe(1250)
    expect(figures.purchases).toBe(20250)
    expect(figures.categoryPurchases).toBe(20250)
  })

  it('counts each stock category once and values near-expiry stock at purchase cost', () => {
    expect(figures.status).toEqual({ 'In stock': 3, 'Low stock': 2, 'Near expiry': 2, 'Out of stock': 1 })
    expect(figures.nearExpiryValue).toBe(1680)
    expect(figures.nearExpirySkus).toBe(2)
    expect(figures.stockouts).toBe(2)
    expect(figures.openStockouts).toBe(1)
  })

  it('computes gross margin from explicit sales and cost inputs', () => {
    expect(figures).toMatchObject({ sales: 11935, cogs: 7855, grossProfit: 4080, margin: 34.2 })
  })
})
