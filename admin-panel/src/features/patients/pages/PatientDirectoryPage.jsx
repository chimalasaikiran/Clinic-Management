import { useEffect, useState } from 'react'
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
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { GENDER_VALUES, toPatientView } from '../adapters'
import { branchesApi, patientsApi, practitionersApi } from '../api'
import { PATIENT_FILTERS } from '../data/patients'
import { formatDate } from '../format'

const EMPTY_FILTERS = { query: '', branch: '', department: '', status: '', visit: '', gender: '' }
const PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300

function PatientRow({ patient, compact, selected, onSelect, canEdit, onStatusChange }) {
  const profile = pathFor(ROUTES.patientHub, { patientId: patient.id })
  const [doctor, department] = patient.lastDoctor.split(' · ')
  const [menuOpen, setMenuOpen] = useState(false)
  const nextStatus = patient.status === 'Active' ? 'inactive' : 'active'

  return (
    <Row>
      <Cell className="w-10">
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${patient.name}`} className="accent-[#006a61]" />
      </Cell>
      <Cell className={compact ? 'py-1.5' : undefined}>
        <div className="flex items-center gap-3">
          <Avatar initials={patient.initials} tone="slate" />
          <div className="min-w-0">
            <Link to={profile} className="font-semibold hover:underline">{patient.name}</Link>
            {!compact && (
              <p className="text-[11px] text-on-surface-variant">
                {patient.age} yrs · {patient.gender} · <span className="font-mono">ABHA: {patient.abha}</span>
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
      <Cell><span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">{patient.branch}</span></Cell>
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
        <span className="relative flex items-center gap-2">
          <Link to={profile} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View Patient <ArrowRight className="size-3" aria-hidden="true" /></Link>
          {canEdit && (
            <>
              <button type="button" aria-label={`More actions for ${patient.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="text-outline hover:text-on-surface">
                <MoreVertical className="size-4" aria-hidden="true" />
              </button>
              {menuOpen && (
                <span role="menu" className="absolute top-6 right-0 z-10 flex min-w-44 flex-col rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
                  <Link role="menuitem" to={pathFor(ROUTES.patientEdit, { patientId: patient.id })} className="px-3 py-2 text-left hover:bg-surface-low">Edit patient</Link>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onStatusChange(patient, nextStatus) }} className="px-3 py-2 text-left hover:bg-surface-low">
                    {nextStatus === 'inactive' ? 'Mark as inactive' : 'Reactivate patient'}
                  </button>
                </span>
              )}
            </>
          )}
        </span>
      </Cell>
    </Row>
  )
}

