// An in-memory stand-in for the owner dashboard API (backend/src/modules/dashboard), for page tests. It answers in
// the API's shape for whichever day and branch is asked, and records each request in `calls`. The figures
// themselves are tested in backend/test/unit/dashboard.test.ts and against the database in
// backend/test/integration/dashboard.test.ts.

export const DASHBOARD_TODAY = '2026-11-18'

const session = (id, firstStart, lastEnd, counts, state) => ({ id, firstStart, lastEnd, state, total: 0, completed: 0, waiting: 0, inConsultation: 0, upcoming: 0, noShow: 0, cancelled: 0, ...counts })

export function dashboardFixture({ date = DASHBOARD_TODAY, branchId = null } = {}) {
  const branches = [
    { id: 'b-main', code: 'HQ', name: 'Main Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
    { id: 'b-kondapur', code: 'KP', name: 'Kondapur Clinic', city: 'Hyderabad', state: 'Telangana', status: 'active' },
  ]
  const locations = [
    { id: 'b-main', appointments: 14, collections: 21400, exceptions: 2 },
    { id: 'b-kondapur', appointments: 8, collections: 13600, exceptions: 1 },
  ]
  return {
    date,
    today: DASHBOARD_TODAY,
    timeZone: 'Asia/Kolkata',
    generatedAt: '2026-11-18T09:30:00.000Z',
    branchId,
    branches,
    orgWide: true,
    appointments: {
      total: 22, completed: 15, waiting: 2, inConsultation: 1, upcoming: 4, noShow: 2, cancelled: 1, noShowRate: 11.8,
      wait: { pairs: 12, meanMinutes: 9 }, notRebooked: 1,
      sessions: [
        session('morning', 540, 810, { total: 12, completed: 10, noShow: 2 }, 'finished'),
        session('afternoon', 870, 1140, { total: 10, completed: 5, waiting: 2, inConsultation: 1, upcoming: 4, cancelled: 1 }, 'in_progress'),
      ],
    },
    collections: { amount: 35000, count: 14, digitalShare: 88, previous: { date: '2026-11-11', amount: 30000 }, change: 16.7 },
    refunds: { processed: 1, amount: 2400, pending: 1 },
    outstanding: { amount: 18200, count: 6, patient: 3, insurance: 2, corporate: 1 },
    reconciliation: { candidates: 2, exceptions: 1 },
    orders: { awaitingReview: 4, urgent: 1, flagged: 2 },
    lowStock: { count: 1, items: [{ itemId: 'amox', name: 'Amoxicillin 500mg', location: 'Central store', available: 40, level: 100 }] },
    approvals: { attendanceUnmarked: 2, payrollAdjustments: 1, advances: 0 },
    team: { total: 18, present: 14, late: 1, leave: 2, absent: 0, notMarked: 2, doctorsOnDuty: 5, staffOnDuty: 9 },
    locations: branchId ? locations.filter((row) => row.id === branchId) : locations,
    activity: [
      { id: '41', action: 'billing.payment.recorded', at: '2026-11-18T09:20:00.000Z', actor: 'Kavya Menon', subject: 'Rohit Mehta', practitioner: null, startsAt: null, details: { amount: 2500, channel: 'UPI / QR' } },
      { id: '40', action: 'appointment.booked', at: '2026-11-18T09:06:00.000Z', actor: 'Kavya Menon', subject: 'Ananya Sharma', practitioner: 'Dr. Rahul Mehta', startsAt: '2026-11-18T11:00:00.000Z', details: { reference: 'APT-000120' } },
      { id: '39', action: 'staff.attendance_recorded', at: '2026-11-18T08:10:00.000Z', actor: 'Siddharth Verma', subject: 'Dr. Rahul Mehta', practitioner: null, startsAt: null, details: { date: DASHBOARD_TODAY, status: 'present' } },
    ],
    setup: [
      { id: 'organisation', done: true }, { id: 'branches', done: true }, { id: 'services', done: true }, { id: 'staff', done: true },
      { id: 'schedules', done: false }, { id: 'billing', done: true }, { id: 'pharmacy', done: false }, { id: 'payroll', done: false },
    ],
  }
}

export function createDashboardApi(build = dashboardFixture) {
  const calls = []
  return {
    calls,
    api: {
      async overview(query = {}) {
        calls.push({ name: 'overview', query })
        return build({ date: query.date ?? DASHBOARD_TODAY, branchId: query.branchId ?? null })
      },
    },
  }
}
