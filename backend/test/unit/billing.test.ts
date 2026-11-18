import { describe, expect, it } from 'vitest'
import { createInvoiceSchema, createPaymentSchema, serviceSchema, settingsSchema } from '../../src/modules/billing/billing.schemas'
import { invoiceTotals, lineTotals, paymentPosition, toPaise } from '../../src/modules/billing/money'
import { csvRows, matchLine, parseStatement, PaymentForMatching, statementAmount, statementDate } from '../../src/modules/billing/reconciliation.logic'

const PATIENT = '01930000-0000-7000-8000-000000000001'
const SERVICE = '01930000-0000-7000-8000-000000000002'
const BRANCH = '01930000-0000-7000-8000-000000000003'

describe('money', () => {
  it('converts rupee decimals to whole paise without float drift', () => {
    expect(toPaise('1500.50')).toBe(150050)
    expect(toPaise(0.1 + 0.2)).toBe(30)
  })

  it('applies the discount before tax and rounds each step', () => {
    // ₹450 × 1, 10% off, 12% GST: 45000 − 4500 = 40500, tax 4860.
    expect(lineTotals({ quantity: 1, unitPrice: 45000, discountPct: 10, gstPct: 12 })).toEqual({ gross: 45000, discount: 4500, taxable: 40500, tax: 4860, total: 45360 })
    // ₹333.33 × 3 at 18%: tax is rounded once on the line, not per unit.
    expect(lineTotals({ quantity: 3, unitPrice: 33333, discountPct: 0, gstPct: 18 })).toMatchObject({ gross: 99999, tax: 18000, total: 117999 })
  })

  it('sums invoice lines so that total = gross − discount + tax', () => {
    const totals = invoiceTotals([
      { quantity: 1, unitPrice: 100000, discountPct: 0, gstPct: 0 },
      { quantity: 2, unitPrice: 12000, discountPct: 5, gstPct: 18 },
    ])
    expect(totals).toEqual({ gross: 124000, discount: 1200, tax: 4104, total: 126904 })
    expect(totals.total).toBe(totals.gross - totals.discount + totals.tax)
  })
})

describe('payment position', () => {
  it('holds pending and approved refunds against the free credit', () => {
    const position = paymentPosition(700000, 550000, [
      { amount: 50000, status: 'processed', releasesAllocations: false },
      { amount: 30000, status: 'pending', releasesAllocations: false },
      { amount: 20000, status: 'rejected', releasesAllocations: false },
    ])
    expect(position).toEqual({ allocated: 550000, processed: 50000, reserved: 30000, unallocated: 100000, available: 70000, refundable: 620000 })
  })

  it('counts released allocations (negative rows) back as credit', () => {
    expect(paymentPosition(100000, 100000 - 40000, []).unallocated).toBe(40000)
  })
})

