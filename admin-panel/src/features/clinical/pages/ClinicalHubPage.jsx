import { useState } from 'react'
import { AlertTriangle, Ban, HeartPulse, Siren } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { OWNER } from '../../../config/workspace'
import { cn } from '../../../lib/cn'
import { CHAMBERS } from '../../appointments/constants'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { DOCTORS } from '../../patients/data/catalog'
import { formatDate } from '../../patients/format'
import { ATTENDING, INCIDENT_CATEGORIES, ROLE_SCOPES, SEVERITY_LEVELS } from '../constants'
import { hubSummary, safetyExceptions, WORK_VIEWS, workAction, workItems } from '../hub'

const PAGE_SIZE = 5
const SCOPE_VIEWS = [
  { id: 'mine', label: 'My Clinical Work' },
  { id: 'clinic', label: 'Clinic-Wide Operational Overview' },
  { id: 'dept', label: 'Cardiology & Internal Med Dept' },
]
const DEPT_MATCH = ['Cardiology', 'Internal Medicine']

function Tile({ label, value, hint, danger, children }) {
  return (
    <div className={cn('rounded-lg border p-4', danger ? 'border-2 border-danger bg-white' : 'border-slate-200 bg-white')}>
      <p className={cn('text-[10px] font-semibold tracking-wide uppercase', danger ? 'text-danger' : 'text-outline')}>{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-3xl font-semibold">{value}<span className="text-xs font-normal text-on-surface-variant">{hint}</span></p>
      {children}
    </div>
  )
}

export default function ClinicalHubPage() {
  const { records } = usePatientRecords()
  const navigate = useNavigate()
  const location = useLocation()
  const [scopeId, setScopeId] = useState('dual')
  const [view, setView] = useState('mine')
  const [workView, setWorkView] = useState('all')
  const [query, setQuery] = useState('')
  const [doctor, setDoctor] = useState('')
  const [page, setPage] = useState(1)
  const scope = ROLE_SCOPES.find((entry) => entry.id === scopeId)
  const summary = hubSummary(records)
  const exceptions = safetyExceptions(records)
  const all = workItems(records)

  const scoped = all.filter((item) => (view === 'mine' ? item.appointment.doctorId === ATTENDING.id : view === 'dept' ? DEPT_MATCH.some((name) => item.department.includes(name)) : true))
  const needle = query.trim().toLowerCase()
  const selected = WORK_VIEWS.find((entry) => entry.id === workView)
  const rows = scoped.filter((item) => selected.test(item) && (!doctor || item.appointment.doctorId === doctor) && (!needle || `${item.patient?.name} ${item.patient?.mrn} ${item.appointment.reason} ${item.token}`.toLowerCase().includes(needle)))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const reset = (setter) => (value) => { setter(value); setPage(1) }
  const saved = location.state?.incident

  const alertTarget = (alert) => (alert.patientId ? pathFor(alert.kind === 'PENDING DIAGNOSTIC' ? ROUTES.patientOrders : ROUTES.patientRecords, { patientId: alert.patientId }) : ROUTES.clinical)
  const alertLabel = (alert) => (alert.kind === 'PENDING DIAGNOSTIC' ? 'Acknowledge Critical Result' : alert.kind.startsWith('ALLERGY') ? `Review & Resolve Alert [${alert.id}]` : 'Review Safety Alert')

  const go = (item, action) => {
    const { appointment, encounter } = item
    const params = { patientId: appointment.patientId, appointmentId: appointment.id }
    const target = {
      sign: encounter && pathFor(ROUTES.encounter, { patientId: appointment.patientId, encounterId: encounter.id }),
      view: encounter && pathFor(ROUTES.encounter, { patientId: appointment.patientId, encounterId: encounter.id }),
      encounter: appointment.encounterId && pathFor(ROUTES.encounter, { patientId: appointment.patientId, encounterId: appointment.encounterId }),
      start: pathFor(ROUTES.appointmentStartEncounter, params),
      checkin: pathFor(ROUTES.appointmentCheckIn, params),
      summary: pathFor(ROUTES.appointment, params),
    }[action.kind]
    if (target) navigate(target)
  }

  return (
    <WorkspacePage>
      {saved && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">Incident {saved} was submitted to the Clinical Governance Committee.</p>}
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl"><h1 className="text-[28px] leading-9 font-bold tracking-tight">Clinical</h1><p className="mt-1 text-sm text-on-surface-variant">Operational clinical command hub: manages active patient encounters, clinical documentation sign-offs, diagnostic result acknowledgements, and clinical safety exceptions.</p></div>
          <div className="flex items-center gap-3"><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Clinical scope</span><FilterTabs label="Clinical scope" value={view} onChange={reset(setView)} options={SCOPE_VIEWS.map((entry) => ({ id: entry.id, label: entry.label, count: entry.id === 'mine' ? all.filter((item) => item.appointment.doctorId === ATTENDING.id).length : entry.id === 'clinic' ? all.length : undefined }))} /></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs">
          <p><span className="text-outline">Active clearance preview: </span><span className="rounded bg-surface-low px-2 py-1 font-mono">{OWNER.name} ({scope.sign ? 'Owner & Attending Physician' : 'Owner'})</span></p>
          <p className="mt-2 flex flex-wrap items-center gap-2"><span className="text-outline">Simulate scope:</span>{ROLE_SCOPES.map((entry) => <button key={entry.id} type="button" aria-pressed={entry.id === scopeId} onClick={() => setScopeId(entry.id)} className={cn('rounded border px-2.5 py-1 font-medium', entry.id === scopeId ? 'border-black bg-black text-white' : 'border-slate-200 bg-surface-lowest')}>{entry.label}</button>)}</p>
          {!scope.sign && <p className="mt-2 text-amber-800">This scope cannot sign notes or acknowledge clinical results. Owner access does not grant clinical sign-off.</p>}
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Active encounters" value={summary.inConsultation} hint="In Consultation" />
        <Tile label="Pending documentation" value={summary.pendingDocumentation} hint="Incomplete Notes" />
        <Tile label="Diagnostic results" value={summary.awaitingReview} hint="Awaiting Review" />
        <Tile label="Clinical safety" value={summary.mandatory} hint="Mandatory Actions" danger><p className="mt-2 rounded bg-danger px-2 py-1 text-center text-[10px] font-semibold text-white">{summary.mandatory ? 'RED ALERT TRIAGE REQUIRED' : 'NO OPEN ALERTS'}</p></Tile>
        <Tile label="Care plan follow-ups" value={summary.followUpsDue} hint="Due Today" />
      </div>

      <section className="mb-5 overflow-hidden rounded-lg border border-red-200 bg-red-50/60">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div><h2 className="text-base font-bold tracking-wide text-danger uppercase">Mandatory clinical safety exceptions &amp; red-flag interventions ({exceptions.length} unresolved)</h2><p className="text-xs text-on-surface-variant">Statutory clinical responsibility · zero override without documented medical justification</p></div>
          <div className="flex items-center gap-2"><ActionButton variant="danger" icon={AlertTriangle} to={ROUTES.incidentNew}>Report Clinical Incident</ActionButton>{exceptions.some((entry) => entry.alert.kind.startsWith('ALLERGY')) && <span className="rounded border border-red-300 bg-white px-2 py-1 font-mono text-[10px] text-danger">E-Prescribing Locks Active</span>}</div>
        </header>
        <ul>
          {exceptions.length === 0 && <li className="border-t border-red-100 px-5 py-6 text-sm text-on-surface-variant">No mandatory safety exceptions are open.</li>}
          {exceptions.map(({ alert, patient }) => (
            <li key={alert.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-red-100 bg-white px-5 py-4">
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-danger">{alert.kind.startsWith('ALLERGY') ? <Ban className="size-4" aria-hidden="true" /> : alert.kind === 'SENTINEL EVENT' ? <Siren className="size-4" aria-hidden="true" /> : <HeartPulse className="size-4" aria-hidden="true" />}</span>
                <div className="text-xs">
                  <p className="flex flex-wrap items-center gap-2"><span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">{alert.kind}</span><span className="font-mono text-outline">REF: {alert.id}</span></p>
                  <p className="mt-1 text-base font-semibold">{patient ? patient.name : 'General incident'} {patient && <span className="text-xs font-normal text-outline">{patient.age}{patient.gender[0]} · UHID: {patient.mrn}{patient.abha ? ` · ABHA: ${patient.abha}` : ''}</span>}</p>
                  <p className="mt-1 font-medium text-danger">{alert.title}</p>
                  <p className="text-on-surface-variant">{alert.detail}</p>
                </div>
              </div>
              {alert.patientId ? (
                <ActionButton variant={scope.sign ? 'danger' : 'secondary'} to={scope.sign ? alertTarget(alert) : undefined} disabled={!scope.sign} title={scope.sign ? undefined : 'Owner access does not grant clinical sign-off'}>{alertLabel(alert)} →</ActionButton>
              ) : (
                <StatusPill tone="danger">Director escalation</StatusPill>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-start justify-between gap-3 p-5"><div><h2 className="text-lg font-semibold">Primary Clinical Work Queue</h2><p className="text-xs text-on-surface-variant">Real-time OPD triage, chamber progression, and digital signature sign-offs.</p></div><p className="text-[11px] text-outline">Live sync from today’s bookings</p></header>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
          <FilterTabs label="Work queue view" value={workView} onChange={reset(setWorkView)} options={WORK_VIEWS.map((entry) => ({ id: entry.id, label: entry.label, count: scoped.filter(entry.test).length }))} />
          <SearchBox value={query} onChange={reset(setQuery)} label="Filter patient, complaint or token" placeholder="Filter patient, complaint, or token…" className="ml-auto w-64" />
          <select aria-label="Assigned clinician" value={doctor} onChange={(event) => reset(setDoctor)(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand"><option value="">Assigned: All clinicians</option>{CHAMBERS.map((entry) => <option key={entry.doctorId} value={entry.doctorId}>{DOCTORS.find((item) => item.id === entry.doctorId).short} (Chamber {entry.chamber})</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Token & chamber', 'Patient identity & ABHA', 'Presentation / chief complaint', 'Responsible clinician', 'Dwell & status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {shown.map((item) => {
                const action = workAction(item, scope)
                return (
                  <tr key={item.id} className="border-b border-slate-100 align-top text-xs hover:bg-surface-lowest">
                    <td className="px-4 py-3">{item.appointment.queueToken && <span className="mr-2 rounded bg-black px-1.5 py-1 font-mono text-[11px] font-semibold text-white">{item.token}</span>}<strong>{item.chamber}</strong><p className="mt-1 text-outline">{item.department}</p></td>
                    <td className="px-4 py-3"><Link to={pathFor(ROUTES.patientHub, { patientId: item.appointment.patientId })} className="text-sm font-semibold text-on-surface hover:underline">{item.patient?.name}</Link><p className="text-outline">{item.patient?.age}{item.patient?.gender[0]} · {item.patient?.mrn}</p><p className="text-outline">ABHA {item.patient?.abha ? 'Verified' : 'Not linked'}</p></td>
                    <td className="px-4 py-3"><p className="font-medium">{item.appointment.reason}</p>{item.alert && <p className="mt-1 text-danger">Allergy Lock {item.alert.id}</p>}</td>
                    <td className="px-4 py-3"><p className="font-medium">{item.appointment.doctorShort}</p><p className="text-outline">{item.appointment.specialty}</p></td>
                    <td className="px-4 py-3"><StatusPill tone={item.dwell.tone} dot>{item.dwell.label}</StatusPill><p className="mt-1 text-outline">{item.dwell.note}</p></td>
                    <td className="px-4 py-3">{action ? <ActionButton size="sm" variant={action.kind === 'sign' ? 'primary' : action.kind === 'encounter' ? 'brand' : 'secondary'} onClick={() => go(item, action)}>{action.label}</ActionButton> : <span className="text-[11px] text-outline">{scope.sign || scope.triage ? '—' : 'View only'}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No clinical work items match this view.</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs text-on-surface-variant">
          <span>Showing {shown.length} of {rows.length} clinical items</span>
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={number === current ? 'page' : undefined} onClick={() => setPage(number)} className={cn('rounded border px-2.5 py-1', number === current ? 'border-brand bg-brand text-white' : 'border-slate-200')}>{number}</button>)}
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </nav>
        </footer>
      </section>

      {records.incidents.length > 0 && (
        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Reported clinical incidents</h2>
          <ul className="flex flex-col gap-2 text-xs">
            {records.incidents.map((incident) => {
              const level = SEVERITY_LEVELS.find((entry) => entry.level === incident.severity)
              const patient = records.patients.find((entry) => entry.id === incident.patientId)
              return <li key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"><span><strong className="font-mono">{incident.id}</strong> · {incident.headline}<span className="block text-outline">{INCIDENT_CATEGORIES.find((entry) => entry.id === incident.category)?.label} · {formatDate(incident.date)} · {incident.zone}{patient ? ` · ${patient.name}` : ''}</span></span><StatusPill tone={incident.severity >= 4 ? 'danger' : 'neutral'}>Level {incident.severity} · {level.name}</StatusPill></li>
            })}
          </ul>
        </section>
      )}
      <p className="font-mono text-[10px] text-outline">ABDM FHIR R4 clinical health record v2.4 compliant · DISHA 2024 statutory consent enforced · role-based access control active</p>
    </WorkspacePage>
  )
}
