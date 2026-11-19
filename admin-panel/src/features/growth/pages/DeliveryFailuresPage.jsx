import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { when } from '../format'
import { messagingApi } from '../messagingApi'
import { CHANNELS, toConversationView, toMessageView } from '../messagingView'
import { useLeadContext } from '../useLeads'
import { useMessagingStream } from '../useMessagingStream'

const GATES = ['The cause is fixed (wording, template approval or channel credentials)', 'The contact still wants to hear from us on this channel']

export default function DeliveryFailuresPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const [filters, setFilters] = useState({ status: '', channel: '' })
  const result = useApiResource(() => messagingApi.problems({ status: filters.status || undefined, channel: filters.channel || undefined, pageSize: 50 }), JSON.stringify(filters))
  useMessagingStream((event) => event.type === 'message' && result.reload())
  const rows = (result.data?.data ?? []).map((entry) => ({ ...toMessageView(entry), conversation: toConversationView(entry.conversation) }))
  const [selectedId, setSelectedId] = useState(null)
  const selected = rows.find((entry) => entry.id === selectedId) ?? rows[0]
  const unknown = rows.filter((entry) => entry.status === 'unknown').length

  return (
    <GrowthFrame back={{ to: ROUTES.conversations, label: 'Conversations inbox · GO21' }} crumb="Owner Panel / Growth OS / Delivery Failures & Retry" code="GO-26" title="Delivery Failures & Retry" description="Messages the provider refused, and messages whose outcome is unknown. Each needs a decision before anything is sent again." badge={<StatusPill tone={rows.length ? 'warning' : 'success'}>{result.data ? `${result.data.meta.total} to review` : 'Loading'}</StatusPill>} context={[context.line, 'Temporary errors are retried automatically (up to 5 attempts); these are the ones that were not']} today={context.today} sample="Live delivery log · From the provider’s responses and receipts">
      {unknown > 0 && <Banner tone="warning" title={`${unknown} message${unknown === 1 ? '' : 's'} with an unknown outcome`} className="mb-6">The provider did not confirm or refuse these, so they may already have been delivered. Check the provider’s console and record what it shows; ClinicOS never resends them on its own.</Banner>}
      <Section title="Queue" aside="Failed and unknown outcomes" className="mb-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><FilterField label="Outcome" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[['', 'Failed and unknown'], ['failed', 'Failed'], ['unknown', 'Outcome unknown']]} /><FilterField label="Channel" value={filters.channel} onChange={(value) => setFilters((current) => ({ ...current, channel: value }))} options={[['', 'All channels'], ...Object.entries(CHANNELS)]} /></div>
        {!result.data ? <LoadingState label="Loading delivery problems…" error={result.error} onRetry={result.reload} /> : <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Conversation / contact', 'Provider response', 'Outcome', 'Attempts', 'Sent from'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id} className={cn('border-t border-slate-100 align-top', selected?.id === entry.id && 'bg-teal-50/50')}><td className="px-6 py-4"><button type="button" onClick={() => setSelectedId(entry.id)} className="text-left font-semibold text-brand hover:underline">{entry.conversation.number} · {entry.conversation.contact}<br /><span className="font-normal">{entry.conversation.channel} · {entry.conversation.maskedAddress}</span></button></td><td className="px-6 py-4">{entry.error ?? '—'}<br /><span className="text-outline">{entry.errorCode}</span></td><td className="px-6 py-4"><StatusPill tone={entry.tone}>{entry.statusLabel}</StatusPill></td><td className="px-6 py-4">{entry.attempts}</td><td className="px-6 py-4">{entry.template ?? 'Free-text reply'}<br /><span className="text-outline">{when(entry.at)}{entry.sentBy ? ` · ${entry.sentBy}` : ''}</span></td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">Nothing to review. Every message was accepted by its provider.</p>}</div>}
      </Section>
      {selected && <Decision key={selected.id} message={selected} canSend={can('growth.manage')} onDone={result.reload} />}
      <GrowthFooter code="GO-26" back={{ to: ROUTES.conversations, label: 'Conversations inbox · GO21' }} />
    </GrowthFrame>
  )
}

function Decision({ message, canSend, onDone }) {
  const [gates, setGates] = useState({})
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState(null)
  const passed = GATES.every((gate) => gates[gate])
  const run = async (call, success) => {
    setNotice(null)
    try {
      await call()
      setNotice({ tone: 'brand', title: success })
      onDone()
    } catch (error) {
      setNotice({ tone: 'danger', title: error.message })
    }
  }

  return (
    <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
      <Section title={`${message.conversation.number} · ${message.statusLabel.toLowerCase()}`} aside={message.conversation.channel}>
        <p className="rounded-md bg-surface-low p-4 text-[13px] leading-5 whitespace-pre-line">{message.body}</p>
        <dl className="mt-4 space-y-3 text-xs"><div><dt className="text-outline">What the provider said</dt><dd className="font-semibold">{message.error ?? 'No reason given'} {message.errorCode && <span className="font-normal text-outline">({message.errorCode})</span>}</dd></div><div><dt className="text-outline">What this means</dt><dd>{message.status === 'unknown' ? 'It may or may not have been delivered. Resending could reach them twice.' : 'It was not delivered.'}</dd></div></dl>
        <Link to={pathFor(ROUTES.conversation, { threadId: message.conversation.id })} className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">Open the conversation →</Link>
      </Section>
      <Section title={message.status === 'unknown' ? 'Record the outcome' : 'Retry'} aside={canSend ? 'Decision' : 'View only'}>
        {notice && <Banner tone={notice.tone} title={notice.title} className="mb-4" />}
        {!canSend ? <p className="text-xs text-outline">Your role cannot send or resend messages.</p> : message.status === 'unknown' ? (
          <>
            <TextInput label="What the provider’s console shows" required value={note} onChange={(event) => setNote(event.target.value)} hint="For example “Delivered at 10:42 in WhatsApp Manager”" />
            <div className="mt-4 flex flex-wrap gap-3"><ActionButton disabled={!note.trim()} onClick={() => run(() => messagingApi.resolve(message.id, { outcome: 'sent', note: note.trim() }), 'Recorded as sent.')}>It was sent</ActionButton><ActionButton disabled={!note.trim()} onClick={() => run(() => messagingApi.resolve(message.id, { outcome: 'failed', note: note.trim() }), 'Recorded as not sent. It can now be retried.')}>It was not sent</ActionButton></div>
          </>
        ) : (
          <>
            <div className="space-y-3">{GATES.map((gate) => <Check key={gate} checked={Boolean(gates[gate])} onChange={(event) => setGates((current) => ({ ...current, [gate]: event.target.checked }))} label={gate} />)}</div>
            <ActionButton className="mt-4" disabled={!passed} onClick={() => run(() => messagingApi.retry(message.id), 'Queued again. Its status updates as the provider reports it.')}>Retry send</ActionButton>
            <p className="mt-3 text-[11px] leading-4 text-outline">ClinicOS checks the channel and the contact’s opt-out again before queuing it.</p>
          </>
        )}
      </Section>
    </div>
  )
}
