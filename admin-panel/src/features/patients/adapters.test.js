import { describe, expect, it } from 'vitest'
import { apiPatient } from '../../test/fixtures/patientsApi'
import { formValuesFromPatient, patientPayload, toAppointmentView, toPatientView } from './adapters'
import { queryString } from './api'

describe('patient adapters', () => {
  it('turns an API patient into the directory and hub shape', () => {
    const view = toPatientView(apiPatient({ addressLine: 'Flat 402', area: 'Kondapur', lastVisit: { date: '2026-10-05', practitioner: 'Dr. Rahul Mehta', department: 'Rehabilitation' } }))
    expect(view).toMatchObject({
      name: 'Ananya Sharma',
      initials: 'AS',
      gender: 'Female',
      mobile: '+91 98452 11029',
      abha: 'Not linked',
      branch: 'Main Clinic',
      status: 'Active',
      lastVisit: '2026-10-05',
      lastDoctor: 'Dr. Rahul Mehta · Rehabilitation',
      address: 'Flat 402, Kondapur, Hyderabad, Telangana, 500084',
    })
  })

  it('round-trips the register form without losing fields', () => {
    const patient = apiPatient({ alias: 'Annie', email: 'ananya@example.com', emergencyName: 'Rohit Sharma', emergencyRelation: 'Spouse', emergencyPhone: '9845277102' })
    const blank = { language: 'English', intakeUnit: 'General OPD' }
    const values = formValuesFromPatient(patient, blank)
    expect(values).toMatchObject({ fullName: 'Ananya Sharma', gender: 'Female', pin: '500084', dob: '1992-04-18', branchId: 'b-main' })

    const payload = patientPayload({ ...values, mobile: '+91 98452 11029' })
    expect(payload).toMatchObject({ fullName: 'Ananya Sharma', alias: 'Annie', mobile: '9845211029', gender: 'female', pinCode: '500084', dateOfBirth: '1992-04-18', homeBranchId: 'b-main', emergencyPhone: '9845277102', notifyWhatsapp: true })
  })
})

describe('appointment adapter', () => {
  it('labels statuses and builds the history from events', () => {
    const view = toAppointmentView({
      id: 'a-1', reference: 'APT-000001', status: 'pending', type: 'follow_up', channel: 'walk_in', waitingQueue: false,
      date: '2026-11-16', time: '10:00', endTime: '10:30', durationMinutes: 30,
      patient: { id: 'p-1', mrn: 'PT-000001', fullName: 'Ananya Sharma' },
      practitioner: { id: 'dr-1', displayName: 'Dr. Rahul Mehta', credentials: 'MD', specialty: 'Physiotherapy', department: 'Rehabilitation', room: null },
      branch: { id: 'b-main', name: 'Main Clinic', city: 'Hyderabad' },
      reason: 'Back pain', internalNote: null, queueToken: null, arrivedAt: null, closedReason: null, bookedBy: 'Siddharth Verma', version: 1,
      events: [{ action: 'reschedule', from: { date: '2026-11-16', time: '09:00' }, to: { date: '2026-11-16', time: '10:00' }, reason: 'Patient requested', note: 'Later slot', actor: 'Siddharth Verma', date: '2026-11-15', time: '08:30' }],
    })
    expect(view).toMatchObject({ status: 'Pending Confirmation', type: 'Follow-up', doctor: 'Dr. Rahul Mehta, MD', room: '—', walkIn: true, patientName: 'Ananya Sharma' })
    expect(view.audit[0].text).toBe('Appointment rescheduled from 16 Nov 2026 09:00 AM to 16 Nov 2026 10:00 AM — Patient requested')
    expect(view.audit[0].by).toBe('Siddharth Verma · Later slot')
  })
})

describe('query strings', () => {
  it('keeps only meaningful parameters', () => {
    expect(queryString({ query: 'ana', status: '', page: 2, branchId: undefined, gender: null })).toBe('?query=ana&page=2')
    expect(queryString({})).toBe('')
  })
})
