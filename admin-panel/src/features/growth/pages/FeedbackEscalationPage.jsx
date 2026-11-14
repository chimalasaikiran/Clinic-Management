import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, GROWTH_NOW, GROWTH_TODAY, OWNERS, SEVERITIES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

const STATUSES = ['Open', 'In progress', 'Resolved']
const overdue = (escalation) => escalation.status !== 'Resolved' && `${escalation.due} ${escalation.dueTime}` < `${GROWTH_TODAY} ${GROWTH_NOW}`

export default function FeedbackEscalationPage() {
  const { data, update } = useGrowth()
  const [filters, setFilters] = useState({ q: '', severity: '', status: '', owner: '' })
  const [selectedId, setSelectedId] = useState(data.escalations[0]?.id)
  const [saved, setSaved] = useState('')
  const needle = filters.q.trim().toLowerCase()
  const rows = data.escalations.filter((entry) => (!filters.severity || entry.severity === filters.severity) && (!filters.status || entry.status === filters.status) && (!filters.owner || entry.owner === filters.owner) && (!needle || `${entry.id} ${entry.topic} ${entry.note}`.toLowerCase().includes(needle)))
  const selected = data.escalations.find((entry) => entry.id === selectedId) ?? rows[0]
  const review = selected && data.reviews.find((entry) => entry.id === selected.reviewId)
  const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }))
  const change = (patch) => { update('escalations', selected.id, patch); setSaved('') }

  return (
    <GrowthFrame back={{ to: ROUTES.reviews, label: 'Reviews & Reputation · GO16' }} crumb="Owner Panel / Growth OS / Feedback Escalation" code="GO-19" title="Feedback Escalation" description="Coordinate operations feedback without changing public response status." badge={<StatusPill tone="warning">Internal operations only</StatusPill>} actions={<ActionButton variant="brand" to={ROUTES.reputation}>Reputation report → GO20</ActionButton>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Origin GO16 / GO17 · Rating / Response / Escalation: All · Newest first']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="No verified review feed — sample data only" className="mb-6">Aliases are public display text, not patients. Escalation status is independent of public response status; resolving an internal case never posts to the provider.</Banner>
      <Section title="Find escalations" aside="Drafts remain separate from records" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3"><FilterField label="Severity" value={filters.severity} onChange={(value) => set('severity', value)} options={[['', 'All · Low / Medium / High'], ...SEVERITIES]} /><FilterField label="Status" value={filters.status} onChange={(value) => set('status', value)} options={[['', 'All statuses'], ...STATUSES]} /><FilterField label="Owner" value={filters.owner} onChange={(value) => set('owner', value)} options={[['', 'All owners'], ...OWNERS]} /></div>
        <div className="mt-4 flex gap-3"><SearchBox value={filters.q} onChange={(value) => set('q', value)} label="Search escalations" placeholder="Search review, escalation or note" className="flex-1" /><ActionButton onClick={() => setFilters({ q: '', severity: '', status: '', owner: '' })}>Clear filters</ActionButton></div>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Operations feedback" aside={`${rows.length} item${rows.length === 1 ? '' : 's'} · sample only`}>
          <ul className="-mx-6 divide-y divide-slate-100">{rows.map((entry) => (
            <li key={entry.id} className={cn('px-6 py-4 text-xs', selected?.id === entry.id && 'bg-teal-50/50')}>
              <button type="button" onClick={() => setSelectedId(entry.id)} className="block w-full text-left"><p className="flex justify-between"><strong className="text-[13px]">{entry.id} · {data.reviews.find((review) => review.id === entry.reviewId)?.alias}</strong><StatusPill tone={entry.status === 'Resolved' ? 'success' : 'info'}>{entry.status}</StatusPill></p><p className="mt-2 text-[13px]">{entry.topic} · {entry.summary}</p><p className="mt-2 text-outline">{entry.severity} · {entry.owner} · Due {day(entry.due)} · {entry.dueTime} IST{overdue(entry) && <span className="ml-2 font-semibold text-danger">Overdue</span>}</p></button>
              <Link to={pathFor(ROUTES.review, { reviewId: entry.reviewId })} className="mt-2 inline-block font-semibold text-brand hover:underline">Source review → GO17</Link>
            </li>))}</ul>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">No escalations match these filters. Open one from a review.</p>}
        </Section>
        {selected && (
          <Section title={`Selected · ${selected.reviewId}`} aside={selected.status}>
            {saved && <Banner tone="brand" title={saved} className="mb-4" />}
            <p className="mb-3 text-xs text-on-surface-variant">“{review?.text}”</p>
            <div className="grid gap-4 sm:grid-cols-2"><SelectInput label="Severity" value={selected.severity} onChange={(event) => change({ severity: event.target.value })} options={SEVERITIES} /><SelectInput label="Owner" value={selected.owner} onChange={(event) => change({ owner: event.target.value })} options={OWNERS} /><TextInput label="Due date" type="date" value={selected.due} onChange={(event) => change({ due: event.target.value })} /><SelectInput label="Status" value={selected.status} onChange={(event) => change({ status: event.target.value })} options={STATUSES} /></div>
            <div className="mt-4"><TextArea label="Internal note" rows={3} value={selected.note} onChange={(event) => change({ note: event.target.value })} hint="Never public. Not copied into any response." /></div>
            <p className="mt-3 text-[11px] text-outline">Changes are saved to the escalation as you make them. Owner role is not proof of permission; resolving never posts to the provider.</p>
            <ActionButton className="mt-3" onClick={() => setSaved('Escalation saved. The public response status is unchanged.')}>Save escalation</ActionButton>
          </Section>
        )}
      </div>
      <GrowthFooter code="GO-19" back={{ to: ROUTES.reviews, label: 'Reviews & Reputation · GO16' }} />
    </GrowthFrame>
  )
}
