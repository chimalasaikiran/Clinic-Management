import { useState } from 'react'
import { TextInput } from '../../../components/workspace/FormControls'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { patientsApi } from '../../patients/api'
import { OptionSelect } from '../../patients/components/parts'
import { summaryOf, usePickedPatient } from '../patientChoice'

// Search-then-select, so a large patient directory never has to be loaded into the form.
export default function PatientPicker({ value, onChange, error, disabled, label = 'Patient', placeholder = 'Select a patient' }) {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const query = search.trim()
  const chosen = usePickedPatient(value)
  const found = useApiResource(() => (query.length >= 2 && can('patients.view') ? patientsApi.list({ query, status: 'active', pageSize: 8 }) : Promise.resolve({ data: [] })), `billing-patients:${query}`).data?.data ?? []
  const options = [...(chosen && !found.some((entry) => entry.id === chosen.id) ? [chosen] : []), ...found.map(summaryOf)]

  return (
    <div className="flex flex-col gap-2">
      {!disabled && <TextInput label={`Find ${label.toLowerCase()}`} placeholder="Name, MRN or mobile (at least 2 characters)" value={search} onChange={(event) => setSearch(event.target.value)} />}
      <OptionSelect
        label={label}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={options.length ? placeholder : 'Search to list patients'}
        error={error}
        disabled={disabled}
        options={options.map((entry) => ({ value: entry.id, label: `${entry.name} · ${entry.mrn}` }))}
      />
    </div>
  )
}
