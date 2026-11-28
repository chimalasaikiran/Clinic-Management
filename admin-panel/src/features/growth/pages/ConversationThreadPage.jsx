import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import { patientsApi } from '../../patients/api'
import LoadingState from '../../patients/components/LoadingState'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { when } from '../format'
import { privacyFindings } from '../growthLogic'
import { leadsApi } from '../leadsApi'
import { stampOf } from '../leadsView'
import { messagingApi } from '../messagingApi'
import { AUTOMATIC_VARIABLES, BLOCK_HINTS, renderTemplate, templateVariables, toConversationView, toMessageView } from '../messagingView'
import { useLeadContext } from '../useLeads'
import { useMessagingStream } from '../useMessagingStream'

export default function ConversationThreadPage() {
  const { threadId } = useParams()
  const { state } = useLocation()
  const backPath = `${ROUTES.conversations}${state?.search ?? ''}`
  const resource = useApiResource(() => messagingApi.conversation(threadId), `conversation:${threadId}`)
  useMessagingStream((event) => event.conversationId === threadId && resource.reload())

  if (resource.error?.status === 404) {
    return (
      <GrowthFrame back={{ to: backPath, label: 'Back to inbox' }} crumb="Owner Panel / Growth OS / Conversation Thread" title="Conversation not found">
        <Banner tone="warning" title="No conversation matches this link">Open the inbox to find the thread. Conversations outside your branches are not shown.</Banner>
      </GrowthFrame>
    )
  }
  if (!resource.data) {
    return (
      <GrowthFrame back={{ to: backPath, label: 'Back to inbox' }} crumb="Owner Panel / Growth OS / Conversation Thread" title="Conversation">
        <LoadingState label="Loading conversation…" error={resource.error} onRetry={resource.reload} />
      </GrowthFrame>
    )
  }
  return <Thread data={resource.data} reload={resource.reload} backPath={backPath} />
}

