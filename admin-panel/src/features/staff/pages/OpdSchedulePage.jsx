import { useState } from 'react'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, Toggle } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { useDepartmentNames } from '../../configuration/useDepartments'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { branchesApi, practitionersApi } from '../../patients/api'
import { staffApi } from '../api'
import LoadingState from '../../patients/components/LoadingState'
import { APPOINTMENT_TYPES } from '../../patients/data/catalog'
import { initialsOf } from '../../patients/format'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'

// Monday first, as clinics plan their week; values are the API's weekday numbers (0 = Sunday).
const WEEK = [['Monday', 1], ['Tuesday', 2], ['Wednesday', 3], ['Thursday', 4], ['Friday', 5], ['Saturday', 6], ['Sunday', 0]]
const MAX_SESSIONS = 3
const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60]
const BLANK_PROFILE = { membershipId: '', displayName: '', credentials: '', specialty: '', department: '', room: '', slotMinutes: '30', status: 'active' }

const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// Therapist profile and weekly consulting hours for one staff member. These hours generate the bookable
// appointment slots. A schedule belongs to the person's ClinicOS account, so they need a login first.
export default function OpdSchedulePage() {
  const { staffId } = useParams()
  const staff = useApiResource(() => staffApi.get(staffId), staffId)
  const practitionerId = staff.data?.practitioner?.id
  const practitioner = useApiResource(() => (practitionerId ? practitionersApi.get(practitionerId) : Promise.resolve(null)), practitionerId ?? 'none')

  if ((staff.loading && !staff.data) || (practitionerId && practitioner.loading && !practitioner.data)) {
    return (
      <WorkspacePage>
        <LoadingState label="Loading OPD schedule…" />
      </WorkspacePage>
    )
  }
  if (!staff.data) {
    return staff.error?.status === 404 || !staff.error ? (
      <StaffNotFound title="OPD Schedule & Tariff" />
    ) : (
      <WorkspacePage>
        <LoadingState error={staff.error} onRetry={staff.reload} />
      </WorkspacePage>
    )
  }
  if (!staff.data.account.linked) {
    return (
      <WorkspacePage>
        <PageIntro title="OPD Schedule & Tariff" description="Consulting hours belong to a person's ClinicOS account." />
        <InfoNote tone="warning">
          <strong>{staff.data.fullName} has no ClinicOS login yet.</strong> Give them a login first; their OPD schedule can be set up once they accept the invitation.{' '}
          <Link to={pathFor(ROUTES.staffAccount, { staffId })} className="font-semibold text-brand hover:underline">Set up user account →</Link>
        </InfoNote>
      </WorkspacePage>
    )
  }
  return <ScheduleEditor key={practitioner.data?.id ?? 'new'} existing={practitioner.data} staff={staff.data} onCreated={staff.reload} />
}

