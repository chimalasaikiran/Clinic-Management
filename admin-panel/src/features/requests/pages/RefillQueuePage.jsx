import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import DetailFrame from '../../inventory/components/DetailFrame'
import { useLiveRefresh } from '../../workspace/useLiveRefresh'
import { useWorkspace } from '../../workspace/useWorkspace'
import { requestsApi } from '../api'
import { when } from '../format'

const FILTERS = [
  ['requested', 'Waiting'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['cancelled', 'Cancelled by patient'],
  ['all', 'All'],
]
const TONE = { requested: 'warning', approved: 'success', declined: 'danger', cancelled: 'neutral' }
const LABEL = { requested: 'Waiting', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled by patient' }

function Decision({ request, onDone }) {
  const [mode, setMode] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await requestsApi.decideRefill(request.id, { decision: mode, note: note.trim() || null, version: request.version })
      onDone(mode === 'approve' ? `Approved the refill for ${request.patient.fullName}.` : `Declined the refill for ${request.patient.fullName}.`)
    } catch (failure) {
      setError(failure.fieldErrors?.().note ?? failure.message)
      setSaving(false)
    }
  }

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2">
        <ActionButton size="sm" variant="primary" disabled={request.prescription.status !== 'active'} title={request.prescription.status !== 'active' ? 'The prescription is no longer active' : undefined} onClick={() => setMode('approve')}>Approve</ActionButton>
        <ActionButton size="sm" onClick={() => setMode('decline')}>Decline</ActionButton>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] text-outline">
        {mode === 'approve' ? 'Message to the patient (optional)' : 'Reason for the patient (required)'}
        <textarea
          aria-label={mode === 'approve' ? 'Message to the patient' : 'Reason for the patient'}
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={mode === 'approve' ? 'For example: ready to collect after 4 pm.' : 'For example: please book a review before more is given.'}
          className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand"
        />
      </label>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <ActionButton size="sm" variant="primary" disabled={saving} onClick={submit}>{mode === 'approve' ? 'Confirm approval' : 'Confirm decline'}</ActionButton>
        <ActionButton size="sm" disabled={saving} onClick={() => setMode(null)}>Back</ActionButton>
      </div>
    </div>
  )
}

// Refill requests from the patient app. Approving tells the patient to collect; the pharmacy dispenses as usual.
export default function RefillQueuePage() {
  const { canAny } = useAuth()
  const { branchId } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'requested'
  const [notice, setNotice] = useState('')
  const canDecide = canAny(['pharmacy.dispense', 'clinical.write'])
  const list = useApiResource(() => requestsApi.refills({ status, branchId: branchId || undefined, pageSize: 100 }), `refills:${status}:${branchId}`)
  useLiveRefresh(['requests'], list.reload)
  const rows = list.data?.data ?? []
  const total = list.data?.meta?.total ?? 0
  const waiting = list.data?.meta?.waiting ?? 0

  return (
    <DetailFrame
      crumbs={[{ label: 'Pharmacy', to: ROUTES.pharmacy }, { label: 'Refill Requests' }]}
      title="Refill Requests"
      badge={waiting ? <StatusPill tone="warning" dot>{waiting} waiting</StatusPill> : null}
      subtitle="Requests patients send from the app. Approving tells the patient to collect it; dispense it from the prescription queue as usual."
    >
      <div role="tablist" aria-label="Refill status" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setParams(value === 'requested' ? {} : { status: value }, { replace: true })}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', status === value ? 'border-brand bg-teal-50 text-brand' : 'border-slate-200 bg-white text-on-surface-variant')}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">{notice}</p>}
      {list.error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">{list.error.message} <button type="button" onClick={list.reload} className="font-semibold underline">Try again</button></p>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!list.data && !list.error ? (
          <p className="px-5 py-10 text-center text-sm text-on-surface-variant">Loading refill requests…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-on-surface-variant">{status === 'requested' ? 'No refill requests are waiting.' : 'No refill requests match this filter.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((request) => (
              <li key={request.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1.5fr_1.3fr]">
                <div className="text-xs">
                  <Link to={pathFor(ROUTES.patientHub, { patientId: request.patient.id })} className="text-sm font-semibold text-brand hover:underline">{request.patient.fullName}</Link>
                  <p className="text-outline">{request.patient.mrn} · {request.branch.name}</p>
                  <p className="mt-1 text-outline">Asked {when(request.createdAt)}</p>
                  <StatusPill tone={TONE[request.status]} className="mt-2">{LABEL[request.status]}</StatusPill>
                </div>
                <div className="text-xs">
                  <p className="font-semibold">{request.prescription.reference} · {request.prescription.prescriberName}</p>
                  <ul className="mt-1 text-on-surface-variant">
                    {request.prescription.items.map((item) => <li key={`${item.name}-${item.strength}`}>{item.name} {item.strength} · {item.dose}, {item.frequency}, {item.durationDays} days</li>)}
                  </ul>
                  <p className="mt-1 text-outline">Issued {when(request.prescription.issuedAt)} · Refills allowed {request.prescription.allowedRefills} · Approved so far {request.prescription.approvedRefills}{request.prescription.status !== 'active' ? ` · Prescription ${request.prescription.status}` : ''}</p>
                  {request.note && <p className="mt-2 rounded bg-surface-low px-2 py-1.5">Patient: “{request.note}”</p>}
                </div>
                <div className="text-xs">
                  {request.status === 'requested' ? (
                    canDecide ? <Decision request={request} onDone={(message) => { setNotice(message); list.reload() }} /> : <p className="text-outline">Deciding needs dispensing or prescribing rights.</p>
                  ) : request.status === 'cancelled' ? (
                    <p className="text-outline">The patient withdrew this request.</p>
                  ) : (
                    <>
                      <p className="font-semibold">{LABEL[request.status]} by {request.decidedBy} · {when(request.decidedAt)}</p>
                      {request.decisionNote && <p className="mt-1 text-on-surface-variant">“{request.decisionNote}”</p>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > rows.length && <p className="border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">Showing {rows.length} of {total}.</p>}
      </section>
    </DetailFrame>
  )
}
