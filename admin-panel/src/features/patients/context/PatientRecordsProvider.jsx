import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ageFrom, initialsOf, nextId, TODAY } from '../format'
import { FIRST_NEW_MRN, PATIENTS } from '../data/patients'
import { SEED_ALERTS, SEED_ALLERGIES, SEED_CARE_PLANS, SEED_NOTES, SEED_ORDERS, SEED_PRESCRIPTIONS, SEED_REFERRALS } from '../data/seedClinical'
import { SEED_CHARGES, SEED_CONSENTS, SEED_FAMILY, SEED_INVOICES, SEED_MESSAGES, SEED_PAYMENTS, SEED_REFUNDS } from '../data/seedAdmin'
import { SEED_APPOINTMENTS, SEED_DIAGNOSES, SEED_ENCOUNTERS, SEED_VITALS } from '../data/seedVisits'
import { SEED_DAY_APPOINTMENTS } from '../../appointments/data/seedDay'
import { PatientRecordsContext } from './patientRecordsContext'

const SEED = {
  patients: PATIENTS,
  appointments: [...SEED_APPOINTMENTS, ...SEED_DAY_APPOINTMENTS],
  encounters: SEED_ENCOUNTERS,
  vitals: SEED_VITALS,
  diagnoses: SEED_DIAGNOSES,
  alerts: SEED_ALERTS,
  allergies: SEED_ALLERGIES,
  notes: SEED_NOTES,
  carePlans: SEED_CARE_PLANS,
  prescriptions: SEED_PRESCRIPTIONS,
  orders: SEED_ORDERS,
  referrals: SEED_REFERRALS,
  invoices: SEED_INVOICES,
  payments: SEED_PAYMENTS,
  refunds: SEED_REFUNDS,
  charges: SEED_CHARGES,
  family: SEED_FAMILY,
  messages: SEED_MESSAGES,
  consents: SEED_CONSENTS,
  incidents: [],
}

const patientFromForm = (values, id, mrn) => ({
  id,
  mrn,
  name: values.fullName.trim(),
  initials: initialsOf(values.fullName),
  tone: 'slate',
  age: ageFrom(values.dob),
  dob: values.dob,
  gender: values.gender,
  abha: values.abha?.trim() || 'Not linked',
  mobile: `+91 ${values.mobile.replace(/\D/g, '').replace(/^(\d{5})(\d{5})$/, '$1 $2')}`,
  contactNote: values.mobileVerified ? 'Verified SMS OTP' : 'Unverified',
  email: values.email?.trim() ?? '',
  address: [values.house, values.area, values.city, values.state, values.pin].filter(Boolean).join(', '),
  branch: values.branch.replace(/\s*\(.*\)$/, ''),
  lastVisit: null,
  lastDoctor: '',
  status: 'Active',
  bloodGroup: values.bloodGroup || 'Unknown',
  regDate: TODAY,
  language: values.language,
  emergencyName: values.emergencyName?.trim() ?? '',
  emergencyRelation: values.emergencyRelation ?? '',
  emergencyPhone: values.emergencyPhone?.trim() ?? '',
  consent: 'Consent pending',
  consentNote: 'No allergies documented',
})

// Holds every patient-facing record in memory so an action in one screen (register, book, check in, bill)
// shows up in the next. It is replaced by API calls once a backend exists.
export default function PatientRecordsProvider({ children }) {
  const [records, setRecords] = useState(SEED)

  const list = useCallback((collection, patientId) => records[collection].filter((item) => item.patientId === patientId), [records])
  const find = useCallback((collection, id) => records[collection].find((item) => item.id === id), [records])
  const newId = useCallback((prefix, collection, width = 3) => nextId(prefix, records[collection].map((item) => item.id), width), [records])

  const add = useCallback((collection, item) => {
    setRecords((current) => ({ ...current, [collection]: [item, ...current[collection]] }))
    return item
  }, [])

  const update = useCallback((collection, id, patch) => {
    setRecords((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item)),
    }))
  }, [])

  const addPatient = useCallback(
    (values) => {
      const added = records.patients.length - PATIENTS.length
      const mrn = `PT-${String(FIRST_NEW_MRN + added).padStart(6, '0')}`
      const patient = patientFromForm(values, mrn.toLowerCase(), mrn)
      setRecords((current) => ({ ...current, patients: [...current.patients, patient] }))
      return patient
    },
    [records.patients.length],
  )

  const updatePatient = useCallback((id, values) => {
    setRecords((current) => ({
      ...current,
      patients: current.patients.map((patient) => (patient.id === id ? { ...patient, ...patientFromForm(values, patient.id, patient.mrn), regDate: patient.regDate, lastVisit: patient.lastVisit, lastDoctor: patient.lastDoctor } : patient)),
    }))
  }, [])

  const value = useMemo(
    () => ({ records, patients: records.patients, getPatient: (id) => records.patients.find((patient) => patient.id === id), list, find, newId, add, update, addPatient, updatePatient }),
    [records, list, find, newId, add, update, addPatient, updatePatient],
  )

  return <PatientRecordsContext.Provider value={value}>{children ?? <Outlet />}</PatientRecordsContext.Provider>
}
