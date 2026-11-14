import { useParams } from 'react-router-dom'
import { usePatientRecords } from './usePatientRecords'

// The patient named by the :patientId route param, plus the shared store.
export function usePatient() {
  const { patientId } = useParams()
  const store = usePatientRecords()
  const patient = store.getPatient(patientId)
  return { ...store, patientId, patient, mine: (collection) => (patient ? store.list(collection, patient.id) : []) }
}
