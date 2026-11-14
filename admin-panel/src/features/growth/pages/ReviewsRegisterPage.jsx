import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { reviewRows } from '../growthLogic'

const RESPONSES = ['No response recorded', 'Draft · approval required', 'Approval requested', 'Response approved']

export default function ReviewsRegisterPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const rows = reviewRows(data.reviews, { rating: filters.get('rating'), response: filters.get('response'), escalated: filters.get('escalation'), escalations: data.escalations, query: filters.get('q') })
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.businessProfile, label: 'Business Profile · GO15' }} crumb="Owner Panel / Growth OS / Reviews & Reputation" code="GO-16" title="Reviews & Reputation Register" description="Review branch feedback, coordinate internal follow-up and prepare privacy-safe public responses." badge={<StatusPill tone="warning">Sample register</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Google sample · 01–23 Oct 2026 · Rating / Response / Escalation filters are kept in the address']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <p className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm font-medium">{data.reviews.length} sample reviews shown · No live reputation metric<span className="flex gap-3"><ActionButton to={ROUTES.businessProfile}>Business profile · GO15</ActionButton><ActionButton variant="brand" to={ROUTES.reviewRequests}>Request feedback → GO18</ActionButton></span></p>
      <Banner tone="warning" title="Live review feed not connected — showing sample reviews only" className="mb-6">Google profile is proposed; connection, ownership, scope and review capability are not verified. Dates and ratings below are supplied samples, not a sync timestamp or a provider total.</Banner>

      <Section title="Find reviews" aside="Context kept on return" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3"><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Rating" value={filters.get('rating')} onChange={(value) => filters.change('rating', value)} options={[['', 'All ratings'], ...['5', '4', '3', '2', '1'].map((star) => [star, `${star} star`])]} /><FilterField label="Response" value={filters.get('response')} onChange={(value) => filters.change('response', value)} options={[['', 'All response states'], ...RESPONSES]} /><FilterField label="Escalation" value={filters.get('escalation')} onChange={(value) => filters.change('escalation', value)} options={[['', 'All escalation states'], 'Escalated', 'Not escalated']} /></div>
        <div className="mt-4 flex flex-wrap items-end gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search reviews" placeholder="Search review text or ID" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Clear filters</ActionButton></div>
      </Section>

      <Section title="Review examples" aside="Offline samples · not provider pagination" className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Review / text preview', 'Source / branch', 'Rating / date', 'Response / escalation'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((review) => {
            const escalation = data.escalations.find((entry) => entry.reviewId === review.id)
            return (
              <tr key={review.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                <td className="max-w-md px-6 py-5"><strong className="text-[13px]">{review.alias}</strong> <span className="ml-2 text-outline">{review.id}</span><p className="mt-2 text-[13px] leading-5">{review.text}</p><Link to={pathFor(ROUTES.review, { reviewId: review.id })} state={state} className="mt-2 inline-block font-semibold text-brand hover:underline">Open review → GO17</Link></td>
                <td className="px-6 py-5">Google review example<br /><StatusPill className="my-1">Sample only</StatusPill><br /><span className="text-outline">{GROWTH_BRANCH.name}<br />{GROWTH_BRANCH.code}</span></td>
                <td className="px-6 py-5"><strong className="text-base text-amber-700">{review.rating} / 5 ★</strong><br /><span className="text-outline">{day(review.date)}<br />{review.time} IST</span></td>
                <td className="px-6 py-5"><strong className={review.responseState === 'No response recorded' ? '' : 'text-amber-700'}>{review.responseState}</strong><br /><span className="text-outline">{escalation ? `${escalation.id} · ${escalation.status}` : 'No internal escalation recorded'}</span></td>
              </tr>)
          })}</tbody>
        </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No reviews match these filters.</p>}</div>
      </Section>
      <GrowthFooter code="GO-16" back={{ to: ROUTES.businessProfile, label: 'Business Profile · GO15' }} />
    </GrowthFrame>
  )
}
