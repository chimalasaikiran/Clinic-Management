import { describe, expect, it } from 'vitest'
import { SEED_CHARGES, SEED_INVOICES, SEED_PAYMENTS, SEED_REFUNDS } from '../patients/data/seedAdmin'
import { DATE_RANGES } from './constants'
import { SEED_SERVICES } from './data/seedServices'
import { billingOverview, invoiceRows, priorityQueue, recentActivity } from './registerLogic'
import { activationBlockers, blankService, buildService, effectivePrice, formFromService, validateService } from './serviceLogic'

const books = { invoices: SEED_INVOICES, payments: SEED_PAYMENTS, refunds: SEED_REFUNDS, charges: SEED_CHARGES }
const range = DATE_RANGES[0]
const name = () => 'Ananya Sharma'

describe('billing overview', () => {
  it('totals collections net of refunds and outstanding balances from the records', () => {
    const overview = billingOverview(books, range)
    expect(overview.outstanding).toBe(3500)
    expect(overview.collections).toBe(2500 + 6500 + 7000 + 1500 - 1500)
    expect(overview.unallocated).toBe(2000)
  })

  it('queues the open invoice and the payment credit that still needs allocating', () => {
    const queue = priorityQueue(books, range, name)
    expect(queue.map((row) => [row.kind, row.id, row.amount])).toEqual([['invoice', 'INV-2026-084', 3500], ['payment', 'PAY-2026-112', 2000]])
  })

  it('lists recent activity newest first and honours the date range', () => {
    const activity = recentActivity(books, range, name)
    expect(activity[0].id).toBe('PAY-2026-112')
    expect(recentActivity(books, { from: '2026-10-01', to: '2026-10-31' }, name).every((row) => row.date.startsWith('2026-10'))).toBe(true)
  })
})

describe('invoice register', () => {
  it('derives status, paid amount and balance, and filters by status and search', () => {
    const all = invoiceRows(books, range, { patientName: name })
    expect(all[0]).toMatchObject({ status: 'Partially Paid', total: 8500, paid: 5000, balance: 3500 })
    expect(invoiceRows(books, range, { status: 'Paid in Full', patientName: name }).every((row) => row.balance === 0)).toBe(true)
    expect(invoiceRows(books, range, { query: 'inv-2026-071', patientName: name })).toHaveLength(1)
  })
})

describe('services', () => {
  const services = SEED_SERVICES
  const filled = (extra = {}) => ({ ...blankService(), name: 'Holter Monitoring', code: 'SRV-CARD-09', category: 'Diagnostic & Lab', price: '1500', tax: 'Exempt', taxConfig: 'Healthcare services — Exempt', status: 'Active', ...extra, branches: { ...blankService().branches, main: { offered: true, mode: 'default', price: '' } } })

  it('needs a name, a unique code, a category and a valid default price', () => {
    const errors = validateService({ ...blankService(), code: 'srv-card-01', price: '-5' }, services)
    expect(Object.keys(errors)).toEqual(['name', 'code', 'category', 'price'])
    expect(validateService({ ...blankService(), name: 'Free camp', code: 'SRV-X', category: 'Consultation', price: '0' }, services)).toEqual({})
  })

  it('will not activate a service without a tax decision or a location', () => {
    expect(validateService(filled({ tax: 'Not configured', taxConfig: '' }), services).tax).toMatch(/before activating/)
    expect(validateService({ ...filled(), branches: blankService().branches }, services).branches).toMatch(/at least one location/)
  })

  it('requires an organization tax configuration for exempt and taxable services', () => {
    expect(validateService(filled({ taxConfig: '' }), services).taxConfig).toBeTruthy()
    expect(validateService(filled({ tax: 'No tax / Not applicable', taxConfig: '' }), services)).toEqual({})
  })

  it('checks custom branch overrides', () => {
    const values = filled()
    values.branches.main = { offered: true, mode: 'custom', price: '' }
    expect(validateService(values, services).branches).toMatch(/Main Clinic \(HQ\) override/)
  })

  it('lets an existing service keep its own code when edited', () => {
    expect(validateService(formFromService(services[0]), services, services[0].id)).toEqual({})
  })

  it('builds the service with default and custom branch prices', () => {
    const values = filled()
    values.branches.kondapur = { offered: true, mode: 'custom', price: '1200' }
    const built = buildService(values, { stamp: 'now' })
    expect(built).toMatchObject({ id: 'srv-card-09', price: 1500 })
    expect(effectivePrice(built, 'main')).toBe(1500)
    expect(effectivePrice(built, 'kondapur')).toBe(1200)
    expect(effectivePrice(built, 'banjara')).toBeNull()
  })

  it('blocks reactivating a service that is still incomplete', () => {
    expect(activationBlockers(services.find((entry) => entry.code === 'SRV-DIAG-14'))).toEqual(['Choose a tax treatment', 'Select at least one location'])
    expect(activationBlockers(services[0])).toEqual([])
  })
})
