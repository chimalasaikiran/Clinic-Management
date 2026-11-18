// Today's worklist as the API returns it: one arrived walk-in with an allergy alert, one in consultation.
export const WORKLIST = {
  date: '2026-11-16',
  me: { practitionerId: 'dr-1' },
  appointments: [
    { id: 'a-1', reference: 'APT-000001', status: 'arrived', time: '09:00', queueToken: 'A-01', arrivedAt: '08:50', reason: 'Knee pain', waitingQueue: false, patient: { id: 'pt-000184', fullName: 'Ananya Sharma', mrn: 'PT-000184' }, practitioner: { id: 'dr-1', displayName: 'Dr. Rahul Mehta', department: 'Rehabilitation', room: 'Chamber 104' }, encounter: null },
    { id: 'a-2', reference: 'APT-000002', status: 'in_progress', time: '09:30', queueToken: 'A-02', arrivedAt: '09:20', reason: 'Back pain', waitingQueue: false, patient: { id: 'pt-000219', fullName: 'Rajesh Sundaram', mrn: 'PT-000219' }, practitioner: { id: 'dr-2', displayName: 'Dr. Ananya Rao', department: 'Cardiology', room: 'Chamber 102' }, encounter: { id: 'enc-9', reference: 'ENC-000009', status: 'in_progress' } },
    { id: 'a-3', reference: 'APT-000003', status: 'cancelled', time: '10:00', queueToken: null, arrivedAt: null, reason: 'Review', waitingQueue: false, patient: { id: 'pt-000305', fullName: 'Priya Venkataraman', mrn: 'PT-000305' }, practitioner: { id: 'dr-1', displayName: 'Dr. Rahul Mehta', department: 'Rehabilitation', room: 'Chamber 104' }, encounter: null },
  ],
  openEncounters: [{ id: 'enc-9' }],
  alerts: [{ id: 'alt-1', patientId: 'pt-000184', kind: 'ALLERGY: PENICILLIN', title: 'Penicillin allergy — Anaphylaxis', severity: 'critical', status: 'active', detail: 'Severe reaction recorded.', patient: { id: 'pt-000184', fullName: 'Ananya Sharma', mrn: 'PT-000184' } }],
}
