import { describe, expect, it } from 'vitest'
import { billingViews } from '../../test/fixtures/billingViews'
import { DATE_RANGES } from './constants'
import { allPayments, allRefunds, canResolve, chargeRequest, chargeRows, chargeSetupIssues, draftBreakdown, patientBalances, paymentRows, receiptRows, reconRows, reconSummary, refundBalance, refundSummary, reportFigures, validateCharge, validatePayment, validateRefund } from './financeLogic'

const ledger = billingViews()
const { records, services } = ledger
const range = DATE_RANGES[0]
const name = () => 'Ananya Sharma'
const refunds = allRefunds(records, ledger.refundRequests)
const payment = (id) => allPayments(records).find((entry) => entry.id === id)

describe('refund balance', () => {
  it('keeps allocations protected and reserves pending requests', () => {
    expect(refundBalance(payment('PAY-2026-112'), refunds)).toEqual({ received: 7000, allocated: 5000, processed: 500, reserved: 1500, eligible: 1500, remaining: 0, refundable: 5000 })
  })

  it('releases the hold of failed and rejected requests, but not of approved ones', () => {
    expect(refundBalance(payment('PAY-2026-119'), refunds).remaining).toBe(800)
    expect(refundBalance(payment('PAY-2026-115'), refunds).remaining).toBe(1200)
    expect(refundBalance(payment('PAY-2026-117'), refunds).remaining).toBe(0)
  })

  it('counts a processed refund as money returned', () => {
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
  const books = { lines: ledger.statementLines, exceptions: ledger.exceptions, payments: records.payments }

  it('compares statement lines with recorded payments, treating a missing record as zero', () => {
    expect(reconSummary(reconRows(books))).toMatchObject({ source: 12150, clinicos: 10200, net: 1950, matched: 1, unmatched: 3, matchedAmount: 7000, exceptions: 2, candidates: 1, linked: 3 })
  })

  it('drops an exception from the open count once its line is resolved', () => {
    const resolved = { ...books, lines: books.lines.map((line) => (line.reference === 'UPI-117' ? { ...line, state: 'Resolved' } : line)) }
    expect(reconSummary(reconRows(resolved)).exceptions).toBe(1)
  })

  it('filters by source and by matched state', () => {
    expect(reconRows(books, { source: 'Bank' })).toHaveLength(1)
    expect(reconRows(books, { state: 'Unmatched' })).toHaveLength(3)
  })

  it('only allows resolving with evidence, a note of at least 10 characters and confirmation', () => {
    expect(canResolve({ evidenceAttached: true, confirmed: true, note: 'Gateway fee of ₹50' })).toBe(true)
    expect(canResolve({ evidenceAttached: false, confirmed: true, note: 'Gateway fee of ₹50' })).toBe(false)
    expect(canResolve({ evidenceAttached: true, confirmed: false, note: 'Gateway fee of ₹50' })).toBe(false)
    expect(canResolve({ evidenceAttached: true, confirmed: true, note: 'Fee' })).toBe(false)
  })
})

describe('balances', () => {
  it('holds prepaid funds apart from the invoice amount owed', () => {
    const balances = patientBalances(records, refunds, 'pt-000184')
    expect(balances).toMatchObject({ held: 1500, reserve: 1500, spendable: 0, used: 5000, owed: 3500 })
    expect(balances.slice.map((entry) => entry.payment.id)).toEqual(['PAY-2026-112'])
    expect(balances.history.map((item) => item.id)).toEqual(expect.arrayContaining(['PAY-2026-112', 'REF-2026-018', 'REF-2026-017', 'ALC-1121']))
  })
})

describe('finance reports', () => {
  it('keeps collections, outstanding and refunds as separate coverage sets', () => {
    const figures = reportFigures(records, refunds, { from: '2026-09-01', to: '2026-10-31' })
    expect(figures.collections).toEqual({ amount: 7000 + 6500 + 2500 + 1500 + 2400 + 800 + 1200, count: 7 })
    expect(figures.outstanding).toMatchObject({ amount: 3500, count: 1 })
    expect(figures.refunds).toMatchObject({ amount: 2000, count: 2 })
  })
})

describe('charges, payments and receipts', () => {
  it('lists charges by status and flags a service that cannot be confirmed', () => {
    expect(chargeRows(records, { range, patientName: name }).map((charge) => charge.id)).toEqual(['CHG-2026-321', 'CHG-2026-320', 'CHG-2026-319'])
    expect(chargeRows(records, { invoice: 'Invoiced', range, patientName: name })).toHaveLength(1)
    expect(chargeSetupIssues(services.find((service) => service.code === 'SRV-CARD-01'))).toEqual([])
    expect(chargeSetupIssues(services.find((service) => service.code === 'SRV-CARD-02'))).toEqual(['Tax treatment missing'])
    expect(chargeSetupIssues(undefined)).toEqual(['Select a service or item'])
  })

  it('prices a draft at the branch and sends only what the API needs', () => {
    const consult = services.find((service) => service.code === 'SRV-GMED-01')
    expect(draftBreakdown(consult, 2, 10, 'b-kondapur')).toMatchObject({ gross: 900, discount: 90, total: 810 })
    expect(draftBreakdown(consult, 1, 0, 'b-main').total).toBe(500)
    expect(chargeRequest({ serviceId: 'srv-gmed-01', encounterId: '', payer: 'Patient Direct (Self)', model: 'Hybrid', qty: '2', discountPct: '10', note: ' Follow-up ' }, true))
      .toEqual({ serviceId: 'srv-gmed-01', encounterId: null, payer: 'Patient Direct (Self)', model: 'Hybrid', quantity: 2, discountPct: 10, note: 'Follow-up', confirm: true })
  })

  it('validates a charge draft', () => {
    expect(validateCharge({ patientId: '', serviceId: '', qty: '0' })).toMatchObject({ patientId: expect.any(String), serviceId: expect.any(String), qty: expect.any(String) })
    expect(validateCharge({ patientId: 'pt-000184', serviceId: 'srv-card-01', qty: '1' })).toEqual({})
  })

  it('marks payments by allocation and filters by method', () => {
    const rows = paymentRows(records, { range, patientName: name })
    expect(rows.find((row) => row.payment.id === 'PAY-2026-112')).toMatchObject({ allocated: 5000, unallocated: 1500, allocation: 'Partially allocated' })
    expect(paymentRows(records, { method: 'Cash Desk', range, patientName: name }).map((row) => row.payment.id)).toEqual(['PAY-2026-077'])
  })

  it('requires a reference for every method except cash, a positive amount and an enabled method', () => {
    expect(validatePayment({ patientId: 'p', amount: '500', channel: 'UPI / QR', reference: '' }).reference).toBeDefined()
    expect(validatePayment({ patientId: 'p', amount: '500', channel: 'Cash Desk', reference: '' })).toEqual({})
    expect(validatePayment({ patientId: 'p', amount: '0', channel: 'Cash Desk', reference: '' }).amount).toBeDefined()
    expect(validatePayment({ patientId: 'p', amount: '4000', channel: 'Cash Desk', reference: '', purpose: 'charges', invoiceId: 'INV-1', outstanding: 3500 }).amount).toMatch('outstanding')
    expect(validatePayment({ patientId: 'p', amount: '1000', channel: 'Cash Desk', reference: '', purpose: 'charges', invoiceId: 'INV-1', outstanding: 3500, fullPayment: true }).amount).toMatch('full outstanding')
    expect(validatePayment({ patientId: 'p', amount: '500', channel: 'Cash Desk', reference: '', enabled: () => false }).channel).toMatch('switched off')
  })

  it('lists one receipt per payment, newest first', () => {
    const rows = receiptRows(records, { patientName: name })
    expect(rows).toHaveLength(records.payments.length)
    expect(receiptRows(records, { query: 'REC-2026-091', patientName: name }).map((row) => row.payment.id)).toEqual(['PAY-2026-112'])
  })
})
