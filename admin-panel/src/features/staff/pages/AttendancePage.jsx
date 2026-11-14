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
import { cn } from '../../../lib/cn'
import { AttendanceDetailDrawer, EditAttendanceDrawer, RecordAttendanceDrawer } from '../components/AttendanceDrawers'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { ANANYA as ananya, ATTENDANCE_RECORDS, ATTENDANCE_SUMMARY } from '../data/ananya'
import { attendanceTone } from '../statusTones'

const FACILITIES = ['Main Surgical Pavilion', 'Kondapur Satellite Clinic']
const SUMMARY_KEYS = { Present: 'Present', Late: 'Late', Absent: 'Absent' }

const countByStatus = (records) =>
  records.reduce((counts, record) => {
    const key = record.status.startsWith('Leave') ? 'Leave' : SUMMARY_KEYS[record.status]
    if (key) counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

const SEED_COUNTS = countByStatus(ATTENDANCE_RECORDS)

const rowTint = (record) => (record.status === 'Late' ? 'bg-amber-50/50' : record.status === 'Absent' ? 'bg-red-50/50' : record.today ? 'bg-teal-50/40' : '')

export default function AttendancePage() {
  const { staffId } = useParams()
  const [records, setRecords] = useState(ATTENDANCE_RECORDS)
  const [facility, setFacility] = useState(FACILITIES[0])
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  // Only one overlay is open at a time: the record drawer, a record's detail, or its edit form.
  const [overlay, setOverlay] = useState(null)

  if (staffId !== ananya.id) return <StaffNotFound title="Attendance & Work Records" reason="Attendance data is connected for Dr. Ananya Rao only in this build." />

  const memberPath = pathFor(ROUTES.staffMember, { staffId })
  const closeOverlay = () => setOverlay(null)
  const counts = countByStatus(records)
  const summary = ATTENDANCE_SUMMARY.map((tile) => {
    const delta = (counts[tile.label] ?? 0) - (SEED_COUNTS[tile.label] ?? 0)
    return delta ? { ...tile, value: String(Number(tile.value) + delta) } : tile
  })

  const sources = [...new Set(ATTENDANCE_RECORDS.map((record) => record.source))]
  const statuses = [...new Set(ATTENDANCE_RECORDS.map((record) => record.status))]
  const visible = records.filter(
    (record) =>
      facility === FACILITIES[0] &&
      (!statusFilter || record.status === statusFilter) &&
      (!sourceFilter || record.source === sourceFilter),
  )
  const detailRecord = overlay?.type === 'detail' || overlay?.type === 'edit' ? records.find((record) => record.id === overlay.id) : null

  const saveCorrection = (updated) => {
    setRecords((current) => current.map((record) => (record.id === updated.id ? updated : record)))
    setOverlay({ type: 'detail', id: updated.id })
  }

  return (
    <WorkspacePage>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-outline">
        <Link to={memberPath} className="inline-flex items-center gap-1 hover:text-on-surface"><ArrowLeft className="size-3" aria-hidden="true" />Back to Staff Details</Link>/
        <Link to={ROUTES.staffDirectory} className="hover:text-on-surface">Staff &amp; Doctors</Link>/
        <Link to={memberPath} className="hover:text-on-surface">Dr. Ananya Rao ({ananya.staffCode})</Link>/
        <span className="font-medium text-on-surface">Attendance &amp; Work Records</span>
      </nav>

      <PageIntro
        title={
          <span className="flex flex-wrap items-center gap-3">
            Attendance &amp; Work Records
            <StatusPill tone="success" dot className="text-[11px]">Active Master Record</StatusPill>
          </span>
        }
        description="View and manage this person's actual attendance and work events. Operating independently from planned OPD rosters and payroll ledgers."
        actions={
          <>
            <ActionButton icon={CalendarDays} to={pathFor(ROUTES.staffSchedule, { staffId })}>View OPD Schedule</ActionButton>
            <ActionButton to={pathFor(ROUTES.staffLeave, { staffId })}>View Leave &amp; Availability</ActionButton>
            <ActionButton variant="primary" icon={Plus} onClick={() => setOverlay({ type: 'record' })}>Record Attendance</ActionButton>
          </>
        }
      />

      <PersonBanner
        person={{ ...ananya, shortName: ananya.name }}
        subtitle="Interventional Cardiology"
        facts={[
          ['Primary dept.', ananya.department],
          ['Current context', 'Main Surgical Pavilion (Flagship)'],
          ['Secondary', 'Kondapur Satellite (8 hrs/wk)'],
        ]}
      />

      <Panel title="Attendance operational summary" action={<span className="text-[11px] text-outline">OCTOBER 2026 MTD · Grace window 15m · FIPS-140 biometric sync</span>} className="mb-5">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summary.map((tile) => (
            <div key={tile.label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">
              <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{tile.label}</dt>
              <dd className="text-xl font-bold text-on-surface">{tile.value} <span className="text-xs font-normal text-on-surface-variant">{tile.value === '1' ? 'Day' : 'Days'}</span></dd>
              <p className={cn('text-[11px] font-medium', tile.tone)}>{tile.hint}</p>
            </div>
          ))}
        </dl>
        <InfoNote className="mt-4">Summary reflects actual attendance logs recorded at Main Surgical Pavilion. Data does not alter recurring OPD schedules or prospective booking rules.</InfoNote>
      </Panel>

      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Facility" className="flex rounded-md border border-slate-200 bg-surface-low p-0.5">
            {FACILITIES.map((name) => (
              <button key={name} type="button" role="tab" aria-selected={facility === name} onClick={() => setFacility(name)} className={cn('rounded px-3 py-1.5 text-xs font-medium', facility === name ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}>
                {name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 font-medium"><ChevronLeft className="size-3" aria-hidden="true" />October 2026<ChevronRight className="size-3" aria-hidden="true" /></span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          Status: <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} allLabel={`All Statuses (${records.length})`} options={statuses} />
          Source: <FilterSelect label="Source" value={sourceFilter} onChange={setSourceFilter} allLabel="All Sources" options={sources} />
        </div>
        <p className="mt-2 text-[11px] text-outline">Showing records for {facility} only. Multi-branch attendance is not combined.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">Recorded daily attendance ledger <StatusPill>{records.length} events logged</StatusPill></h2>
          <ActionButton size="sm" icon={Download}>Export Audit CSV</ActionButton>
        </div>
        <Table headings={['Date', 'Facility', 'Scheduled context', 'Attendance status', 'Recorded time', 'Source', 'Recorded by', 'Actions']} minWidth={1060} empty={visible.length ? null : `No attendance records for ${facility} in the sample data.`}>
          {visible.map((record) => (
            <Row key={record.id}>
              <Cell className={cn('font-mono font-semibold', rowTint(record))}>
                {record.today && <span className="mr-1.5 text-brand">●</span>}
                {record.date}
                {record.today && <StatusPill tone="success" className="ml-2">Today</StatusPill>}
              </Cell>
              <Cell className={cn(record.facilityMuted && 'text-outline italic', rowTint(record))}>{record.facility}</Cell>
              <Cell className={cn('text-xs', rowTint(record))}>{record.context}</Cell>
              <Cell className={rowTint(record)}><StatusPill tone={attendanceTone(record.status)}>{record.status}</StatusPill></Cell>
              <Cell className={cn('font-mono text-xs', rowTint(record))}>{record.time} {record.timeNote && <span className="text-amber-700">({record.timeNote})</span>}</Cell>
              <Cell className={cn('text-xs', rowTint(record))}>{record.source}</Cell>
              <Cell className={cn('text-xs text-on-surface-variant', rowTint(record))}>{record.by}</Cell>
              <Cell className={rowTint(record)}>
                <span className="flex items-center gap-3 text-xs font-semibold text-brand">
                  <button type="button" onClick={() => setOverlay({ type: 'detail', id: record.id })} aria-label={`View detail for ${record.date}`} className="hover:underline">View Detail</button>
                  <button type="button" onClick={() => setOverlay({ type: 'edit', id: record.id })} aria-label={`Correct ${record.date}`} className={cn('hover:underline', record.status === 'Absent' ? 'text-danger' : 'text-on-surface-variant')}>Correct</button>
                </span>
              </Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${visible.length} events for October 2026`}>
          <nav aria-label="Pagination" className="flex items-center gap-2">
            <ActionButton size="sm" disabled>Previous</ActionButton>
            <span className="text-xs">Page 1 of 1</span>
            <ActionButton size="sm" disabled>Next</ActionButton>
          </nav>
        </TableFooter>
      </div>

      <RecordAttendanceDrawer open={overlay?.type === 'record'} onClose={closeOverlay} onSave={(record) => setRecords((current) => [record, ...current])} />
      {overlay?.type === 'detail' && detailRecord && (
        <AttendanceDetailDrawer record={detailRecord} onClose={closeOverlay} onCorrect={(record) => setOverlay({ type: 'edit', id: record.id })} />
      )}
      {overlay?.type === 'edit' && detailRecord && (
        <EditAttendanceDrawer key={detailRecord.id} record={detailRecord} onClose={closeOverlay} onSave={saveCorrection} />
      )}
    </WorkspacePage>
  )
}
