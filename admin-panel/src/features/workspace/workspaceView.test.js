import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../config/routes'
import { API_BRANCHES } from '../../test/fixtures/patientsApi'
import { alertsFixture, searchFixture } from '../../test/fixtures/workspaceApi'
import { alertItems, healthStatus, locationOptions, permittedBranches, scopeLabel, searchGroups } from './workspaceView'

const CLOSED = { id: 'b-old', code: 'OLD', name: 'Old Clinic', status: 'inactive' }

describe('workspace view', () => {
  it('offers the active branches the role covers', () => {
    expect(permittedBranches([...API_BRANCHES, CLOSED], 'all').map((branch) => branch.id)).toEqual(['b-main', 'b-kondapur'])
    expect(permittedBranches(API_BRANCHES, ['b-kondapur']).map((branch) => branch.id)).toEqual(['b-kondapur'])
    expect(permittedBranches(null, 'all')).toEqual([])

    expect(locationOptions(API_BRANCHES, 'all').map((option) => option.label)).toEqual(['All locations (2)', 'Main Clinic', 'Kondapur Clinic'])
    expect(locationOptions(API_BRANCHES, ['b-main', 'b-kondapur'])[0].label).toBe('All my locations (2)')
    expect(locationOptions([API_BRANCHES[1]], ['b-kondapur'])).toEqual([{ value: '', label: 'Kondapur Clinic' }])

    expect(scopeLabel('all', 1)).toBe('Single Location')
    expect(scopeLabel('all', 3)).toBe('All 3 locations')
    expect(scopeLabel(['b-main'], 1)).toBe('1 location assigned')
  })

  it('words each open item and links it to where it is handled', () => {
    expect(alertItems(alertsFixture()).map((item) => [item.title, item.detail, item.to])).toEqual([
      ['2 patients waiting', 'Arrived today and not yet called in', ROUTES.appointments],
      ['4 results awaiting review', '1 marked urgent', ROUTES.clinical],
      ['1 staff member without attendance', 'Not yet marked present, late, absent or on leave today', ROUTES.staffDirectory],
    ])
    expect(alertItems({ items: [{ id: 'unknown', count: 3 }] })).toEqual([])
    expect(alertItems(null)).toEqual([])
  })

  it('groups search results and leaves out what the role cannot read', () => {
    const groups = searchGroups(searchFixture('ananya'))
    expect(groups.map((group) => group.label)).toEqual(['Patients', 'Appointments', 'Invoices'])
    expect(groups[0].items[0]).toEqual({ key: 'p-1', title: 'Ananya Sharma', detail: 'PT-000001 · 9845211029', to: '/patients/p-1' })
    expect(groups[1].items[0]).toMatchObject({ title: 'APT-000120 · Ananya Sharma', detail: '18 Nov 2026, 11:00 AM · Dr. Rahul Mehta · Confirmed', to: '/patients/p-1/appointment/a-1' })
    expect(groups[2].items[0]).toMatchObject({ title: 'INV-000007 · Ananya Sharma', detail: '17 Nov 2026 · ₹1,200 · Physiotherapy session', to: '/billing/invoices/INV-000007' })

    expect(searchGroups({ ...searchFixture('x'), appointments: null, invoices: [] }).map((group) => group.id)).toEqual(['patients'])
    expect(searchGroups(null)).toEqual([])
  })

  it('reports the backend health without inventing an uptime figure', () => {
    expect(healthStatus(null)).toEqual({ label: 'Checking…', tone: 'neutral' })
    expect(healthStatus({ ok: true, ms: 84 })).toEqual({ label: 'Operational · 84 ms', tone: 'brand' })
    expect(healthStatus({ ok: false })).toEqual({ label: 'Unavailable', tone: 'danger' })
  })
})
