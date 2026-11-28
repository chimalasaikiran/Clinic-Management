// An answer in the shape of GET /v1/dashboard/day for page tests. What each role may receive is enforced and
// tested on the server (backend/test/integration/role-dashboards.test.ts).

const patient = (id, fullName, mrn) => ({ id, fullName, mrn, gender: 'female', dateOfBirth: '1990-05-02' })
const doctor = { id: 'doc-1', displayName: 'Dr. Aditi Rao', department: 'Internal Medicine', room: 'Chamber 101' }

const visit = (id, status, time, who, extra = {}) => ({
  id, reference: `APT-${id}`, status, type: 'consultation', time, durationMinutes: 30, token: null, waitingQueue: false, arrivedAt: null, arrivedTime: null,
  reason: 'Follow-up', patient: who, practitioner: doctor, branch: { id: 'b-main', name: 'Main Clinic' }, ...extra,
})

const list = (items = []) => ({ total: items.length, items })

export function dayFixture({ clinical = true, empty = false } = {}) {
  const waiting = patient('p-1', 'Kavya Nair', 'PT-000001')
  const rows = empty ? [] : [
    visit('1', 'arrived', '10:00', waiting, { token: 'A-01', arrivedAt: '2026-11-18T04:18:00.000Z', arrivedTime: '09:48' }),
    visit('2', 'confirmed', '10:30', patient('p-2', 'Nisha Patil', 'PT-000002')),
    visit('3', 'pending', '11:00', patient('p-3', 'Farhan Ali', 'PT-000003')),
  ]
  return {
    date: '2026-11-18',
    today: '2026-11-18',
    timeZone: 'Asia/Kolkata',
    generatedAt: '2026-11-18T04:28:00.000Z',
    me: { practitionerId: 'doc-1' },
    branches: [{ id: 'b-main', name: 'Main Clinic', city: 'Hyderabad' }],
    appointments: clinical ? rows.map((row) => ({ ...row, encounter: null, vitals: null, allergies: [] })) : rows,
    events: empty ? [] : [{ id: 'e-1', action: 'checkIn', time: '09:48', actor: 'Kavya Menon', appointmentId: '1', token: 'A-01', patient: { id: 'p-1', fullName: 'Kavya Nair' } }],
    clinical: clinical
      ? {
          alerts: list(), results: list(), unsigned: list(), carePlans: list(),
          specimens: list(empty ? [] : [{ id: 'ord-1', title: 'Fasting glucose', urgent: false, resultFlag: null, resultSummary: null, patient: waiting }]),
        }
      : null,
  }
}
