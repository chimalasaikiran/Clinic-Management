import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
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
  ['active', 'Needs attention'],
  ['open', 'Waiting on clinic'],
  ['answered', 'Waiting on patient'],
  ['resolved', 'Resolved'],
  ['all', 'All'],
]
const TONE = { open: 'warning', answered: 'info', resolved: 'success' }
const LABEL = { open: 'Waiting on clinic', answered: 'Waiting on patient', resolved: 'Resolved' }

function Conversation({ ticketId, canReply, onChanged }) {
  const ticket = useApiResource(() => requestsApi.ticket(ticketId), `ticket:${ticketId}`)
  useLiveRefresh(['requests'], ticket.reload)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = ticket.data?.id === ticketId ? ticket.data : null

  const run = async (work) => {
    setBusy(true)
    setError('')
    try {
      await work()
      ticket.reload()
      onChanged()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  const send = (resolve) => run(async () => {
    await requestsApi.reply(ticketId, { body: body.trim(), resolve })
    setBody('')
  })

  if (!data) {
    return <p className="p-5 text-sm text-on-surface-variant">{ticket.error ? ticket.error.message : 'Loading request…'}</p>
  }
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-outline">{data.reference} · {data.category}</p>
          <h2 className="text-lg font-semibold">{data.subject}</h2>
          <p className="text-xs text-on-surface-variant">
            <Link to={pathFor(ROUTES.patientHub, { patientId: data.patient.id })} className="font-semibold text-brand hover:underline">{data.patient.fullName}</Link> · {data.patient.mrn} · {data.patient.mobile} · {data.branch.name}
          </p>
        </div>
        <StatusPill tone={TONE[data.status]} dot>{LABEL[data.status]}</StatusPill>
      </div>
      <ol aria-label="Messages" className="flex flex-col gap-3">
        {data.messages.map((message) => (
          <li key={message.id} className={cn('max-w-[85%] rounded-lg border px-3 py-2 text-sm', message.by === 'staff' ? 'self-end border-teal-200 bg-teal-50/60' : 'self-start border-slate-200 bg-white')}>
            <p className="text-[11px] font-semibold text-outline">{message.author} · {when(message.at)}</p>
            <p className="whitespace-pre-wrap text-on-surface">{message.body}</p>
          </li>
        ))}
      </ol>
      {canReply ? (
        data.status === 'resolved' ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest px-4 py-3 text-xs">
            <span>Resolved {when(data.resolvedAt)}. Reopen it to reply.</span>
            <ActionButton size="sm" disabled={busy} onClick={() => run(() => requestsApi.setStatus(ticketId, 'open'))}>Reopen</ActionButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] text-outline">
              Reply to the patient
              <textarea aria-label="Reply to the patient" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-on-surface outline-none focus:border-brand" />
            </label>
            <p className="text-[11px] text-outline">The patient sees replies from “the clinic”, not your name.</p>
            {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="primary" disabled={busy || !body.trim()} onClick={() => send(false)}>Send reply</ActionButton>
              <ActionButton disabled={busy || !body.trim()} onClick={() => send(true)}>Send and resolve</ActionButton>
              <ActionButton disabled={busy} onClick={() => run(() => requestsApi.setStatus(ticketId, 'resolved'))}>Resolve without reply</ActionButton>
            </div>
          </div>
        )
      ) : (
        <p className="text-xs text-outline">Replying needs permission to edit patients.</p>
      )}
    </div>
  )
}

// Help requests patients send from the app to this clinic.
export default function HelpInboxPage() {
  const { can } = useAuth()
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { branchId } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'active'
  const [query, setQuery] = useState('')
  const list = useApiResource(
    () => requestsApi.tickets({ status, branchId: branchId || undefined, query: query.trim() || undefined, pageSize: 100 }),
    `tickets:${status}:${branchId}:${query.trim()}`,
  )
  useLiveRefresh(['requests'], list.reload)
  const rows = list.data?.data ?? []
  const counts = list.data?.meta?.counts
  const open = (id) => navigate({ pathname: pathFor(ROUTES.helpRequest, { ticketId: id }), search: params.toString() })

  return (
    <DetailFrame
      crumbs={[{ label: 'Patients', to: ROUTES.patients }, { label: 'Help Requests' }]}
      title="Help Requests"
      badge={counts?.open ? <StatusPill tone="warning" dot>{counts.open} waiting on clinic</StatusPill> : null}
      subtitle="Questions patients send from the app. Reply here; they read it in the app."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Request status" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setParams(value === 'active' ? {} : { status: value }, { replace: true })}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', status === value ? 'border-brand bg-teal-50 text-brand' : 'border-slate-200 bg-white text-on-surface-variant')}
            >
              {label}{counts && value !== 'all' && value !== 'active' ? ` (${counts[value]})` : ''}
            </button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} label="Search help requests" placeholder="Reference, subject, patient…" className="w-64" />
      </div>
      {list.error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">{list.error.message}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section aria-label="Requests" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {!list.data && !list.error ? (
            <p className="px-5 py-10 text-center text-sm text-on-surface-variant">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No help requests here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((ticket) => (
                <li key={ticket.id}>
                  <button type="button" onClick={() => open(ticket.id)} aria-current={ticket.id === ticketId} className={cn('block w-full px-4 py-3 text-left text-xs hover:bg-surface-lowest', ticket.id === ticketId && 'bg-teal-50/60')}>
                    <span className="flex items-center justify-between gap-2"><span className="font-mono text-outline">{ticket.reference}</span><StatusPill tone={TONE[ticket.status]}>{LABEL[ticket.status]}</StatusPill></span>
                    <span className="mt-1 block text-sm font-semibold text-on-surface">{ticket.subject}</span>
                    <span className="block text-outline">{ticket.patient.fullName} · {ticket.category} · {when(ticket.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Conversation" className="min-h-[240px] rounded-lg border border-slate-200 bg-white">
          {ticketId ? <Conversation key={ticketId} ticketId={ticketId} canReply={can('patients.edit')} onChanged={list.reload} /> : <p className="p-5 text-sm text-on-surface-variant">Choose a request to read and reply.</p>}
        </section>
      </div>
    </DetailFrame>
  )
}
