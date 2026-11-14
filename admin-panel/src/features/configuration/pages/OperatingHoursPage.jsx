import { useState } from 'react'
import { ArrowRight, CalendarDays, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import { SCHEDULE_EXCEPTIONS, SCHEDULE_PIPELINE, WEEKLY_SCHEDULE } from '../data/schedule'
import { validateException } from '../validation'

function Pipeline() {
  return (
    <Panel
      title="Used across ClinicOS Scheduling Pipeline"
      action={
        <ActionButton variant="soft" size="sm">
          Configure doctor availability for Kondapur Clinic <ArrowRight className="size-3" aria-hidden="true" />
        </ActionButton>
      }
    >
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {SCHEDULE_PIPELINE.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                'rounded border px-2.5 py-1.5',
                index === 1 ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200 bg-surface-lowest text-on-surface-variant',
              )}
            >
              {step}
            </span>
            {index < SCHEDULE_PIPELINE.length - 1 && <ArrowRight className="size-3 text-outline" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-5 text-on-surface-variant">
        Branch operating hours establish the physical facility envelope. Individual practitioner consultation schedules, room
        assignments, and break intervals are configured separately in the Doctor Availability workflow.
      </p>
    </Panel>
  )
}

function SessionRow({ index, session }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
      <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-bold">S{index + 1}</span>
      <span className="font-mono text-on-surface">{session.from}</span>
      <span>to</span>
      <span className="font-mono text-on-surface">{session.to}</span>
      <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px]">{session.label}</span>
    </li>
  )
}

function WeeklySchedule() {
  return (
    <Panel
      icon={CalendarDays}
      title="Weekly schedule"
      subtitle="Set the regular hours for each day of the week. Supports split morning and evening sessions."
      action={
        <ActionButton size="sm" icon={Copy}>
          Copy schedule to weekdays
        </ActionButton>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-slate-100">
        {WEEKLY_SCHEDULE.map(({ day, sessions }) => {
          const open = sessions.length > 0
          return (
            <li key={day} className={cn('flex flex-wrap items-start justify-between gap-4 px-5 py-4', !open && 'bg-surface-lowest')}>
              <div className="w-28">
                <p className={cn('text-[13px] font-semibold', open ? 'text-on-surface' : 'text-outline')}>{day}</p>
                <StatusPill tone={open ? 'success' : 'neutral'} dot className="mt-1.5">
                  {open ? 'Open' : 'Closed'}
                </StatusPill>
              </div>
              {open ? (
                <>
                  <ul className="flex min-w-0 flex-1 flex-col gap-2">
                    {sessions.map((session, index) => (
                      <SessionRow key={session.id} index={index} session={session} />
                    ))}
                  </ul>
                  <button type="button" aria-label={`Edit ${day} hours`} className="text-outline hover:text-on-surface">
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 text-xs text-outline">No sessions configured for facility on Sundays.</p>
                  <ActionButton size="sm" variant="soft">
                    Enable Sunday OPD
                  </ActionButton>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function ExceptionCard({ exception, onRemove }) {
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-on-surface">{exception.date}</p>
        <StatusPill tone={exception.kind === 'closed' ? 'danger' : 'warning'} className="mt-1.5">
          {exception.badge}
        </StatusPill>
        <p className="mt-2 text-[13px] font-medium text-on-surface">{exception.title}</p>
        <p className="text-xs leading-4 text-on-surface-variant">{exception.note}</p>
      </div>
      <button type="button" aria-label={`Remove ${exception.title}`} onClick={() => onRemove(exception.id)} className="text-outline hover:text-danger">
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  )
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AddExceptionForm({ onAdd }) {
  const [values, setValues] = useState({ date: '', kind: 'closed', from: '09:00', to: '13:00', reason: '', notify: true })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateException(values) : {}

  const update = (event) => {
    const { name, value, type, checked } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateException(values)).length) return

    const special = values.kind === 'special'
    onAdd({
      id: `custom-${Date.now()}`,
      date: formatDate(values.date),
      kind: values.kind,
      badge: special ? `Special Hours: ${values.from} – ${values.to}` : 'Closed (Full Day)',
      title: values.reason.trim(),
      note: `${special ? 'Reduced facility hours' : 'Full-day facility closure'} · Status: Scheduled`,
    })
    setValues({ date: '', kind: 'closed', from: '09:00', to: '13:00', reason: '', notify: true })
    setSubmitted(false)
  }

  return (
    <Panel title="Quick add exception" action={<StatusPill tone="success">Interactive preview</StatusPill>} className="border-t-2 border-t-brand">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput id="exception-date" label="Date" name="date" type="date" required value={values.date} onChange={update} error={errors.date} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Exception type &amp; schedule</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['closed', 'Closed (Full Day)'],
              ['special', 'Special hours'],
            ].map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs',
                  values.kind === value ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200',
                )}
              >
                <input type="radio" name="kind" value={value} checked={values.kind === value} onChange={update} className="accent-[#006a61]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {values.kind === 'special' && (
          <div className="grid grid-cols-2 gap-3 rounded-md bg-surface-lowest p-3">
            <TextInput label="Opening time" name="from" type="time" value={values.from} onChange={update} />
            <TextInput label="Closing time" name="to" type="time" value={values.to} onChange={update} />
          </div>
        )}

        <TextInput label="Reason / description" name="reason" required value={values.reason} onChange={update} error={errors.reason} />

        <label className="flex items-start gap-2 text-xs leading-4 text-on-surface-variant">
          <input type="checkbox" name="notify" checked={values.notify} onChange={update} className="mt-0.5 accent-[#006a61]" />
          Notify patients with existing appointments booked on this date via WhatsApp &amp; SMS broadcast
        </label>

        <div className="flex justify-end">
          <ActionButton variant="primary" type="submit">
            Add exception
          </ActionButton>
        </div>
      </form>
    </Panel>
  )
}

const focusExceptionForm = () => document.getElementById('exception-date')?.focus()

export default function OperatingHoursPage() {
  const [exceptions, setExceptions] = useState(SCHEDULE_EXCEPTIONS)

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={
          <>
            <span className="text-on-surface-variant">Branch configuration · Kondapur Clinic (#KDP-01)</span>
            <StatusPill tone="success">Active / Licensed OPD Hub</StatusPill>
          </>
        }
        title="Operating hours"
        description="Set when this branch is open for patient appointments and daily clinical operations. These facility hours govern room dispatching, check-ins, and doctor roster bounds."
        actions={
          <>
            <ActionButton>Cancel</ActionButton>
            <ActionButton variant="primary">Save changes</ActionButton>
          </>
        }
        note="All changes immediately sync with appointment engine"
      />

      <Pipeline />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <WeeklySchedule />
        <div className="flex flex-col gap-5">
          <Panel
            title="Schedule exceptions"
            subtitle="Gazetted holidays and special facility hours."
            action={
              <ActionButton variant="brand" size="sm" icon={Plus} onClick={focusExceptionForm}>
                Add exception
              </ActionButton>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100">
              {exceptions.map((exception) => (
                <ExceptionCard
                  key={exception.id}
                  exception={exception}
                  onRemove={(id) => setExceptions((current) => current.filter((item) => item.id !== id))}
                />
              ))}
            </ul>
            {exceptions.length === 0 && <p className="px-5 py-8 text-center text-xs text-on-surface-variant">No exceptions scheduled.</p>}
          </Panel>
          <AddExceptionForm onAdd={(exception) => setExceptions((current) => [...current, exception])} />
        </div>
      </div>
    </ConfigPage>
  )
}
