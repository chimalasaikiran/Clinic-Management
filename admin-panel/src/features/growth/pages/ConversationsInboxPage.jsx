import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { when } from '../format'

export default function ConversationsInboxPage() {
  const { data, update } = useGrowth()
  const filters = useRegisterFilters()
  const [selectedId, setSelectedId] = useState(data.conversations[0]?.id)
  const needle = filters.get('q').trim().toLowerCase()
  const rows = data.conversations
    .filter((thread) => (!filters.get('status') || thread.status === filters.get('status')) && (!filters.get('owner') || thread.owner === filters.get('owner')) && (!filters.get('unread') || (filters.get('unread') === 'Unread') === thread.unread) && (!filters.get('identity') || (filters.get('identity') === 'Linked') === thread.linked))
    .filter((thread) => !needle || `${thread.subject} ${thread.id}`.toLowerCase().includes(needle))
    .sort((a, b) => `${b.last.date} ${b.last.time}`.localeCompare(`${a.last.date} ${a.last.time}`))
  const selected = data.conversations.find((thread) => thread.id === selectedId) ?? rows[0]
  const unread = data.conversations.filter((thread) => thread.unread).length
  const state = { search: filters.search }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Conversations Inbox" code="GO-21" title="Conversations Inbox" description="Triage branch enquiries, assign follow-up and review identity independently." badge={<StatusPill tone="warning">Test channel only</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Inbox origin · ClinicOS test inbox · Status / Owner / Unread / Identity filters are kept in the address']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="No configured live messaging channel has been verified" className="mb-4">An authorized administrator must confirm channel capabilities and branch access. Live mode is a setup gate, not a populated inbox. No external messaging transport is established here.</Banner>
      <p className="mb-6 flex flex-wrap items-center gap-3"><StatusPill>LIVE · SETUP REQUIRED</StatusPill><StatusPill tone="brand">TEST CHANNEL CONFIGURATION ✓</StatusPill><ActionButton to={ROUTES.channels} className="ml-auto">Review configuration · admin only</ActionButton></p>

      <Section title="Find conversations" aside="Filters kept on return from the thread" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Channel · test mode only" value="" disabled options={[['', 'ClinicOS test inbox']]} /><FilterField label="Conversation status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], 'Open', 'Resolved']} /><FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...OWNERS]} /><FilterField label="Unread" value={filters.get('unread')} onChange={(value) => filters.change('unread', value)} options={[['', 'All read states'], 'Unread', 'Read']} /><FilterField label="Patient link" value={filters.get('identity')} onChange={(value) => filters.change('identity', value)} options={[['', 'All identity states'], 'Linked', 'Unlinked']} /></div>
        <div className="mt-4 flex gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search conversations" placeholder="Search subject or conversation ID" className="flex-1" /><ActionButton onClick={filters.reset}>Clear filters</ActionButton></div>
        <p className="mt-3 text-[11px] text-outline">No phone numbers or patient identifiers appear in previews.</p>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Section title={`${rows.length} sample conversation${rows.length === 1 ? '' : 's'}`} aside={`${unread} unread · ${data.conversations.length - unread} read`}>
          <ul className="-mx-6 divide-y divide-slate-100">{rows.map((thread) => (
            <li key={thread.id} className={cn('px-6 py-4 text-xs', selected?.id === thread.id && 'bg-teal-50/50')}>
              <button type="button" onClick={() => setSelectedId(thread.id)} className="block w-full text-left"><p className="flex justify-between"><strong className="text-[15px]">{thread.unread && <span className="mr-2 inline-block size-2 rounded-full bg-brand" aria-label="Unread" />}{thread.subject}</strong><span className="text-outline">{when(thread.last)}</span></p><p className="mt-2 text-[13px]">{thread.preview}</p><p className="mt-2 flex flex-wrap gap-2"><StatusPill tone={thread.status === 'Open' ? 'success' : 'neutral'}>{thread.status}</StatusPill><StatusPill>{thread.unread ? 'Unread' : 'Read'}</StatusPill><StatusPill tone={thread.linked ? 'brand' : 'neutral'}>{thread.linked ? 'Linked' : 'Unlinked'}</StatusPill><span className="ml-auto text-outline">{thread.id}</span></p></button>
              <Link to={pathFor(ROUTES.conversation, { threadId: thread.id })} state={state} className="mt-2 inline-block font-semibold text-brand hover:underline">Open conversation → GO22</Link>
            </li>))}</ul>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">No conversations match these filters.</p>}
        </Section>
        {selected && (
          <Section title={`Selected · ${selected.id}`} aside="Sample baseline">
            <p className="mb-3 flex gap-2"><StatusPill tone={selected.status === 'Open' ? 'success' : 'neutral'}>{selected.status}</StatusPill><StatusPill>{selected.linked ? 'Linked' : 'Unlinked'}</StatusPill></p>
            <p className="text-[13px] font-semibold">{selected.subject}</p><p className="mt-2 text-xs leading-5 text-on-surface-variant">{selected.summary}</p>
            <div className="mt-4"><SelectInput label="Current owner" value={selected.owner} onChange={(event) => update('conversations', selected.id, { owner: event.target.value })} options={OWNERS} /></div>
            <div className="mt-4 flex flex-wrap gap-3"><ActionButton variant="brand" to={pathFor(ROUTES.conversation, { threadId: selected.id })} state={state}>Open conversation</ActionButton><ActionButton onClick={() => update('conversations', selected.id, { status: selected.status === 'Open' ? 'Resolved' : 'Open' })}>{selected.status === 'Open' ? 'Mark resolved' : 'Reopen'}</ActionButton><ActionButton onClick={() => update('conversations', selected.id, { unread: !selected.unread })}>{selected.unread ? 'Mark read' : 'Mark unread'}</ActionButton></div>
          </Section>
        )}
      </div>
      <GrowthFooter code="GO-21" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
