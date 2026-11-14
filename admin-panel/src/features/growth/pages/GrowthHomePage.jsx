import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { LEAD_STAGES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day, TONES, when } from '../format'
import { dueState, leadRows, pipelineCounts } from '../growthLogic'

const QUICK = [['Add Lead', ROUTES.leadNew, true], ['Create Campaign', ROUTES.campaignNew], ['Create Content', ROUTES.contentNew], ['Conversations', ROUTES.conversations], ['Reviews', ROUTES.reviews]]

export default function GrowthHomePage() {
  const { data } = useGrowth()
  const counts = pipelineCounts(data.leads)
  const followUps = leadRows(data.leads, {}).filter((lead) => dueState(lead) !== 'None')
  const overdue = followUps.filter((lead) => dueState(lead) === 'Overdue').length
  const needsAttention = data.reviews.filter((review) => review.rating <= 3 && review.responseState !== 'Response approved')
  const unread = data.conversations.filter((thread) => thread.unread).length

  return (
    <GrowthFrame back={{ to: ROUTES.dashboard, label: 'Back to Owner Panel' }} crumb="Owner Panel / Growth" code="GO-01" title="Growth OS" description="Prioritize inquiries, follow-ups and patient relationships across Aura Health." sample="Sample work items, not clinic records. Live Growth data has not been connected; channel connection states are unverified." context={['Organization / branch · Aura Health · All locations (3)', 'Date range · Month to date · 01–22 Oct 2026']}>
      <p className="mb-6 flex flex-wrap items-center gap-2 text-xs"><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Quick actions</span>{QUICK.map(([label, to, primary]) => <ActionButton key={label} to={to} variant={primary ? 'brand' : 'secondary'}>{label}</ActionButton>)}</p>

      <dl className="mb-2 grid gap-4 sm:grid-cols-4">
        {[['New Leads', String(counts.New), 'Lead records in the sample'], ['Follow-ups Due', String(followUps.length), `${overdue} overdue`], ['Attributed Appointments', '—', 'Attribution unavailable'], ['Campaign Performance', '—', 'Performance data unavailable']].map(([label, value, hint]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[13px] font-medium">{label}</dt><dd className="mt-3 text-2xl font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>
        ))}
      </dl>
      <p className="mb-6 text-[11px] text-outline">“—” means unavailable, not zero. Comparisons appear only with reliable data for both periods.</p>

      <h2 className="mb-3 flex items-baseline justify-between text-[17px] font-semibold">Lead pipeline <span className="text-xs font-normal text-outline">Counts from the sample leads</span></h2>
      <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
        <ul className="grid divide-slate-200 sm:grid-cols-5 sm:divide-x">{LEAD_STAGES.map((stage) => <li key={stage} className="p-4"><Link to={`${ROUTES.leads}?stage=${stage}`} className="text-xs hover:underline">{stage} ›</Link><p className="mt-2 text-xl font-semibold">{counts[stage]}</p></li>)}</ul>
        <p className="flex justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-outline"><span>Overdue follow-ups: {overdue}</span><span>Priority work below ↓</span></p>
      </div>

      <Section title="Prioritized follow-ups" aside="Overdue first, then next due" className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Lead / inquiry', 'Source', 'Last contact · IST', 'Next action', 'Due · IST', 'Owner'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{followUps.map((lead) => (
            <tr key={lead.id} className="border-t border-slate-100 align-top">
              <td className="px-6 py-4"><Link to={pathFor(ROUTES.lead, { leadId: lead.id })} className="font-semibold text-brand hover:underline">{lead.name} ↗</Link><br /><span className="text-outline">{lead.summary}</span></td>
              <td className="px-6 py-4">{lead.source}</td>
              <td className="px-6 py-4">{when(lead.lastActivity)}</td>
              <td className="px-6 py-4">{lead.nextAction}<br /><Link to={pathFor(ROUTES.leadFollowUp, { leadId: lead.id })} className="text-[11px] text-brand hover:underline">Record follow-up →</Link></td>
              <td className="px-6 py-4">{when(lead.due)}<br /><StatusPill tone={TONES[dueState(lead)]} className="mt-1">{dueState(lead)}</StatusPill></td>
              <td className="px-6 py-4">{lead.owner}</td>
            </tr>))}</tbody>
        </table>{followUps.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No open follow-ups.</p>}</div>
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
          <ul className="divide-y divide-slate-100 text-xs">{data.conversations.slice(0, 2).map((thread) => <li key={thread.id} className="py-3"><p className="flex justify-between"><strong className="text-[13px]">{thread.subject}</strong><Link to={pathFor(ROUTES.conversation, { threadId: thread.id })} className="font-semibold text-brand hover:underline">Thread ↗</Link></p><p className="mt-1">“{thread.preview}”</p><p className="mt-1 text-outline">{thread.channel} · {when(thread.last)} <StatusPill tone={thread.unread ? 'success' : 'neutral'} className="ml-2">{thread.unread ? 'Unread' : 'Read'}</StatusPill></p></li>)}</ul>
          <p className="mt-3 text-[11px] text-outline">Unread total: {unread} · Channel states unverified</p>
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
