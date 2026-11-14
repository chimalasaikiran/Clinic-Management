import { describe, expect, it } from 'vitest'
import { allocationError, applyAllocation, autoAllocate, buildLedger, invoiceBalance, invoiceStatus, invoiceTotals, ledgerSummary, paymentUnallocated, refundCeiling, unlinkForRefund } from './billing'
import { SEED_CHARGES, SEED_INVOICES, SEED_PAYMENTS, SEED_REFUNDS } from './data/seedAdmin'

const records = { invoices: SEED_INVOICES, payments: SEED_PAYMENTS, refunds: SEED_REFUNDS, charges: SEED_CHARGES }

describe('invoiceTotals', () => {
  it('keeps exempt services separate from taxable consumables and splits GST', () => {
    const totals = invoiceTotals([
      { qty: 1, price: 1500, discountPct: 0, gstPct: 0 },
      { qty: 1, price: 3500, discountPct: 0, gstPct: 0 },
      { qty: 1, price: 450, discountPct: 10, gstPct: 12 },
    ])

    expect(totals.gross).toBe(5450)
    expect(totals.discount).toBe(45)
    expect(totals.exemptBase).toBe(5000)
    expect(totals.taxableBase).toBe(405)
    expect(totals.cgst).toBe(24.3)
    expect(totals.sgst).toBe(24.3)
    expect(totals.total).toBe(5453.6)
  })

  it('returns zeros for an empty invoice', () => {
    expect(invoiceTotals([]).total).toBe(0)
  })
})

describe('invoice balances', () => {
  it('derives balance and status from allocations', () => {
    const [partial, paid] = SEED_INVOICES
    expect(invoiceBalance(partial, SEED_PAYMENTS)).toBe(3500)
    expect(invoiceStatus(partial, SEED_PAYMENTS)).toBe('Partially Paid')
    expect(invoiceStatus(paid, SEED_PAYMENTS)).toBe('Paid in Full')
  })

  it('reports an invoice with no allocations as issued', () => {
    expect(invoiceStatus(SEED_INVOICES[0], [])).toBe('Issued')
  })
})

describe('payment credit', () => {
  it('treats the unallocated remainder as vault credit and ignores refunded money', () => {
    expect(paymentUnallocated(SEED_PAYMENTS[0], SEED_REFUNDS)).toBe(2000)
    const refundedPayment = SEED_PAYMENTS.find((payment) => payment.id === 'PAY-2026-064')
    expect(paymentUnallocated(refundedPayment, SEED_REFUNDS)).toBe(0)
  })
})

describe('ledgerSummary', () => {
  it('matches the figures shown on the billing header', () => {
    const summary = ledgerSummary(records)
    expect(summary.outstanding).toBe(3500)
    expect(summary.unallocated).toBe(2000)
    expect(summary.invoiced).toBe(62500)
    expect(summary.refunded).toBe(1500)
    expect(summary.nextDue).toBe('2026-10-13')
  })
})

describe('allocation', () => {
  it('rejects amounts that are not positive or exceed the credit or the balance', () => {
    expect(allocationError({ amount: 0, available: 2000, balance: 3500 })).toMatch(/greater than zero/)
    expect(allocationError({ amount: 2500, available: 2000, balance: 3500 })).toMatch(/credit/)
    expect(allocationError({ amount: 2000, available: 5000, balance: 1500 })).toMatch(/balance/)
    expect(allocationError({ amount: 2000, available: 2000, balance: 3500 })).toBeNull()
  })

  it('adds to an existing allocation or creates a new one', () => {
    const payment = { allocations: [{ invoiceId: 'A', amount: 100 }] }
    expect(applyAllocation(payment, 'A', 50).allocations).toEqual([{ invoiceId: 'A', amount: 150 }])
    expect(applyAllocation(payment, 'B', 25).allocations).toHaveLength(2)
  })

  it('fills open invoices in order until the amount runs out', () => {
    expect(autoAllocate(4000, [{ invoiceId: 'A', balance: 3500 }, { invoiceId: 'B', balance: 2800 }])).toEqual([
      { invoiceId: 'A', amount: 3500 },
      { invoiceId: 'B', amount: 500 },
    ])
  })
})

describe('buildLedger', () => {
  it('lists newest records first and tags each kind', () => {
    const rows = buildLedger(records)
    expect(rows[0].id).toBe('PAY-2026-112')
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(['invoice', 'payment', 'charge', 'refund']))
    expect(rows.find((row) => row.id === 'PAY-2026-112').status).toBe('Partial Alloc')
    expect(rows.find((row) => row.id === 'PAY-2026-064').status).toBe('Refunded')
  })
})

describe('refunds', () => {
  const payment = SEED_PAYMENTS[0]

  it('limits a refund to what was received less earlier refunds', () => {
    expect(refundCeiling(payment, [])).toBe(7000)
    expect(refundCeiling(payment, [{ paymentId: payment.id, amount: 1000 }])).toBe(6000)
  })

  it('draws on the unallocated credit before touching allocations', () => {
    expect(unlinkForRefund(payment, [], 1500)).toEqual(payment.allocations)
  })

  it('unlinks the newest allocation when the credit is not enough', () => {
    expect(unlinkForRefund(payment, [], 3000)).toEqual([{ invoiceId: 'INV-2026-084', amount: 4000 }])
    expect(unlinkForRefund(payment, [], 7000)).toEqual([])
  })
})
