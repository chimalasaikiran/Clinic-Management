import { Link } from 'react-router-dom'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import LoadingState from '../../patients/components/LoadingState'
import { formatDate } from '../../patients/format'
import ReportsFrame from '../components/ReportsFrame'
import { operationsFigures, windowTotal } from '../reportsLogic'
import { useOperationsReport } from '../useOperationsReport'

const SERIES = [['completed', 'Completed', 'bg-brand'], ['cancelled', 'Cancelled', 'bg-amber-700'], ['noShow', 'No-show', 'bg-red-700'], ['open', 'Not yet closed', 'bg-slate-400']]
const pct = (value) => (value === null ? '—' : `${value}%`)
const short = (iso) => formatDate(iso).slice(0, 6)
const windowLabel = (window) => `${short(window.from)}–${short(window.to)}${window.days < 7 ? ` · ${window.days} day${window.days === 1 ? '' : 's'}` : ''}`

// Appointments, attendance and capacity for a period, from the appointment records.
export default function OperationsReportPage() {
  const { allowed, periods, period, setPeriodId, branchId, setBranchId, report, error, loading, reload } = useOperationsReport()
  const frame = { code: 'RPT-02', title: 'Operations', back: { to: ROUTES.reports, label: '← Back to Overview · RPT-01' } }
  if (!allowed) {
    return <ReportsFrame {...frame} description="Appointments, attendance and capacity." notes={{ title: 'Reports not available to your role', text: 'Your role has no reports permission, so no appointment figures are shown.' }} />
  }
  if (!report) return <ReportsFrame {...frame} description="Appointments, attendance and capacity."><LoadingState label="Loading appointment records…" error={loading ? null : error} onRetry={reload} /></ReportsFrame>

  const figures = operationsFigures(report)
  const { rebooking } = report
  const peak = Math.max(1, ...report.windows.map(windowTotal))
  const range = `${formatDate(report.from)} – ${formatDate(report.to)}`
  const scope = branchId ? report.branches.find((branch) => branch.id === branchId)?.name : `All permitted branches (${report.branches.length})`

  return (
    <ReportsFrame
      {...frame}
      description={`Appointments starting ${range} · ${scope}`}
      period={{ label: `${period.label} (${range})` }}
      branch={{ value: branchId, onChange: setBranchId, options: [['', `All permitted branches (${report.branches.length})`], ...report.branches.map((branch) => [branch.id, branch.name])] }}
      notes={{ title: 'Live appointment records', text: 'Each appointment counts once, by its start date and its status now. Rates show their denominators; a rate with nothing to divide by shows a dash.' }}
      extraFilters={<FilterField label="Period" value={period.id} onChange={setPeriodId} options={periods.map((entry) => [entry.id, entry.label])} />}
    >
      <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[
        ['Scheduled appointments', String(figures.scheduled), `${figures.completed} completed · ${figures.cancelled} cancelled · ${figures.noShow} no-show · ${figures.open} not yet closed`],
        ['Attendance-assessable no-show', pct(figures.noShowRate), figures.assessable ? `${figures.noShow} ÷ ${figures.assessable} (${figures.completed} completed + ${figures.noShow} no-show). Exact rate ${figures.noShowExact}%.` : 'No completed or no-show appointments yet.'],
        ['Mean wait', figures.meanWait === null ? '—' : `${figures.meanWait} min`, report.wait.pairs ? `${report.wait.minutes.toLocaleString('en-IN')} total minutes ÷ ${report.wait.pairs} check-in → consultation-start pairs` : 'No visit with both a check-in and a consultation start.'],
        ['Doctor utilization', pct(figures.utilization), `${figures.consultMinutes.toLocaleString('en-IN')} consultation minutes ÷ ${figures.availableMinutes.toLocaleString('en-IN')} available clinical minutes`],
      ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[13px]">{label}</dt><dd className="mt-2 text-[32px] leading-9 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>)}</dl>

      <Section title="Appointment outcomes by start-date window" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Count of appointments · {report.windows.map(windowTotal).join(', ')} scheduled per 7-day window · no prior-period comparison</p>
        <p className="mb-4 flex flex-wrap gap-4 text-xs">{SERIES.map(([key, label, tone]) => <span key={key} className="flex items-center gap-2"><span className={`size-2.5 rounded-sm ${tone}`} />{label} · {figures[key]}</span>)}</p>
        <ul className="space-y-3">{report.windows.map((window) => (
          <li key={window.from} className="grid grid-cols-[130px_1fr_120px] items-center gap-3 text-xs" aria-label={`${windowLabel(window)}: ${SERIES.map(([key, label]) => `${label} ${window[key]}`).join(', ')}`}>
            <span>{windowLabel(window)}</span>
            <span className="flex h-5 overflow-hidden rounded-sm bg-slate-100" style={{ width: `${(windowTotal(window) / peak) * 100}%` }}>{SERIES.map(([key, , tone]) => <span key={key} className={tone} style={{ width: `${windowTotal(window) ? (window[key] / windowTotal(window)) * 100 : 0}%` }} />)}</span>
            <span className="text-outline">{window.completed} / {window.cancelled} / {window.noShow} / {window.open}</span>
          </li>))}</ul>
        <p className="mt-4 text-[11px] text-outline">C / Cancel / NS / Open. A shorter last window says how many days it covers. Rescheduling keeps the same appointment, so it is not an outcome: {figures.rescheduled} of these appointments were rescheduled at least once.</p>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Cancellations" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Status now, of appointments scheduled in the period</p><p className="text-[32px] font-semibold">{pct(figures.cancellationRate)}</p>
          <p className="mt-2 text-xs">{figures.cancelled} cancelled ÷ {figures.scheduled} scheduled appointment records.</p><p className="mt-3 text-[11px] leading-4 text-outline">The no-show denominator leaves out these {figures.cancelled} cancellations and the {figures.open} appointments not yet closed. It is {figures.assessable} attendance-assessable appointments, not {figures.scheduled - figures.cancelled} non-cancelled records.</p>
        </Section>
        <Section title="Rebooking within 7 days" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Cancellations and no-shows followed up for a full week</p><p className="text-[32px] font-semibold">{pct(figures.rebookingRate)} · {rebooking.replaced} / {rebooking.mature}</p>
          <p className="mt-2 text-xs">{rebooking.replaced} of {rebooking.mature} cancellation/no-show events were followed by a new booking for the same patient within 7 days. {rebooking.immature} of {rebooking.mature + rebooking.immature} events are less than a week old and are left out.</p><p className="mt-3 text-[11px] leading-4 text-outline">A new booking by the same patient counts as the replacement; bookings are not linked to the appointment they replace.</p>
        </Section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Doctor utilization" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Days of the period already passed · weekly consulting windows less leave and blocks</p>
          <div className="-mx-6 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Doctor', 'Consultation / available', 'Utilization'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead>
            <tbody>{report.doctors.map((doctor) => <tr key={doctor.id} className="border-t border-slate-100"><td className="px-6 py-3 font-semibold">{doctor.name}</td><td className="px-6 py-3">{doctor.consultMinutes.toLocaleString('en-IN')} / {doctor.availableMinutes.toLocaleString('en-IN')} min</td><td className="px-6 py-3">{doctor.availableMinutes ? `${Math.round((doctor.consultMinutes / doctor.availableMinutes) * 100)}%` : '—'}</td></tr>)}<tr className="border-t border-slate-200 font-semibold"><td className="px-6 py-3">Total</td><td className="px-6 py-3">{figures.consultMinutes.toLocaleString('en-IN')} / {figures.availableMinutes.toLocaleString('en-IN')} min</td><td className="px-6 py-3">{pct(figures.utilization)}</td></tr></tbody></table></div>
          {report.doctors.length === 0 && <p className="mt-3 text-xs text-on-surface-variant">No therapist has consulting hours at these branches.</p>}
          <p className="mt-3 text-[11px] text-outline">Consultation minutes are the booked length of completed appointments. This is not maximum theoretical building capacity.</p>
        </Section>
        <Section title="Service volume" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">{figures.completed} completed appointments · by appointment type</p>
          <ul className="space-y-4">{report.services.map((service) => <li key={service.name} className="text-xs"><p className="flex justify-between font-semibold"><span>{service.name}</span><span>{service.count} · {Math.round((service.count / figures.completed) * 100)}%</span></p><span className="mt-1 block h-2 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(service.count / figures.completed) * 100}%` }} /></span></li>)}</ul>
          {report.services.length === 0 && <p className="text-xs text-on-surface-variant">No appointment was completed in this period.</p>}
          <p className="mt-4 text-[11px] text-outline">Appointment types, not charge counts or unique patients.</p>
          <Link to={ROUTES.appointments} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">View Appointments ↗</Link>
        </Section>
      </div>

      <Section title="Definitions & coverage" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">How each measure is worked out</p>
        <dl className="divide-y divide-slate-100 text-xs">{[
          ['Cohort and status', 'Appointments whose start date falls in the period, at the branches in scope, each once with its status now. Pending, confirmed, checked-in and in-consultation appointments are not yet closed.'],
          ['Wait timestamps', `Check-in → consultation start: ${report.wait.pairs} / ${figures.completed} completed visits have both (${pct(figures.waitCoverage)} coverage); the rest are left out. Mean only.`],
          ['Rebooking observation', `A cancellation or no-show counts once its week has passed. ${rebooking.mature} events followed up / ${rebooking.immature} still within their week.`],
        ].map(([term, text]) => <div key={term} className="grid gap-2 py-3 sm:grid-cols-[200px_1fr]"><dt className="font-semibold">{term}</dt><dd className="text-on-surface-variant">{text}</dd></div>)}</dl>
        <p className="mt-3 text-[11px] text-outline">Sources: appointment records and their history, check-in and consultation-start times, therapists' weekly hours, leave and blocks. Needs the reports permission; branches follow your role.</p>
      </Section>
    </ReportsFrame>
  )
}
