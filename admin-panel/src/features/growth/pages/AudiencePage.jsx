import { useState } from 'react'
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
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { AUDIENCE_INCLUDE, AUDIENCE_STATUSES, AUDIENCE_TONE } from '../campaignsView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

// The checks every broadcast makes for each person, in this order.
const CASCADE = [['Branch scope', 'Only records at the audience’s branch (or every branch, for organisation-wide audiences).'], ['Rules', 'Lead stage, source, interest and age; patients by visits, age and gender. No diagnosis is used.'], ['One message per address', 'A converted lead who is also a patient is counted and messaged once.'], ['Channel permission', 'Marketing needs a recorded opt-in for that channel. Unknown permission is not eligible.'], ['Opt-outs', 'A STOP reply or recorded withdrawal always excludes the person.'], ['Weekly limit', 'Automated messages per person in 7 days, counting workflows, are capped when sending.']]

export default function AudiencePage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const [selectedId, setSelectedId] = useState(null)
  const query = { q: filters.get('q') || undefined, status: filters.get('status') || undefined, pageSize: 100 }
  const audiences = useApiResource(() => campaignsApi.audiences(query), `audiences:${JSON.stringify(query)}`)
  const rows = audiences.data?.data ?? []
  const selected = rows.find((audience) => audience.id === selectedId) ?? rows[0]
  const state = { search: filters.search }
  const manage = can('growth.manage')

  return (
    <GrowthFrame back={{ to: ROUTES.campaigns, label: 'Back to Campaigns' }} crumb="Owner Panel / Growth OS / Campaigns / Audiences" code="GO 10" title="Audience Management" description="Define who a campaign reaches from live lead and patient records, and see how many each channel can reach after permission and opt-outs." actions={manage && <ActionButton variant="brand" icon={Plus} to={ROUTES.segmentNew} state={state}>Create segment</ActionButton>} actionNote={manage ? 'Run campaigns & patient messaging' : 'View only'} context={[context.line, 'Filters are kept in the address · Return retains the campaign selection']} today={context.today} sample="Live records · Sizes are counted from current leads, patients and recorded permission">
      <Banner tone="brand" title="Rules, counted live" className="mb-6">An audience stores its rules, never a list of people, so its size is always current. Ready audiences can be used for campaign broadcasts; each broadcast checks everyone again when it sends.</Banner>

      <Section title="Audience segments" aside={`${rows.length} definitions · No contact details shown`} className="mb-6">
        <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search segments" placeholder="Search segment name, code or purpose" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Reset filters</ActionButton></div>
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><FilterField label="Definition status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'Draft and ready'], ...Object.entries(AUDIENCE_STATUSES).map(([id, label]) => [id, label])]} /></div>
        {!audiences.data ? <LoadingState label="Loading audiences…" error={audiences.error} onRetry={audiences.reload} /> : (
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Segment / status', 'Inclusion criteria', 'Who', 'Branch', 'Last updated', 'Used by'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>{rows.map((audience) => (
              <tr key={audience.id} className={`border-t border-slate-100 align-top ${selected?.id === audience.id ? 'bg-teal-50/40' : ''}`}>
                <td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(audience.id)} className="text-left font-semibold text-brand hover:underline">{audience.name} ↗</button><br /><span className="text-outline">{audience.code} · Version {audience.version}</span><br /><StatusPill tone={AUDIENCE_TONE[audience.status]} className="mt-1">{AUDIENCE_STATUSES[audience.status]}</StatusPill><br /><button type="button" onClick={() => setSelectedId(audience.id)} className="mt-1 text-[11px] font-semibold text-brand hover:underline">{selected?.id === audience.id ? 'Counted below ↓' : 'Count audience ↗'}</button></td>
                <td className="px-5 py-4">{audience.description.join('; ')}<br /><span className="text-outline">{audience.purpose}</span></td>
                <td className="px-5 py-4">{AUDIENCE_INCLUDE[audience.rules.include]}</td>
                <td className="px-5 py-4">{audience.branch?.name ?? 'All branches'}</td>
                <td className="px-5 py-4">{when(stampOf(audience.updatedAt))}<br /><span className="text-outline">{audience.updatedBy}</span></td>
                <td className="px-5 py-4">{audience.campaigns.length ? audience.campaigns.map((campaign) => <Link key={campaign.id} to={pathFor(ROUTES.campaign, { campaignId: campaign.id })} className="block font-semibold text-brand hover:underline">{campaign.code} · {campaign.name}</Link>) : <span className="text-outline">No campaign yet</span>}{manage && <Link to={pathFor(ROUTES.segmentEdit, { segmentId: audience.id })} state={state} className="mt-1 inline-block font-semibold text-brand hover:underline">Edit definition</Link>}</td>
              </tr>))}</tbody>
          </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No segments match these filters.</p>}</div>
        )}
      </Section>

      {selected && <AudiencePreview key={`${selected.id}:${selected.version}`} audience={selected} state={state} manage={manage} />}
      <GrowthFooter code="GO 10" back={{ to: ROUTES.campaigns, label: 'Back to Campaigns · Context retained' }} />
    </GrowthFrame>
  )
}

