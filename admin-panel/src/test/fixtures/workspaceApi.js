import { API_BRANCHES } from './patientsApi'

// An in-memory stand-in for what the header and sidebar read: branches, open items for the alerts, the search and
// the readiness check. It records each request in `calls`. The real figures are tested in
// backend/test/integration/workspace.test.ts.

export const alertsFixture = () => ({
  generatedAt: '2026-11-18T09:30:00.000Z',
  branchId: null,
  items: [{ id: 'waiting', count: 2 }, { id: 'results', count: 4, urgent: 1 }, { id: 'attendance', count: 1 }],
})

export const searchFixture = (q) => ({
  query: q,
  patients: [{ id: 'p-1', mrn: 'PT-000001', fullName: 'Ananya Sharma', mobile: '9845211029', status: 'active' }],
  appointments: [{ id: 'a-1', reference: 'APT-000120', date: '2026-11-18', time: '11:00', status: 'confirmed', patientId: 'p-1', patient: 'Ananya Sharma', mrn: 'PT-000001', practitioner: 'Dr. Rahul Mehta', branch: 'Main Clinic' }],
  invoices: [{ reference: 'INV-000007', date: '2026-11-17', title: 'Physiotherapy session', total: 1200, patient: 'Ananya Sharma', mrn: 'PT-000001' }],
})

export function createWorkspaceApi({ branches = API_BRANCHES, alerts = alertsFixture, search = searchFixture, healthy = true, notices = [], stream = () => null } = {}) {
  const calls = []
  let inbox = notices
  return {
    calls,
    api: {
      stream,
      async notifications() {
        calls.push({ name: 'notifications' })
        return { data: inbox, meta: { unread: inbox.filter((item) => !item.readAt).length, nextCursor: null } }
      },
      async markNotificationsRead(body) {
        calls.push({ name: 'markNotificationsRead', body })
        inbox = inbox.map((item) => ({ ...item, readAt: item.readAt ?? '2026-11-18T09:31:00.000Z' }))
        return { marked: inbox.length }
      },
      async branches() {
        calls.push({ name: 'branches' })
        return branches
      },
      async alerts(query = {}) {
        calls.push({ name: 'alerts', query })
        return alerts(query)
      },
      async search(q) {
        calls.push({ name: 'search', q })
        return search(q)
      },
      async health() {
        calls.push({ name: 'health' })
        if (!healthy) throw new Error('Database unavailable')
        return undefined
      },
    },
  }
}
