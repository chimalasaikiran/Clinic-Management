import { createContext } from 'react'

export const PatientRecordsContext = createContext(null)

// Initial records for the modules that still keep data in memory. Only tests provide it.
export const RecordsSeedContext = createContext(null)
