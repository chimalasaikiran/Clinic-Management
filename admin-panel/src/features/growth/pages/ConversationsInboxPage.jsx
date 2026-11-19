import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { when } from '../format'
import { messagingApi } from '../messagingApi'
import { CHANNEL_STATUS, CHANNELS, toConversationView } from '../messagingView'
import { useLeadContext, useLeadOwners } from '../useLeads'
import { useMessagingStream } from '../useMessagingStream'

const FILTERS = { status: { Open: 'open', Resolved: 'resolved' }, unread: { Unread: 'true', Read: 'false' }, identity: { Linked: 'true', Unlinked: 'false' } }

export default function ConversationsInboxPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const owners = useLeadOwners()
  const filters = useRegisterFilters()
  const [selectedId, setSelectedId] = useState(null)
  const [failure, setFailure] = useState('')
  const query = {
    q: filters.get('q') || undefined, channel: filters.get('channel') || undefined, status: FILTERS.status[filters.get('status')], ownerId: filters.get('owner') || undefined,
    unread: FILTERS.unread[filters.get('unread')], linked: FILTERS.identity[filters.get('identity')], branchId: context.branchId || undefined, pageSize: 50,
  }
  const result = useApiResource(() => messagingApi.conversations(query), JSON.stringify(query))
  // A new message or receipt anywhere in the inbox reloads it.
  useMessagingStream(() => result.reload())
  const rows = (result.data?.data ?? []).map(toConversationView)
  const meta = result.data?.meta
  const selected = rows.find((thread) => thread.id === selectedId) ?? rows[0]
  const triage = can('growth.leads') || can('growth.manage')
  const connected = meta ? Object.entries(meta.channels).filter(([, status]) => status === 'connected').map(([channel]) => CHANNELS[channel]) : []
  const state = { search: filters.search }

  const update = async (patch) => {
    setFailure('')
    try {
      await messagingApi.updateConversation(selected.id, { ...patch, version: selected.version })
      result.reload()
    } catch (error) {
      setFailure(error.message)
      result.reload()
    }
  }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Conversations Inbox" code="GO-21" title="Conversations Inbox" description="Triage enquiries and replies, assign follow-up and link each conversation to the right lead or patient." badge={<StatusPill tone={connected.length ? 'success' : 'warning'}>{meta ? (connected.length ? `Live · ${connected.join(', ')}` : 'No channel connected') : 'Loading'}</StatusPill>} context={[context.line, 'Status / owner / unread / identity filters are kept in the address · Updates arrive as they happen']} today={context.today} sample="Live conversations · New messages and receipts appear without reloading">
      {meta && !connected.length && <Banner tone="warning" title="No messaging channel is connected yet" className="mb-4">Replies and delivery receipts arrive once an administrator connects WhatsApp, SMS or email. Conversations started from a lead are kept until then.</Banner>}
      {meta && <p className="mb-6 flex flex-wrap items-center gap-3">{Object.entries(meta.channels).map(([channel, status]) => <StatusPill key={channel} tone={CHANNEL_STATUS[status][1]}>{CHANNELS[channel]} · {CHANNEL_STATUS[status][0]}</StatusPill>)}<ActionButton to={ROUTES.channels} className="ml-auto">Channel configuration</ActionButton></p>}
      {failure && <Banner tone="danger" title="Not saved" className="mb-4">{failure}</Banner>}

      <Section title="Find conversations" aside="Filters kept on return from the thread" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><FilterField label="Channel" value={filters.get('channel')} onChange={(value) => filters.change('channel', value)} options={[['', 'All channels'], ...Object.entries(CHANNELS)]} /><FilterField label="Conversation status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], 'Open', 'Resolved']} /><FilterField label="Owner" value={filters.get('owner')} onChange={(value) => filters.change('owner', value)} options={[['', 'All owners'], ...owners.map((owner) => [owner.membershipId, owner.name])]} /><FilterField label="Unread" value={filters.get('unread')} onChange={(value) => filters.change('unread', value)} options={[['', 'All read states'], 'Unread', 'Read']} /><FilterField label="Patient link" value={filters.get('identity')} onChange={(value) => filters.change('identity', value)} options={[['', 'All identity states'], 'Linked', 'Unlinked']} /></div>
        <div className="mt-4 flex gap-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search conversations" placeholder="Search name, message text, conversation number or last digits" className="flex-1" /><ActionButton onClick={filters.reset}>Clear filters</ActionButton></div>
        <p className="mt-3 text-[11px] text-outline">Lists show only the last digits of a number. Conversations not yet linked to a branch are visible to organisation-wide roles.</p>
      </Section>

      {!result.data ? <LoadingState label="Loading conversations…" error={result.error} onRetry={result.reload} /> : (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Section title={`${meta.total} conversation${meta.total === 1 ? '' : 's'}`} aside={`${meta.unread} unread in this location`}>
            <ul className="-mx-6 divide-y divide-slate-100">{rows.map((thread) => (
              <li key={thread.id} className={cn('px-6 py-4 text-xs', selected?.id === thread.id && 'bg-teal-50/50')}>
                <button type="button" onClick={() => setSelectedId(thread.id)} className="block w-full text-left"><p className="flex justify-between"><strong className="text-[15px]">{thread.unread && <span className="mr-2 inline-block size-2 rounded-full bg-brand" aria-label="Unread" />}{thread.contact}</strong><span className="text-outline">{when(thread.last)}</span></p><p className="mt-2 text-[13px]">{thread.preview}</p><p className="mt-2 flex flex-wrap gap-2"><StatusPill>{thread.channel} · {thread.maskedAddress}</StatusPill><StatusPill tone={thread.status === 'Open' ? 'success' : 'neutral'}>{thread.status}</StatusPill><StatusPill>{thread.unread ? 'Unread' : 'Read'}</StatusPill><StatusPill tone={thread.linked ? 'brand' : 'neutral'}>{thread.linked ? 'Linked' : 'Unlinked'}</StatusPill><span className="ml-auto text-outline">{thread.number}</span></p></button>
                <Link to={pathFor(ROUTES.conversation, { threadId: thread.id })} state={state} className="mt-2 inline-block font-semibold text-brand hover:underline">Open conversation → GO22</Link>
              </li>))}</ul>
            {rows.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">{meta.total === 0 && !filters.search ? 'No conversations yet. Start one from a lead, or wait for a reply on a connected channel.' : 'No conversations match these filters.'}</p>}
          </Section>
          {selected && (
            <Section title={`Selected · ${selected.number}`} aside={selected.branch}>
              <p className="mb-3 flex gap-2"><StatusPill tone={selected.status === 'Open' ? 'success' : 'neutral'}>{selected.status}</StatusPill><StatusPill>{selected.linked ? 'Linked' : 'Unlinked'}</StatusPill>{selected.replyWindowOpen && <StatusPill tone="info">Reply window open</StatusPill>}</p>
              <p className="text-[13px] font-semibold">{selected.contact} · {selected.channel}</p><p className="mt-2 text-xs leading-5 text-on-surface-variant">{selected.preview}</p>
              <div className="mt-4"><SelectInput label="Current owner" disabled={!triage} value={selected.owner?.membershipId ?? ''} onChange={(event) => update({ ownerMembershipId: event.target.value || null })} options={[{ value: '', label: 'Unassigned' }, ...owners.map((owner) => ({ value: owner.membershipId, label: owner.name }))]} /></div>
              <div className="mt-4 flex flex-wrap gap-3"><ActionButton variant="brand" to={pathFor(ROUTES.conversation, { threadId: selected.id })} state={state}>Open conversation</ActionButton>{triage && <><ActionButton onClick={() => update({ status: selected.status === 'Open' ? 'resolved' : 'open' })}>{selected.status === 'Open' ? 'Mark resolved' : 'Reopen'}</ActionButton><ActionButton onClick={() => update({ unread: !selected.unread })}>{selected.unread ? 'Mark read' : 'Mark unread'}</ActionButton></>}</div>
            </Section>
          )}
        </div>
      )}
      <GrowthFooter code="GO-21" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