export default function PatientDirectoryPage() {
  const { can } = useAuth()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [compact, setCompact] = useState(false)
  const [selected, setSelected] = useState([])
  const [notice, setNotice] = useState(null)

  // Search runs on the server; wait for a pause in typing before asking.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters.query.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [filters.query])

  const branches = useApiResource(() => branchesApi.list(), 'branches')
  const practitioners = useApiResource(() => (can('bookings.view') || can('bookings.create') ? practitionersApi.list() : Promise.resolve([])), 'practitioners')
  const branchList = branches.data ?? []
  const departments = [...new Set((practitioners.data ?? []).map((entry) => entry.department))].sort()
  const branchId = branchList.find((branch) => branch.name === filters.branch)?.id

  const params = {
    query,
    status: filters.status.toLowerCase() || undefined,
    gender: GENDER_VALUES[filters.gender],
    branchId,
    department: filters.department || undefined,
    visitWithinDays: PATIENT_FILTERS.visit.find((option) => option.label === filters.visit)?.days,
    page,
    pageSize: PAGE_SIZE,
  }
  const result = useApiResource(() => patientsApi.list(params), JSON.stringify(params))
  const rows = (result.data?.data ?? []).map(toPatientView)
  const total = result.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const last = (page - 1) * PAGE_SIZE + rows.length

  const set = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }
  const filtered = Object.values(filters).some(Boolean)
  const allSelected = rows.length > 0 && rows.every((patient) => selected.includes(patient.id))
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((patient) => patient.id))
  const toggleOne = (id) => setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))

  const changeStatus = async (patient, status) => {
    setNotice(null)
    try {
      await patientsApi.setStatus(patient.id, status, null)
      setNotice({ tone: 'success', text: `${patient.name} is now ${status}.` })
      result.reload()
    } catch (error) {
      setNotice({ tone: 'error', text: error.message })
    }
  }

  // Page numbers around the current page, at most four.
  const firstShown = Math.max(1, Math.min(page - 1, pages - 3))
  const pageNumbers = Array.from({ length: Math.min(4, pages) }, (_, index) => firstShown + index)

  return (
    <WorkspacePage>
      <PageIntro
        title="Patients"
        description="Find, register, and manage patients across your clinic network. Select a patient to access the authoritative Patient Details hub."
        actions={
          <>
            <ActionButton to={ROUTES.helpRequests}>Help Requests</ActionButton>
            <ActionButton icon={FileUp} disabled title="Bulk import is not connected yet">Import Patients <span className="rounded bg-surface-low px-1 font-mono text-[10px]">CSV / FHIR</span></ActionButton>
            {can('patients.create') && <ActionButton variant="primary" icon={UserPlus} to={ROUTES.patientNew}>Register Patient</ActionButton>}
          </>
        }
      />

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={filters.query} onChange={set('query')} label="Search patients" placeholder="Search by patient name, mobile number (+91), Patient ID (MRN), or ABHA number…" className="mb-3" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Branch" value={filters.branch} onChange={set('branch')} allLabel="All branches" options={branchList.map((branch) => branch.name)} />
          <FilterSelect label="Department" value={filters.department} onChange={set('department')} allLabel="Dept: All Departments" options={departments} />
          <FilterSelect label="Status" value={filters.status} onChange={set('status')} allLabel="Status: Any" options={PATIENT_FILTERS.status} />
          <FilterSelect label="Last visit" value={filters.visit} onChange={set('visit')} allLabel="Visit: Any Time" options={PATIENT_FILTERS.visit.map((option) => option.label)} />
          <FilterSelect label="Gender" value={filters.gender} onChange={set('gender')} allLabel="Gender: All Genders" options={PATIENT_FILTERS.gender} />
          {filtered && <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }} className="text-xs font-medium text-brand hover:underline">Reset Filters</button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          Showing {first}–{last} of {total.toLocaleString('en-IN')} {filtered ? 'matching' : 'registered'}
          <div role="group" aria-label="Row density" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {[['Comfortable', false], ['Compact', true]].map(([label, value]) => (
              <button key={label} type="button" aria-pressed={compact === value} onClick={() => setCompact(value)} className={cn('rounded px-2.5 py-1 font-medium', compact === value ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('mb-4 rounded-md border px-4 py-2.5 text-xs', notice.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-teal-200 bg-teal-50/60 text-on-surface')}>{notice.text}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left" aria-busy={result.loading}>
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
                <PatientRow key={patient.id} patient={patient} compact={compact} selected={selected.includes(patient.id)} onSelect={() => toggleOne(patient.id)} canEdit={can('patients.edit')} onStatusChange={changeStatus} />
              ))}
            </tbody>
          </table>
          {result.error && (
            <p role="alert" className="px-5 py-10 text-center text-sm text-danger">
              {result.error.message} <button type="button" onClick={result.reload} className="font-semibold text-brand hover:underline">Try again</button>
            </p>
          )}
          {!result.error && result.loading && rows.length === 0 && <p role="status" className="px-5 py-10 text-center text-sm text-on-surface-variant">Loading patients…</p>}
          {!result.error && !result.loading && rows.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-on-surface-variant">{filtered ? 'No patients match your search.' : 'No patients are registered yet. Register the first patient to get started.'}</p>
          )}
        </div>
        <TableFooter summary={selected.length ? `${selected.length} selected` : `Showing ${first}–${last} of ${total.toLocaleString('en-IN')} patients`}>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <ActionButton size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</ActionButton>
            {pageNumbers.map((number) =>
              number === page ? (
                <span key={number} className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white" aria-current="page">{number}</span>
              ) : (
                <ActionButton key={number} size="sm" onClick={() => setPage(number)}>{number}</ActionButton>
              ),
            )}
            <ActionButton size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          { icon: Fingerprint, title: 'Identity Verification & Duplicate Safety', text: 'Patient search covers name, hospital MRN, ABHA number and +91 phone numbers. Duplicate detection runs during intake on the mobile number to safeguard historical records.' },
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
