import { useState } from 'react'
import { ClipboardList, Lock, Stethoscope } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import { formatDate, formatTime } from '../format'
import { byNewest, startEncounterPath } from '../selectors'

const TABS = [
  { id: 'all', label: 'All encounters', test: () => true },
  { id: 'opd', label: 'OPD Consultations', test: (encounter) => encounter.mode === 'OPD' },
  { id: 'procedure', label: 'Procedures & Diagnostics', test: (encounter) => encounter.mode === 'Procedure' },
  { id: 'tele', label: 'Tele-Health', test: (encounter) => encounter.mode === 'Tele' },
  { id: 'cancelled', label: 'Cancelled', test: (encounter) => encounter.status === 'Cancelled' },
]

const statusTone = (status) => (status === 'In Progress' ? 'brand' : status === 'Tele-Completed' ? 'info' : status === 'Validated' ? 'success' : 'neutral')

export default function EncountersTab() {
  const { patient, patientId, mine } = usePatient()
  const encounters = mine('encounters').sort(byNewest)
  const vitals = mine('vitals')
  const appointments = mine('appointments')
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [clinician, setClinician] = useState('')
  const [department, setDepartment] = useState('')

  const active = encounters.find((encounter) => encounter.status === 'In Progress')
  const latestDone = encounters.find((encounter) => encounter.status !== 'In Progress')
  const needle = query.trim().toLowerCase()
  const selectedTab = TABS.find((entry) => entry.id === tab)
  const rows = encounters.filter(
    (encounter) =>
      selectedTab.test(encounter) &&
      (!needle || `${encounter.id} ${encounter.type} ${encounter.reason} ${encounter.doctor}`.toLowerCase().includes(needle)) &&
      (!clinician || encounter.doctor === clinician) &&
      (!department || encounter.department === department),
  )
  const unique = (key) => [...new Set(encounters.map((encounter) => encounter[key]))]
  const modes = { OPD: 0, Procedure: 0, Tele: 0 }
  encounters.forEach((encounter) => { modes[encounter.mode] = (modes[encounter.mode] ?? 0) + 1 })
  const activeVitals = active && vitals.filter((entry) => entry.encounterId === active.id).sort(byNewest)[0]
  const open = (encounter) => pathFor(ROUTES.encounter, { patientId, encounterId: encounter.id })

  if (!encounters.length) {
    return (
      <EmptyState icon={ClipboardList} title="No encounters recorded" action={<ActionButton variant="primary" to={startEncounterPath(patientId, appointments)}>Start Encounter</ActionButton>}>
        Clinical encounters appear here once a booked visit is checked in and started.
      </EmptyState>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">Encounters <StatusPill>{encounters.length} total logs</StatusPill></h2>
          <p className="text-sm text-on-surface-variant">View, audit, and document this patient&apos;s longitudinal clinical encounters across licensed clinic branches.</p>
        </div>
        <ActionButton variant="primary" icon={Stethoscope} to={startEncounterPath(patientId, appointments)}>Start Encounter</ActionButton>
      </div>

      <StatTiles
        className="mb-5 lg:grid-cols-5"
        items={[
          { label: 'Active today', value: active ? '1 In consultation' : '0 Active', hint: active ? `Started ${formatTime(active.time)}` : 'No open encounter' },
          { label: 'Latest completed', value: latestDone ? formatDate(latestDone.date) : '—', hint: latestDone ? `${latestDone.doctor} · ${latestDone.department}` : '' },
          { label: 'Total recorded', value: `${encounters.length} Encounters`, hint: `Across ${unique('branch').length} facilities` },
          { label: 'Modality distribution', value: `${modes.OPD} OPD · ${modes.Procedure} Proc. · ${modes.Tele} Tele`, hint: '100% care protocols met' },
          { label: 'ABDM care sync', value: `${encounters.filter((encounter) => encounter.status !== 'In Progress').length} / ${encounters.length} Synced`, hint: 'Milestone 3 cryptographic hash verified' },
        ]}
      />

      {active && (
        <section className="mb-5 rounded-lg border-2 border-teal-300 bg-teal-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <StatusPill tone="brand" dot className="uppercase">Active care context · today&apos;s encounter · #{active.id}</StatusPill>
              <p className="mt-2 text-base font-bold">{active.doctor} <span className="text-sm font-normal text-on-surface-variant">({active.department}) · {active.chamber} · {formatDate(active.date)}, {formatTime(active.time)} IST</span></p>
              {activeVitals && (
                <p className="mt-2 flex flex-wrap gap-2 text-xs">
                  {[['BP', `${activeVitals.bp.sys}/${activeVitals.bp.dia} mmHg`], ['Heart Rate', `${activeVitals.pulse} bpm`], ['SpO₂', `${activeVitals.spo2}%`], ['Temp', `${activeVitals.temp}°F`]].map(([label, value]) => (
                    <span key={label} className="rounded border border-slate-200 bg-white px-2 py-1">{label}: <strong>{value}</strong></span>
                  ))}
                </p>
              )}
            </div>
            <ActionButton variant="brand" to={open(active)}>Open Encounter &amp; Document Care →</ActionButton>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <FilterTabs label="Encounter type" value={tab} onChange={setTab} options={TABS.map((entry) => ({ id: entry.id, label: entry.label, count: encounters.filter(entry.test).length }))} />
          <SearchBox value={query} onChange={setQuery} label="Search encounters" placeholder="Search by ID, clinician, diagnosis…" className="w-64" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs text-on-surface-variant">
          Clinician: <FilterSelect label="Clinician" value={clinician} onChange={setClinician} allLabel={`All Doctors (${unique('doctor').length})`} options={unique('doctor')} />
          Department: <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="All Departments" options={unique('department')} />
          <span className="ml-auto">Showing {rows.length} of {encounters.length} rows</span>
        </div>
        <Table headings={['Date & encounter ID', 'Encounter type & clinical reason', 'Attending clinician', 'Dept & chamber', 'Facility / branch', 'Clinical artifacts', 'Status', 'Actions']} minWidth={1180} empty={rows.length ? null : 'No encounters match the current filters.'}>
          {rows.map((encounter) => (
            <Row key={encounter.id}>
              <Cell><p className="font-semibold">{formatDate(encounter.date)}</p><p className="font-mono text-[11px] font-semibold text-brand">#{encounter.id}</p><p className="text-[10px] text-outline">{formatTime(encounter.time)}{encounter.minutes ? ` · ${encounter.minutes} mins` : ''}</p></Cell>
              <Cell><p className="font-semibold">{encounter.type}</p><p className="text-[11px] text-on-surface-variant">{encounter.reason}</p>{encounter.icd && <p className="font-mono text-[10px] text-brand">{encounter.icd}</p>}</Cell>
              <Cell><p className="font-semibold">{encounter.doctor}</p><p className="text-[11px] text-on-surface-variant">{encounter.credentials}</p></Cell>
              <Cell><p>{encounter.department}</p><p className="text-[11px] text-on-surface-variant">{encounter.chamber}</p></Cell>
              <Cell><p>{encounter.branch}</p><p className="text-[11px] text-on-surface-variant">{encounter.campus}</p></Cell>
              <Cell><span className="flex flex-wrap gap-1">{encounter.artifacts.map((artifact) => <span key={artifact} className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-[10px]">{artifact}</span>)}</span></Cell>
              <Cell><StatusPill tone={statusTone(encounter.status)}>{encounter.status !== 'In Progress' && encounter.status.includes('Locked') && <Lock className="size-3" aria-hidden="true" />}{encounter.status === 'In Progress' ? 'Checked-in / Active' : encounter.status}</StatusPill></Cell>
              <Cell>
                <ActionButton size="sm" variant={encounter.status === 'In Progress' ? 'brand' : 'secondary'} to={open(encounter)}>{encounter.status === 'In Progress' ? 'Open Encounter' : 'View Summary'}</ActionButton>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary="ABDM v2 synced · Milestone 3 cryptographic care context active · HIPAA & DISHA compliant">
          <span>{patient.name} · {patient.mrn}</span>
        </TableFooter>
      </div>
    </div>
  )
}
