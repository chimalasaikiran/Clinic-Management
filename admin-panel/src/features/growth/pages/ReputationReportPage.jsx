import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { day } from '../format'
import { clinicNow } from '../leadsView'
import { useLeadContext } from '../useLeads'

const addDays = (iso, count) => {
  const [year, month, date] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10)
}

export default function ReputationReportPage() {
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const today = clinicNow().date
  const from = filters.get('from') || addDays(today, -29)
  const to = filters.get('to') || today
  const rating = filters.get('rating')
  const valid = from <= to
  const query = { from, to, rating: rating || undefined, branchId: context.branchId || undefined }
  const report = useApiResource(() => (valid ? contentApi.report(query) : Promise.resolve(null)), `reputation:${JSON.stringify(query)}`)
  const data = report.data
  const largest = Math.max(1, ...(data?.byDay ?? []).map((entry) => entry.count))

  return (
    <GrowthFrame back={{ to: ROUTES.escalations, label: 'Feedback Escalation · GO19' }} crumb="Owner Panel / Growth OS / Reputation Reporting" code="GO-20" title="Reputation Reporting" description="Review volume, ratings and replies for the period, each with its denominator." actions={<ActionButton variant="brand" to={ROUTES.escalations}>Escalations → GO19</ActionButton>} context={[context.line, `${day(from)} – ${day(to)} inclusive · Asia/Kolkata · Reviews by the date they were posted`]} today={context.today} sample="Live records · Google reviews fetched for linked branches">
      <Section title="Report scope" aside="Review-posted cohort · IST" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="From · IST" type="date" max={to} value={from} onChange={(event) => filters.change('from', event.target.value)} />
          <TextInput label="To · IST" type="date" min={from} max={today} value={to} onChange={(event) => filters.change('to', event.target.value)} error={valid ? undefined : 'The end date must not be before the start date.'} />
          <FilterField label="Rating" value={rating} onChange={(value) => filters.change('rating', value)} options={[['', 'All ratings'], ...['5', '4', '3', '2', '1'].map((star) => [star, `${star} star`])]} />
        </div>
        <p className="mt-3 text-[11px] text-outline">{day(from)} 00:00 ≤ posted &lt; the day after {day(to)}, Asia/Kolkata. The branch follows the location chosen in the header.</p>
      </Section>

      {!data ? <LoadingState label="Loading the report…" error={report.error} onRetry={report.reload} /> : (
        <>
          {data.total < 10 && <Banner tone="warning" title={`${data.total} review${data.total === 1 ? '' : 's'} in this period`} className="mb-6">Small numbers swing a lot; read the average alongside the count.</Banner>}
          <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[
            ['Review volume', String(data.total), `Posted ${day(from)} – ${day(to)}.`],
            ['Average rating', data.average === null ? '—' : `${data.average.toFixed(1)} / 5`, data.total ? `Across ${data.total} review${data.total === 1 ? '' : 's'}.` : 'No reviews in this period.'],
            ['Replied', `${data.replied} of ${data.total}`, data.medianReplyHours === null ? 'No replies yet.' : `Median ${data.medianReplyHours} hours to reply.`],
            ['Escalations', `${data.escalations.open} open`, `${data.escalations.total} opened for these reviews · ${data.escalations.overdue} overdue.`],
          ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="mt-2 text-[28px] leading-8 font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>)}</dl>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Section title="Rating distribution" aside={`Out of ${data.total}`}>
              <ul className="space-y-4">{data.distribution.map(({ star, count }) => <li key={star} className="grid grid-cols-[48px_1fr_40px_56px] items-center gap-3 text-xs"><span>{star} star</span><span className="h-3 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${data.total ? (count / data.total) * 100 : 0}%` }} /></span><span>{count} / {data.total}</span><Link to={`${ROUTES.reviews}?rating=${star}`} className="font-semibold text-brand hover:underline">GO16 ↗</Link></li>)}</ul>
              <p className="mt-4 text-[11px] text-outline">Select a rating to open those reviews in the register.</p>
            </Section>
            <Section title="Reviews by day" aside={`${data.byDay.length} day${data.byDay.length === 1 ? '' : 's'} with reviews`}>
              <ul className="space-y-3 text-xs">{data.byDay.map((entry) => <li key={entry.date} className="grid grid-cols-[110px_1fr_24px] items-center gap-3"><span>{day(entry.date)}</span><span className="h-3 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(entry.count / largest) * 100}%` }} /></span><strong>{entry.count}</strong></li>)}</ul>
              {!data.byDay.length && <p className="text-xs text-outline">No reviews in this period.</p>}
              <p className="mt-4 text-[11px] text-outline">Days not listed had no reviews.</p>
            </Section>
          </div>
        </>
      )}
      <GrowthFooter code="GO-20" back={{ to: ROUTES.escalations, label: 'Feedback Escalation · GO19' }} />
    </GrowthFrame>
  )
}
