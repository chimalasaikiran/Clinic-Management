import { describe, expect, it } from 'vitest'
import { SEED_CHARGES, SEED_INVOICES, SEED_PAYMENTS, SEED_REFUNDS } from '../patients/data/seedAdmin'
import { DATE_RANGES } from './constants'
import { SEED_EXCEPTIONS, SEED_REFUND_REQUESTS } from './data/financeSeed'
import { SEED_SERVICES } from './data/seedServices'
import { allPayments, allRefunds, canResolve, chargeRows, chargeSetupIssues, patientBalances, paymentRows, receiptRows, reconRows, reconSummary, refundBalance, refundSummary, reportFigures, validateCharge, validatePayment, validateRefund } from './financeLogic'

const records = { invoices: SEED_INVOICES, payments: SEED_PAYMENTS, refunds: SEED_REFUNDS, charges: SEED_CHARGES }
const range = DATE_RANGES[0]
const name = () => 'Ananya Sharma'
const refunds = allRefunds(records, SEED_REFUND_REQUESTS)
const payment = (id) => allPayments(records).find((entry) => entry.id === id)

describe('refund balance', () => {
  it('keeps allocations protected and reserves pending requests', () => {
    expect(refundBalance(payment('PAY-2026-112'), refunds)).toEqual({ received: 7000, allocated: 5000, processed: 500, reserved: 1500, eligible: 1500, remaining: 0 })
  })

  it('does not reserve funds for failed or rejected requests', () => {
    expect(refundBalance(payment('PAY-2026-119'), refunds).remaining).toBe(800)
    expect(refundBalance(payment('PAY-2026-115'), refunds).remaining).toBe(1200)
  })

  it('treats refunds already processed with the patient records as processed', () => {
    expect(refundBalance(payment('PAY-2026-064'), refunds)).toMatchObject({ processed: 1500, remaining: 0 })
  })

  it('rejects an amount above the remaining balance and names the excess', () => {
    expect(validateRefund({ paymentId: 'PAY-2026-119', amount: '900', reference: 'RF-1' }, 800).amount).toMatch('Exceeds ₹800 remaining by ₹100')
    expect(validateRefund({ paymentId: 'PAY-2026-119', amount: '800', reference: 'RF-1' }, 800)).toEqual({})
    expect(validateRefund({ paymentId: '', amount: '', reference: '' }, 800)).toMatchObject({ paymentId: expect.any(String), amount: expect.any(String), reference: expect.any(String) })
  })

  it('summarises the register by status', () => {
    const summary = refundSummary(refunds)
    expect(summary.Processed).toEqual({ count: 2, amount: 2000 })
    expect(summary.Pending).toEqual({ count: 1, amount: 1500 })
    expect(summary.Approved.amount).toBe(2400)
    expect(summary.Failed.amount).toBe(800)
    expect(summary.Rejected.amount).toBe(1200)
  })
})

describe('reconciliation', () => {
  const summary = reconSummary(reconRows(SEED_EXCEPTIONS))

  it('compares source lines with ClinicOS payments, treating a missing record as zero', () => {
    expect(summary).toMatchObject({ source: 25250, clinicos: 23500, net: 1750, matched: 3, unmatched: 3, matchedAmount: 16700, exceptions: 2, candidates: 1, linked: 5 })
  })

  it('drops an exception from the open count once it is resolved', () => {
    const resolved = SEED_EXCEPTIONS.map((entry) => (entry.id === 'EXC-2026-042' ? { ...entry, status: 'Resolved' } : entry))
    expect(reconSummary(reconRows(resolved)).exceptions).toBe(1)
  })

  it('filters by source and by matched state', () => {
    expect(reconRows(SEED_EXCEPTIONS, { source: 'HDFC Bank' })).toHaveLength(2)
    expect(reconRows(SEED_EXCEPTIONS, { state: 'Unmatched' })).toHaveLength(3)
  })

  it('only allows resolving with evidence, a note and confirmation', () => {
    expect(canResolve({ evidenceAttached: true, confirmed: true, note: 'Fee breakdown' })).toBe(true)
    expect(canResolve({ evidenceAttached: false, confirmed: true, note: 'Fee breakdown' })).toBe(false)
    expect(canResolve({ evidenceAttached: true, confirmed: false, note: 'Fee breakdown' })).toBe(false)
    expect(canResolve({ evidenceAttached: true, confirmed: true, note: '  ' })).toBe(false)
  })
})