function Thread({ data, reload, backPath }) {
  const { can } = useAuth()
  const { state } = useLocation()
  const context = useLeadContext()
  const thread = toConversationView(data)
  const messages = data.messages.map(toMessageView)
  const triage = can('growth.leads') || can('growth.manage')
  const [tab, setTab] = useState('conversation')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState(null)

  // Opening a conversation reads it.
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current || !data.unread || !triage) return
    marked.current = true
    messagingApi.updateConversation(data.id, { unread: false, version: data.version }).then(reload, () => undefined)
  }, [data.id, data.unread, data.version, triage, reload])

  const act = async (call, success) => {
    setNotice(null)
    try {
      await call()
      if (success) setNotice({ tone: 'brand', title: success })
      reload()
    } catch (error) {
      setNotice({ tone: 'danger', title: error.message, text: BLOCK_HINTS[error.code] })
    }
  }
  const addNote = () => act(() => messagingApi.addNote(data.id, note.trim()).then(() => setNote('')), 'Internal note added. It is never sent to the contact.')

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to inbox · Filters kept' }} crumb="Owner Panel / Growth OS / Conversation Thread & Patient Context" title="Conversation Thread & Patient Context" description="Read and answer the conversation, coordinate internal follow-up and keep identity linking explicit." badge={<StatusPill tone={data.channelConnected ? 'success' : 'warning'}>{thread.channel} · {data.channelConnected ? 'connected' : 'not connected'}</StatusPill>} context={[context.line, `${thread.number} · ${thread.channel} · ${thread.address} · ${thread.branch}`]} today={context.today} sample="Live conversation · New messages and receipts appear as they arrive">
      {!data.channelConnected && <Banner tone="warning" title={`${thread.channel} is not connected`} className="mb-6">Messages cannot be sent until an administrator connects this channel. <Link to={ROUTES.channels} className="font-semibold text-brand hover:underline">Channel configuration →</Link></Banner>}
      {notice && <Banner tone={notice.tone} title={notice.title} className="mb-6">{notice.text}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title={`${thread.contact} · ${thread.number}`} aside={when(thread.last)}>
            <p className="mb-3 flex flex-wrap gap-2"><StatusPill tone={thread.status === 'Open' ? 'success' : 'neutral'}>{thread.status}</StatusPill><StatusPill>{thread.linked ? 'Linked' : 'Unlinked'}</StatusPill><StatusPill>{data.unread ? 'Unread' : 'Read'}</StatusPill>{data.consent && <StatusPill tone={data.consent === 'granted' ? 'success' : 'danger'}>{data.consent === 'granted' ? 'Permission recorded' : 'Opted out'}</StatusPill>}</p>
            <div role="tablist" aria-label="Thread view" className="mb-4 flex gap-5 border-b border-slate-200 text-[13px]">{[['conversation', 'Conversation'], ['notes', `Internal notes (${data.notes.length})`]].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('pb-2 font-medium', tab === id ? 'border-b-2 border-brand text-brand' : 'text-outline')}>{label}</button>)}</div>
            {tab === 'conversation' ? (
              <div className="space-y-5">{messages.map((message) => (
                <div key={message.id} className={cn('text-xs', !message.inbound && 'ml-12')}>
                  <p className="flex justify-between gap-3 font-semibold"><span>{message.inbound ? thread.contact : message.sentBy ?? 'Clinic'}{message.template && <span className="ml-2 font-normal text-outline">{message.template}</span>}</span><span className="font-normal text-outline">{when(message.at)}</span></p>
                  <p className={cn('mt-1 rounded-md p-4 text-[13px] leading-5 whitespace-pre-line', message.inbound ? 'bg-surface-low' : 'bg-teal-50')}>{message.subject && <strong className="mb-1 block">{message.subject}</strong>}{message.body}</p>
                  {!message.inbound && <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-outline"><StatusPill tone={message.tone}>{message.statusLabel}</StatusPill>{message.receipts.map((receipt) => <span key={receipt.name}>{receipt.name} {receipt.at.time}</span>)}{message.error && <span className="text-danger">{message.error}</span>}</p>}
                </div>))}
                {messages.length === 0 && <p className="text-xs text-outline">No messages yet.</p>}
              </div>
            ) : (
              <div>{triage && <><TextArea label="Add internal note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} hint="Internal only — never sent to the contact." /><ActionButton className="mt-3" onClick={addNote} disabled={!note.trim()}>Add note</ActionButton></>}<ul className="mt-4 space-y-3 text-xs">{data.notes.map((entry) => <li key={entry.id} className="rounded-md bg-surface-low p-3">{entry.text}<span className="mt-1 block text-outline">{entry.author} · {when(stampOf(entry.createdAt))}</span></li>)}{data.notes.length === 0 && <li className="text-outline">No internal notes yet.</li>}</ul></div>
            )}
          </Section>
          <Composer data={data} thread={thread} onSent={(text) => act(() => Promise.resolve(), text)} onFailed={(error) => setNotice({ tone: 'danger', title: error.message, text: BLOCK_HINTS[error.code] })} reload={reload} />
        </div>
        <div className="space-y-6">
          <Identity data={data} thread={thread} triage={triage} act={act} />
          <Section title="Related"><p className="space-y-2 text-xs"><Link to={pathFor(ROUTES.communicationHistory, { threadId: data.id })} state={state} className="block font-semibold text-brand hover:underline">Communication history & permission →</Link>{triage && <button type="button" onClick={() => act(() => messagingApi.updateConversation(data.id, { status: thread.status === 'Open' ? 'resolved' : 'open', version: data.version }))} className="font-semibold text-brand hover:underline">{thread.status === 'Open' ? 'Mark conversation resolved' : 'Reopen conversation'}</button>}</p></Section>
        </div>
      </div>
      <GrowthFooter back={{ to: backPath, label: 'Back to inbox' }} />
    </GrowthFrame>
  )
}