function AudiencePreview({ audience, state, manage }) {
  const count = useApiResource(() => campaignsApi.countAudience({ branchId: audience.branch?.id ?? null, rules: audience.rules }), `audience-count:${audience.id}:${audience.version}`)
  const detail = useApiResource(() => campaignsApi.audience(audience.id), `audience:${audience.id}:${audience.version}`)
  const size = count.data

  return (
    <>
      <h2 className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[17px] font-semibold">Preview · {audience.name} <StatusPill tone="success">Counted from current records</StatusPill></h2>
      <p className="mb-4 text-xs text-outline">{audience.code} · Version {audience.version} · {audience.campaigns[0] ? `Used by ${audience.campaigns.map((campaign) => campaign.name).join(', ')}` : 'Not used by a campaign yet'}</p>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Size and reach" aside={size ? `${size.leads} leads · ${size.patients} patients` : 'Counting…'}>
          {!size ? <LoadingState label="Counting the audience…" error={count.error} onRetry={count.reload} /> : (
            <>
              <ul className="mb-4 space-y-1 text-xs leading-5">{size.description.map((line) => <li key={line}>{line}</li>)}</ul>
              <table className="w-full text-left text-xs"><thead className="text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Channel', 'Can reach', 'Opted out', 'No permission', 'No address'].map((heading) => <th key={heading} scope="col" className="py-2">{heading}</th>)}</tr></thead>
                <tbody>{Object.entries(size.channels).map(([channel, reach]) => <tr key={channel} className="border-t border-slate-100"><th scope="row" className="py-2 font-medium">{CHANNELS[channel]}</th><td className="py-2 text-[13px] font-semibold text-brand">{reach.reachable}</td><td className="py-2">{reach.optedOut}</td><td className="py-2">{reach.noConsent}</td><td className="py-2">{reach.noAddress}</td></tr>)}</tbody></table>
              <p className="mt-3 text-[11px] text-outline">“Can reach” counts addresses with a recorded opt-in. Appointment reminders to patients may also use their notification setting.</p>
            </>
          )}
        </Section>
        <Section title="Eligibility checks" aside="Applied to every broadcast">
          <ol className="space-y-4">{CASCADE.map(([title, text], index) => <li key={title} className="flex gap-3 text-xs"><span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface-low font-semibold">{index + 1}</span><span><strong className="block text-[13px]">{title}</strong><span className="text-on-surface-variant">{text}</span></span></li>)}</ol>
        </Section>
      </div>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Version history" aside="Append only">
          {!detail.data ? <LoadingState label="Loading history…" error={detail.error} onRetry={detail.reload} /> : <ul className="space-y-2 text-xs">{detail.data.versions.map((version) => <li key={version.version}><strong>v{version.version}</strong> · {version.changeNote} <span className="text-outline">· {version.actor} · {when(stampOf(version.createdAt))}</span></li>)}</ul>}
          {manage && <Link to={pathFor(ROUTES.segmentEdit, { segmentId: audience.id })} state={state} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Propose a new version →</Link>}
        </Section>
        <Section title="Using this audience" aside={AUDIENCE_STATUSES[audience.status]}>
          <StatusPill tone={AUDIENCE_TONE[audience.status]}>{audience.status === 'ready' ? 'READY FOR BROADCASTS' : audience.status === 'draft' ? 'DRAFT · NOT SENDABLE' : 'ARCHIVED'}</StatusPill>
          <p className="mt-3 text-xs leading-5 text-on-surface-variant">Choose this audience on a WhatsApp, SMS or email campaign, then send a broadcast from the campaign. Only Ready audiences can be sent to. Contact lists are never exported from here.</p>
          <ActionButton className="mt-4" to={ROUTES.campaigns}>Open campaigns</ActionButton>
        </Section>
      </div>
    </>
  )
}
