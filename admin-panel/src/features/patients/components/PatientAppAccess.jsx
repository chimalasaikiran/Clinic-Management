import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import { patientsApi } from '../api'

const when = (value) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const METHODS = { mobile_dob: 'Matched by mobile and date of birth', clinic_code: 'Connected with a desk code' }

// Who can read this record in the patient app, and the one-time code the desk hands to a patient.
export default function PatientAppAccess({ patientId }) {
  const { can } = useAuth()
  const manage = can('patients.edit')
  const { data, error, reload } = useApiResource(() => patientsApi.appAccess(patientId), `patient-app:${patientId}`)
  const [issued, setIssued] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const links = data?.links?.filter((link) => !link.revokedAt) ?? []
  // A code belongs to the record it was issued for; it must not show on another patient's page.
  const code = issued?.patientId === patientId ? issued : null

  const run = async (action) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      reload()
    } catch (failure) {
      setMessage(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-on-surface">Patient app access</h2>
        {data && <StatusPill tone={links.length ? 'success' : 'neutral'}>{links.length ? 'Connected' : 'Not connected'}</StatusPill>}
      </header>
      <div className="space-y-3 p-5 text-xs">
        {message && <p role="alert" className="text-danger">{message}</p>}
        {error && (
          <p role="alert" className="text-on-surface-variant">
            App access could not be loaded. <button type="button" onClick={reload} className="font-semibold text-brand hover:underline">Try again</button>
          </p>
        )}
        {!data && !error && <p className="text-on-surface-variant">Loading app access…</p>}
        {data && !links.length && <p className="text-on-surface-variant">No app account can read this record.</p>}
        {links.map((link) => (
          <div key={link.id} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
            <p className="font-semibold text-on-surface">{link.accountName}{link.accountMobile ? ` · +91 ${link.accountMobile}` : ''}</p>
            <p className="text-on-surface-variant">{METHODS[link.method]} · {when(link.verifiedAt)}</p>
            {manage && (confirming === link.id ? (
              <p className="mt-2 flex gap-2">
                <ActionButton size="sm" onClick={() => setConfirming(null)}>Keep access</ActionButton>
                <ActionButton variant="danger" size="sm" disabled={busy} onClick={() => run(async () => { await patientsApi.revokeAppLink(patientId, link.id); setConfirming(null) })}>Confirm removal</ActionButton>
              </p>
            ) : (
              <button type="button" onClick={() => setConfirming(link.id)} className="mt-2 font-semibold text-danger hover:underline">Remove access</button>
            ))}
          </div>
        ))}
        {code ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 p-3">
            <p className="text-on-surface-variant">Give this code to the patient after checking their identity. It is shown only once.</p>
            <p className="my-1 font-mono text-lg font-semibold tracking-widest text-on-surface">{code.code.slice(0, 4)} {code.code.slice(4)}</p>
            <p className="text-on-surface-variant">Works once, until {when(code.expiresAt)}.</p>
          </div>
        ) : data?.pendingCodeExpiresAt ? (
          <p className="text-on-surface-variant">An unused code is active until {when(data.pendingCodeExpiresAt)}. A new code cancels it.</p>
        ) : null}
        {manage && data && !links.length && (
          <ActionButton variant="soft" size="sm" disabled={busy} onClick={() => run(async () => setIssued({ ...(await patientsApi.issueAppCode(patientId)), patientId }))}>
            {code ? 'Issue a new code' : 'Issue connection code'}
          </ActionButton>
        )}
      </div>
    </section>
  )
}
