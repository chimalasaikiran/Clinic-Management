import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { ESCALATION_STATUSES, RESPONSE_STATES, RESPONSE_TONE, stars } from '../contentView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

export default function ReviewsRegisterPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const [message, setMessage] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const query = { q: filters.get('q') || undefined, rating: filters.get('rating') || undefined, response: filters.get('response') || undefined, escalated: filters.get('escalation') || undefined, branchId: context.branchId || undefined, pageSize: 100 }
  const reviews = useApiResource(() => contentApi.reviews(query), `reviews:${JSON.stringify(query)}`)
  const rows = reviews.data?.data ?? []
  const sync = reviews.data?.meta.sync
  const state = { search: filters.search }

  const syncNow = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const result = await contentApi.syncReviews(context.branchId)
      setMessage({ tone: 'brand', title: `Fetched ${result.fetched} review${result.fetched === 1 ? '' : 's'} from Google.` })
      reviews.reload()
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not fetched', text: error.message })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <GrowthFrame back={{ to: ROUTES.businessProfile, label: 'Business Profile · GO15' }} crumb="Owner Panel / Growth OS / Reviews & Reputation" code="GO-16" title="Reviews & Reputation Register" description="Google reviews for your branches, with replies approved by a second person and internal follow-up kept separate." badge={sync ? <StatusPill tone={sync.googleConnected ? 'success' : 'warning'}>{sync.googleConnected ? `${sync.linkedBranches} branch${sync.linkedBranches === 1 ? '' : 'es'} linked` : 'Google not connected'}</StatusPill> : null} context={[context.line, 'Rating, reply and escalation filters are kept in the address']} today={context.today} sample="Live records · Fetched from Google Business Profile every 30 minutes">
      <p className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm font-medium">{reviews.data ? `${reviews.data.meta.total} review${reviews.data.meta.total === 1 ? '' : 's'}${sync?.lastSyncedAt ? ` · last fetched ${when(stampOf(sync.lastSyncedAt))}` : ''}` : 'Loading…'}<span className="flex gap-3">{can('growth.manage') && context.branchId && sync?.googleConnected && <ActionButton disabled={syncing} onClick={syncNow}>{syncing ? 'Fetching…' : 'Fetch now'}</ActionButton>}<ActionButton to={ROUTES.businessProfile}>Business profile · GO15</ActionButton><ActionButton variant="brand" to={ROUTES.reviewRequests}>Request feedback → GO18</ActionButton></span></p>
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      {sync && !sync.googleConnected && <Banner tone="warning" title="Google Business Profile is not connected" className="mb-6">Reviews appear here once an administrator connects Google on the Channels screen and each branch is linked to its location on the Business Profile screen.</Banner>}
      {sync && sync.googleConnected && !sync.linkedBranches && <Banner tone="warning" title="No branch is linked to a Google location" className="mb-6">Choose each branch’s Google location on the Business Profile screen; its reviews are then fetched every 30 minutes.</Banner>}

      <Section title="Find reviews" aside="Context kept on return" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3"><FilterField label="Rating" value={filters.get('rating')} onChange={(value) => filters.change('rating', value)} options={[['', 'All ratings'], ...['5', '4', '3', '2', '1'].map((star) => [star, `${star} star`])]} /><FilterField label="Reply" value={filters.get('response')} onChange={(value) => filters.change('response', value)} options={[['', 'All reply states'], ...Object.entries(RESPONSE_STATES).filter(([id]) => id !== 'posted')]} /><FilterField label="Escalation" value={filters.get('escalation')} onChange={(value) => filters.change('escalation', value)} options={[['', 'All escalation states'], ['true', 'Escalated'], ['false', 'Not escalated']]} /></div>
        <div className="mt-4 flex flex-wrap items-end gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search reviews" placeholder="Search review text or reviewer name" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Clear filters</ActionButton></div>
      </Section>

      <Section title="Reviews" aside="Newest first" className="mb-6">
        {!reviews.data ? <LoadingState label="Loading reviews…" error={reviews.error} onRetry={reviews.reload} /> : (
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Review / text', 'Source / branch', 'Rating / posted', 'Reply / escalation'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((review) => (
              <tr key={review.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                <td className="max-w-md px-6 py-5"><strong className="text-[13px]">{review.reviewerName}</strong><p className="mt-2 text-[13px] leading-5">{review.comment ?? <span className="text-outline">Rating only, no text</span>}</p><Link to={pathFor(ROUTES.review, { reviewId: review.id })} state={state} className="mt-2 inline-block font-semibold text-brand hover:underline">Open review → GO17</Link></td>
                <td className="px-6 py-5">Google<br /><span className="text-outline">{review.branch.name}</span></td>
                <td className="px-6 py-5"><strong className="text-base text-amber-700">{stars(review.rating)}</strong><br /><span className="text-outline">{when(stampOf(review.postedAt))}</span></td>
                <td className="px-6 py-5"><StatusPill tone={RESPONSE_TONE[review.responseState]}>{RESPONSE_STATES[review.responseState]}</StatusPill><br /><span className="text-outline">{review.escalations[0] ? `${review.escalations[0].code} · ${ESCALATION_STATUSES[review.escalations[0].status]}` : 'No escalation'}</span></td>
              </tr>))}</tbody>
          </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">{query.q || query.rating || query.response || query.escalated ? 'No reviews match these filters.' : 'No reviews have been fetched yet.'}</p>}</div>
        )}
      </Section>
      <GrowthFooter code="GO-16" back={{ to: ROUTES.businessProfile, label: 'Business Profile · GO15' }} />
    </GrowthFrame>
  )
}
