import { useState } from 'react'
import { Check, Clock, ExternalLink, Fingerprint } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { ANANYA as ananya, ATTENDANCE_STATUSES } from '../data/ananya'
import { formatLedgerDate, to12Hour, to24Hour } from '../time'
import { validateAttendance, validateCorrection } from '../validation'

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

function PersonHeader() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
      <Avatar initials={ananya.initials} tone="slate" size="sm" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">{ananya.name} <StatusPill>{ananya.staffCode}</StatusPill></p>
        <p className="text-[11px] text-on-surface-variant">Doctor · Consultant Interventional Cardiologist</p>
      </div>
    </div>
  )
}

export function RecordAttendanceDrawer({ open, onClose, onSave }) {
  const initial = { date: '2026-10-16', status: 'Present', time: '08:52', note: '' }
  const [values, setValues] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateAttendance(values) : {}

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues(initial)
    setSubmitted(false)
    onClose()
  }
  const submit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateAttendance(values)).length) return
    const timed = values.status === 'Present' || values.status === 'Late'
    onSave({
      id: `custom-${Date.now()}`,
      date: formatLedgerDate(values.date),
      facility: 'Main Surgical Pavilion',
      context: values.note.trim() || 'Manual attendance entry',
      status: values.status === 'Unavail.' ? 'Unavailable' : values.status,
      time: timed ? to12Hour(values.time) : '—',
      source: 'Manual Entry',
      by: 'Dr. Julian Vance (CMP)',
    })
    finish()
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
          <ActionButton variant="primary" icon={Check} type="submit" form="record-attendance-form">Save Attendance</ActionButton>
        </div>
      }
    >
      <form id="record-attendance-form" onSubmit={submit} noValidate className="flex flex-col gap-5 p-5">
        <PersonHeader />
        <p className="text-[11px] font-semibold tracking-wide text-outline uppercase">Attendance details</p>
        <TextInput label="Date" name="date" type="date" required hint="Context carried" value={values.date} onChange={update} error={errors.date} />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Attendance status <span className="text-rose-500">*</span></p>
          <StatusChips value={values.status} onChange={(status) => setValues((current) => ({ ...current, status }))} />
        </div>
        <TextInput label="Attendance time" name="time" type="time" required hint="IST (UTC+05:30)" value={values.time} onChange={update} error={errors.time} />
        <InfoNote icon={Fingerprint}>
          <strong className="text-on-surface">Source: Manual (administrative entry).</strong> Manual entry will be attributed to current administrative session without impersonating biometric terminal registers.
        </InfoNote>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Operational note <span className="font-normal text-outline">(optional)</span></span>
          <textarea name="note" rows={3} value={values.note} onChange={update} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <InfoNote>Recording attendance creates an independent operational event and will never alter booked patient appointments, signed clinical notes, or tariff ledgers.</InfoNote>
      </form>
    </Drawer>
  )
}

