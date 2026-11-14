import { Link } from 'react-router-dom'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import ReportsFrame from '../components/ReportsFrame'
import { OPERATIONS } from '../data/sampleReports'
import { operationsFigures, windowTotal } from '../reportsLogic'

const SERIES = [['completed', 'Completed', 'bg-brand'], ['cancelled', 'Cancelled', 'bg-amber-700'], ['noShow', 'No-show', 'bg-red-700'], ['rescheduled', 'Rescheduled', 'bg-slate-400']]
const pct = (value) => (value === null ? '—' : `${value}%`)

export default function OperationsReportPage() {
  const figures = operationsFigures(OPERATIONS)
  const { rebooking } = OPERATIONS
  const peak = Math.max(...OPERATIONS.windows.map(windowTotal))

  return (
    <ReportsFrame code="RPT-02" title="Operations" description="Appointments, attendance and capacity — a defined sample cohort, not a live booking queue." back={{ to: ROUTES.reports, label: '← Back to Overview · RPT-01' }}>
      <Banner tone="warning" title={`Sample cohort · ${figures.scheduled} scheduled appointments · Main Surgical Pavilion only`} className="mb-6">Retrospective closed cohort; appointment-start dates 01–25 Oct 2026. All final statuses are mutually exclusive. This is separate from, and does not update or reconcile, the conflicting 14 Oct Appointments snapshot.</Banner>

      <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[['Scheduled appointments', String(figures.scheduled), `${figures.completed} completed · ${figures.cancelled} cancelled · ${figures.noShow} no-show · ${figures.rescheduled} rescheduled`], ['Attendance-assessable no-show', pct(figures.noShowRate), `${figures.noShow} ÷ ${figures.assessable} (${figures.completed} completed + ${figures.noShow} no-show). Exact rate ${figures.noShowExact}%.`], ['Mean wait', `${figures.meanWait} min`, `${OPERATIONS.waitMinutes.toLocaleString('en-IN')} total minutes ÷ ${OPERATIONS.waitPairs} valid check-in → consultation-start pairs`], ['Doctor utilization', pct(figures.utilization), `${figures.consultMinutes.toLocaleString('en-IN')} direct consultation minutes ÷ ${figures.availableMinutes.toLocaleString('en-IN')} available clinical minutes`]].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[13px]">{label}</dt><dd className="mt-2 text-[32px] leading-9 font-semibold">{value}</dd><p className="mt-2 text-xs text-outline">{hint}</p></div>)}</dl>

      <Section title="Appointment outcomes by start-date window" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Count of appointments · {OPERATIONS.windows.map(windowTotal).join(', ')} scheduled per bucket · same closed cohort, no prior-period comparison</p>
        <p className="mb-4 flex flex-wrap gap-4 text-xs">{SERIES.map(([key, label, tone]) => <span key={key} className="flex items-center gap-2"><span className={`size-2.5 rounded-sm ${tone}`} />{label} · {figures[key]}</span>)}</p>
        <ul className="space-y-3">{OPERATIONS.windows.map((window) => (
          <li key={window.label} className="grid grid-cols-[110px_1fr_120px] items-center gap-3 text-xs" aria-label={`${window.label}: ${SERIES.map(([key, label]) => `${label} ${window[key]}`).join(', ')}`}>
            <span>{window.label}</span>
            <span className="flex h-5 overflow-hidden rounded-sm bg-slate-100" style={{ width: `${(windowTotal(window) / peak) * 100}%` }}>{SERIES.map(([key, , tone]) => <span key={key} className={tone} style={{ width: `${(window[key] / windowTotal(window)) * 100}%` }} />)}</span>
            <span className="text-outline">{window.completed} / {window.cancelled} / {window.noShow} / {window.rescheduled}</span>
          </li>))}</ul>
        <p className="mt-4 text-[11px] text-outline">C / Cancel / NS / Resch. 22–25 Oct is a 4-day partial bucket, not a comparable 7-day interval. Rescheduled = no attendance slot at the original time; it is not a rebooking outcome.</p>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Cancellations" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Final status in the scheduled cohort</p><p className="text-[32px] font-semibold">{pct(figures.cancellationRate)}</p>
          <p className="mt-2 text-xs">{figures.cancelled} cancelled ÷ {figures.scheduled} scheduled appointment records.</p><p className="mt-3 text-[11px] leading-4 text-outline">The canonical no-show denominator excludes these {figures.cancelled} cancellations and {figures.rescheduled} reschedules. It is {figures.assessable} attendance-assessable appointments, not {figures.scheduled - figures.cancelled} non-cancelled records.</p>
        </Section>
        <Section title="Rebooking within 7 days" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Separate eligible-event follow-up cohort</p><p className="text-[32px] font-semibold">{pct(figures.rebookingRate)} · {rebooking.replaced} / {rebooking.mature}</p>
          <p className="mt-2 text-xs">{rebooking.replaced} explicitly linked replacement bookings among {rebooking.mature} mature cancellation/no-show events. {rebooking.immature} of {rebooking.mature + rebooking.immature} events lack full follow-up and are excluded.</p><p className="mt-3 text-[11px] leading-4 text-outline">At 25 Oct, eligible event dates are no later than 18 Oct. No weekly maturity breakdown is supplied. The {figures.rescheduled} rescheduled statuses are distinct.</p>
        </Section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Doctor utilization" aside="">
          <p className="-mt-3 mb-3 text-xs text-outline">Sample doctors · illustrative capacity, not an actual roster</p>
          <div className="-mx-6 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Doctor', 'Consultation / available', 'Utilization'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead>
            <tbody>{OPERATIONS.doctors.map((doctor) => <tr key={doctor.name} className="border-t border-slate-100"><td className="px-6 py-3 font-semibold">{doctor.name}</td><td className="px-6 py-3">{doctor.consultMinutes.toLocaleString('en-IN')} / {doctor.availableMinutes.toLocaleString('en-IN')} min</td><td className="px-6 py-3">{Math.round((doctor.consultMinutes / doctor.availableMinutes) * 100)}%</td></tr>)}<tr className="border-t border-slate-200 font-semibold"><td className="px-6 py-3">Sample total</td><td className="px-6 py-3">{figures.consultMinutes.toLocaleString('en-IN')} / {figures.availableMinutes.toLocaleString('en-IN')} min</td><td className="px-6 py-3">{pct(figures.utilization)}</td></tr></tbody></table></div>
          <p className="mt-3 text-[11px] text-outline">Scheduled available clinical minutes exclude leave, breaks and blocked slots. This is not maximum theoretical building capacity.</p>
        </Section>
        <Section title="Service volume" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">{figures.completed} completed consultations · primary service only</p>
          <ul className="space-y-4">{OPERATIONS.services.map((service) => <li key={service.name} className="text-xs"><p className="flex justify-between font-semibold"><span>{service.name}</span><span>{service.count} · {Math.round((service.count / figures.completed) * 100)}%</span></p><span className="mt-1 block h-2 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(service.count / figures.completed) * 100}%` }} /></span></li>)}</ul>
          <p className="mt-4 text-[11px] text-outline">Mutually exclusive primary services, not charge counts or unique patients.</p>
          <Link to={ROUTES.appointments} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">View Appointments ↗</Link>
        </Section>
      </div>

      <Section title="Definitions & coverage" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Expected appointment reporting contract · implementation decisions remain explicit</p>
        <dl className="divide-y divide-slate-100 text-xs">{[['Cohort and final status', 'Deduplicate by appointment ID; select the current record version and one final status per original scheduled slot. Appointment-start dates define inclusion.'], ['Wait timestamps', `Check-in → consultation start: ${OPERATIONS.waitPairs} / ${figures.completed} completions have valid pairs (${figures.waitCoverage}% coverage); ${figures.completed - OPERATIONS.waitPairs} missing excluded. Invalid or negative intervals excluded. Mean only; no median supplied.`], ['Rebooking observation', `A replacement needs an explicit event-to-booking link within 7 days. ${rebooking.mature} mature events / ${rebooking.immature} immature; replacement links are never inferred from Rescheduled status.`]].map(([term, text]) => <div key={term} className="grid gap-2 py-3 sm:grid-cols-[200px_1fr]"><dt className="font-semibold">{term}</dt><dd className="text-on-surface-variant">{text}</dd></div>)}</dl>
        <p className="mt-3 text-[11px] text-outline">Expected sources: appointment records, linked replacements, check-in/consultation timestamps and clinical availability. Needs operations-report-read plus scoped branch access.</p>
      </Section>
    </ReportsFrame>
  )
}
