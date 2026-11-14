import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { reviewMetrics } from '../growthLogic'

export default function ReputationReportPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const rating = filters.get('rating')
  const reviews = data.reviews.filter((review) => !rating || String(review.rating) === rating).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const metrics = reviewMetrics(reviews)
  const escalations = data.escalations
  const open = escalations.filter((entry) => entry.status !== 'Resolved').length
  const ratings = reviews.map((review) => review.rating)

  return (
    <GrowthFrame back={{ to: ROUTES.escalations, label: 'Feedback Escalation · GO19' }} crumb="Owner Panel / Growth OS / Reputation Reporting" code="GO-20" title="Reputation Reporting" description="Inspect scoped review evidence before interpreting clinic reputation." actions={<ActionButton variant="brand" to={ROUTES.escalations}>Escalations → GO19</ActionButton>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Reporting origin · 01–24 Oct 2026 · Google sample · Distinct from GO16’s 01–23 Oct range']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title={`ISOLATED ${data.reviews.length}-REVIEW SAMPLE · Not clinic performance or a provider total`} className="mb-6">No verified review feed — sample data only. Live verification is gated: verify feed completeness, response timestamps and branch mapping before calculating. No live analytics query has run.</Banner>
      <Section title="Report scope" aside="Review-posted cohort · IST" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><FilterField label="Branch" value="" disabled options={[['', `${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`]]} /><FilterField label="Review date · inclusive" value="" disabled options={[['', '01–24 Oct 2026']]} /><FilterField label="Source" value="" disabled options={[['', 'Google sample']]} /><FilterField label="Rating" value={rating} onChange={(value) => filters.change('rating', value)} options={[['', 'All ratings'], ...['5', '4', '3', '2', '1'].map((star) => [star, `${star} star`])]} /></div>
        <p className="mt-3 text-[11px] text-outline">Boundary: 01 Oct 00:00 ≤ review posted &lt; 25 Oct 00:00 Asia/Kolkata. Exactly the supplied examples below; no missing-day or historical trend inference.</p>
      </Section>

      <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[['Review volume · sample set', `${metrics.total} examples`, `${reviews.map((review) => review.id.slice(-3)).join(', ') || 'None'} only. Not the branch’s live review total.`], ['Arithmetic sample average', metrics.average === null ? '—' : `${metrics.average.toFixed(1)} / 5`, `(${ratings.join(' + ') || '—'}) ÷ ${metrics.total} supplied ratings. No live rating claim.`], ['Confirmed response evidence', `${metrics.confirmedResponses} of ${metrics.total}`, 'Provider-confirmed replies among samples; not verified live coverage.'], ['Recorded escalations', `${open} open`, `${escalations.length - open} recorded resolved among ${escalations.length} recorded escalation${escalations.length === 1 ? '' : 's'}.`]].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="mt-2 text-[28px] leading-8 font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>)}</dl>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Rating distribution" aside={`Denominator: ${metrics.total} samples`}>
          <ul className="space-y-4">{metrics.distribution.map(({ star, count }) => <li key={star} className="grid grid-cols-[48px_1fr_40px_56px] items-center gap-3 text-xs"><span>{star} star</span><span className="h-3 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${metrics.total ? (count / metrics.total) * 100 : 0}%` }} /></span><span>{count} / {metrics.total}</span><Link to={`${ROUTES.reviews}?rating=${star}`} className="font-semibold text-brand hover:underline">GO16 ↗</Link></li>)}</ul>
          <p className="mt-4 text-[11px] text-outline">A 0 count is an actual zero in this sample set only. Select a bucket to carry its rating filter into the review register.</p>
        </Section>
        <Section title="Volume by supplied review date" aside={`${metrics.total} records · no trend extrapolation`}>
          <ul className="space-y-3 text-xs">{reviews.map((review) => <li key={review.id} className="grid grid-cols-[110px_20px_1fr] items-center gap-3"><span>{day(review.date).slice(0, 6)} · {review.time}</span><span className="h-5 w-8 rounded-sm border border-teal-200 bg-teal-50" /><span><strong className="mr-2">1</strong><Link to={`${ROUTES.reviews}/${review.id}`} className="text-outline hover:underline">{review.id}</Link></span></li>)}</ul>
          <p className="mt-4 text-[11px] text-outline">Dates not listed are not claimed to be confirmed live zero days.</p>
        </Section>
      </div>
      <GrowthFooter code="GO-20" back={{ to: ROUTES.escalations, label: 'Feedback Escalation · GO19' }} />
    </GrowthFrame>
  )
}
