import { useState } from 'react'
import { useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { messagingApi } from '../messagingApi'
import { CONSENT_SOURCES, toConversationView, toMessageView } from '../messagingView'
import { useLeadContext } from '../useLeads'

const RECORDABLE = ['verbal', 'written_form', 'web_form', 'inbound_reply']

export default function CommunicationHistoryPage() {
  const { threadId } = useParams()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const resource = useApiResource(() => messagingApi.conversation(threadId), `conversation:${threadId}`)
  const threadPath = pathFor(ROUTES.conversation, { threadId })

  if (resource.error?.status === 404) {
    return (
      <GrowthFrame back={{ to: ROUTES.conversations, label: 'Back to inbox' }} crumb="Owner Panel / Growth OS / Communication History" title="Conversation not found">
        <Banner tone="warning" title="No conversation matches this link">Open the inbox to find the thread.</Banner>
      </GrowthFrame>
    )
  }
  if (!resource.data) {
    return (
      <GrowthFrame back={{ to: threadPath, label: 'Conversation thread' }} crumb="Owner Panel / Growth OS / Communication History" title="Communication History & Preferences">
        <LoadingState label="Loading history…" error={resource.error} onRetry={resource.reload} />
      </GrowthFrame>
    )
  }

  const data = resource.data
  const thread = toConversationView(data)
  const direction = filters.get('direction')
  const entries = data.messages.map(toMessageView).filter((message) => !direction || (direction === 'Inbound') === message.inbound)

  return (
    <GrowthFrame back={{ to: threadPath, label: 'Conversation thread · Keep inbox context' }} crumb="Owner Panel / Growth OS / Communication History" title="Communication History & Preferences" description="Review everything sent and received, and the contact’s recorded permission for this channel." badge={<StatusPill tone={thread.linked ? 'brand' : 'warning'}>{thread.linked ? `Linked · ${thread.contact}` : 'Unlinked contact'}</StatusPill>} context={[context.line, `${thread.number} · ${thread.channel} · ${thread.address}`]} today={context.today} sample="Live history · Receipts are as reported by the provider">
      <Section title="Find communications" aside="This conversation" className="mb-6"><div className="grid gap-4 sm:grid-cols-4"><FilterField label="Channel" value="" disabled options={[['', thread.channel]]} /><FilterField label="Direction" value={direction} onChange={(value) => filters.change('direction', value)} options={[['', 'All directions'], 'Inbound', 'Outbound']} /></div><p className="mt-3 text-[11px] text-outline">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} · oldest first · times in IST.</p></Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title={`${thread.contact} · ${thread.number}`} aside={when(thread.last)}>
          <ul className="space-y-5">{entries.map((message) => <li key={message.id} className="text-xs"><p className="flex justify-between font-semibold"><span>{message.inbound ? 'Inbound' : `Outbound${message.sentBy ? ` · ${message.sentBy}` : ''}`}</span><span className="font-normal text-outline">{when(message.at)}</span></p><p className={cn('mt-1 rounded-md p-4 text-[13px] leading-5 whitespace-pre-line', message.inbound ? 'bg-surface-low' : 'bg-teal-50')}>{message.body}<span className="mt-1 block text-[11px] text-outline">{message.inbound ? 'Received from the provider' : [message.statusLabel, ...message.receipts.map((receipt) => `${receipt.name} ${when(receipt.at)}`), message.template].filter(Boolean).join(' · ')}</span></p></li>)}</ul>
          {entries.length === 0 && <p className="text-xs text-outline">No entries match these filters.</p>}
        </Section>
        <Permission data={data} thread={thread} />
      </div>
      <GrowthFooter back={{ to: threadPath, label: 'Conversation thread' }} />
    </GrowthFrame>
  )
}

function Permission({ data, thread }) {
  const { can } = useAuth()
  const history = useApiResource(() => messagingApi.consent(data.channel, data.address), `consent:${data.channel}:${data.address}`)
  const [form, setForm] = useState({ status: 'granted', source: 'verbal', note: '', confirmed: false })
  const [notice, setNotice] = useState(null)
  const writer = can('growth.leads') || can('growth.manage')
  const current = history.data?.current ?? null

  const record = async () => {
    setNotice(null)
    try {
      await messagingApi.recordConsent({ channel: data.channel, address: data.address, status: form.status, source: form.source, note: form.note.trim() || undefined, leadId: data.lead?.id, patientId: data.patient?.id })
      setForm({ status: 'granted', source: 'verbal', note: '', confirmed: false })
      setNotice({ tone: 'brand', title: form.status === 'granted' ? 'Permission recorded.' : 'Opt-out recorded. Nothing more will be sent on this channel.' })
      history.reload()
    } catch (error) {
      setNotice({ tone: 'danger', title: error.message })
    }
  }

  return (
    <Section title="Contact permission" aside={`${thread.channel} · ${thread.address}`}>
      {!history.data ? <LoadingState label="Loading permission…" error={history.error} onRetry={history.reload} /> : (
        <>
          <Banner tone={current === 'granted' ? 'brand' : current === 'withdrawn' ? 'danger' : 'warning'} title={current === 'granted' ? 'Permission recorded for this channel' : current === 'withdrawn' ? 'Opted out — nothing is sent on this channel' : 'No permission recorded'}>{current === 'granted' ? 'Marketing and follow-up templates may be sent here until they opt out.' : current === 'withdrawn' ? 'A STOP reply or a recorded opt-out blocks every send to this address on this channel.' : 'Marketing messages are blocked until permission is recorded. Care reminders to patients follow their notification settings.'}</Banner>
          <ol className="mt-4 space-y-3 text-xs">{history.data.entries.map((entry) => <li key={entry.id}><StatusPill tone={entry.status === 'granted' ? 'success' : 'danger'}>{entry.status === 'granted' ? 'Granted' : 'Withdrawn'}</StatusPill> <span className="text-on-surface-variant">{CONSENT_SOURCES[entry.source] ?? entry.source}</span><span className="block text-outline">{when(stampOf(entry.createdAt))}{entry.recordedBy ? ` · ${entry.recordedBy}` : ' · from the contact'}{entry.note ? ` · ${entry.note}` : ''}</span></li>)}{history.data.entries.length === 0 && <li className="text-outline">Nothing recorded yet.</li>}</ol>
          {writer && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              {notice && <Banner tone={notice.tone} title={notice.title} className="mb-3" />}
              <div className="grid gap-3">
                <SelectInput label="Record" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} options={[{ value: 'granted', label: 'They agreed to hear from us' }, { value: 'withdrawn', label: 'They asked not to be contacted' }]} />
                <SelectInput label="How" value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} options={RECORDABLE.map((value) => ({ value, label: CONSENT_SOURCES[value] }))} />
                <TextInput label="Note" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} hint="Optional · for example where the signed form is kept" />
                <Check checked={form.confirmed} onChange={(event) => setForm((current) => ({ ...current, confirmed: event.target.checked }))} label="I confirm this is what the contact told us" />
              </div>
              <ActionButton className="mt-3" disabled={!form.confirmed} onClick={record}>Record</ActionButton>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
