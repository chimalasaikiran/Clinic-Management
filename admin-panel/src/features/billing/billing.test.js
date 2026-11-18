import { describe, expect, it } from 'vitest'
import { billingViews } from '../../test/fixtures/billingViews'
import { toServiceRequest } from './adapters'
import { DATE_RANGES, dateRanges } from './constants'
import { billingOverview, invoiceRows, priorityQueue, recentActivity } from './registerLogic'
import { activationBlockers, blankService, branchSummary, buildService, effectivePrice, formFromService, validateService } from './serviceLogic'

const { records: books, services, branches } = billingViews()
const range = DATE_RANGES[0]
const name = () => 'Ananya Sharma'

describe('date ranges', () => {
  it('works out this month, last month and the last 30 days from today', () => {
    const [all, month, lastMonth, recent] = dateRanges('2026-11-17')
    expect(all.id).toBe('all')
    expect(month).toMatchObject({ from: '2026-11-01', to: '2026-11-30', label: 'November 2026' })
    expect(lastMonth).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect(recent).toMatchObject({ from: '2026-10-19', to: '2026-11-17' })
    expect(dateRanges('2026-01-05')[2]).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
  })
})

describe('billing overview', () => {
  it('totals collections net of processed refunds and outstanding balances from the records', () => {
    const overview = billingOverview(books, range)
    const received = books.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const refunded = books.refunds.reduce((sum, refund) => sum + refund.amount, 0)
    expect(overview.collections).toBe(received - refunded)
    expect(overview.outstanding).toBe(3500)
    // PAY-2026-112 keeps ₹1,500 after allocation and a processed refund; three advances are untouched.
    expect(overview.unallocated).toBe(1500 + 2400 + 800 + 1200)
  })

  it('queues the open invoice and the payments with credit still to apply', () => {
    const queue = priorityQueue(books, range, name)
    expect(queue[0]).toMatchObject({ kind: 'invoice', id: 'INV-2026-084', amount: 3500 })
    expect(queue.filter((row) => row.kind === 'payment').map((row) => row.id)).toEqual(expect.arrayContaining(['PAY-2026-112', 'PAY-2026-117', 'PAY-2026-119', 'PAY-2026-115']))
  })

  it('lists recent activity newest first and honours the date range', () => {
    const activity = recentActivity(books, range, name)
    expect(activity.map((row) => `${row.date} ${row.time}`)).toEqual([...activity.map((row) => `${row.date} ${row.time}`)].sort().reverse())
    expect(recentActivity(books, { from: '2026-10-01', to: '2026-10-31' }, name).every((row) => row.date.startsWith('2026-10'))).toBe(true)
  })
})

describe('invoice register', () => {
  it('derives status, paid amount and balance, and filters by status and search', () => {
    const all = invoiceRows(books, range, { patientName: name })
    expect(all.find((row) => row.invoice.id === 'INV-2026-084')).toMatchObject({ status: 'Partially Paid', total: 8500, paid: 5000, balance: 3500 })
    expect(invoiceRows(books, range, { status: 'Paid in Full', patientName: name }).every((row) => row.balance === 0)).toBe(true)
    expect(invoiceRows(books, range, { query: 'inv-2026-071', patientName: name })).toHaveLength(1)
  })
})

describe('services', () => {
  const filled = (extra = {}) => {
    const base = blankService(branches)
    return { ...base, name: 'Holter Monitoring', code: 'SRV-CARD-09', category: 'Diagnostic & Lab', price: '1500', tax: 'Exempt', taxConfig: 'Healthcare services — Exempt', status: 'Active', ...extra, branches: { ...base.branches, 'b-main': { offered: true, mode: 'default', price: '' } } }
  }

  it('needs a name, a unique code, a category and a valid default price', () => {
    const errors = validateService({ ...blankService(branches), code: 'srv-card-01', price: '-5' }, services, undefined, branches)
    expect(Object.keys(errors)).toEqual(['name', 'code', 'category', 'price'])
    expect(validateService({ ...blankService(branches), name: 'Free camp', code: 'SRV-X', category: 'Consultation', price: '0' }, services, undefined, branches)).toEqual({})
  })

  it('will not activate a service without a tax decision or a location', () => {
    expect(validateService(filled({ tax: 'Not configured', taxConfig: '' }), services, undefined, branches).tax).toMatch(/before activating/)
    expect(validateService({ ...filled(), branches: blankService(branches).branches }, services, undefined, branches).branches).toMatch(/at least one location/)
  })

  it('requires an organization tax configuration for exempt and taxable services', () => {
    expect(validateService(filled({ taxConfig: '' }), services, undefined, branches).taxConfig).toBeTruthy()
    expect(validateService(filled({ tax: 'No tax / Not applicable', taxConfig: '' }), services, undefined, branches)).toEqual({})
  })

  it('checks custom branch overrides', () => {
    const values = filled()
    values.branches['b-main'] = { offered: true, mode: 'custom', price: '' }
    expect(validateService(values, services, undefined, branches).branches).toMatch(/Main Clinic \(HQ\) override/)
  })

  it('lets an existing service keep its own code when edited', () => {
    expect(validateService(formFromService(services[0], branches), services, services[0].id, branches)).toEqual({})
  })

  it('builds the service with default and custom branch prices, and the API body from it', () => {
    const values = filled()
    values.branches['b-kondapur'] = { offered: true, mode: 'custom', price: '1200' }
    const built = buildService(values, branches)
    expect(built).toMatchObject({ code: 'SRV-CARD-09', price: 1500 })
    expect(effectivePrice(built, 'b-main')).toBe(1500)
    expect(effectivePrice(built, 'b-kondapur')).toBe(1200)
    expect(effectivePrice(built, 'b-banjara')).toBeNull()
    expect(toServiceRequest(built)).toMatchObject({ status: 'active', taxTreatment: 'exempt', prices: [{ branchId: 'b-main', price: null }, { branchId: 'b-kondapur', price: 1200 }] })
  })

  it('summarises where a service is offered', () => {
    const consult = services.find((entry) => entry.code === 'SRV-GMED-01')
    expect(branchSummary(consult, branches)).toEqual(['All 3 locations', 'Custom price at Kondapur ₹450, Banjara Hills ₹450'])
  })

  it('blocks reactivating a service that is still incomplete', () => {
    expect(activationBlockers(services.find((entry) => entry.code === 'SRV-DIAG-14'))).toEqual(['Choose a tax treatment', 'Select at least one location'])
    expect(activationBlockers(services[0])).toEqual([])
  })
})
