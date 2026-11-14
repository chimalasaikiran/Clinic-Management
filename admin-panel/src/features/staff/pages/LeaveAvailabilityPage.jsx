import { useState } from 'react'
import { AlertTriangle, CalendarDays, ExternalLink, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterTabs, InfoNote } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import LeaveExceptionDrawer from '../components/LeaveExceptionDrawer'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { ANANYA as ananya, LEAVE_HISTORY, LEAVE_RECORDS, LEAVE_SUMMARY } from '../data/ananya'

const BRANCH_TABS = [
  { id: 'all', label: 'All Branches' },
  { id: 'main', label: 'Main Pavilion Only' },
  { id: 'kondapur', label: 'Kondapur Only' },
]

export default function LeaveAvailabilityPage() {
  const { staffId } = useParams()
  const [records, setRecords] = useState(LEAVE_RECORDS)
  const [scope, setScope] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (staffId !== ananya.id) return <StaffNotFound title="Leave & Availability" reason="Leave data is connected for Dr. Ananya Rao only in this build." />

  const memberPath = pathFor(ROUTES.staffMember, { staffId })
  const schedulePath = pathFor(ROUTES.staffSchedule, { staffId })
  // "All branches" shows everything; a branch tab shows exceptions that apply to that branch.
  const visible = records.filter((record) => scope === 'all' || record.branch === 'all' || record.branch === scope)
  const blocked = records.reduce((total, record) => total + (Number.parseInt(record.affected, 10) || 0), 0)

  return (
    <WorkspacePage>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-outline">
        <Link to={ROUTES.staffDirectory} className="hover:text-on-surface">Staff Directory</Link>/
        <Link to={memberPath} className="hover:text-on-surface">Dr. Ananya Rao</Link>/
        <span className="font-medium text-on-surface">Leave &amp; Availability</span>
      </nav>

      <PageIntro
        title={
          <span className="flex flex-wrap items-center gap-3">
            Leave &amp; Availability
            <StatusPill tone="success" dot className="text-[11px]">Roster Exceptions Engine · Sync Active</StatusPill>
          </span>
        }
        description="Manage temporary leave and availability exceptions without changing the practitioner's recurring OPD schedule."
        actions={
          <>
            <ActionButton icon={CalendarDays} to={schedulePath}>View OPD Schedule</ActionButton>
            <ActionButton variant="brand" icon={Plus} onClick={() => setDrawerOpen(true)}>Add Leave / Exception</ActionButton>
          </>
        }
      />

      <PersonBanner
        person={ananya}
        badge="Active Roster"
        subtitle={`${ananya.speciality} (${ananya.council})`}
        facts={[
          ['Primary facility anchor', 'Main Surgical Pavilion (Chamber Suite 104)'],
          ['Department', ananya.department],
          ['Cross-branch scope', 'Kondapur Surgical Clinic (Tue/Thu)'],
        ]}
      />

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LEAVE_SUMMARY.map(([label, value, hint], index) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
            <dd className={index === 1 ? 'text-lg font-bold text-brand' : 'text-lg font-bold text-on-surface'}>{index === 2 ? `${records.length} Scheduled` : value}</dd>
            <p className="text-[11px] text-on-surface-variant">{hint}</p>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title={<span className="flex items-center gap-2">Upcoming leave &amp; exceptions <StatusPill>{visible.length} Active</StatusPill></span>}
            bodyClassName="p-0"
          >
            <div className="border-b border-slate-100 px-5 py-3">
              <FilterTabs options={BRANCH_TABS} value={scope} onChange={setScope} label="Branch scope" />
            </div>
            <Table headings={['Date / period', 'Type', 'Branch scope', 'Reason / operational note', 'Affected', '']} minWidth={820} empty={visible.length ? null : 'No exceptions for this branch.'}>
              {visible.map((record) => (
                <Row key={record.id}>
                  <Cell>
                    <p className="font-semibold">{record.period}</p>
                    <p className="text-[11px] text-outline">{record.length}</p>
                  </Cell>
                  <Cell>
                    <StatusPill tone={record.kind === 'Leave' ? 'success' : 'warning'} className="rounded">{record.kind}</StatusPill>
                    <p className="mt-1 text-[11px] text-outline">{record.type}</p>
                  </Cell>
                  <Cell>
                    <p className="font-medium">{record.scope}</p>
                    <p className="text-[11px] text-outline">{record.scopeNote}</p>
                  </Cell>
                  <Cell className="max-w-48 text-xs">{record.reason}</Cell>
                  <Cell>
                    {record.affected && <span className="flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle className="size-3" aria-hidden="true" />{record.affected}</span>}
                  </Cell>
                  <Cell>
                    <button type="button" aria-label={`Remove ${record.type} on ${record.period}`} onClick={() => setRecords((current) => current.filter((entry) => entry.id !== record.id))} className="text-outline hover:text-danger">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </Cell>
                </Row>
              ))}
            </Table>
            <InfoNote tone="neutral" icon={ShieldCheck} className="m-5">
              <strong className="text-on-surface">Appointment ledger protection:</strong> Adding or editing a leave period locks online slot booking and flags affected patient appointments for triage. Historical patient encounter records and completed consults remain strictly intact.
            </InfoNote>
          </Panel>

          <Panel title="Availability history" action={<span className="text-[11px] text-outline">Past 6 months · 3 records · Audited by NMC Roster Rule 14.b</span>} bodyClassName="p-0">
            <Table headings={['Past period', 'Type', 'Branch scope', 'Recorded by']} minWidth={640}>
              {LEAVE_HISTORY.map((entry) => (
                <Row key={entry.id}>
                  <Cell className="font-medium">{entry.period}</Cell>
                  <Cell>{entry.type}</Cell>
                  <Cell>{entry.scope}</Cell>
                  <Cell className="text-xs text-on-surface-variant">{entry.by}</Cell>
                </Row>
              ))}
            </Table>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Schedule context & boundaries">
            <p className="text-xs leading-5 text-on-surface-variant">Leave and availability exceptions apply as an operational override over the practitioner's baseline weekly roster. They do not alter the master recurring schedule or branch operating hours.</p>
            <dl className="mt-3 space-y-2 rounded-md bg-surface-lowest p-3 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Baseline schedule</dt><dd className="text-right font-semibold text-on-surface">Mon, Wed, Fri (Main)<br />Tue, Thu (Kondapur)</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Operating hours</dt><dd className="font-semibold text-on-surface">08:00 AM – 08:00 PM IST</dd></div>
            </dl>
            <Link to={schedulePath} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Manage recurring OPD schedule →</Link>
          </Panel>

          <Panel title="Impact & triage summary" action={<StatusPill tone="danger">{blocked} Blocked</StatusPill>}>
            <div className="rounded-md border-l-4 border-danger bg-surface-lowest p-3 text-xs">
              <p className="font-semibold text-on-surface">Pending patient notice (18–20 Oct 2026)</p>
              <p className="mt-1 text-on-surface-variant">{blocked} appointments scheduled during this period require rerouting or patient confirmation.</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-on-surface-variant">
              <strong className="text-on-surface">Active triage protocol:</strong> Automated SMS notification dispatched with option to reschedule to Dr. Sarita V. Nambiar (Senior Interventional Consultant) or shift to Monday 23 Oct.
            </p>
            <ActionButton className="mt-3 w-full" icon={ExternalLink}>Open Appointment Triage Desk</ActionButton>
          </Panel>

          <Panel title="Multi-branch governance">
            <p className="text-xs leading-5 text-on-surface-variant">Exceptions configured for <em>All Assigned Branches</em> synchronously lock tele-consultation queues and satellite OPD kiosks to prevent cross-facility booking fragmentation.</p>
            <p className="mt-3 flex items-start gap-2 rounded-md bg-surface-lowest p-3 text-xs text-on-surface-variant"><ShieldCheck className="mt-0.5 size-4 text-brand" aria-hidden="true" /><span><strong className="block text-on-surface">DISHA &amp; NMC statutory audit</strong>Milestone M1/M2/M3 roster audit trail active</span></p>
          </Panel>
        </div>
      </div>

      <LeaveExceptionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCommit={(record) => setRecords((current) => [...current, record])} />
    </WorkspacePage>
  )
}
