import { useState } from 'react'
import { ArrowRight, Calendar, ShieldAlert, Ban, Siren } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { ANANYA as ananya, EXCEPTION_TYPES, FACILITY_SCOPES } from '../data/ananya'
import { validateLeave } from '../validation'

const TYPE_ICONS = { leave: Calendar, block: Ban, relief: Siren }
const INITIAL = { kind: 'leave', scope: 'all', start: '', end: '', reason: '' }

// Adds a leave / availability exception. `onCommit` receives the new record for the page's list.
export default function LeaveExceptionDrawer({ open, onClose, onCommit }) {
  const [values, setValues] = useState(INITIAL)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateLeave(values) : {}

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues(INITIAL)
    setSubmitted(false)
    onClose()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateLeave(values)).length) return

    const scope = FACILITY_SCOPES.find((entry) => entry.value === values.scope)
    const kind = EXCEPTION_TYPES.find((entry) => entry.value === values.kind)
    const format = (iso) => {
      const [year, month, day] = iso.split('-').map(Number)
      return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    const days = Math.round((new Date(values.end) - new Date(values.start)) / 86400000) + 1

    onCommit({
      id: `custom-${Date.now()}`,
      period: values.start === values.end ? format(values.start) : `${format(values.start)} – ${format(values.end)}`,
      length: `${days} Full ${days === 1 ? 'Day' : 'Days'}`,
      kind: values.kind === 'leave' ? 'Leave' : 'Unavailable',
      type: kind.title,
      scope: scope.title,
      scopeNote: scope.detail,
      branch: values.scope,
      reason: values.reason.trim(),
    })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="New operational override · Roster exception engine"
      title="Add Leave / Availability Exception"
      description={`Configure a temporary exception for ${ananya.shortName} without altering their recurring roster.`}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Discard &amp; Close</ActionButton>
          <ActionButton variant="brand" type="submit" form="leave-exception-form">
            Commit Exception &amp; Flag Triage <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
        </div>
      }
    >
      <form id="leave-exception-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest p-3">
          <div className="flex items-center gap-3">
            <Avatar initials={ananya.initials} tone="deep" size="sm" />
            <div>
              <p className="text-[13px] font-semibold text-on-surface">{ananya.shortName}</p>
              <p className="text-[11px] text-on-surface-variant">{ananya.staffCode} · Interventional Cardiology</p>
            </div>
          </div>
          <StatusPill>Locked target</StatusPill>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Exception type <span className="text-rose-500">*</span></legend>
          <div className="grid grid-cols-3 gap-2">
            {EXCEPTION_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type.value]
              const selected = values.kind === type.value
              return (
                <label key={type.value} className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-md border p-3 text-center', selected ? 'border-brand bg-teal-50/60' : 'border-slate-200')}>
                  <input type="radio" name="kind" value={type.value} checked={selected} onChange={update} className="sr-only" />
                  <Icon className={cn('size-4', selected ? 'text-brand' : 'text-outline')} aria-hidden="true" />
                  <span className="text-xs font-semibold text-on-surface">{type.title}</span>
                  <span className="text-[10px] text-outline">{type.detail}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Facility scope application <span className="text-rose-500">*</span></legend>
          <div className="flex flex-col gap-2">
            {FACILITY_SCOPES.map((scope) => (
              <RadioCard key={scope.value} name="scope" value={scope.value} checked={values.scope === scope.value} onChange={update} title={scope.title} detail={scope.detail} />
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Start date" name="start" type="date" required value={values.start} onChange={update} error={errors.start} />
          <TextInput label="End date" name="end" type="date" required value={values.end} onChange={update} error={errors.end} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Reason / operational justification <span className="text-rose-500">*</span></span>
          <textarea
            name="reason"
            rows={3}
            value={values.reason}
            onChange={update}
            aria-invalid={errors.reason ? true : undefined}
            className={cn('rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15', errors.reason ? 'border-rose-400' : 'border-slate-200')}
          />
          {errors.reason && <span role="alert" className="text-xs text-rose-600">{errors.reason}</span>}
          <span className="text-[11px] text-outline">This text appears on the internal doctor roster audit and is sent in sanitized form to appointment desk staff.</span>
        </label>

        <InfoNote tone="warning" icon={ShieldAlert}>
          <strong>Roster impact conflict detected:</strong> 2 recurring OPD sessions affected (18 Oct Mon, 19 Oct Tue). <strong>14 booked patient slots</strong> will be locked and flagged for immediate dispatch to the Appointment Triage Desk upon confirmation.
        </InfoNote>
      </form>
    </Drawer>
  )
}
