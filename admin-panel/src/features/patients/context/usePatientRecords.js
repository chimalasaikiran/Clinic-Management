import { useContext } from 'react'
import { PatientRecordsContext } from './patientRecordsContext'

export function usePatientRecords() {
  const value = useContext(PatientRecordsContext)
  if (!value) throw new Error('usePatientRecords must be used inside PatientRecordsProvider')
  return value
}
