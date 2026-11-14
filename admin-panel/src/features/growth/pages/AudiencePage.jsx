import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { LEAD_STAGES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

const CASCADE = [['Scope + role', 'Verify authorized role and Jubilee Hills scope. Other branches: access not verified.'], ['Permitted inquiry interest', 'Use recorded inquiry interest and known adult eligibility; no inferred conditions.'], ['Channel-specific consent', 'Require recorded, current consent for the proposed use. Unknown or withdrawn consent is not eligible.'], ['Contact preferences', 'Check permitted channel, purpose and contact preferences before use.'], ['Opt-outs, DND & suppression', 'Apply all exclusions. Suppression always overrides inclusion.'], ['Deduplicate + refresh', 'Count a shared identity once. Run a current authorized eligibility refresh before export or activation.']]

export default function AudiencePage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const [selectedId, setSelectedId] = useState(null)
  const query = filters.get('q').trim().toLowerCase()
  const rows = data.segments
    .filter((segment) => (!filters.get('status') || segment.status === filters.get('status')) && (!filters.get('stage') || segment.lifecycle.includes(filters.get('stage'))))
    .filter((segment) => !query || `${segment.name} ${segment.id} ${segment.interest}`.toLowerCase().includes(query))
  const selected = data.segments.find((segment) => segment.id === selectedId) ?? rows[0]
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.campaigns, label: 'Back to Campaigns' }} crumb="Owner Panel / Growth OS / Campaigns / Audiences" code="GO 10" title="Audience Management" description="Define consent-aware inquiry segments. Preview rules without exposing patient data or claiming an addressable audience." actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.segmentNew} state={state}>Create segment</ActionButton>} actionNote="Authorized definition-edit role required" context={['Return to: Aura Health · All locations (3) · 01–22 Oct 2026', 'Filters are kept in the address · Return retains the campaign selection']}>
      <Banner tone="brand" title="Definitions, not computed patient lists" className="mb-6">All sizes are “Not calculated · authorized query required”. Dates below are definition-edit dates, not eligibility refreshes. Draft / Review describe the definition; New / Contacted / Qualified describe lead lifecycle criteria.</Banner>

      <Section title="Audience segments" aside={`${rows.length} definitions · No raw PII`} className="mb-6">
        <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search segments" placeholder="Search segment name, ID or permitted inquiry interest" className="min-w-72 flex-1" /><ActionButton onClick={filters.reset}>Reset filters</ActionButton></div>
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><FilterField label="Definition status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All definitions'], 'Draft', 'Review']} /><FilterField label="Lead lifecycle" value={filters.get('stage')} onChange={(value) => filters.change('stage', value)} options={[['', 'All lead stages'], ...LEAD_STAGES]} /><FilterField label="Branch scope" value="" disabled options={[['', 'All locations (3)']]} /></div>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Segment / status', 'Inclusion criteria', 'Size', 'Lead lifecycle', 'Branch', 'Last updated', 'Proposed channels'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((segment) => (
            <tr key={segment.id} className={`border-t border-slate-100 align-top ${selected?.id === segment.id ? 'bg-teal-50/40' : ''}`}>
              <td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(segment.id)} className="text-left font-semibold text-brand hover:underline">{segment.name} ↗</button><br /><span className="text-outline">{segment.id} · Definition v{segment.version}</span><br /><StatusPill tone={segment.status === 'Draft' ? 'neutral' : 'warning'} className="mt-1">{segment.status} · definition</StatusPill><br /><button type="button" onClick={() => setSelectedId(segment.id)} className="mt-1 text-[11px] font-semibold text-brand hover:underline">{selected?.id === segment.id ? 'Preview selected ↓' : 'Preview definition ↗'}</button></td>
              <td className="px-5 py-4">{segment.criteria}<br /><span className="text-outline">Existing consent verification required</span></td>
              <td className="px-5 py-4">Not calculated<br /><span className="text-outline">Authorized query required · Not a zero count</span></td>
              <td className="px-5 py-4">{segment.lifecycle.join(' / ')}<br /><span className="text-outline">Lead-stage filter only</span></td>
              <td className="px-5 py-4">{segment.branch}<br /><span className="text-outline">Access unverified</span></td>
              <td className="px-5 py-4">{day(segment.updated)}<br /><span className="text-outline">Sample edit · IST</span></td>
              <td className="px-5 py-4">{segment.channel}<br /><span className="text-outline">Pending consent / integration check</span><br /><Link to={pathFor(ROUTES.segmentEdit, { segmentId: segment.id })} state={state} className="mt-1 inline-block font-semibold text-brand hover:underline">Edit definition</Link></td>
            </tr>))}</tbody>
        </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No segments match these filters.</p>}</div>
        <p className="mt-3 flex justify-between text-[11px] text-outline"><span>{rows.length} definitions · No query run · No eligible or matched count supplied</span><span>Last updated = definition edit, not count refresh</span></p>
      </Section>

      {selected && (
        <>
          <h2 className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[17px] font-semibold">Preview · {selected.name} <StatusPill tone="success">Rules only · No query run</StatusPill></h2>
          <p className="mb-4 text-xs text-outline">{selected.id} · Definition v{selected.version} · Proposed for {data.campaigns.find((campaign) => campaign.segmentId === selected.id)?.name ?? 'no campaign'}</p>
          <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
            <Section title="Include / exclude rules" aside={`Definition v${selected.version}`}>
              <p className="text-[10px] font-semibold tracking-wide text-brand uppercase">Include · all rules required</p>
              <p className="mt-1 text-xs leading-5">{selected.branch} inquiry scope; {selected.interest.toLowerCase()}; adult age eligibility only when known; lead lifecycle {selected.lifecycle.join(', ')}.</p>
              <p className="mt-4 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">Exclude · overrides inclusion</p>
              <p className="mt-1 text-xs leading-5">Unknown age eligibility or consent; withdrawn consent; opt-outs, DND; suppressed identities and disallowed preferences. Withdrawn inquiry interest and “not interested” records are excluded unless a permitted preference authorizes contact.</p>
              <p className="mt-4 text-[11px] text-outline">Size / eligible channels: Not calculated · pending consent and integration check</p>
            </Section>
            <Section title="Eligibility cascade" aside="Required before any use">
              <ol className="space-y-4">{CASCADE.map(([title, text], index) => <li key={title} className="flex gap-3 text-xs"><span className="flex size-5 shrink-0 items-center justify-center rounded bg-surface-low font-semibold">{index + 1}</span><span><strong className="block text-[13px]">{title}</strong><span className="text-on-surface-variant">{text}</span></span></li>)}</ol>
              <Banner tone="warning" title="No eligible results available" className="mt-4">Eligibility has not been evaluated. No computed patient count, exported contacts or matched paid-search audience is claimed.</Banner>
            </Section>
          </div>
          <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
            <Section title="Version history" aside="Append only"><ul className="space-y-2 text-xs">{selected.versions.map((version) => <li key={version.v}><strong>v{version.v}</strong> · {version.note}</li>)}</ul><Link to={pathFor(ROUTES.segmentEdit, { segmentId: selected.id })} state={state} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Propose a new version →</Link></Section>
            <Section title="Activation & export" aside="Unavailable"><StatusPill tone="warning">INTEGRATION DEPENDENT</StatusPill><p className="mt-3 text-xs leading-5 text-on-surface-variant">Require an authorized, current consent-checked query plus a supported integration. Neither is verified. Unknown consent is not eligible.</p><div className="mt-4 flex gap-3"><ActionButton disabled>Export</ActionButton><ActionButton disabled>Activate audience</ActionButton></div><p className="mt-3 text-[11px] text-outline">No raw PII is displayed or exported in this view.</p></Section>
          </div>
        </>
      )}
      <GrowthFooter code="GO 10" back={{ to: ROUTES.campaigns, label: 'Back to Campaigns · Context retained' }} />
    </GrowthFrame>
  )
}
