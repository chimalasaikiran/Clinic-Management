import { Plus } from 'lucide-react'
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
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, CAMPAIGN_TONE } from '../campaignsView'
import { day } from '../format'
import { useLeadContext } from '../useLeads'

const range = (campaign) => `${day(campaign.startDate)} – ${day(campaign.endDate)}`

export default function CampaignRegisterPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const query = { q: filters.get('q') || undefined, channel: filters.get('channel') || undefined, status: filters.get('status') || undefined, ownerId: filters.get('owner') || undefined, branchId: context.branchId || undefined, pageSize: 100 }
  const campaigns = useApiResource(() => campaignsApi.campaigns(query), `campaigns:${JSON.stringify(query)}`)
  const owners = useApiResource(() => campaignsApi.owners(), 'campaign-owners').data ?? []
  const rows = campaigns.data?.data ?? []
  const total = campaigns.data?.meta.total ?? 0
  const state = { search: filters.search }
  const tagged = rows.reduce((sum, campaign) => sum + campaign.leadCount, 0)

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Back to Owner Panel' }} crumb="Owner Panel / Growth OS / Campaigns" code="GO 07" title="Campaign Register" description="Plan clinic outreach, record what was spent, and see which campaigns brought enquiries that became patients." actions={can('growth.manage') && <ActionButton variant="brand" icon={Plus} to={ROUTES.campaignNew} state={state}>Create Campaign</ActionButton>} actionNote="Create / edit campaign · GO09" context={[context.line, 'Filters are kept in the address']} today={context.today} sample="Live records · Spend is entered by hand; leads count only when recorded against the campaign">
      <p className="mb-2 text-right text-xs"><Link to={ROUTES.audiences} className="font-semibold text-brand hover:underline">Manage Audiences · GO10 ↗</Link></p>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5"><h2 className="text-[17px] font-semibold">Status is your plan</h2><p className="mt-2 text-xs leading-5 text-on-surface-variant">Draft, Scheduled, Active, Paused and Completed are set by your team. Only WhatsApp, SMS and email campaigns send anything, and only through a confirmed broadcast.</p></div>
        <div className="rounded-md border border-slate-200 bg-white p-5"><h2 className="text-[17px] font-semibold">Measured from your records</h2><p className="mt-2 text-xs leading-5 text-on-surface-variant">Leads are counted when they are recorded against a campaign; conversions follow those leads. Ad platforms’ reach and clicks are not connected.</p><p className="mt-2 text-[11px] text-outline">{tagged} lead{tagged === 1 ? '' : 's'} recorded against the campaigns shown.</p></div>
      </div>

      <Section title="All campaigns" aside={`${rows.length} of ${total} campaigns`} className="mb-6">
        <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search campaigns" placeholder="Search campaign name, code or objective" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Reset filters</ActionButton></div>
        <div className="mb-3 grid gap-4 sm:grid-cols-3"><FilterField label="Channel" value={filters.get('channel')} onChange={(value) => filters.change('channel', value)} options={[['', 'All channels'], ...Object.entries(CAMPAIGN_CHANNELS)]} /><FilterField label="Status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...Object.entries(CAMPAIGN_STATUSES)]} /><FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...owners.map((owner) => [owner.membershipId, owner.name])]} /></div>
        {!campaigns.data ? <LoadingState label="Loading campaigns…" error={campaigns.error} onRetry={campaigns.reload} /> : (
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Campaign / objective', 'Channel / status', 'Branch / owner', 'Plan / dates', 'Spend', 'Leads recorded', 'Converted'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((campaign) => (
              <tr key={campaign.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                <td className="px-5 py-4"><Link to={pathFor(ROUTES.campaign, { campaignId: campaign.id })} state={state} className="font-semibold text-brand hover:underline">{campaign.name} ↗</Link><br /><span className="text-outline">{campaign.code}</span><br />{campaign.objective}</td>
                <td className="px-5 py-4">{CAMPAIGN_CHANNELS[campaign.channel]}<br /><StatusPill tone={CAMPAIGN_TONE[campaign.status]} className="my-1">{CAMPAIGN_STATUSES[campaign.status]}</StatusPill></td>
                <td className="px-5 py-4">{campaign.branch.name}<br /><span className="text-outline">Owner · {campaign.owner.name}</span></td>
                <td className="px-5 py-4 text-sm font-semibold">{formatINR(campaign.budget)}<br /><span className="text-xs font-normal text-outline">Planned budget<br />{range(campaign)}</span></td>
                <td className="px-5 py-4">{formatINR(campaign.spent)}<br /><span className="text-outline">{campaign.spent ? 'Entered by the team' : 'None entered'}</span></td>
                <td className="px-5 py-4">{campaign.leadCount}<br /><span className="text-outline">{campaign.leadCount && campaign.spent ? `${formatINR(Math.round(campaign.spent / campaign.leadCount))} per lead` : 'Cost per lead —'}</span></td>
                <td className="px-5 py-4">{campaign.converted}<br /><span className="text-outline">Became patients</span><br />{can('growth.manage') && <Link to={pathFor(ROUTES.campaignEdit, { campaignId: campaign.id })} state={state} className="mt-1 inline-block font-semibold text-brand hover:underline">Edit · GO09</Link>}</td>
              </tr>))}</tbody>
          </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">{total || query.q || query.status || query.channel ? 'No campaigns match these filters.' : 'No campaigns yet. Create one to start recording where enquiries come from.'}</p>}</div>
        )}
        <p className="mt-3 flex justify-between text-[11px] text-outline"><span>Showing {rows.length} of {total} campaigns · All dates IST</span><span>Budgets are plans, not spend</span></p>
      </Section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Banner tone="brand" title="Attribution stays intact">A lead’s campaign is recorded with its source and is never moved to another campaign afterwards.</Banner>
        <Banner title="Permission before sending">Broadcasts reach only people with recorded permission for the channel, never anyone who opted out.</Banner>
      </div>
      <GrowthFooter code="GO 07" back={{ to: ROUTES.growth, label: 'Back to Owner Panel · Register context retained on return' }} />
    </GrowthFrame>
  )
}
