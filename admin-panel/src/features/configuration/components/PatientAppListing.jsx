import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { configApi } from '../api'

const text = (value) => (value === null || value === undefined ? '' : String(value))

// An empty box means "no coordinate"; anything else is sent as a number for the server to range-check.
const coordinate = (value) => (value.trim() === '' ? null : Number(value))

// The clinic's opt-in to the patient app. Until a branch is listed, no patient record is matched to an app account.
export default function PatientAppListing({ branch, manage, onSaved }) {
  const listed = Boolean(branch.listedInPatientApp)
  const [latitude, setLatitude] = useState(text(branch.latitude))
  const [longitude, setLongitude] = useState(text(branch.longitude))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (listedInPatientApp) => {
    const position = { latitude: coordinate(latitude), longitude: coordinate(longitude) }
    if (Number.isNaN(position.latitude) || Number.isNaN(position.longitude)) {
      setMessage('Latitude and longitude must be numbers, for example 17.4701 and 78.3573.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await configApi.setPatientApp(branch.id, { listedInPatientApp, ...position, version: branch.version })
      onSaved()
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage(error.message)
      setBusy(false)
    }
  }

  return (
    <Panel
      icon={Smartphone}
      title="Patient app"
      subtitle="Listing this branch lets patients see it in the app, and lets a patient’s own record be connected when their verified mobile number and date of birth both match."
      action={<StatusPill tone={listed ? 'success' : 'neutral'} dot>{listed ? 'Listed' : 'Not listed'}</StatusPill>}
    >
      {message && <Banner tone="danger" title={message} className="mb-4" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Latitude" hint="Optional" inputMode="decimal" disabled={!manage} value={latitude} onChange={(event) => setLatitude(event.target.value)} error={errors.latitude} />
        <TextInput label="Longitude" hint="Optional" inputMode="decimal" disabled={!manage} value={longitude} onChange={(event) => setLongitude(event.target.value)} error={errors.longitude} />
      </div>
      {manage && (
        <div className="mt-4 flex flex-wrap gap-3">
          {listed ? (
            <>
              <ActionButton variant="primary" disabled={busy} onClick={() => save(true)}>Save location</ActionButton>
              <ActionButton variant="danger" disabled={busy} onClick={() => save(false)}>Remove from patient app</ActionButton>
            </>
          ) : (
            <ActionButton variant="primary" disabled={busy || branch.status !== 'active'} onClick={() => save(true)}>List in patient app</ActionButton>
          )}
        </div>
      )}
    </Panel>
  )
}