function ScheduleEditor({ existing, staff, onCreated }) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('bookings.assign')
  const branches = useApiResource(() => branchesApi.list(), 'branches')
  const activeBranches = (branches.data ?? []).filter((branch) => branch.status === 'active')
  const departments = useDepartmentNames(existing?.department ?? staff.department)
  // Sessions outside the branch's opening hours: shown, not refused (Configuration › Operating hours).
  const [hoursWarnings, setHoursWarnings] = useState(existing?.hoursWarnings ?? [])

  const [profile, setProfile] = useState(() =>
    existing
      ? { membershipId: existing.membershipId, displayName: existing.displayName, credentials: existing.credentials ?? '', specialty: existing.specialty, department: existing.department, room: existing.room ?? '', slotMinutes: String(existing.slotMinutes), status: existing.status }
      : { ...BLANK_PROFILE, membershipId: staff.account.membershipId, displayName: staff.fullName, credentials: staff.qualifications.join(', '), specialty: staff.designation, department: staff.department },
  )
  const [days, setDays] = useState(() =>
    Object.fromEntries(WEEK.map(([, weekday]) => {
      const sessions = (existing?.availability ?? []).filter((window) => window.weekday === weekday).map(({ branchId, start, end }) => ({ branchId, start, end }))
      return [weekday, { on: sessions.length > 0, sessions }]
    })),
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const defaultBranch = activeBranches[0]?.id ?? ''
  const setField = (name) => (event) => {
    setProfile((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setDirty(true)
  }
  const changeDay = (weekday, update) => {
    setDays((current) => ({ ...current, [weekday]: update(current[weekday]) }))
    setDirty(true)
  }
  const toggleDay = (weekday) => changeDay(weekday, (state) => ({ on: !state.on, sessions: !state.on && state.sessions.length === 0 ? [{ branchId: defaultBranch, start: '09:00', end: '13:00' }] : state.sessions }))
  const addSession = (weekday) => changeDay(weekday, (state) => ({ ...state, sessions: [...state.sessions, { branchId: state.sessions.at(-1)?.branchId ?? defaultBranch, start: '16:00', end: '19:00' }] }))
  const editSession = (weekday, index, patch) => changeDay(weekday, (state) => ({ ...state, sessions: state.sessions.map((session, position) => (position === index ? { ...session, ...patch } : session)) }))
  const removeSession = (weekday, index) => changeDay(weekday, (state) => {
    const sessions = state.sessions.filter((_, position) => position !== index)
    return { on: sessions.length > 0, sessions }
  })

  const windows = WEEK.flatMap(([, weekday]) => (days[weekday].on ? days[weekday].sessions.map((session) => ({ ...session, branchId: session.branchId || defaultBranch, weekday })) : []))
  const slotMinutes = Number(profile.slotMinutes) || 0
  const weeklyMinutes = windows.reduce((sum, window) => sum + Math.max(0, minutesOf(window.end) - minutesOf(window.start)), 0)
  const weeklySlots = slotMinutes ? windows.reduce((sum, window) => sum + Math.max(0, Math.floor((minutesOf(window.end) - minutesOf(window.start)) / slotMinutes)), 0) : 0
  const activeDays = WEEK.filter(([, weekday]) => days[weekday].on).length
  const branchNames = [...new Set(windows.map((window) => activeBranches.find((branch) => branch.id === window.branchId)?.name).filter(Boolean))]
  const memberName = staff.fullName

  const backPath = pathFor(ROUTES.staffMember, { staffId: staff.id })
  const save = async () => {
    setFormError('')
    const problems = {}
    for (const field of ['displayName', 'specialty', 'department']) if (!profile[field].trim()) problems[field] = 'Required.'
    if (windows.some((window) => window.start >= window.end)) problems.sessions = 'Each session must end after it starts.'
    setErrors(problems)
    if (Object.keys(problems).length) return

    setSaving(true)
    const body = { displayName: profile.displayName.trim(), credentials: profile.credentials, specialty: profile.specialty.trim(), department: profile.department.trim(), room: profile.room, slotMinutes }
    try {
      const saved = existing ? await practitionersApi.update(existing.id, { ...body, status: profile.status }) : await practitionersApi.create({ ...body, membershipId: profile.membershipId })
      const withHours = await practitionersApi.setAvailability(saved.id, windows.map(({ branchId, weekday, start, end }) => ({ branchId, weekday, start, end })))
      setHoursWarnings(withHours.hoursWarnings ?? [])
      setDirty(false)
      setSaving(false)
      if (!existing) onCreated()
    } catch (error) {
      setSaving(false)
      setFormError(error.message)
      if (error.code === 'VALIDATION_FAILED') setErrors(error.fieldErrors())
    }
  }

  const person = { initials: initialsOf(profile.displayName || memberName || 'New therapist'), name: profile.displayName || memberName || 'New therapist', staffCode: existing ? 'Therapist' : 'New' }

  return (
    <WorkspacePage>
      <div className="pb-20">
        <PageIntro
          eyebrow={<StatusPill tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Unsaved schedule changes' : existing ? 'Schedule saved' : 'New therapist profile'}</StatusPill>}
          title="OPD Schedule & Tariff"
          description="Configure when this therapist sees patients. These hours generate the appointment slots offered at booking."
          actions={
            <>
              <ActionButton icon={ArrowLeft} to={backPath}>Back to Staff Profile</ActionButton>
              {canManage && <ActionButton variant="brand" icon={Save} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Changes'}</ActionButton>}
            </>
          }
        />

        <PersonBanner
          person={person}
          badge={profile.status === 'active' ? 'Taking appointments' : undefined}
          subtitle={[profile.specialty, memberName && `Staff account: ${memberName}`].filter(Boolean).join(' · ') || 'Choose a staff member and describe their practice'}
          facts={[
            ['Department', profile.department || '—'],
            ['Branches', branchNames.length ? branchNames.join(', ') : 'None yet'],
            ['Slot length', slotMinutes ? `${slotMinutes} min` : '—'],
          ]}
        />

        {hoursWarnings.length > 0 && (
          <InfoNote tone="warning" className="mb-5">
            <strong>Outside the branch’s opening hours:</strong>
            <ul className="mt-1 list-inside list-disc">{hoursWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </InfoNote>
        )}

        {!canManage && <InfoNote tone="warning" className="mb-5">You can view this schedule. Changing it needs the “Assign &amp; dispatch therapist” permission.</InfoNote>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="01. Therapist profile" action={<span className="text-[11px] text-outline">Shown to reception at booking</span>} bodyClassName="grid gap-4 sm:grid-cols-2">
              <TextInput label="Staff account" value={memberName} readOnly hint="The schedule belongs to this person's ClinicOS account" />
              <TextInput label="Display name" required value={profile.displayName} onChange={setField('displayName')} error={errors.displayName} placeholder="Dr. Preeti Deshmukh" />
              <TextInput label="Credentials" value={profile.credentials} onChange={setField('credentials')} error={errors.credentials} placeholder="BPT, MPT" hint="Optional" />
              <TextInput label="Specialty" required value={profile.specialty} onChange={setField('specialty')} error={errors.specialty} placeholder="Physiotherapy" />
              {departments.loaded && !departments.names.length ? (
                <TextInput label="Clinical department" required value={profile.department} onChange={setField('department')} error={errors.department} placeholder="Physical Medicine & Rehab" />
              ) : (
                <SelectInput label="Clinical department" required placeholder="Choose a department" options={departments.names} value={profile.department} onChange={setField('department')} error={errors.department} />
              )}
              <TextInput label="Dedicated OPD chamber / suite" value={profile.room} onChange={setField('room')} error={errors.room} placeholder="Chamber 104" hint="Optional" />
              <SelectInput label="Appointment slot length" required value={profile.slotMinutes} onChange={setField('slotMinutes')} error={errors.slotMinutes} options={SLOT_LENGTHS.map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))} />
              {existing && <SelectInput label="Booking status" value={profile.status} onChange={setField('status')} options={[{ value: 'active', label: 'Taking appointments' }, { value: 'inactive', label: 'Not taking appointments' }]} />}
            </Panel>

            <Panel title="02. Weekly OPD schedule matrix" action={<span className="text-[11px] text-on-surface-variant"><span className="text-brand">●</span> {slotMinutes ? `${slotMinutes} mins / slot` : 'Choose a slot length'}</span>} bodyClassName="p-0">
              <InfoNote className="m-5 mb-0">
                <strong className="text-on-surface">How slots are made:</strong> each session is cut into back-to-back slots of the chosen length, starting at the session start. Sessions on the same day must not overlap. Changing hours never moves appointments that are already booked.
              </InfoNote>
              {errors.sessions && <p role="alert" className="mx-5 mt-3 text-xs text-rose-600">{errors.sessions}</p>}
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {WEEK.map(([name, weekday]) => {
                  const state = days[weekday]
                  return (
                    <li key={name} className={cn('flex flex-wrap items-start gap-4 px-5 py-4', !state.on && 'bg-surface-lowest')}>
                      <div className="flex w-36 items-start gap-3">
                        <Toggle checked={state.on} onChange={() => canManage && toggleDay(weekday)} label={`${name} OPD`} />
                        <div>
                          <p className="text-[13px] font-semibold text-on-surface">{name}</p>
                          <p className={cn('text-[11px]', state.on ? 'text-brand' : 'text-outline')}>{state.on ? `Active · ${state.sessions.length} session${state.sessions.length === 1 ? '' : 's'}` : 'Off'}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {state.on && (
                          <ul className="flex flex-col gap-2">
                            {state.sessions.map((session, index) => (
                              <li key={index} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-surface-lowest px-3 py-1.5 text-xs">
                                <label className="sr-only" htmlFor={`${name}-${index}-start`}>{`${name} session ${index + 1} start`}</label>
                                <input id={`${name}-${index}-start`} type="time" value={session.start} disabled={!canManage} onChange={(event) => editSession(weekday, index, { start: event.target.value })} className="rounded border border-slate-200 bg-white px-2 py-1 font-mono" />
                                <span className="text-outline">to</span>
                                <label className="sr-only" htmlFor={`${name}-${index}-end`}>{`${name} session ${index + 1} end`}</label>
                                <input id={`${name}-${index}-end`} type="time" value={session.end} disabled={!canManage} onChange={(event) => editSession(weekday, index, { end: event.target.value })} className="rounded border border-slate-200 bg-white px-2 py-1 font-mono" />
                                <label className="sr-only" htmlFor={`${name}-${index}-branch`}>{`${name} session ${index + 1} branch`}</label>
                                <select id={`${name}-${index}-branch`} value={session.branchId || defaultBranch} disabled={!canManage} onChange={(event) => editSession(weekday, index, { branchId: event.target.value })} className="rounded border border-slate-200 bg-white px-2 py-1">
                                  {activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                </select>
                                {slotMinutes > 0 && <span className="text-outline">{Math.max(0, Math.floor((minutesOf(session.end) - minutesOf(session.start)) / slotMinutes))} slots</span>}
                                {canManage && <button type="button" aria-label={`Remove ${name} session ${index + 1}`} onClick={() => removeSession(weekday, index)} className="ml-auto text-outline hover:text-danger"><Trash2 className="size-3.5" aria-hidden="true" /></button>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!state.on && <p className="text-xs text-outline italic">No OPD sessions · no slots generated</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {canManage && state.on && state.sessions.length < MAX_SESSIONS && <button type="button" onClick={() => addSession(weekday)} className="font-semibold text-brand hover:underline">+ Add Session</button>}
                        {canManage && !state.on && <button type="button" onClick={() => toggleDay(weekday)} className="font-semibold text-brand hover:underline">Enable Day</button>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title="03. Visit types & tariff" subtitle="Visit length comes from the slot length above. Fees are priced in billing." action={<Link to={ROUTES.services} className="text-xs font-semibold text-brand hover:underline">View Full Catalog ↗</Link>}>
              <ul className="flex flex-wrap gap-2">
                {APPOINTMENT_TYPES.map((type) => <li key={type} className="rounded border border-slate-200 bg-surface-lowest px-3 py-1.5 text-xs"><strong>{type}</strong> · {slotMinutes ? `${slotMinutes} min` : '—'}</li>)}
              </ul>
              <InfoNote className="mt-4">
                <strong className="text-on-surface">Segregation of duties:</strong> therapist profiles never set prices. Consultation fees and payout splits are managed in Configuration → Services &amp; Pricing.
              </InfoNote>
            </Panel>
          </div>

          <div className="flex flex-col gap-5">
            <Panel title="Configuration context" subtitle="What booking uses from this page">
              <dl className="space-y-3 text-xs">
                {[
                  ['Therapist', profile.displayName || '—'],
                  ['Branch deployment', branchNames.join(', ') || '—'],
                  ['Department scope', profile.department || '—'],
                  ['Scheduling model', slotMinutes ? `${slotMinutes}-min recurring slots` : '—'],
                  ['Booking status', profile.status === 'active' ? 'Taking appointments' : 'Paused'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-on-surface-variant">{label}</dt>
                    <dd className="text-right font-semibold text-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>
              <InfoNote className="mt-4">Double booking is blocked by the database: a slot can only be held by one open appointment, and a patient cannot hold two overlapping appointments.</InfoNote>
            </Panel>

            <Panel title="Weekly capacity summary" action={<StatusPill tone={windows.length ? 'success' : 'neutral'}>{windows.length ? 'Bookable' : 'No hours'}</StatusPill>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Total OPD time</p>
                  <p className="text-xl font-bold text-on-surface">{Math.round((weeklyMinutes / 60) * 10) / 10} <span className="text-xs font-normal">hrs/wk</span></p>
                </div>
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Max patient volume</p>
                  <p className="text-xl font-bold text-on-surface">{weeklySlots} <span className="text-xs font-normal">slots</span></p>
                  <p className="text-[11px] text-outline">{slotMinutes ? `At ${slotMinutes}m / slot` : 'Choose a slot length'}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Active days</dt><dd className="font-semibold text-on-surface">{activeDays} of 7</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Primary consulting chamber</dt><dd className="font-semibold text-on-surface">{profile.room || '—'}</dd></div>
              </dl>
            </Panel>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
          {formError ? <p role="alert" className="text-xs text-rose-600">{formError}</p> : <p className="text-xs text-on-surface-variant"><span className="mr-2 text-brand">●</span>{dirty ? 'Unsaved changes' : 'All changes saved'} · {windows.length} weekly session{windows.length === 1 ? '' : 's'}</p>}
          <div className="flex gap-2">
            <ActionButton onClick={() => navigate(backPath)}>Discard Unsaved Changes</ActionButton>
            <ActionButton variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save & Apply OPD Schedule'}</ActionButton>
          </div>
        </div>
      )}
    </WorkspacePage>
  )
}
