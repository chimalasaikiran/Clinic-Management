import { useState } from 'react'
import { ArrowRight, FileUp, Fingerprint, MoreVertical, Network, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { usePatientRecords } from '../context/usePatientRecords'
import { PATIENT_FILTERS, PATIENT_TOTAL } from '../data/patients'
import { TODAY, daysBetween, digitsOf, formatDate } from '../format'

const EMPTY_FILTERS = { query: '', branch: '', department: '', status: '', visit: '', gender: '' }
const BRANCH_TONES = { 'Kondapur Satellite Clinic': 'bg-amber-50 text-amber-900', 'Metro North Clinic': 'bg-sky-50 text-sky-900' }
const AVATAR_TONES = { teal: 'teal', amber: 'teal', slate: 'slate' }

function PatientRow({ patient, compact, selected, onSelect }) {
  const profile = pathFor(ROUTES.patientHub, { patientId: patient.id })
  const [doctor, department] = patient.lastDoctor.split(' · ')

  return (
    <Row>
      <Cell className="w-10">
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${patient.name}`} className="accent-[#006a61]" />
      </Cell>
      <Cell className={compact ? 'py-1.5' : undefined}>
        <div className="flex items-center gap-3">
          <Avatar initials={patient.initials} tone={AVATAR_TONES[patient.tone] ?? 'slate'} />
          <div className="min-w-0">
            <Link to={profile} className="font-semibold hover:underline">{patient.name}</Link>
            {!compact && (
              <p className="text-[11px] text-on-surface-variant">
                {patient.age} yrs · {patient.gender}
                {patient.ageTag && ` (${patient.ageTag})`} · <span className="font-mono">ABHA: {patient.abha}</span>
              </p>
            )}
          </div>
        </div>
      </Cell>
      <Cell><span className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-[11px]">{patient.mrn}</span></Cell>
      <Cell>
        <p className="text-xs font-medium">{patient.mobile}</p>
        {!compact && <p className="text-[11px] text-on-surface-variant">{patient.contactNote}</p>}
      </Cell>
      <Cell><span className={cn('rounded px-1.5 py-0.5 text-[11px]', BRANCH_TONES[patient.branch] ?? 'bg-surface-high')}>{patient.branch}</span></Cell>
      <Cell>
        {patient.lastVisit ? (
          <>
            <p className="text-xs font-medium">{formatDate(patient.lastVisit)}</p>
            {!compact && <p className="text-[11px] text-on-surface-variant">{doctor}{department && ` · ${department}`}</p>}
          </>
        ) : (
          <span className="text-[11px] text-outline">No visits yet</span>
        )}
      </Cell>
      <Cell>
        <StatusPill tone={patient.status === 'Active' ? 'success' : 'neutral'} dot>
          {patient.status}
          {patient.statusNote && ` (${patient.statusNote})`}
        </StatusPill>
      </Cell>
      <Cell>
        <span className="flex items-center gap-2">
          <Link to={profile} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View Patient <ArrowRight className="size-3" aria-hidden="true" /></Link>
          <button type="button" aria-label={`More actions for ${patient.name}`} className="text-outline hover:text-on-surface"><MoreVertical className="size-4" aria-hidden="true" /></button>
        </span>
      </Cell>
    </Row>
  )
}

export default function PatientDirectoryPage() {
  const { patients } = usePatientRecords()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [compact, setCompact] = useState(false)
  const [selected, setSelected] = useState([])

  const set = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }))
  const needle = filters.query.trim().toLowerCase()
  const needleDigits = digitsOf(filters.query)
  const visitWindow = PATIENT_FILTERS.visit.find((option) => option.label === filters.visit)?.days
  const rows = patients.filter(
    (patient) =>
      (!needle ||
        `${patient.name} ${patient.mrn} ${patient.abha}`.toLowerCase().includes(needle) ||
        (needleDigits.length >= 3 && digitsOf(`${patient.mobile} ${patient.abha}`).includes(needleDigits))) &&
      (!filters.branch || patient.branch === filters.branch) &&
      (!filters.department || patient.lastDoctor.includes(filters.department)) &&
      (!filters.status || patient.status === filters.status) &&
      (!filters.gender || patient.gender === filters.gender) &&
      (!visitWindow || (patient.lastVisit && daysBetween(patient.lastVisit, TODAY) <= visitWindow)),
  )
  const filtered = Object.values(filters).some(Boolean)
  const total = PATIENT_TOTAL + (patients.length - 8)
  const allSelected = rows.length > 0 && rows.every((patient) => selected.includes(patient.id))
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((patient) => patient.id))
  const toggleOne = (id) => setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))

  return (
    <WorkspacePage>
      <PageIntro
        title="Patients"
        description="Find, register, and manage patients across your clinic network. Select a patient to access the authoritative Patient Details hub."
        actions={
          <>
            <ActionButton icon={FileUp} disabled title="Bulk import is not connected yet">Import Patients <span className="rounded bg-surface-low px-1 font-mono text-[10px]">CSV / FHIR</span></ActionButton>
            <ActionButton variant="primary" icon={UserPlus} to={ROUTES.patientNew}>Register Patient</ActionButton>
          </>
        }
      />

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={filters.query} onChange={set('query')} label="Search patients" placeholder="Search by patient name, mobile number (+91), Patient ID (MRN), or ABHA number…" className="mb-3" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Branch" value={filters.branch} onChange={set('branch')} allLabel="All branches" options={PATIENT_FILTERS.branch} />
          <FilterSelect label="Department" value={filters.department} onChange={set('department')} allLabel="Dept: All Departments" options={PATIENT_FILTERS.department} />
          <FilterSelect label="Status" value={filters.status} onChange={set('status')} allLabel="Status: Any" options={PATIENT_FILTERS.status} />
          <FilterSelect label="Last visit" value={filters.visit} onChange={set('visit')} allLabel="Visit: Any Time" options={PATIENT_FILTERS.visit.map((option) => option.label)} />
          <FilterSelect label="Gender" value={filters.gender} onChange={set('gender')} allLabel="Gender: All Genders" options={PATIENT_FILTERS.gender} />
          {filtered && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-medium text-brand hover:underline">Reset Filters</button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          Showing 1–{rows.length} of {filtered ? rows.length : total.toLocaleString('en-IN')} verified
          <div role="group" aria-label="Row density" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {[['Comfortable', false], ['Compact', true]].map(([label, value]) => (
              <button key={label} type="button" aria-pressed={compact === value} onClick={() => setCompact(value)} className={cn('rounded px-2.5 py-1 font-medium', compact === value ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-surface-low text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all patients" className="accent-[#006a61]" />
                </th>
                {['Patient & ABHA ID', 'Patient ID (MRN)', 'Mobile & contact', 'Primary branch', 'Last visit & attending', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((patient) => (
                <PatientRow key={patient.id} patient={patient} compact={compact} selected={selected.includes(patient.id)} onSelect={() => toggleOne(patient.id)} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No patients match your search.</p>}
        </div>
        <TableFooter summary={selected.length ? `${selected.length} selected` : `Showing 1–${rows.length} of ${(filtered ? rows.length : total).toLocaleString('en-IN')} patients`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled>Previous</ActionButton>
            <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">1</span>
            {[2, 3, 4].map((page) => (
              <ActionButton key={page} size="sm" disabled title="Sample data covers the first page only">{page}</ActionButton>
            ))}
            <ActionButton size="sm" disabled>Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          { icon: Fingerprint, title: 'Identity Verification & Duplicate Safety', text: 'Patient search aggregates across national ABHA Health ID, hospital MRN, and +91 phone numbers. Duplicate detection runs automatically in real time during intake to safeguard historical EHR records.' },
          { icon: Network, title: 'Decoupled Clinical Architecture', text: 'Clinical encounters, telemetry streams, and billing ledgers are encapsulated within each individual patient record hub, keeping this master directory optimized for high-throughput front-desk workflows.' },
        ].map(({ icon: Icon, title, text }) => (
          <section key={title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded bg-teal-50 text-brand"><Icon className="size-4" aria-hidden="true" /></span>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">{text}</p>
            </div>
          </section>
        ))}
      </div>
    </WorkspacePage>
  )
}
