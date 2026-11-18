import { useState } from 'react'
import { Check, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { localToday } from '../../patients/format'
import { ATTENDANCE_LABELS, ATTENDANCE_VALUES } from '../adapters'
import { ATTENDANCE_STATUSES } from '../data/directory'
import { to12Hour } from '../time'
import { validateAttendance, validateCorrection } from '../validation'

const timed = (status) => status === 'Present' || status === 'Late'

function StatusChips({ value, onChange }) {
  return (
    <div role="group" aria-label="Attendance status" className="grid grid-cols-5 gap-2">
      {ATTENDANCE_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={value === status}
          onClick={() => onChange(status)}
          className={cn('rounded-md border px-1 py-2 text-[11px] font-semibold', value === status ? 'border-brand bg-teal-50 text-brand' : 'border-slate-200 text-on-surface-variant hover:bg-surface-lowest')}
        >
          {status}
        </button>
      ))}
    </div>
  )
}

function PersonHeader({ person }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
      <Avatar initials={person.initials} tone="slate" size="sm" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">{person.name} <StatusPill>{person.staffCode}</StatusPill></p>
        <p className="text-[11px] text-on-surface-variant">{person.type} · {person.role}</p>
      </div>
    </div>
  )
}

export function RecordAttendanceDrawer({ open, person, branches, onClose, onSave }) {
  const initial = { date: localToday(), status: 'Present', time: '', note: '', branchId: branches[0]?.id ?? '' }
  const [values, setValues] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const errors = submitted ? validateAttendance(values) : {}

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues(initial)
    setSubmitted(false)
    setFailure('')
    onClose()
  }
  const submit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateAttendance(values)).length) return
    setSaving(true)
    try {
      await onSave({ branchId: values.branchId || branches[0]?.id, date: values.date, status: ATTENDANCE_VALUES[values.status], time: timed(values.status) ? values.time : undefined, note: values.note.trim() })
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
      title="Record Attendance"
      description="Record the actual attendance status for this person."
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <ActionButton variant="primary" icon={Check} type="submit" form="record-attendance-form" disabled={saving}>{saving ? 'Saving…' : 'Save Attendance'}</ActionButton>
        </div>
      }
    >
      <form id="record-attendance-form" onSubmit={submit} noValidate className="flex flex-col gap-5 p-5">
        <PersonHeader person={person} />
        <p className="text-[11px] font-semibold tracking-wide text-outline uppercase">Attendance details</p>
        <SelectInput label="Branch" name="branchId" required value={values.branchId || branches[0]?.id || ''} onChange={update} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
        <TextInput label="Date" name="date" type="date" required max={localToday()} value={values.date} onChange={update} error={errors.date} />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Attendance status <span className="text-rose-500">*</span></p>
          <StatusChips value={values.status} onChange={(status) => setValues((current) => ({ ...current, status }))} />
        </div>
        {timed(values.status) && <TextInput label="Arrival time" name="time" type="time" required hint="Clinic local time" value={values.time} onChange={update} error={errors.time} />}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Operational note <span className="font-normal text-outline">(optional)</span></span>
          <textarea name="note" rows={3} value={values.note} onChange={update} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        {failure && <p role="alert" className="text-xs text-rose-600">{failure}</p>}
        <InfoNote>Recorded as a manual entry under your name. Attendance never changes booked appointments, clinical notes or billing.</InfoNote>
      </form>
    </Drawer>
  )
}