function Composer({ data, thread, onSent, onFailed, reload }) {
  const { can } = useAuth()
  const templates = useApiResource(() => messagingApi.templates(), 'templates').data ?? []
  const usable = templates.filter((entry) => entry.channel === data.channel && entry.status === 'approved')
  // Free text is possible by email, and on WhatsApp within 24 hours of the contact's last message.
  const freeTextAllowed = data.channel === 'email' || thread.replyWindowOpen
  const [mode, setMode] = useState(freeTextAllowed ? 'text' : 'template')
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState({})
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const template = usable.find((entry) => entry.id === templateId)
  const needed = template ? templateVariables(template.body).filter((name) => !AUTOMATIC_VARIABLES.includes(name)) : []
  const findings = privacyFindings(draft)
  const ready = mode === 'text' ? draft.trim() && freeTextAllowed : template && needed.every((name) => variables[name]?.trim())
  const sender = can('growth.manage')

  const send = async () => {
    setSending(true)
    try {
      await messagingApi.sendMessage(data.id, mode === 'text' ? { body: draft.trim() } : { templateId, variables })
      setDraft('')
      setVariables({})
      onSent('Message queued. Its status updates here as the provider reports it.')
    } catch (error) {
      onFailed(error)
      reload()
    } finally {
      setSending(false)
    }
  }

  if (!sender) return <Section title="Reply" aside="View only"><p className="text-xs text-outline">Your role can read and triage conversations but not send messages.</p></Section>
  return (
    <Section title="Reply" aside={thread.replyWindowOpen ? 'WhatsApp reply window open' : data.channel === 'whatsapp' ? 'Template only · no reply in the last 24 hours' : data.channel === 'sms' ? 'SMS · DLT template only' : 'Email'}>
      <div role="radiogroup" aria-label="Message type" className="mb-4 flex gap-4 text-xs">{[['text', 'Write a reply', freeTextAllowed], ['template', 'Use a template', true]].map(([id, label, enabled]) => <label key={id} className={cn('flex items-center gap-2', enabled ? 'cursor-pointer' : 'text-outline')}><input type="radio" name="mode" disabled={!enabled} checked={mode === id} onChange={() => setMode(id)} className="accent-[#006a61]" />{label}</label>)}</div>
      {mode === 'text' ? (
        <>
          <TextArea label="Message" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} hint="Do not include clinical detail or promises." />
          {findings > 0 && <Banner tone="danger" title="Possible personal or clinical detail found" className="mt-3">Remove contact numbers, emails or clinical wording from the reply.</Banner>}
        </>
      ) : (
        <div className="grid gap-4">
          <SelectInput label="Approved template" value={templateId} onChange={(event) => { setTemplateId(event.target.value); setVariables({}) }} placeholder={usable.length ? 'Choose a template' : `No approved ${thread.channel} template yet`} options={usable.map((entry) => ({ value: entry.id, label: `${entry.name} · ${entry.code} v${entry.version}` }))} />
          {needed.map((name) => <TextInput key={name} label={name.replace(/_/g, ' ')} required value={variables[name] ?? ''} onChange={(event) => setVariables((current) => ({ ...current, [name]: event.target.value }))} />)}
          {template && <p className="rounded-md bg-teal-50 p-3 text-xs leading-5 whitespace-pre-line text-on-surface-variant">{renderTemplate(template.body, { ...variables, preferred_name: thread.linked ? thread.contact.split(' ')[0] : '' })}</p>}
        </div>
      )}
      <div className="mt-3 flex gap-3"><ActionButton variant="brand" disabled={!ready || sending || !data.channelConnected} onClick={send}>{sending ? 'Sending…' : 'Send'}</ActionButton></div>
      <p className="mt-2 text-[11px] text-outline">ClinicOS checks the contact’s permission and the channel’s rules again when you send.</p>
    </Section>
  )
}

function Identity({ data, thread, triage, act }) {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const term = search.trim()
  const leads = useApiResource(() => (term.length >= 2 ? leadsApi.list({ q: term, pageSize: 5 }) : Promise.resolve(null)), `link-leads:${term}`).data?.data ?? []
  const patients = useApiResource(() => (term.length >= 2 && can('patients.view') ? patientsApi.list({ query: term, pageSize: 5 }) : Promise.resolve(null)), `link-patients:${term}`).data?.data ?? []
  const link = (target, name) => act(() => messagingApi.link(data.id, { ...target, version: data.version }), `Linked to ${name}.`)

  if (thread.linked) {
    return (
      <Section title="Contact" aside="Linked">
        {data.lead && <p className="text-xs"><span className="text-outline">Lead</span><br /><Link to={pathFor(ROUTES.lead, { leadId: data.lead.id })} className="text-[15px] font-semibold text-brand hover:underline">{data.lead.fullName} ↗</Link><span className="block text-outline">{data.lead.number}</span></p>}
        {data.patient && <p className="mt-3 text-xs"><span className="text-outline">Patient</span><br />{data.patient.fullName ? <Link to={pathFor(ROUTES.patientHub, { patientId: data.patient.id })} className="text-[15px] font-semibold text-brand hover:underline">{data.patient.fullName} ↗</Link> : 'Linked patient (your role cannot open patient records)'}{data.patient.mrn && <span className="block text-outline">{data.patient.mrn}</span>}</p>}
        <p className="mt-3 text-[11px] text-outline">Conversation access does not open the clinical chart; that follows the patient record’s own permissions.</p>
      </Section>
    )
  }
  return (
    <Section title="Patient context" aside="Unlinked">
      <StatusPill>Unlinked · no lead or patient</StatusPill>
      <p className="mt-3 text-xs leading-5 text-on-surface-variant">This number wrote in without a matching link. A matching phone number alone does not prove who it is — check before linking.</p>
      {triage && (
        <div className="mt-4">
          <SearchBox value={search} onChange={setSearch} label="Find a lead or patient" placeholder="Name, number or mobile" />
          <ul className="mt-3 space-y-2 text-xs">
            {leads.map((lead) => <li key={lead.id} className="flex items-center justify-between gap-2"><span>{lead.fullName} · {lead.number} · lead</span><ActionButton onClick={() => link({ leadId: lead.id }, lead.fullName)}>Link</ActionButton></li>)}
            {patients.map((patient) => <li key={patient.id} className="flex items-center justify-between gap-2"><span>{patient.fullName} · {patient.mrn} · patient</span><ActionButton onClick={() => link({ patientId: patient.id }, patient.fullName)}>Link</ActionButton></li>)}
            {term.length >= 2 && !leads.length && !patients.length && <li className="text-outline">No lead or patient matches “{term}”.</li>}
          </ul>
        </div>
      )}
    </Section>
  )
}
