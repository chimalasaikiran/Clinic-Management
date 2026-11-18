import { useApiResource } from '../../hooks/useApiResource'
import { patientsApi } from '../patients/api'
import { ageFrom, localToday } from '../patients/format'
import { useBilling } from './context/useBilling'

// A patient from the patients API, in the shape the billing screens use for ledger patients.
export const summaryOf = (patient) => ({
  id: patient.id, name: patient.fullName, mrn: patient.mrn, mobile: patient.mobile, age: ageFrom(patient.dateOfBirth, localToday()), branch: patient.homeBranch.name, branchId: patient.homeBranch.id,
})

// The chosen patient: from the ledger when they already have finance records, otherwise fetched from the API.
export function usePickedPatient(id) {
  const { getPatient } = useBilling()
  const known = id ? getPatient(id) : null
  const fetched = useApiResource(() => (id && !known ? patientsApi.get(id) : Promise.resolve(null)), `billing-patient:${id}:${known ? 'known' : 'fetch'}`).data
  return known ?? (fetched && fetched.id === id ? summaryOf(fetched) : null)
}