describe('balances', () => {
  it('holds prepaid funds apart from the invoice amount owed', () => {
    const balances = patientBalances(records, refunds, 'pt-000184')
    expect(balances).toMatchObject({ held: 1500, reserve: 1500, spendable: 0, used: 5000, owed: 3500 })
    expect(balances.slice.map((entry) => entry.payment.id)).toEqual(['PAY-2026-112'])
    expect(balances.history.map((item) => item.id)).toEqual(expect.arrayContaining(['PAY-2026-112', 'REF-2026-018', 'REF-2026-017', 'ALC-88194']))
  })
})

describe('finance reports', () => {
  it('keeps collections, outstanding and refunds as separate coverage sets', () => {
    const figures = reportFigures(records, refunds, range)
    expect(figures.collections).toEqual({ amount: 17500, count: 4 })
    expect(figures.outstanding).toMatchObject({ amount: 3500, count: 1 })
    expect(figures.refunds).toMatchObject({ amount: 2000, count: 2 })
  })
})

describe('charges, payments and receipts', () => {
  it('lists charges by status and flags a service that cannot be confirmed', () => {
    expect(chargeRows(records, { range, patientName: name }).map((charge) => charge.id)).toEqual(['CHG-2026-321', 'CHG-2026-320', 'CHG-2026-319'])
    expect(chargeRows(records, { invoice: 'Invoiced', range, patientName: name })).toHaveLength(1)
    expect(chargeSetupIssues(SEED_SERVICES.find((service) => service.code === 'SRV-CARD-01'))).toEqual([])
    expect(chargeSetupIssues(SEED_SERVICES.find((service) => service.code === 'SRV-CARD-02'))).toEqual(['Tax treatment missing'])
    expect(chargeSetupIssues(undefined)).toEqual(['Select a service or item'])
  })

  it('validates a charge draft', () => {
    expect(validateCharge({ patientId: '', serviceCode: '', qty: '0' })).toMatchObject({ patientId: expect.any(String), serviceCode: expect.any(String), qty: expect.any(String) })
    expect(validateCharge({ patientId: 'pt-000184', serviceCode: 'SRV-CARD-01', qty: '1' })).toEqual({})
  })

  it('marks payments by allocation and filters by method', () => {
    const rows = paymentRows(records, { range, patientName: name })
    expect(rows.find((row) => row.payment.id === 'PAY-2026-112')).toMatchObject({ allocated: 5000, unallocated: 2000, allocation: 'Partially allocated' })
    expect(paymentRows(records, { method: 'Cash Desk', range, patientName: name }).map((row) => row.payment.id)).toEqual(['PAY-2026-077'])
  })

  it('requires a reference for every method except cash, and a positive amount', () => {
    expect(validatePayment({ patientId: 'p', amount: '500', channel: 'UPI / QR', reference: '' }).reference).toBeDefined()
    expect(validatePayment({ patientId: 'p', amount: '500', channel: 'Cash Desk', reference: '' })).toEqual({})
    expect(validatePayment({ patientId: 'p', amount: '0', channel: 'Cash Desk', reference: '' }).amount).toBeDefined()
    expect(validatePayment({ patientId: 'p', amount: '4000', channel: 'Cash Desk', reference: '', purpose: 'charges', invoiceId: 'INV-1', outstanding: 3500 }).amount).toMatch('outstanding')
  })

  it('flags receipts whose source amounts conflict', () => {
    const rows = receiptRows(records, { patientName: name })
    expect(rows.find((row) => row.receiptId === 'REC-2026-091').conflict).toBe(true)
    expect(receiptRows(records, { status: 'conflict', patientName: name }).map((row) => row.receiptId)).toEqual(['REC-2026-091'])
  })
})