describe('statement parsing', () => {
  it('splits quoted CSV fields with commas, quotes and line breaks', () => {
    expect(csvRows('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([['a', 'b, c', 'say "hi"'], ['1', 'two\nlines', '3']])
  })

  it('reads ISO and day-first dates and Indian-formatted amounts', () => {
    expect(statementDate('2026-11-17')).toBe('2026-11-17')
    expect(statementDate('17/11/2026')).toBe('2026-11-17')
    expect(statementDate('31/02/2026')).toBeNull()
    expect(statementAmount('₹1,50,000.50')).toBe(15000050)
    expect(statementAmount('-200')).toBeNull()
  })

  it('maps common header names and keeps narration', () => {
    const result = parseStatement('Txn Date,UTR,Credit,Remarks,Time\n17/11/2026,UPI-123456,"1,500",UPI from patient,14:05\n')
    expect(result.errors).toEqual([])
    expect(result.lines).toEqual([{ row: 2, date: '2026-11-17', time: '14:05', reference: 'UPI-123456', amount: 150000, narration: 'UPI from patient' }])
  })

  it('reports every unreadable row with its row number', () => {
    const result = parseStatement('date,reference,amount\nnot-a-date,R1,100\n2026-11-17,,100\n2026-11-17,R3,abc\n2026-11-17,R4,100\n2026-11-17,r4,50\n')
    expect(result.errors.map((entry) => entry.row)).toEqual([2, 3, 4, 6])
    expect(result.lines.map((line) => line.reference)).toEqual(['R4'])
  })

  it('refuses a file without the required columns', () => {
    expect(parseStatement('when,how much\n2026-11-17,100\n').errors[0]!.issue).toMatch(/date, reference, amount/)
  })
})

describe('statement matching', () => {
  const payment = (overrides: Partial<PaymentForMatching> = {}): PaymentForMatching => ({ id: 'p1', txnReference: 'UTR-998877', amount: 500000, date: '2026-11-17', cash: false, matched: false, ...overrides })
  const line = (overrides = {}) => ({ reference: 'UTR-998877', narration: '', amount: 500000, date: '2026-11-17', ...overrides })

  it('matches on the transaction reference and the amount', () => {
    expect(matchLine(line(), [payment()])).toEqual({ state: 'matched', paymentId: 'p1' })
    expect(matchLine(line({ reference: 'NEFT/77', narration: 'credit utr-998877 hdfc' }), [payment()])).toEqual({ state: 'matched', paymentId: 'p1' })
  })

  it('raises an amount mismatch but keeps the link to the payment', () => {
    const outcome = matchLine(line({ amount: 475000 }), [payment()])
    expect(outcome).toMatchObject({ state: 'exception', paymentId: 'p1', kind: 'Amount mismatch' })
  })

  it('flags a second line for an already matched payment as a duplicate', () => {
    expect(matchLine(line(), [payment({ matched: true })])).toMatchObject({ state: 'exception', kind: 'Duplicate source line' })
  })

  it('suggests a single same-day, same-amount payment for review only', () => {
    const outcome = matchLine(line({ reference: 'OTHER' }), [payment({ txnReference: null })])
    expect(outcome).toEqual({ state: 'candidate', paymentId: 'p1' })
  })

  it('never suggests cash, and gives up when several payments could fit', () => {
    expect(matchLine(line({ reference: 'OTHER' }), [payment({ txnReference: null, cash: true })])).toMatchObject({ state: 'exception', kind: 'Missing ClinicOS record', paymentId: null })
    const two = [payment({ id: 'a', txnReference: null }), payment({ id: 'b', txnReference: null })]
    expect(matchLine(line({ reference: 'OTHER' }), two)).toMatchObject({ state: 'exception', kind: 'Missing ClinicOS record' })
  })
})

describe('billing requests', () => {
  const service = { code: 'srv-1', name: 'Consultation', category: 'Consultation', status: 'active', price: 500, taxTreatment: 'exempt', taxConfig: 'Healthcare services — Exempt', prices: [{ branchId: BRANCH, price: null }] }

  it('upper-cases service codes and requires a tax decision and a location to activate', () => {
    expect(serviceSchema.parse(service).code).toBe('SRV-1')
    expect(serviceSchema.safeParse({ ...service, taxTreatment: 'not_configured', taxConfig: null }).success).toBe(false)
    expect(serviceSchema.safeParse({ ...service, prices: [] }).success).toBe(false)
    expect(serviceSchema.safeParse({ ...service, status: 'inactive', prices: [] }).success).toBe(true)
    expect(serviceSchema.safeParse({ ...service, taxTreatment: 'taxable', taxConfig: 'Healthcare services — Exempt' }).success).toBe(false)
  })

  it('needs a reference for every method but cash, and amounts in paise precision', () => {
    const base = { patientId: PATIENT, amount: 1500, channel: 'UPI / QR', payer: 'Patient Direct (Self)', purpose: 'advance' }
    expect(createPaymentSchema.safeParse(base).success).toBe(false)
    expect(createPaymentSchema.safeParse({ ...base, txnReference: 'UTR-1' }).success).toBe(true)
    expect(createPaymentSchema.safeParse({ ...base, channel: 'Cash Desk' }).success).toBe(true)
    expect(createPaymentSchema.safeParse({ ...base, channel: 'Cash Desk', amount: 10.005 }).success).toBe(false)
  })

  it('refuses an invoice due before it is issued or with nothing on it', () => {
    const base = { patientId: PATIENT, payer: 'Patient Direct (Self)', model: 'Consolidated', invoiceDate: '2026-11-17', dueDate: '2026-11-24', items: [{ serviceId: SERVICE, quantity: 1 }] }
    expect(createInvoiceSchema.safeParse(base).success).toBe(true)
    expect(createInvoiceSchema.safeParse({ ...base, dueDate: '2026-11-16' }).success).toBe(false)
    expect(createInvoiceSchema.safeParse({ ...base, items: [] }).success).toBe(false)
  })

  it('keeps at least one payment method switched on', () => {
    const settings = { billingModel: 'Hybrid', cashEnabled: false, bankEnabled: false, upiEnabled: false, advancePolicy: '', partialPolicy: '', allocationPolicy: '', invoiceDocument: '', receiptDocument: '', version: 1 }
    expect(settingsSchema.safeParse(settings).success).toBe(false)
    expect(settingsSchema.safeParse({ ...settings, cashEnabled: true }).success).toBe(true)
  })
})
