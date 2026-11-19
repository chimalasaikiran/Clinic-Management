import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { useGrowth } from '../context/growthContext'
import { day, TONES, when } from '../format'
import { leadsApi } from '../leadsApi'
import { messagingApi } from '../messagingApi'
import { toConversationView } from '../messagingView'
import { clinicNow, leadSummary, STAGES, toLeadView } from '../leadsView'
import { useLeadContext } from '../useLeads'

const QUICK = [['Add Lead', ROUTES.leadNew, true], ['Create Campaign', ROUTES.campaignNew], ['Create Content', ROUTES.contentNew], ['Conversations', ROUTES.conversations], ['Reviews', ROUTES.reviews]]

const FOLLOW_UPS = 10

export default function GrowthHomePage() {
  const { data } = useGrowth()
  const { can } = useAuth()
  const context = useLeadContext()
  const branchId = context.branchId || undefined
  const today = clinicNow().date
  const monthStart = `${today.slice(0, 8)}01`
  const open = useApiResource(() => leadsApi.list({ branchId, due: 'open', sort: 'follow-up', pageSize: FOLLOW_UPS }), `home:${branchId}`)
  const month = useApiResource(() => leadsApi.performance({ branchId, from: monthStart, to: today }), `home-month:${branchId}:${today}`).data
  const summary = leadSummary(open.data?.meta)
  const counts = summary.pipeline
  const followUps = (open.data?.data ?? []).map(toLeadView)
  const openTotal = open.data?.meta?.total ?? 0
  const overdue = summary.overdue
  const quick = QUICK.filter(([label]) => label !== 'Add Lead' || can('growth.leads'))
  const needsAttention = data.reviews.filter((review) => review.rating <= 3 && review.responseState !== 'Response approved')
  const inbox = useApiResource(() => (can('growth.view') ? messagingApi.conversations({ branchId, pageSize: 2 }) : Promise.resolve(null)), `home-inbox:${branchId}`).data
  const conversations = (inbox?.data ?? []).map(toConversationView)

  return (
    <GrowthFrame back={{ to: ROUTES.dashboard, label: 'Back to Owner Panel' }} crumb="Owner Panel / Growth" code="GO-01" title="Growth OS" description="Prioritize inquiries, follow-ups and patient relationships across Aura Health." sample="Leads, follow-ups and conversations are live. Campaigns, reviews and workflows below are still sample records; channel connection states are unverified." context={[context.line, `Month to date · ${day(monthStart)} – ${day(today)} · Asia/Kolkata`]} today={context.today}>
      <p className="mb-6 flex flex-wrap items-center gap-2 text-xs"><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Quick actions</span>{quick.map(([label, to, primary]) => <ActionButton key={label} to={to} variant={primary ? 'brand' : 'secondary'}>{label}</ActionButton>)}</p>

      <dl className="mb-2 grid gap-4 sm:grid-cols-4">
        {[['New Leads', open.data ? String(counts.New) : '—', 'Leads at the New stage'], ['Follow-ups Due', open.data ? String(summary.followUpsDue) : '—', `${overdue} overdue · due by end of today`], ['Booked After Conversion', month ? String(month.booked) : '—', month ? `${month.converted} converted this month` : 'Loading'], ['Campaign Performance', '—', 'Campaigns are not linked to leads yet']].map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[13px] font-medium">{label}</dt><dd className="mt-3 text-2xl font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>
        ))}
      </dl>
      <p className="mb-6 text-[11px] text-outline">“—” means unavailable, not zero. Comparisons appear only with reliable data for both periods.</p>

      <h2 className="mb-3 flex items-baseline justify-between text-[17px] font-semibold">Lead pipeline <span className="text-xs font-normal text-outline">All leads in this location</span></h2>
      <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
        <ul className="grid divide-slate-200 sm:grid-cols-5 sm:divide-x">{Object.values(STAGES).map((stage) => <li key={stage} className="p-4"><Link to={`${ROUTES.leads}?stage=${stage}`} className="text-xs hover:underline">{stage} ›</Link><p className="mt-2 text-xl font-semibold">{counts[stage]}</p></li>)}</ul>
        <p className="flex justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-outline"><span>Overdue follow-ups: {overdue}</span><span>Priority work below ↓</span></p>
      </div>

      <Section title="Prioritized follow-ups" aside={openTotal > FOLLOW_UPS ? <Link to={ROUTES.leads} className="font-semibold text-brand hover:underline">{openTotal} open · Lead Register ↗</Link> : 'Overdue first, then next due'} className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead / inquiry', 'Source', 'Last contact · IST', 'Next action', 'Due · IST', 'Owner'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{followUps.map((lead) => (
            <tr key={lead.id} className="border-t border-slate-100 align-top">
              <td className="px-6 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.name} ↗</Link><br /><span className="text-outline">{lead.summary}</span></td>
              <td className="px-6 py-4">{lead.source}</td>
              <td className="px-6 py-4">{when(lead.lastActivity)}</td>
              <td className="px-6 py-4">{lead.nextAction}{can('growth.leads') && <><br /><Link to={pathFor(ROUTES.leadFollowUp, { leadId: lead.id })} className="text-[11px] text-brand hover:underline">Record follow-up →</Link></>}</td>
              <td className="px-6 py-4">{when(lead.due)}<br /><StatusPill tone={TONES[lead.dueState]} className="mt-1">{lead.dueState}</StatusPill></td>
              <td className="px-6 py-4">{lead.owner}</td>
            </tr>))}</tbody>
        </table>{open.data && followUps.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No open follow-ups.</p>}{open.error && !open.data && <p role="alert" className="px-6 py-8 text-center text-sm text-danger">{open.error.message}</p>}</div>
      </Section>

      <Section title="Recent campaigns" aside={<Link to={ROUTES.campaigns} className="font-semibold text-brand hover:underline">Campaign Details ↗</Link>} className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Campaign', 'Channel', 'Status', 'Spend · INR', 'Leads', 'Conversion'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{data.campaigns.slice(0, 3).map((campaign) => (
            <tr key={campaign.id} className="border-t border-slate-100 align-top"><td className="px-6 py-4"><Link to={pathFor(ROUTES.campaign, { campaignId: campaign.id })} className="font-semibold text-brand hover:underline">{campaign.name} ↗</Link><br /><span className="text-outline">Updated {day(campaign.updated)}</span></td><td className="px-6 py-4">{campaign.channel.split(' / ')[0]}</td><td className="px-6 py-4"><StatusPill>{campaign.status}</StatusPill></td><td className="px-6 py-4">—<br /><span className="text-outline">Setup unverified</span></td><td className="px-6 py-4">—<br /><span className="text-outline">Unavailable</span></td><td className="px-6 py-4">—<br /><span className="text-outline">Attribution unavailable</span></td></tr>))}</tbody>
        </table></div>
        <p className="mt-3 text-[11px] text-outline">Spend requires configured tracking. Setup is unverified; unavailable spend or attribution is not zero performance.</p>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Recent conversations" aside={<Link to={ROUTES.conversations} className="font-semibold text-brand hover:underline">Inbox ↗</Link>}>
          <ul className="divide-y divide-slate-100 text-xs">{conversations.map((thread) => <li key={thread.id} className="py-3"><p className="flex justify-between"><strong className="text-[13px]">{thread.contact} · {thread.number}</strong><Link to={pathFor(ROUTES.conversation, { threadId: thread.id })} className="font-semibold text-brand hover:underline">Thread ↗</Link></p><p className="mt-1">“{thread.preview}”</p><p className="mt-1 text-outline">{thread.channel} · {when(thread.last)} <StatusPill tone={thread.unread ? 'success' : 'neutral'} className="ml-2">{thread.unread ? 'Unread' : 'Read'}</StatusPill></p></li>)}</ul>
          {inbox && conversations.length === 0 && <p className="py-3 text-xs text-outline">No conversations yet.</p>}
          <p className="mt-3 text-[11px] text-outline">Unread total: {inbox?.meta.unread ?? '—'} · Live</p>
        </Section>
        <Section title="Reviews requiring attention" aside={<Link to={ROUTES.reviews} className="font-semibold text-brand hover:underline">Register ↗</Link>}>
          <ul className="divide-y divide-slate-100 text-xs">{needsAttention.map((review) => <li key={review.id} className="py-3"><p className="flex justify-between"><strong className="text-[13px]">{review.alias} · {review.rating}/5</strong><StatusPill tone="warning">Needs response</StatusPill></p><p className="mt-1">“{review.text}”</p><Link to={pathFor(ROUTES.review, { reviewId: review.id })} className="mt-1 inline-block font-semibold text-brand hover:underline">Review Details ↗</Link></li>)}</ul>
          {needsAttention.length === 0 && <p className="text-xs text-outline">No reviews need a response.</p>}
        </Section>
      </div>

      <h2 className="mb-3 text-[17px] font-semibold">Keep care relationships moving</h2>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {[['Retention reminders', 'Routine recall', data.workflows[0], ROUTES.workflows, 'Recall workflow'], ['No-show recovery', 'Recovery', data.workflows[4], ROUTES.workflows, 'Recovery workflow'], ['Workflow exceptions', 'Needs review', null, ROUTES.workflowExecutions, 'Execution exceptions']].map(([title, tag, workflow, to, link]) => (
          <div key={title} className="rounded-md border border-slate-200 bg-white p-5 text-xs"><p className="text-[13px] font-semibold">{title}</p><StatusPill className="my-3">{tag}</StatusPill><p className="font-medium">{workflow?.name ?? 'Simulation scenarios'}</p><p className="mt-1 text-on-surface-variant">{workflow ? workflow.trigger : 'Four simulated runs need review before any live use.'}</p><Link to={to} className="mt-3 inline-block font-semibold text-brand hover:underline">{link} ↗</Link></div>
        ))}
      </div>
      <GrowthFooter code="GO-01" />
    </GrowthFrame>
  )
}
