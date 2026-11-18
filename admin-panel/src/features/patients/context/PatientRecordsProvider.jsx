import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { nextId } from '../format'
import { useAuth } from '../../auth/context/useAuth'
import { toAppointmentView, toPatientView } from '../adapters'
import { appointmentsApi, clinicalApi, patientsApi } from '../api'
import { CHART_COLLECTIONS, toChartView } from '../clinicalAdapters'
import { PatientRecordsContext, RecordsSeedContext } from './patientRecordsContext'

// In-memory collections for modules that do not have a backend yet (billing, family, communication). They start
// empty; tests can seed them through RecordsSeedContext. The clinical chart (encounters, vitals, diagnoses,
// allergies, alerts, notes, prescriptions, orders, referrals, care plans) comes from the API per patient; the
// in-memory copies of those only exist for tests of the other modules, which seed them.
const LOCAL_COLLECTIONS = ['encounters', 'vitals', 'diagnoses', 'alerts', 'allergies', 'notes', 'carePlans', 'prescriptions', 'orders', 'referrals', 'family', 'messages', 'consents']

// Every patient's appointment history fits in one page for the hub; the API caps a page at 200.
const HISTORY_PAGE = 200

// Patients and their appointments come from the API and are cached here by id, so the hub header, tabs and
// flows share one copy and refresh together after a change. getPatient() also serves the other modules.
export default function PatientRecordsProvider({ children }) {
  const seed = useContext(RecordsSeedContext)
  const { can } = useAuth()
  const canReadChart = can('clinical.read')
  const [records, setRecords] = useState(() => ({
    ...Object.fromEntries(LOCAL_COLLECTIONS.map((name) => [name, []])),
    ...(seed ?? {}),
    patients: seed?.patients ?? [],
    appointments: seed?.appointments ?? [],
  }))
  const [entries, setEntries] = useState({})
  const inflight = useRef(new Map())

  const loadPatient = useCallback((id, { force = false } = {}) => {
    if (!id) return Promise.resolve()
    if (!force && inflight.current.has(id)) return inflight.current.get(id)
    setEntries((current) => ({ ...current, [id]: { ...current[id], status: current[id]?.patient ? 'refreshing' : 'loading', error: null } }))
    const request = Promise.all([patientsApi.get(id), appointmentsApi.list({ patientId: id, pageSize: HISTORY_PAGE }), canReadChart ? clinicalApi.chart(id) : null])
      .then(([patient, history, chart]) => {
        setEntries((current) => ({ ...current, [id]: { status: 'ready', error: null, patient: toPatientView(patient), appointments: history.data.map(toAppointmentView), chart: chart ? toChartView(chart) : null } }))
      })
      .catch((error) => {
        setEntries((current) => ({ ...current, [id]: { status: error.status === 404 ? 'missing' : 'error', error, patient: current[id]?.patient, appointments: current[id]?.appointments ?? [], chart: current[id]?.chart ?? null } }))
      })
      .finally(() => inflight.current.delete(id))
    inflight.current.set(id, request)
    return request
  }, [canReadChart])

  const list = useCallback((collection, patientId) => records[collection].filter((item) => item.patientId === patientId), [records])
  // Chart records are looked up in the loaded charts first, then in the in-memory collections.
  const find = useCallback(
    (collection, id) => {
      if (CHART_COLLECTIONS.includes(collection)) {
        for (const entry of Object.values(entries)) {
          const match = entry.chart?.[collection].find((item) => item.id === id)
          if (match) return match
        }
      }
      return records[collection].find((item) => item.id === id)
    },
    [records, entries],
  )
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

  const value = useMemo(() => {
    const cached = Object.values(entries).map((entry) => entry.patient).filter(Boolean)
    const patients = [...cached, ...records.patients.filter((patient) => !entries[patient.id])]
    return {
      records,
      patients,
      getPatient: (id) => entries[id]?.patient ?? records.patients.find((patient) => patient.id === id),
      patientEntry: (id) => entries[id],
      loadPatient,
      list,
      find,
      newId,
      add,
      update,
    }
  }, [records, entries, loadPatient, list, find, newId, add, update])

  return <PatientRecordsContext.Provider value={value}>{children ?? <Outlet />}</PatientRecordsContext.Provider>
}