export function AttendanceDetailDrawer({ record, onClose, onCorrect }) {
  if (!record) return null
  const staffId = ananya.id

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Attendance & Work Records · ${record.date}`}
      title="Attendance Detail"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Close</ActionButton>
          <ActionButton variant="primary" icon={Clock} onClick={() => onCorrect(record)}>Edit / Correct Attendance</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <PersonHeader />
        <p className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-sm font-semibold text-brand">
          {record.date} · <span className={cn(record.status === 'Absent' && 'text-danger')}>{record.status}</span>
          {record.timeNote && <span className="ml-2 text-xs font-normal">{record.timeNote}</span>}
        </p>

        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">01. Attendance record information</h3>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            {[
              ['Calendar date', record.date],
              ['Branch context', record.facility],
              ['Attendance status', record.status],
              ['Recorded time', record.time],
              ['Source', record.source],
              ['Recorded by', record.by],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-outline">{label}</dt>
                <dd className="font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          {record.hash && <p className="mt-3 rounded-md bg-surface-lowest p-2 font-mono text-[11px] break-all text-on-surface-variant">{record.hash} <StatusPill tone="success">VERIFIED</StatusPill></p>}
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">02. Schedule context</h3>
          <p className="text-xs text-on-surface-variant">OPD schedule: <strong className="text-on-surface">{record.context}</strong></p>
          <Link to={pathFor(ROUTES.staffSchedule, { staffId })} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View OPD schedule <ExternalLink className="size-3" aria-hidden="true" /></Link>
        </section>

        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">03. Availability & exception context</h3>
          <InfoNote tone="brand"><strong className="text-brand">Normal rostered duty.</strong> No active leave, medical sabbatical, or shift-swap exception recorded for this date.</InfoNote>
          <Link to={pathFor(ROUTES.staffLeave, { staffId })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View availability ledger <ExternalLink className="size-3" aria-hidden="true" /></Link>
        </section>

        <InfoNote><strong className="text-on-surface">Historical safety:</strong> Attendance events reflect verified physical presence and never alter clinical prescriptions, closed patient encounters, or financial billing tariffs.</InfoNote>
      </div>
    </Drawer>
  )
}

export function EditAttendanceDrawer({ record, onClose, onSave }) {
  const [status, setStatus] = useState(record?.status ?? 'Present')
  const [time, setTime] = useState(to24Hour(record?.time))
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!record) return null

  const errors = submitted ? validateCorrection({ reason }) : {}
  const timeLabel = to12Hour(time) || record.time
  const changes = [
    status !== record.status && ['Attendance status', record.status, status],
    timeLabel !== record.time && ['Attendance time', record.time, timeLabel],
    reason.trim() && ['Operational note', '—', 'Added correction explanation'],
  ].filter(Boolean)

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(validateCorrection({ reason })).length || changes.length === 0) return
    onSave({ ...record, status: status === 'Unavail.' ? 'Unavailable' : status, time: timeLabel, source: 'Manual Entry', by: 'Dr. Julian Vance (CMP)' })
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Attendance & Work Records · Attendance Detail · Edit Attendance`}
      title="Edit Attendance"
      description="Correct this attendance record while preserving its operational history."
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" icon={Check} onClick={submit} disabled={changes.length === 0}>Save Changes ({changes.length})</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <PersonHeader />
        <dl className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-xs">
          <div><dt className="text-outline">Branch & chamber</dt><dd className="font-medium">{record.facility}</dd></div>
          <div><dt className="text-outline">Attendance date</dt><dd className="font-medium">{record.date}</dd></div>
          <div className="col-span-2"><dt className="text-outline">Original clock-in</dt><dd className="font-medium text-brand">{record.status} ({record.time})</dd></div>
        </dl>
        <p className="text-[11px] text-outline">Read-only context — to change branch or doctor, use Staff Details.</p>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Attendance status <span className="text-rose-500">*</span> <span className="font-normal text-outline">Prior: {record.status}</span></p>
          <StatusChips value={status} onChange={setStatus} />
        </div>
        <TextInput label="Attendance time" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Correction reason & operational note <span className="text-rose-500">*</span></span>
          <textarea
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Correction reason"
            aria-invalid={errors.reason ? true : undefined}
            className={cn('rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15', errors.reason ? 'border-rose-400' : 'border-slate-200')}
          />
          {errors.reason && <span role="alert" className="text-xs text-rose-600">{errors.reason}</span>}
          <span className="text-right text-[11px] text-outline">{reason.length} / 500 chars</span>
        </label>

        <section className="rounded-md border border-teal-200 bg-teal-50/50 p-3">
          <p className="mb-2 flex items-center justify-between text-[13px] font-semibold text-brand">Changes staged for commit <StatusPill tone="success">{changes.length} {changes.length === 1 ? 'Change' : 'Changes'}</StatusPill></p>
          {changes.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Nothing staged yet — change the status, time or add a reason.</p>
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

        <InfoNote><strong className="text-on-surface">Historical safety:</strong> Correcting physical presence does not alter booked patient consults, e-prescriptions, or billing tariffs. Prior values remain permanently archived.</InfoNote>

        <section className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
          <p className="mb-2 flex items-center justify-between text-[11px] font-bold text-on-surface-variant uppercase">Original biometric record (read-only locked) <StatusPill>IMMUTABLE</StatusPill></p>
          <dl className="grid grid-cols-2 gap-2">
            <div><dt className="text-outline">Original source</dt><dd className="font-medium">{record.source}</dd></div>
            <div><dt className="text-outline">Recorded at</dt><dd className="font-medium">{record.date}, {record.time}</dd></div>
            <div><dt className="text-outline">Recorded by</dt><dd className="font-medium">{record.by}</dd></div>
            {record.hash && <div><dt className="text-outline">Cryptographic hash</dt><dd className="font-mono">{record.hash}</dd></div>}
          </dl>
        </section>
      </div>
    </Drawer>
  )
}
