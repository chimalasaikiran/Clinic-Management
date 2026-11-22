import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { ESCALATION_STATUSES, SEVERITIES, stars } from '../contentView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

export default function FeedbackEscalationPage() {
  const context = useLeadContext()
  const [filters, setFilters] = useState({ q: '', severity: '', status: '', ownerId: '' })
  const [selectedId, setSelectedId] = useState(null)
  const query = { q: filters.q || undefined, severity: filters.severity || undefined, status: filters.status || undefined, ownerId: filters.ownerId || undefined, pageSize: 100 }
  const escalations = useApiResource(() => contentApi.escalations(query), `escalations:${JSON.stringify(query)}`)
  const owners = useApiResource(() => contentApi.escalationOwners(), 'escalation-owners').data ?? []
  const rows = escalations.data?.data ?? []
  const selected = rows.find((entry) => entry.id === selectedId) ?? rows[0]
  const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }))

  return (
    <GrowthFrame back={{ to: ROUTES.reviews, label: 'Reviews & Reputation · GO16' }} crumb="Owner Panel / Growth OS / Feedback Escalation" code="GO-19" title="Feedback Escalation" description="Follow up on what reviews raise, with an owner and a due time, separately from the public reply." badge={<StatusPill tone="warning">Internal operations only</StatusPill>} actions={<ActionButton variant="brand" to={ROUTES.reputation}>Reputation report → GO20</ActionButton>} context={[context.line, 'Open first, then by due time']} today={context.today} sample="Live records · Escalations are opened from a review">
      <Banner title="Internal follow-up" className="mb-6">Reviewer names are public display names, not patients. Resolving an escalation never posts or changes anything on Google.</Banner>
      <Section title="Find escalations" aside="Filters" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3"><FilterField label="Severity" value={filters.severity} onChange={(value) => set('severity', value)} options={[['', 'All severities'], ...Object.entries(SEVERITIES)]} /><FilterField label="Status" value={filters.status} onChange={(value) => set('status', value)} options={[['', 'All statuses'], ...Object.entries(ESCALATION_STATUSES)]} /><FilterField label="Owner" value={filters.ownerId} onChange={(value) => set('ownerId', value)} options={[['', 'All owners'], ...owners.map((owner) => [owner.membershipId, owner.name])]} /></div>
        <div className="mt-4 flex gap-3"><SearchBox value={filters.q} onChange={(value) => set('q', value)} label="Search escalations" placeholder="Search code, topic or note" className="flex-1" /><ActionButton onClick={() => setFilters({ q: '', severity: '', status: '', ownerId: '' })}>Clear filters</ActionButton></div>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Operations feedback" aside={escalations.data ? `${escalations.data.meta.total} item${escalations.data.meta.total === 1 ? '' : 's'}` : 'Loading'}>
          {!escalations.data ? <LoadingState label="Loading escalations…" error={escalations.error} onRetry={escalations.reload} /> : (
            <ul className="-mx-6 divide-y divide-slate-100">{rows.map((entry) => (
              <li key={entry.id} className={cn('px-6 py-4 text-xs', selected?.id === entry.id && 'bg-teal-50/50')}>
                <button type="button" onClick={() => setSelectedId(entry.id)} className="block w-full text-left"><p className="flex justify-between"><strong className="text-[13px]">{entry.code} · {entry.review.reviewerName}</strong><StatusPill tone={entry.status === 'resolved' ? 'success' : 'info'}>{ESCALATION_STATUSES[entry.status]}</StatusPill></p><p className="mt-2 text-[13px]">{entry.topic}</p><p className="mt-2 text-outline">{SEVERITIES[entry.severity]} · {entry.owner.name} · Due {when(stampOf(entry.dueAt))}{entry.overdue && <span className="ml-2 font-semibold text-danger">Overdue</span>}</p></button>
                <Link to={pathFor(ROUTES.review, { reviewId: entry.review.id })} className="mt-2 inline-block font-semibold text-brand hover:underline">Source review → GO17</Link>
              </li>))}</ul>
          )}
          {escalations.data && rows.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">No escalations match these filters. Open one from a review.</p>}
        </Section>
        {selected && <EscalationEditor key={`${selected.id}:${selected.version}`} escalation={selected} owners={owners} onSaved={escalations.reload} />}
      </div>
      <GrowthFooter code="GO-19" back={{ to: ROUTES.reviews, label: 'Reviews & Reputation · GO16' }} />
    </GrowthFrame>
  )
}

function EscalationEditor({ escalation, owners, onSaved }) {
  const { canAny } = useAuth()
  const due = stampOf(escalation.dueAt)
  const [values, setValues] = useState({ topic: escalation.topic, severity: escalation.severity, ownerMembershipId: escalation.owner.membershipId, dueDate: due.date, dueTime: due.time, status: escalation.status, note: escalation.note })
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const editable = canAny(['growth.leads', 'growth.manage'])
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await contentApi.updateEscalation(escalation.id, { ...values, topic: values.topic.trim(), version: escalation.version })
      onSaved()
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
      setBusy(false)
    }
  }
  return (
    <Section title={`Selected · ${escalation.code}`} aside={ESCALATION_STATUSES[escalation.status]}>
      {message && <Banner tone={message.tone} title={message.title} className="mb-4">{message.text}</Banner>}
      <p className="mb-3 text-xs text-on-surface-variant">{stars(escalation.review.rating)} · “{escalation.review.comment ?? 'Rating only'}”</p>
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextInput label="Topic" value={values.topic} onChange={(event) => set('topic', event.target.value)} /></div>
        <SelectInput label="Severity" value={values.severity} onChange={(event) => set('severity', event.target.value)} options={Object.entries(SEVERITIES).map(([value, label]) => ({ value, label }))} />
        <SelectInput label="Owner" value={values.ownerMembershipId} onChange={(event) => set('ownerMembershipId', event.target.value)} options={owners.map((owner) => ({ value: owner.membershipId, label: owner.name }))} />
        <TextInput label="Due date" type="date" value={values.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
        <TextInput label="Due time" type="time" value={values.dueTime} onChange={(event) => set('dueTime', event.target.value)} />
        <SelectInput label="Status" value={values.status} onChange={(event) => set('status', event.target.value)} options={Object.entries(ESCALATION_STATUSES).map(([value, label]) => ({ value, label }))} />
        <div className="sm:col-span-2"><TextArea label="Internal note" rows={3} value={values.note} onChange={(event) => set('note', event.target.value)} hint="Never public. Not copied into any reply." /></div>
      </fieldset>
      <p className="mt-3 text-[11px] text-outline">Opened by {escalation.createdBy} {when(stampOf(escalation.createdAt))}.{escalation.resolvedAt ? ` Resolved ${when(stampOf(escalation.resolvedAt))}.` : ''}</p>
      {editable && <ActionButton className="mt-3" variant="brand" disabled={busy || !values.topic.trim()} onClick={save}>Save escalation</ActionButton>}
    </Section>
  )
}
