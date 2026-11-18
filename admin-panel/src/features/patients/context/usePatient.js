import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CHART_COLLECTIONS } from '../clinicalAdapters'
import { usePatientRecords } from './usePatientRecords'

// The patient named by the :patientId route param, loaded from the API, plus the shared store.
// `loading` is true until the first response; `missing` when the patient does not exist (or is not visible).
export function usePatient() {
  const { patientId } = useParams()
  const store = usePatientRecords()
  const { loadPatient } = store

  useEffect(() => {
    loadPatient(patientId)
  }, [loadPatient, patientId])

  const entry = store.patientEntry(patientId)
  const appointments = entry?.appointments ?? []
  return {
    ...store,
    patientId,
    patient: entry?.patient,
    loading: Boolean(patientId) && (!entry || entry.status === 'loading'),
    loadError: entry?.status === 'error' ? entry.error : null,
    appointments,
    refresh: () => loadPatient(patientId, { force: true }),
    // The clinical chart comes from the API once loaded; other in-memory records are keyed by the same id as the
    // route, so they are available before the patient loads.
    mine: (collection) => {
      if (collection === 'appointments') return appointments
      if (entry?.chart && CHART_COLLECTIONS.includes(collection)) return entry.chart[collection]
      return patientId ? store.list(collection, patientId) : []
    },
  }
}
