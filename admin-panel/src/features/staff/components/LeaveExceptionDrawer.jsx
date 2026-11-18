import { useState } from 'react'
import { Ban, Calendar, Check, Siren } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { cn } from '../../../lib/cn'
import { localToday } from '../../patients/format'
import { EXCEPTION_TYPES } from '../data/directory'
import { validateLeave } from '../validation'

const TYPE_ICONS = { leave: Calendar, block: Ban, relief: Siren }
const initial = () => ({ kind: 'leave', title: '', scope: 'all', start: localToday(), end: localToday(), startTime: '', endTime: '', reason: '' })

// Adds leave or a block. `onCommit` sends it to the API and resolves with the number of affected appointments.
export default function LeaveExceptionDrawer({ open, branches, onClose, onCommit }) {
  const [values, setValues] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const block = values.kind === 'block'
  const errors = submitted ? { ...validateLeave(values), ...(block && (!values.startTime || !values.endTime) ? { endTime: 'Give the blocked hours.' } : {}), ...(!values.title.trim() ? { title: 'Name the exception.' } : {}) } : {}

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues(initial())
    setSubmitted(false)
    setFailure('')
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(errors).length || Object.keys(validateLeave(values)).length || !values.title.trim() || (block && (!values.startTime || !values.endTime))) return
    setSaving(true)
    try {
      await onCommit({
        kind: values.kind,
        title: values.title.trim(),
        startDate: values.start,
        endDate: values.end,
        startTime: block ? values.startTime : undefined,
        endTime: block ? values.endTime : undefined,
        branchId: values.scope === 'all' ? null : values.scope,
        reason: values.reason.trim(),
      })
      setSaving(false)
      finish()
    } catch (error) {
      setSaving(false)
      setFailure(error.message)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Leave & availability"
      title="Add leave or exception"
      description="Takes this person out of the appointment schedule for the chosen dates without changing their weekly hours."
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <ActionButton variant="primary" icon={Check} type="submit" form="leave-form" disabled={saving}>{saving ? 'Saving…' : 'Commit exception'}</ActionButton>
        </div>
      }
    >
      <form id="leave-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-800">Exception type</legend>
          <div className="grid grid-cols-3 gap-2">
            {EXCEPTION_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type.value]
              const selected = values.kind === type.value
              return (
                <label key={type.value} className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-md border p-3 text-center text-xs', selected ? 'border-brand bg-teal-50 text-brand' : 'border-slate-200')}>
                  <input type="radio" name="kind" value={type.value} checked={selected} onChange={update} className="sr-only" />
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="font-semibold">{type.title}</span>
                  <span className="text-[10px] text-outline">{type.detail}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <TextInput label="Title" name="title" required value={values.title} onChange={update} error={errors.title} placeholder="e.g. Annual conference" />
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-800">Branch scope</legend>
          <div className="flex flex-col gap-2">
            <RadioCard name="scope" value="all" checked={values.scope === 'all'} onChange={update} title="All assigned branches" detail="Applies wherever this person works" />
            {branches.map((branch) => (
              <RadioCard key={branch.id} name="scope" value={branch.id} checked={values.scope === branch.id} onChange={update} title={`${branch.name} only`} detail="Other branches keep their schedule" />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Start date" name="start" type="date" required value={values.start} onChange={update} error={errors.start} />
          <TextInput label="End date" name="end" type="date" required value={values.end} onChange={update} error={errors.end} />
        </div>
        {block && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Blocked from" name="startTime" type="time" required value={values.startTime} onChange={update} />
            <TextInput label="Blocked until" name="endTime" type="time" required value={values.endTime} onChange={update} error={errors.endTime} />
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Operational justification <span className="text-rose-500">*</span></span>
          <textarea name="reason" rows={3} value={values.reason} onChange={update} aria-label="Operational justification" aria-invalid={errors.reason ? true : undefined} className={cn('rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15', errors.reason ? 'border-rose-400' : 'border-slate-200')} />
          {errors.reason && <span role="alert" className="text-xs text-rose-600">{errors.reason}</span>}
        </label>
        {failure && <p role="alert" className="text-xs text-rose-600">{failure}</p>}
        <InfoNote>Appointments already booked in this window are not cancelled; you will see how many are affected so the desk can move them.</InfoNote>
      </form>
    </Drawer>
  )
}
