import { useState } from 'react'
import { ArrowRight, CalendarDays, Copy, Plus, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, clock12, WEEK_ORDER, WEEKDAYS } from '../configView'
import { validateException } from '../validation'

const PIPELINE = ['Branch master', 'Branch operating hours & closures', 'Doctor availability (within the hours)', 'Bookable slots']
const NEW_SESSION = { start: '09:00', end: '13:00', label: 'Morning OPD' }

function Pipeline({ branch }) {
  return (
    <Panel title="Used across the ClinicOS scheduling pipeline" action={<ActionButton variant="soft" size="sm" to={ROUTES.appointments}>Doctor availability for {branch.name} <ArrowRight className="size-3" aria-hidden="true" /></ActionButton>}>
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {PIPELINE.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span className={cn('rounded border px-2.5 py-1.5', index === 1 ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200 bg-surface-lowest text-on-surface-variant')}>{step}</span>
            {index < PIPELINE.length - 1 && <ArrowRight className="size-3 text-outline" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-5 text-on-surface-variant">A closed day takes no new appointments at this branch. A doctor’s session outside these hours is shown as a warning on the doctor’s schedule; it is not refused.</p>
    </Panel>
  )
}

function WeeklySchedule({ sessions, setSessions, editable }) {
  const day = (weekday) => sessions.filter((session) => session.weekday === weekday)
  const change = (weekday, index, patch) => {
    let seen = -1
    setSessions(sessions.map((session) => {
      if (session.weekday !== weekday) return session
      seen += 1
      return seen === index ? { ...session, ...patch } : session
    }))
  }
  const remove = (weekday, index) => {
    let seen = -1
    setSessions(sessions.filter((session) => {
      if (session.weekday !== weekday) return true
      seen += 1
      return seen !== index
    }))
  }
  const add = (weekday) => {
    const last = day(weekday).at(-1)
    setSessions([...sessions, last ? { weekday, start: last.end < '17:00' ? '17:00' : last.end, end: '20:00', label: 'Evening OPD' } : { weekday, ...NEW_SESSION }])
  }
  // Monday's sessions on every weekday (Tuesday–Friday).
  const copyMonday = () => setSessions([...sessions.filter((session) => ![2, 3, 4, 5].includes(session.weekday)), ...[2, 3, 4, 5].flatMap((weekday) => day(1).map((session) => ({ ...session, weekday })))])

  return (
    <Panel icon={CalendarDays} title="Weekly schedule" subtitle="Set the regular hours for each day of the week. Supports split morning and evening sessions." action={editable && <ActionButton size="sm" icon={Copy} onClick={copyMonday} disabled={!day(1).length}>Copy Monday to weekdays</ActionButton>} bodyClassName="p-0">
      <ul className="divide-y divide-slate-100">
        {WEEK_ORDER.map((weekday) => {
          const list = day(weekday)
          const open = list.length > 0
          return (
            <li key={weekday} className={cn('flex flex-wrap items-start justify-between gap-4 px-5 py-4', !open && 'bg-surface-lowest')}>
              <div className="w-28">
                <p className={cn('text-[13px] font-semibold', open ? 'text-on-surface' : 'text-outline')}>{WEEKDAYS[weekday]}</p>
                <StatusPill tone={open ? 'success' : 'neutral'} dot className="mt-1.5">{open ? 'Open' : 'Closed'}</StatusPill>
              </div>
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {list.map((session, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-bold">S{index + 1}</span>
                    {editable ? (
                      <>
                        <input type="time" aria-label={`${WEEKDAYS[weekday]} session ${index + 1} opens`} value={session.start} onChange={(event) => change(weekday, index, { start: event.target.value })} className="rounded border border-slate-300 px-2 py-1 font-mono" />
                        <span>to</span>
                        <input type="time" aria-label={`${WEEKDAYS[weekday]} session ${index + 1} closes`} value={session.end} onChange={(event) => change(weekday, index, { end: event.target.value })} className="rounded border border-slate-300 px-2 py-1 font-mono" />
                        <input aria-label={`${WEEKDAYS[weekday]} session ${index + 1} label`} value={session.label} onChange={(event) => change(weekday, index, { label: event.target.value })} placeholder="Label" className="w-32 rounded border border-slate-300 px-2 py-1" />
                        <button type="button" aria-label={`Remove ${WEEKDAYS[weekday]} session ${index + 1}`} onClick={() => remove(weekday, index)} className="text-outline hover:text-danger"><Trash2 className="size-3.5" aria-hidden="true" /></button>
                      </>
                    ) : (
                      <><span className="font-mono text-on-surface">{clock12(session.start)}</span><span>to</span><span className="font-mono text-on-surface">{clock12(session.end)}</span>{session.label && <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px]">{session.label}</span>}</>
                    )}
                  </li>
                ))}
                {!open && <li className="text-xs text-outline">No sessions on {WEEKDAYS[weekday]}s.</li>}
              </ul>
              {editable && list.length < 4 && <ActionButton size="sm" variant="soft" icon={Plus} onClick={() => add(weekday)}>{open ? 'Add session' : `Open on ${WEEKDAYS[weekday]}`}</ActionButton>}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function ExceptionCard({ exception, onRemove, editable }) {
  const special = exception.kind === 'special'
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-on-surface">{new Date(`${exception.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <StatusPill tone={special ? 'warning' : 'danger'} className="mt-1.5">{special ? `Special Hours: ${clock12(exception.opensAt)} – ${clock12(exception.closesAt)}` : 'Closed (Full Day)'}</StatusPill>
        <p className="mt-2 text-[13px] font-medium text-on-surface">{exception.reason}</p>
        <p className="text-xs leading-4 text-on-surface-variant">{special ? 'Reduced facility hours' : 'Full-day closure · no new appointments'} · added by {exception.createdBy}</p>
      </div>
      {editable && <button type="button" aria-label={`Remove ${exception.reason}`} onClick={() => onRemove(exception.id)} className="text-outline hover:text-danger"><Trash2 className="size-3.5" aria-hidden="true" /></button>}
    </li>
  )
}

function AddExceptionForm({ branchId, onAdded }) {
  const [values, setValues] = useState({ date: '', kind: 'closed', from: '09:00', to: '13:00', reason: '' })
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const errors = submitted ? validateException(values) : {}
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateException(values)).length) return
    setPending(true)
    try {
      const special = values.kind === 'special'
      const result = await configApi.addClosure(branchId, { date: values.date, kind: values.kind, opensAt: special ? values.from : null, closesAt: special ? values.to : null, reason: values.reason.trim() })
      setValues({ date: '', kind: 'closed', from: '09:00', to: '13:00', reason: '' })
      setSubmitted(false)
      onAdded(result)
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel title="Quick add exception" className="border-t-2 border-t-brand">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {failure && <Banner tone="danger" title={failure} />}
        <TextInput id="exception-date" label="Date" name="date" type="date" required value={values.date} onChange={update} error={errors.date} />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Exception type &amp; schedule</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['closed', 'Closed (Full Day)'], ['special', 'Special hours']].map(([value, label]) => (
              <label key={value} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs', values.kind === value ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>
                <input type="radio" name="kind" value={value} checked={values.kind === value} onChange={update} className="accent-brand" />{label}
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
        <p className="text-[11px] leading-4 text-outline">Existing appointments on a closed day are not cancelled automatically; you are told how many need rebooking.</p>
        <div className="flex justify-end"><ActionButton variant="primary" type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add exception'}</ActionButton></div>
      </form>
    </Panel>
  )
}

const focusExceptionForm = () => document.getElementById('exception-date')?.focus()

export default function OperatingHoursPage() {
  const { branchId } = useParams()
  const { can } = useAuth()
  const resource = useApiResource(() => configApi.branch(branchId), `config-branch:${branchId}`)
  const branch = resource.data
  if (!branch) {
    return (
      <ConfigPage>
        <PageIntro title={resource.error?.status === 404 ? 'Branch not found' : 'Operating hours'} />
        {resource.error?.status !== 404 && <LoadingState label="Loading operating hours…" error={resource.error} onRetry={resource.reload} />}
      </ConfigPage>
    )
  }
  return <HoursEditor key={branch.id} branch={branch} editable={can('branches.hours')} />
}

function HoursEditor({ branch, editable }) {
  // The saved schedule: what the page loaded, then what the last save returned.
  const [saved, setSaved] = useState(branch.hours)
  const [sessions, setSessions] = useState(branch.hours)
  const [closures, setClosures] = useState(branch.closures)
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(sessions) !== JSON.stringify(saved)
  const [label, tone] = BRANCH_STATUS[branch.status]

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await configApi.setHours(branch.id, sessions)
      setSaved(updated.hours)
      setSessions(updated.hours)
      setMessage({ tone: 'brand', title: 'Operating hours saved.' })
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
    } finally {
      setSaving(false)
    }
  }
  const remove = async (closureId) => {
    setMessage(null)
    try {
      setClosures((await configApi.removeClosure(branch.id, closureId)).closures)
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not removed', text: error.message })
    }
  }
  const added = (result) => {
    setClosures(result.closures)
    setMessage(result.bookedThatDay ? { tone: 'warning', title: `${result.bookedThatDay} appointment${result.bookedThatDay === 1 ? ' is' : 's are'} already booked that day`, text: 'They are not cancelled automatically. Reschedule or cancel them from the appointments schedule.' } : { tone: 'brand', title: 'Exception added.' })
  }

  return (
    <ConfigPage>
      <PageIntro
        eyebrow={<><span className="text-on-surface-variant">Branch configuration · {branch.name} (#{branch.code})</span><StatusPill tone={tone}>{label}</StatusPill></>}
        title="Operating hours"
        description="Set when this branch is open for patient appointments and daily clinical operations. A closed day takes no new bookings at this branch."
        actions={editable && <><ActionButton to={pathFor(ROUTES.branch, { branchId: branch.id })}>Cancel</ActionButton><ActionButton variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</ActionButton></>}
        note={dirty ? 'Unsaved changes to the weekly schedule' : 'Saved'}
      />
      {message && <Banner tone={message.tone} title={message.title} className="mb-5">{message.text}</Banner>}
      <Pipeline branch={branch} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <WeeklySchedule sessions={sessions} setSessions={setSessions} editable={editable} />
        <div className="flex flex-col gap-5">
          <Panel title="Schedule exceptions" subtitle="Holidays, closures and special facility hours." action={editable && <ActionButton variant="brand" size="sm" icon={Plus} onClick={focusExceptionForm}>Add exception</ActionButton>} bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">{closures.map((exception) => <ExceptionCard key={exception.id} exception={exception} onRemove={remove} editable={editable} />)}</ul>
            {closures.length === 0 && <p className="px-5 py-8 text-center text-xs text-on-surface-variant">No exceptions scheduled.</p>}
          </Panel>
          {editable && <AddExceptionForm branchId={branch.id} onAdded={added} />}
        </div>
      </div>
    </ConfigPage>
  )
}
