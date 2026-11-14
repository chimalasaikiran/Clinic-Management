import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { formatINR } from '../../patients/format'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

const TONE = { Draft: 'neutral', Scheduled: 'success', Active: 'info', Paused: 'warning' }
const range = (campaign) => `${day(campaign.start)} – ${day(campaign.end)}`

export default function CampaignRegisterPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const query = filters.get('q').trim().toLowerCase()
  const rows = data.campaigns
    .filter((campaign) => (!filters.get('channel') || campaign.channel === filters.get('channel')) && (!filters.get('status') || campaign.status === filters.get('status')) && (!filters.get('owner') || campaign.owner === filters.get('owner')))
    .filter((campaign) => !query || `${campaign.name} ${campaign.id} ${campaign.objective}`.toLowerCase().includes(query))
    .sort((a, b) => a.id.localeCompare(b.id))
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Back to Owner Panel' }} crumb="Owner Panel / Growth OS / Campaigns" code="GO 07" title="Campaign Register" description="Plan clinic outreach, review campaign ownership and preserve a verifiable acquisition history." actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.campaignNew} state={state}>Create Campaign</ActionButton>} actionNote="Create / edit campaign · GO09" context={['Aura Health · All locations (3) · 01–22 Oct 2026', 'Register activity window, not campaign delivery dates · Filters kept in the address']}>
      <p className="mb-2 text-right text-xs"><Link to={ROUTES.audiences} className="font-semibold text-brand hover:underline">Manage Audiences · GO10 ↗</Link></p>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5"><h2 className="text-[17px] font-semibold">Internal plans, not delivery</h2><p className="mt-2 text-xs leading-5 text-on-surface-variant">Draft, Scheduled, Active and Paused are internal lifecycle labels. None confirms external ad delivery, calls or messaging.</p><StatusPill tone="warning" className="mt-3">INTEGRATION DEPENDENT</StatusPill></div>
        <div className="rounded-md border border-slate-200 bg-white p-5"><h2 className="text-[17px] font-semibold">Measurement unavailable</h2><p className="mt-2 text-xs leading-5 text-on-surface-variant">Spend, reach, clicks and provider results are unavailable · connector not verified. Missing measurement is not zero.</p><p className="mt-2 text-[11px] text-outline">{data.leads.filter((lead) => lead.campaignId).length} known historical tag is shown separately from verified attributed leads.</p></div>
      </div>

      <Section title="All campaigns" aside={`${rows.length} of ${data.campaigns.length} plans`} className="mb-6">
        <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search campaigns" placeholder="Search campaign name, ID or objective" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Reset filters</ActionButton></div>
        <div className="mb-3 grid gap-4 sm:grid-cols-3"><FilterField label="Channel" value={filters.get('channel')} onChange={(value) => filters.change('channel', value)} options={[['', 'All channels'], ...CAMPAIGN_CHANNELS]} /><FilterField label="Internal status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...CAMPAIGN_STATUSES]} /><FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...OWNERS]} /></div>
        <p className="mb-4 text-[11px] text-outline">Branch scope inherited: All locations (3). Proposed schedule is shown per campaign, not constrained to this activity window.</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Campaign / objective', 'Channel / internal status', 'Branch / owner', 'Plan / dates', 'Spend', 'Lead associations', 'Attributed results'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((campaign) => (
            <tr key={campaign.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
              <td className="px-5 py-4"><Link to={pathFor(ROUTES.campaign, { campaignId: campaign.id })} state={state} className="font-semibold text-brand hover:underline">{campaign.name} ↗</Link><br /><span className="text-outline">{campaign.id.replace('CMP', 'CMP ')} · Sample plan</span><br />{campaign.objective}</td>
              <td className="px-5 py-4">{campaign.channel.split(' / ')[0]}<br /><StatusPill tone={TONE[campaign.status]} className="my-1">{campaign.status} · internal</StatusPill><br /><span className="text-outline">{campaign.status === 'Draft' ? 'Not published' : 'Internal only; external delivery unverified'}</span></td>
              <td className="px-5 py-4">{campaign.branch}<br /><span className="text-outline">Owner · {campaign.owner}</span></td>
              <td className="px-5 py-4 text-sm font-semibold">{formatINR(campaign.budget)}<br /><span className="text-xs font-normal text-outline">Planned · INR<br />{range(campaign)}<br />Proposed window · IST</span></td>
              <td className="px-5 py-4">Unavailable<br /><span className="text-outline">Connector not verified</span></td>
              <td className="px-5 py-4">{campaign.leadIds.length ? `${campaign.leadIds.length} historical tag` : 'Not measured'}<br /><span className="text-outline">{campaign.leadIds.length ? `${campaign.leadIds.map((id) => id.replace('LD', 'LD')).join(', ')} · unverified` : 'No verified attribution supplied'}</span></td>
              <td className="px-5 py-4">Not attributed<br /><span className="text-outline">No verified linkage</span><br /><Link to={pathFor(ROUTES.campaignEdit, { campaignId: campaign.id })} state={state} className="mt-1 inline-block font-semibold text-brand hover:underline">Edit · GO09</Link></td>
            </tr>))}</tbody>
        </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No campaigns match these filters.</p>}</div>
        <p className="mt-3 flex justify-between text-[11px] text-outline"><span>Showing {rows.length} of {data.campaigns.length} plans · All dates IST</span><span>Budgets are not spend</span></p>
      </Section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Banner tone="brand" title="Attribution stays intact">Original source and campaign tags are immutable. Verification appends evidence and audit history; it never rewrites lead records.</Banner>
        <Banner title="Eligibility before activation">Role and branch authorization, recorded channel consent, preferences and suppression rules must pass. Unknown consent is not eligible.</Banner>
      </div>
      <GrowthFooter code="GO 07" back={{ to: ROUTES.growth, label: 'Back to Owner Panel · Register context retained on return' }} />
    </GrowthFrame>
  )
}