export function AttendanceDetailDrawer({ record, person, staffId, onClose, onCorrect, canCorrect }) {
  if (!record) return null
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Attendance & Work Records · ${record.isoDate}`}
      title="Attendance Detail"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Close</ActionButton>
          {canCorrect && <ActionButton variant="primary" icon={Clock} onClick={() => onCorrect(record)}>Edit / Correct Attendance</ActionButton>}
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <PersonHeader person={person} />
        <p className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-sm font-semibold text-brand">
          {record.isoDate} · <span className={cn(record.status === 'Absent' && 'text-danger')}>{record.status}</span>
        </p>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">01. Attendance record information</h3>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            {[['Calendar date', record.isoDate], ['Branch', record.facility], ['Attendance status', record.status], ['Arrival time', record.time], ['Source', record.source], ['Recorded by', record.by]].map(([label, value]) => (
              <div key={label}>
                <dt className="text-outline">{label}</dt>
                <dd className="font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          {record.note && <p className="mt-3 rounded-md bg-surface-lowest p-2 text-xs text-on-surface-variant">{record.note}</p>}
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">02. Correction history</h3>
          {record.corrections.length ? (
            <ul className="flex flex-col gap-2 text-xs">
              {record.corrections.map((entry) => (
                <li key={entry.id} className="rounded-md border border-slate-200 p-2">
                  <p className="font-semibold text-on-surface">{ATTENDANCE_LABELS[entry.fromStatus]}{entry.fromTime ? ` (${entry.fromTime})` : ''} → {ATTENDANCE_LABELS[entry.toStatus]}{entry.toTime ? ` (${entry.toTime})` : ''}</p>
                  <p className="text-on-surface-variant">{entry.reason}</p>
                  <p className="text-[11px] text-outline">By {entry.by}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-on-surface-variant">Never corrected.</p>
          )}
        </section>
        <Link to={pathFor(ROUTES.staffLeave, { staffId })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View leave &amp; availability <ExternalLink className="size-3" aria-hidden="true" /></Link>
      </div>
    </Drawer>
  )
}

export function EditAttendanceDrawer({ record, person, onClose, onSave }) {
  const [status, setStatus] = useState(record.status)
  const [time, setTime] = useState(record.rawTime)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')

  const errors = submitted ? { ...validateCorrection({ reason }), ...(timed(status) && !time ? { time: 'Enter the arrival time.' } : {}) } : {}
  const changes = [status !== record.status && ['Attendance status', record.status, status], timed(status) && time !== record.rawTime && ['Arrival time', record.time, to12Hour(time)]].filter(Boolean)

  const submit = async () => {
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateCorrection({ reason })).length || changes.length === 0 || (timed(status) && !time)) return
    setSaving(true)
    try {
      await onSave(record, { status: ATTENDANCE_VALUES[status], time: timed(status) ? time : undefined, reason: reason.trim(), version: record.version })
    } catch (error) {
      setSaving(false)
      setFailure(error.message)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Attendance & Work Records · Edit Attendance"
      title="Edit Attendance"
      description="Correct this attendance record. The previous values are kept in its correction history."
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" icon={Check} onClick={submit} disabled={changes.length === 0 || saving}>{saving ? 'Saving…' : `Save Changes (${changes.length})`}</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <PersonHeader person={person} />
        <dl className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-xs">
          <div><dt className="text-outline">Branch</dt><dd className="font-medium">{record.facility}</dd></div>
          <div><dt className="text-outline">Attendance date</dt><dd className="font-medium">{record.isoDate}</dd></div>
          <div className="col-span-2"><dt className="text-outline">Currently recorded</dt><dd className="font-medium text-brand">{record.status} ({record.time})</dd></div>
        </dl>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Attendance status <span className="text-rose-500">*</span> <span className="font-normal text-outline">Prior: {record.status}</span></p>
          <StatusChips value={status} onChange={setStatus} />
        </div>
        {timed(status) && <TextInput label="Arrival time" type="time" required value={time} onChange={(event) => setTime(event.target.value)} error={errors.time} />}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Correction reason <span className="text-rose-500">*</span></span>
          <textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Correction reason" aria-invalid={errors.reason ? true : undefined} className={cn('rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15', errors.reason ? 'border-rose-400' : 'border-slate-200')} />
          {errors.reason && <span role="alert" className="text-xs text-rose-600">{errors.reason}</span>}
          <span className="text-right text-[11px] text-outline">{reason.length} / 500 chars</span>
        </label>
        <section className="rounded-md border border-teal-200 bg-teal-50/50 p-3">
          <p className="mb-2 flex items-center justify-between text-[13px] font-semibold text-brand">Changes staged <StatusPill tone="success">{changes.length} {changes.length === 1 ? 'Change' : 'Changes'}</StatusPill></p>
          {changes.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Nothing staged yet. Change the status or time.</p>
          ) : (
            <dl className="space-y-1 text-xs">
              {changes.map(([label, from, to]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-on-surface-variant">{label}</dt>
                  <dd className="font-medium text-on-surface"><span className="text-outline line-through">{from}</span> → {to}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        {failure && <p role="alert" className="text-xs text-rose-600">{failure}</p>}
      </div>
    </Drawer>
  )
}
