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
import { GROWTH_NOW, GROWTH_TODAY, INTERACTION_OUTCOMES, INTERACTION_TYPES, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { TONES, when } from '../format'
import { dueState, validateInteraction } from '../growthLogic'

const DECISIONS = [['reschedule', 'Reschedule'], ['complete', 'Complete original task'], ['keep', 'Keep open']]

export default function LeadFollowUpPage() {
  const { leadId } = useParams()
  const { data } = useGrowth()
  const lead = data.leads.find((entry) => entry.id === leadId)
  if (!lead) {
    return (
      <GrowthFrame back={{ to: ROUTES.leads, label: 'Back to Lead Register' }} crumb="Owner Panel / Growth OS / Leads" code="GO-05" title="Lead not found">
        <Banner tone="warning" title="No lead matches this link">Open the Lead Register to find the record.</Banner>
      </GrowthFrame>
    )
  }
  return <FollowUpForm key={leadId} lead={lead} />
}

function FollowUpForm({ lead }) {
  const { update } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [values, setValues] = useState({ type: INTERACTION_TYPES[0], date: GROWTH_TODAY, time: GROWTH_NOW, outcome: '', notes: '', owner: lead.owner, decision: 'keep', nextAction: '', nextDate: '', nextTime: '11:00', reason: '', permissions: false, reviewed: false, confirmed: false })
  const [attempted, setAttempted] = useState(false)
  const errors = attempted ? validateInteraction(values) : {}
  const detailPath = pathFor(ROUTES.lead, { leadId: lead.id })
  const due = dueState(lead)
  const needsConfirm = values.decision !== 'keep'
  const blocked = !values.permissions || !values.reviewed || (needsConfirm && !values.confirmed)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const record = () => {
    setAttempted(true)
    if (Object.keys(validateInteraction(values)).length || blocked) return
    const at = { date: values.date, time: values.time }
    const task = values.decision === 'reschedule' ? { due: { date: values.nextDate, time: values.nextTime }, nextAction: values.nextAction.trim(), owner: values.owner } : values.decision === 'complete' ? { due: null, nextAction: '' } : {}
    const note = values.decision === 'reschedule' ? `Rescheduled ${when(lead.due)} → ${when(task.due)}. Reason: ${values.reason.trim()}` : values.decision === 'complete' ? 'Original follow-up completed.' : 'Original follow-up kept open.'
    update('leads', lead.id, (current) => ({ ...task, lastActivity: at, activities: [{ id: `a${current.activities.length + 1}`, at, title: `${values.type} · ${values.outcome}`, text: `${values.notes.trim()} ${note}` }, ...current.activities] }))
    navigate(detailPath, { state })
  }

  return (
    <GrowthFrame back={{ to: detailPath, label: 'Back to Lead Details' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name} / Lead Follow-up`} code="GO-05" title="Lead Follow-up" description="Record a contact attempt, plan the next action and resolve the original task only with explicit confirmation." context={['Return to: Aura Health · All locations (3) · 01–22 Oct 2026', `Lead branch: ${lead.branch}. Return keeps the register’s all-location scope.`]}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-5">
        <div><p className="flex flex-wrap items-center gap-2"><strong className="text-lg">{lead.name}</strong><StatusPill tone="success">{lead.stage}</StatusPill>{due !== 'None' && <StatusPill tone={TONES[due]}>{due} · Open</StatusPill>}</p><p className="mt-1 text-xs text-outline">{lead.id.replace('LD', 'LD ')} · {lead.phone} · {lead.interest}</p></div>
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
              <SelectInput label="Interaction type" required value={values.type} onChange={(event) => set('type', event.target.value)} options={INTERACTION_TYPES} />
              <div className="grid grid-cols-2 gap-3"><TextInput label="Date" required type="date" value={values.date} onChange={(event) => set('date', event.target.value)} /><TextInput label="Time · IST" required type="time" value={values.time} onChange={(event) => set('time', event.target.value)} /></div>
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Outcome * · Choose one</legend>
              <div className="mt-2 flex flex-wrap gap-2">{INTERACTION_OUTCOMES.map((outcome) => <label key={outcome} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', values.outcome === outcome ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="radio" name="outcome" value={outcome} checked={values.outcome === outcome} onChange={() => set('outcome', outcome)} className="accent-[#006a61]" />{outcome}</label>)}</div>
              {errors.outcome && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.outcome}</p>}
            </fieldset>
            <div className="mt-4 space-y-4"><TextArea label="Notes" required rows={4} value={values.notes} onChange={(event) => set('notes', event.target.value)} error={errors.notes} hint="Do not record appointment promises or health detail." /><SelectInput label="Activity owner" required value={values.owner} onChange={(event) => set('owner', event.target.value)} options={OWNERS} /></div>
            <Banner tone="brand" title="Logging activity does not close the overdue task" className="mt-4">The activity and the task decision are separate. Keep the stage unchanged; do not infer a booking, consent or completed follow-up from the outcome.</Banner>
          </Section>

          <Section title="Next action & task decision" aside="Explicit confirmation required">
            <div role="radiogroup" aria-label="Task decision" className="mb-4 flex flex-wrap gap-4 text-xs">{DECISIONS.map(([id, label]) => <label key={id} className="flex cursor-pointer items-center gap-2"><input type="radio" name="decision" checked={values.decision === id} onChange={() => set('decision', id)} className="accent-[#006a61]" />{label}</label>)}</div>
            {values.decision === 'reschedule' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><TextInput label="Proposed next action" required value={values.nextAction} onChange={(event) => set('nextAction', event.target.value)} error={errors.nextAction} /></div>
                <TextInput label="Proposed next follow-up date" required type="date" min={GROWTH_TODAY} value={values.nextDate} onChange={(event) => set('nextDate', event.target.value)} error={errors.nextDate} />
                <TextInput label="Time · IST" type="time" value={values.nextTime} onChange={(event) => set('nextTime', event.target.value)} />
                <div className="sm:col-span-2"><TextInput label="Reschedule reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} /></div>
              </div>
            )}
            {needsConfirm && <div className="mt-4"><Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label={values.decision === 'reschedule' ? `Confirm rescheduling the original open task${lead.due ? ` (${when(lead.due)} → new date)` : ''}. Both dates, the reason, owner, actor and timestamp stay in the audit history.` : 'Confirm completing the original task. Completion is recorded with this activity.'} /></div>}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Activity timeline" aside="Saved history · IST"><ol className="space-y-4">{lead.activities.map((activity) => <li key={activity.id} className="text-xs"><p className="text-[13px] font-semibold">{activity.title}</p><p className="text-outline">{when(activity.at)}</p><p className="mt-1 leading-5 text-on-surface-variant">{activity.text}</p></li>)}</ol><p className="mt-4 text-[11px] text-outline">The interaction you are recording is unsaved and is not part of this timeline. Audit history is immutable.</p></Section>
          <Section title="Before recording"><div className="space-y-3"><Check checked={values.permissions} onChange={(event) => set('permissions', event.target.checked)} label="Verify activity and task permissions" /><Check checked={values.reviewed} onChange={(event) => set('reviewed', event.target.checked)} label="Review the activity and task decision" /></div><Banner tone="warning" title="No consent inferred" className="mt-4">Connected is not marketing consent. Check contact preference and permitted purpose before future outreach.</Banner></Section>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{blocked ? 'Draft only · original task stays open' : 'Ready to record'}</strong>{blocked ? 'Recording is blocked until permissions, the task decision and any confirmation are complete.' : 'The activity and the chosen task decision will be saved together.'}</p>
        <ActionButton onClick={() => navigate(detailPath)}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked} onClick={record}>Record Follow-up</ActionButton>
      </div>
      <GrowthFooter code="GO-05" back={{ to: detailPath, label: 'Back to Lead Details' }} />
    </GrowthFrame>
  )
}
