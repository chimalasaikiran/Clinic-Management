import { useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { exportCsv } from '../../../lib/exportCsv'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { localToday } from '../../patients/format'
import { toLedgerRow, toPersonView } from '../adapters'
import { staffApi } from '../api'
import { AttendanceDetailDrawer, EditAttendanceDrawer, RecordAttendanceDrawer } from '../components/AttendanceDrawers'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { attendanceTone } from '../statusTones'
import { formatLedgerDate } from '../time'

const SUMMARY = [['Present', 'present', 'text-brand'], ['Late', 'late', 'text-amber-700'], ['Absent', 'absent', 'text-danger'], ['Leave', 'leave', 'text-brand'], ['Unavailable', 'unavailable', 'text-outline']]
const rowTint = (record) => (record.status === 'Late' ? 'bg-amber-50/50' : record.status === 'Absent' ? 'bg-red-50/50' : '')

function shiftMonth(month, delta) {
  const [year, value] = month.split('-').map(Number)
  const moved = new Date(year, value - 1 + delta, 1)
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export default function AttendancePage() {
  const { staffId } = useParams()
  const person = useApiResource(() => staffApi.get(staffId), staffId)
  if (person.loading && !person.data) return <WorkspacePage><LoadingState label="Loading attendance…" /></WorkspacePage>
  if (!person.data) return <StaffNotFound title="Attendance & Work Records" />
  return <Ledger record={person.data} />
}

function Ledger({ record }) {
  const { can } = useAuth()
  const person = toPersonView(record)
  const branches = record.branches
  const [month, setMonth] = useState(localToday().slice(0, 7))
  const [branchId, setBranchId] = useState(branches.find((branch) => branch.isPrimary)?.id ?? branches[0]?.id ?? '')
  const [statusFilter, setStatusFilter] = useState('')
  const [overlay, setOverlay] = useState(null)
  const data = useApiResource(() => staffApi.attendance(record.id, month, branchId || undefined), `${record.id}:${month}:${branchId}`)

  const memberPath = pathFor(ROUTES.staffMember, { staffId: record.id })
  const rows = (data.data?.records ?? []).map(toLedgerRow)
  const visible = rows.filter((row) => !statusFilter || row.status === statusFilter)
  const counts = data.data?.counts ?? {}
  const detail = overlay?.id ? rows.find((row) => row.id === overlay.id) : null
  const branchName = branches.find((branch) => branch.id === branchId)?.name ?? 'this branch'
  const close = () => setOverlay(null)

  const record_ = async (body) => {
    await staffApi.recordAttendance(record.id, body)
    data.reload()
  }
  const correct = async (row, body) => {
    await staffApi.correctAttendance(record.id, row.id, body)
    data.reload()
    setOverlay({ type: 'detail', id: row.id })
  }
  const download = () => exportCsv(`attendance-${record.staffCode}-${month}.csv`, [['Date', 'Branch', 'Status', 'Arrival', 'Recorded by', 'Corrections'], ...rows.map((row) => [row.isoDate, row.facility, row.status, row.time, row.by, row.corrections.length])])

  return (
    <WorkspacePage>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-outline">
        <Link to={memberPath} className="inline-flex items-center gap-1 hover:text-on-surface"><ArrowLeft className="size-3" aria-hidden="true" />Back to Staff Details</Link>/
        <Link to={ROUTES.staffDirectory} className="hover:text-on-surface">Staff &amp; Doctors</Link>/
        <Link to={memberPath} className="hover:text-on-surface">{person.name} ({person.staffCode})</Link>/
        <span className="font-medium text-on-surface">Attendance &amp; Work Records</span>
      </nav>

      <PageIntro
        title={<span className="flex flex-wrap items-center gap-3">Attendance &amp; Work Records<StatusPill tone={person.status === 'Active' ? 'success' : 'neutral'} dot className="text-[11px]">{person.status}</StatusPill></span>}
        description="Actual attendance for this person, recorded per branch and day. Independent from OPD schedules and payroll."
        actions={
          <>
            <ActionButton icon={CalendarDays} to={pathFor(ROUTES.staffSchedule, { staffId: record.id })}>View OPD Schedule</ActionButton>
            <ActionButton to={pathFor(ROUTES.staffLeave, { staffId: record.id })}>View Leave &amp; Availability</ActionButton>
            {can('staff.attendance') && <ActionButton variant="primary" icon={Plus} disabled={branches.length === 0} title={branches.length ? undefined : 'Assign a branch first'} onClick={() => setOverlay({ type: 'record' })}>Record Attendance</ActionButton>}
          </>
        }
      />

      <PersonBanner person={person} subtitle={person.role} facts={[['Primary dept.', person.department], ['Primary branch', person.primaryBranch ?? 'Not assigned'], ['Branches', String(branches.length)]]} />

      {branches.length === 0 && <InfoNote tone="warning" className="mb-5">Assign this person to a branch before recording attendance. <Link to={pathFor(ROUTES.staffBranches, { staffId: record.id })} className="font-semibold text-brand hover:underline">Assign branches →</Link></InfoNote>}

      <Panel title="Attendance summary" action={<span className="text-[11px] text-outline">{monthLabel(month).toUpperCase()} · {branchName}</span>} className="mb-5">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SUMMARY.map(([label, key, tone]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
              <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
              <dd className={cn('text-xl font-bold', tone)}>{counts[key] ?? 0} <span className="text-xs font-normal text-on-surface-variant">{counts[key] === 1 ? 'Day' : 'Days'}</span></dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Facility" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {branches.map((branch) => (
              <button key={branch.id} type="button" role="tab" aria-selected={branchId === branch.id} onClick={() => setBranchId(branch.id)} className={cn('rounded px-3 py-1.5 text-xs font-medium', branchId === branch.id ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
                {branch.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 px-1 py-1 text-xs font-medium">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded p-1 hover:bg-surface-low"><ChevronLeft className="size-3" aria-hidden="true" /></button>
            {monthLabel(month)}
            <button type="button" aria-label="Next month" disabled={month >= localToday().slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))} className="rounded p-1 hover:bg-surface-low disabled:opacity-40"><ChevronRight className="size-3" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          Status: <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} allLabel={`All Statuses (${rows.length})`} options={SUMMARY.map(([label]) => label)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">Recorded daily attendance ledger <StatusPill>{rows.length} records</StatusPill></h2>
          <ActionButton size="sm" icon={Download} onClick={download} disabled={rows.length === 0}>Export CSV</ActionButton>
        </div>
        <Table headings={['Date', 'Facility', 'Attendance status', 'Arrival', 'Source', 'Recorded by', 'Actions']} minWidth={960} empty={visible.length ? null : data.loading ? 'Loading…' : `No attendance recorded at ${branchName} in ${monthLabel(month)}.`}>
          {visible.map((row) => (
            <Row key={row.id}>
              <Cell className={cn('font-mono font-semibold', rowTint(row))}>{formatLedgerDate(row.isoDate)}</Cell>
              <Cell className={rowTint(row)}>{row.facility}</Cell>
              <Cell className={rowTint(row)}><StatusPill tone={attendanceTone(row.status)}>{row.status}</StatusPill>{row.corrections.length > 0 && <span className="ml-2 text-[10px] text-outline">Corrected</span>}</Cell>
              <Cell className={cn('font-mono text-xs', rowTint(row))}>{row.time}</Cell>
              <Cell className={cn('text-xs', rowTint(row))}>{row.source}</Cell>
              <Cell className={cn('text-xs text-on-surface-variant', rowTint(row))}>{row.by}</Cell>
              <Cell className={rowTint(row)}>
                <span className="flex items-center gap-3 text-xs font-semibold text-brand">
                  <button type="button" onClick={() => setOverlay({ type: 'detail', id: row.id })} aria-label={`View detail for ${row.isoDate}`} className="hover:underline">View Detail</button>
                  {can('staff.attendance') && <button type="button" onClick={() => setOverlay({ type: 'edit', id: row.id })} aria-label={`Correct ${row.isoDate}`} className="text-on-surface hover:underline">Correct</button>}
                </span>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${visible.length} records for ${monthLabel(month)}`} />
      </div>

      {overlay?.type === 'record' && <RecordAttendanceDrawer open person={person} branches={branches.filter((branch) => !branchId || branch.id === branchId).concat(branches.filter((branch) => branchId && branch.id !== branchId))} onClose={close} onSave={record_} />}
      {overlay?.type === 'detail' && detail && <AttendanceDetailDrawer record={detail} person={person} staffId={record.id} canCorrect={can('staff.attendance')} onClose={close} onCorrect={(row) => setOverlay({ type: 'edit', id: row.id })} />}
      {overlay?.type === 'edit' && detail && <EditAttendanceDrawer key={detail.id} record={detail} person={person} onClose={close} onSave={correct} />}
    </WorkspacePage>
  )
}
