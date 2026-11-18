// An in-memory stand-in for the owner reports API (backend/src/modules/reports), for page tests. It returns the
// Operations report in the API's shape for whatever period is asked, and records each request in `calls`. The
// real measures are tested in backend/test/unit/reports.test.ts and against the database in
// backend/test/integration/reports.test.ts.

export function operationsReportFixture({ from = '2026-10-01', to = '2026-10-28' } = {}) {
  const window = (start, end, completed, cancelled, noShow, open) => ({ from: start, to: end, days: 7, completed, cancelled, noShow, open })
  return {
    from, to, scheduled: 200, completed: 150, cancelled: 20, noShow: 10, open: 20, rescheduled: 12,
    windows: [
      window('2026-10-01', '2026-10-07', 37, 5, 3, 5), window('2026-10-08', '2026-10-14', 38, 4, 2, 6),
      window('2026-10-15', '2026-10-21', 36, 6, 3, 5), window('2026-10-22', '2026-10-28', 39, 5, 2, 4),
    ],
    wait: { pairs: 120, minutes: 1800, meanMinutes: 15 },
    rebooking: { mature: 24, replaced: 12, immature: 6 },
    doctors: [
      { id: 'dr-1', name: 'Dr. Rahul Mehta', consultMinutes: 3600, availableMinutes: 4800 },
      { id: 'dr-2', name: 'Dr. Priya Nair', consultMinutes: 3600, availableMinutes: 4800 },
    ],
    services: [{ name: 'Consultation', count: 90 }, { name: 'Follow-up', count: 60 }],
    branches: [{ id: 'b-main', name: 'Main Clinic' }, { id: 'b-west', name: 'West Wing' }],
    branchId: null,
  }
}

export function createReportsApi(report = operationsReportFixture) {
  const calls = []
  return {
    calls,
    api: {
      async operations(query) {
        calls.push({ name: 'operations', query })
        return { ...report(query), branchId: query.branchId ?? null }
      },
    },
  }
}
