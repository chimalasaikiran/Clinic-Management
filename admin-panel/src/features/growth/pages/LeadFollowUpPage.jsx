import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import LeadGate from '../components/LeadGate'
import { TONES, when } from '../format'
import { leadsApi } from '../leadsApi'
import { clinicNow, INTERACTIONS, interactionId, LIVE_NOTE, OUTCOMES, outcomeId, ownerOptions, STAGES, validateInteraction } from '../leadsView'
import { useLeadContext, useLeadOwners } from '../useLeads'

const DECISIONS = [['reschedule', 'Reschedule'], ['complete', 'Complete original task'], ['keep', 'Keep open']]

export default function LeadFollowUpPage() {
  const { leadId } = useParams()
  return <LeadGate leadId={leadId} code="GO-05">{(lead) => <FollowUpForm key={lead.id} lead={lead} />}</LeadGate>
}

function FollowUpForm({ lead }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const context = useLeadContext()
  const eligible = ownerOptions(useLeadOwners(), lead.branchId)
  const owners = eligible.some((option) => option.value === lead.ownerId) ? eligible : [{ value: lead.ownerId, label: lead.owner }, ...eligible]
  const [now] = useState(() => clinicNow())
  const [values, setValues] = useState({ type: INTERACTIONS.phone_call, date: now.date, time: now.time, outcome: '', notes: '', owner: lead.ownerId, decision: 'keep', nextAction: '', nextDate: '', nextTime: '11:00', reason: '', permissions: false, reviewed: false, confirmed: false })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const errors = attempted ? validateInteraction(values) : {}
  const detailPath = pathFor(ROUTES.lead, { leadId: lead.id })
  const due = lead.dueState
  const finished = lead.stage === STAGES.converted || lead.stage === STAGES.closed
  // Only an open follow-up can be completed, and a finished lead takes no new one.
  const decisions = DECISIONS.filter(([id]) => (id !== 'complete' || lead.due) && (id !== 'reschedule' || !finished))
  const needsConfirm = values.decision !== 'keep'
  const blocked = !values.permissions || !values.reviewed || (needsConfirm && !values.confirmed)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const record = async () => {
    setAttempted(true)
    setFailure('')
    if (Object.keys(validateInteraction(values)).length || blocked) return
    setSaving(true)
    try {
      await leadsApi.recordInteraction(lead.id, {
        type: interactionId(values.type), occurredDate: values.date, occurredTime: values.time, outcome: outcomeId(values.outcome), notes: values.notes.trim(), ownerMembershipId: values.owner,
        decision: values.decision, nextAction: values.nextAction.trim(), nextDueDate: values.decision === 'reschedule' ? values.nextDate : undefined, nextDueTime: values.nextTime, reason: values.reason.trim(), version: lead.version,
      })
      navigate(detailPath, { state })
    } catch (error) {
      setSaving(false)
      setFailure([error.message, ...(error.details ?? []).map((detail) => detail.issue)].filter(Boolean).join(' '))
    }
  }

  return (
    <GrowthFrame back={{ to: detailPath, label: 'Back to Lead Details' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name} / Lead Follow-up`} code="GO-05" title="Lead Follow-up" description="Record a contact attempt, plan the next action and resolve the original task only with explicit confirmation." context={[context.line, `Lead branch: ${lead.branch}.`]} today={context.today} sample={LIVE_NOTE}>
      {failure && <Banner tone="danger" title="Not recorded" className="mb-6">{failure}</Banner>}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div><p className="flex flex-wrap items-center gap-2"><strong className="text-lg">{lead.name}</strong><StatusPill tone="success">{lead.stage}</StatusPill>{due !== 'None' && <StatusPill tone={TONES[due]}>{due} · Open</StatusPill>}</p><p className="mt-1 text-xs text-outline">{lead.number} · {lead.phone} · {lead.summary}</p></div>
        <p className="text-right text-xs text-outline">{lead.branch}<br />Owner · {lead.owner}<br />Last saved · {when(lead.lastActivity)}</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-xs"><p className="flex justify-between"><strong className="text-[13px]">Current saved follow-up</strong>{due !== 'None' && <span className="text-amber-700">{due} · Open</span>}</p><p className="mt-3 text-xl font-semibold text-amber-800">{lead.due ? when(lead.due) : 'None set'}</p><p className="mt-1 text-sm">{lead.nextAction || '—'}</p><p className="mt-2 text-on-surface-variant">{lead.owner}</p></div>
        <div className="rounded-md border border-teal-200 bg-teal-50 p-5 text-xs"><p className="flex justify-between"><strong className="text-[13px]">Upcoming · proposed draft</strong><StatusPill tone="success">Unsaved</StatusPill></p><p className="mt-3 text-xl font-semibold text-brand">{values.decision === 'reschedule' && values.nextDate ? when({ date: values.nextDate, time: values.nextTime }) : 'No change proposed'}</p><p className="mt-1 text-sm">{values.decision === 'reschedule' ? values.nextAction || 'Describe the next action' : values.decision === 'complete' ? 'Original task would be completed' : 'Original task stays open'}</p></div>
      </div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="Record interaction" aside="Unsaved activity draft">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Interaction type" required value={values.type} onChange={(event) => set('type', event.target.value)} options={Object.values(INTERACTIONS)} />
              <div className="grid grid-cols-2 gap-3"><TextInput label="Date" required type="date" value={values.date} onChange={(event) => set('date', event.target.value)} /><TextInput label="Time · IST" required type="time" value={values.time} onChange={(event) => set('time', event.target.value)} /></div>
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Outcome * · Choose one</legend>
              <div className="mt-2 flex flex-wrap gap-2">{Object.values(OUTCOMES).map((outcome) => <label key={outcome} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', values.outcome === outcome ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="outcome" value={outcome} checked={values.outcome === outcome} onChange={() => set('outcome', outcome)} className="accent-[#006a61]" />{outcome}</label>)}</div>
              {errors.outcome && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.outcome}</p>}
            </fieldset>
            <div className="mt-4 space-y-4"><TextArea label="Notes" required rows={4} value={values.notes} onChange={(event) => set('notes', event.target.value)} error={errors.notes} hint="Do not record appointment promises or health detail." /><SelectInput label="Activity owner" required value={values.owner} onChange={(event) => set('owner', event.target.value)} options={owners} error={errors.owner} hint={values.decision === 'reschedule' ? 'Becomes the lead owner for the rescheduled follow-up' : undefined} /></div>
            <Banner tone="brand" title="Logging activity does not close the overdue task" className="mt-4">The activity and the task decision are separate. Keep the stage unchanged; do not infer a booking, consent or completed follow-up from the outcome.</Banner>
          </Section>

          <Section title="Next action & task decision" aside="Explicit confirmation required">
            <div role="radiogroup" aria-label="Task decision" className="mb-4 flex flex-wrap gap-4 text-xs">{decisions.map(([id, label]) => <label key={id} className="flex cursor-pointer items-center gap-2"><input type="radio" name="decision" checked={values.decision === id} onChange={() => set('decision', id)} className="accent-[#006a61]" />{label}</label>)}</div>
            {values.decision === 'reschedule' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><TextInput label="Proposed next action" required value={values.nextAction} onChange={(event) => set('nextAction', event.target.value)} error={errors.nextAction} /></div>
                <TextInput label="Proposed next follow-up date" required type="date" min={now.date} value={values.nextDate} onChange={(event) => set('nextDate', event.target.value)} error={errors.nextDate} />
                <TextInput label="Time · IST" type="time" value={values.nextTime} onChange={(event) => set('nextTime', event.target.value)} />
                <div className="sm:col-span-2"><TextInput label="Reschedule reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} /></div>
              </div>
            )}
            {needsConfirm && <div className="mt-4"><Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label={values.decision === 'reschedule' ? `Confirm rescheduling the original open task${lead.due ? ` (${when(lead.due)} → new date)` : ''}. Both dates, the reason, owner, actor and timestamp stay in the audit history.` : 'Confirm completing the original task. Completion is recorded with this activity.'} /></div>}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Activity timeline" aside="Saved history · IST"><ol className="space-y-4">{lead.activities.map((activity) => <li key={activity.id} className="text-xs"><p className="text-[13px] font-semibold">{activity.title}</p><p className="text-outline">{when(activity.at)}{activity.actor ? ` · ${activity.actor}` : ''}</p><p className="mt-1 leading-5 text-on-surface-variant">{activity.text}</p></li>)}</ol><p className="mt-4 text-[11px] text-outline">The interaction you are recording is unsaved and is not part of this timeline. The history cannot be edited.</p></Section>
          <Section title="Before recording"><div className="space-y-3"><Check checked={values.permissions} onChange={(event) => set('permissions', event.target.checked)} label="Verify activity and task permissions" /><Check checked={values.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label="Review the activity and task decision" /></div><Banner tone="warning" title="No consent inferred" className="mt-4">Connected is not marketing consent. Check contact preference and permitted purpose before future outreach.</Banner></Section>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Draft only · original task stays open' : 'Ready to record'}</strong>{blocked ? 'Recording is blocked until permissions, the task decision and any confirmation are complete.' : 'The activity and the chosen task decision will be saved together.'}</p>
        <ActionButton onClick={() => navigate(detailPath)}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked || saving} onClick={record}>{saving ? 'Recording…' : 'Record Follow-up'}</ActionButton>
      </div>
      <GrowthFooter code="GO-05" back={{ to: detailPath, label: 'Back to Lead Details' }} />
    </GrowthFrame>
  )
}
