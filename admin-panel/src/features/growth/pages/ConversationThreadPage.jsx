import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { when } from '../format'
import { privacyFindings } from '../growthLogic'

const IDENTITY = [['Unlinked · current', 'No association to a patient record; no chart context.'], ['Ambiguous · review required', 'Multiple candidates or conflicting evidence: prevent auto-link and chart access.'], ['Verified · evidence required', 'Authorized verification evidence, method, date and actor plus an acknowledged link. Chart-read is separately scoped.']]

export default function ConversationThreadPage() {
  const { threadId } = useParams()
  const { data } = useGrowth()
  const thread = data.conversations.find((entry) => entry.id === threadId)
  if (!thread) {
    return (
      <GrowthFrame back={{ to: ROUTES.conversations, label: 'Back to inbox' }} crumb="Owner Panel / Growth OS / Conversation Thread" code="GO-22" title="Conversation not found">
        <Banner tone="warning" title="No conversation matches this link">Open the inbox to find the thread.</Banner>
      </GrowthFrame>
    )
  }
  return <Thread key={threadId} thread={thread} />
}

function Thread({ thread }) {
  const { data, update } = useGrowth()
  const { state } = useLocation()
  const messages = data.messages.filter((message) => message.threadId === thread.id).sort((a, b) => `${a.at.date} ${a.at.time}`.localeCompare(`${b.at.date} ${b.at.time}`))
  const [tab, setTab] = useState('conversation')
  const [draft, setDraft] = useState(thread.replyDraft ?? '')
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState(thread.notes ?? [])
  const [saved, setSaved] = useState('')
  const findings = privacyFindings(draft)
  const backPath = `${ROUTES.conversations}${state?.search ?? ''}`

  const saveDraft = () => { update('conversations', thread.id, { replyDraft: draft }); setSaved('Reply draft saved. It is unsent: no live channel is verified.') }
  const addNote = () => {
    if (!note.trim()) return
    const next = [{ id: `n${notes.length + 1}`, text: note.trim(), at: { date: '2026-10-22', time: '10:00' } }, ...notes]
    setNotes(next); update('conversations', thread.id, { notes: next }); setNote(''); setSaved('Internal note added. It is never sent to the visitor.')
  }
  const markRead = () => update('conversations', thread.id, { unread: false })

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to inbox · GO21 · Preserve filters & scroll' }} crumb="Owner Panel / Growth OS / Conversation Thread & Patient Context" code="GO-22" title="Conversation Thread & Patient Context" description="Review the enquiry, coordinate internal follow-up and keep identity verification explicit." badge={<StatusPill tone="warning">Sample transcript</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, `Origin GO21 · ${thread.id} · ClinicOS test inbox · Anchor ${thread.id}`]} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="No configured live messaging channel has been verified" className="mb-6">The ClinicOS test inbox is synthetic transport only, not verified production support. No provider-confirmed message status was received: no live send, read receipt or patient verification has occurred.</Banner>
      {saved && <Banner tone="brand" title={saved} className="mb-6" />}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title={`${thread.subject} · ${thread.id}`} aside={when(thread.last)}>
            <p className="mb-3 flex flex-wrap gap-2"><StatusPill tone={thread.status === 'Open' ? 'success' : 'neutral'}>{thread.status} · sample</StatusPill><StatusPill>{thread.linked ? 'Linked' : 'Unlinked'}</StatusPill><StatusPill>{thread.unread ? 'Unread' : 'Read'}</StatusPill></p>
            <div role="tablist" aria-label="Thread view" className="mb-4 flex gap-5 border-b border-slate-200 text-[13px]">{[['conversation', 'Conversation'], ['notes', `Internal notes (${notes.length})`]].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('pb-2 font-medium', tab === id ? 'border-b-2 border-brand text-brand' : 'text-outline')}>{label}</button>)}</div>
            {tab === 'conversation' ? (
              <div className="space-y-5">{messages.map((message) => (
                <div key={message.id} className={cn('text-xs', message.from === 'team' && 'ml-12')}>
                  <p className="flex justify-between font-semibold"><span>{message.who}</span><span className="font-normal text-outline">{message.at.time} IST</span></p>
                  <p className={cn('mt-1 rounded-md p-4 text-[13px] leading-5', message.from === 'team' ? 'bg-teal-50' : 'bg-surface-low')}>{message.text}<span className="mt-2 block text-[11px] text-outline">{message.note}</span></p>
                </div>))}
                <p className="text-[11px] text-outline">Transcript times and contents are sample entries, not delivery evidence.</p></div>
            ) : (
              <div><TextArea label="Add internal note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} hint="Internal only — never sent to the visitor." /><ActionButton className="mt-3" onClick={addNote} disabled={!note.trim()}>Add note</ActionButton><ul className="mt-4 space-y-3 text-xs">{notes.map((entry) => <li key={entry.id} className="rounded-md bg-surface-low p-3">{entry.text}<span className="mt-1 block text-outline">{when(entry.at)}</span></li>)}{notes.length === 0 && <li className="text-outline">No internal notes yet.</li>}</ul></div>
            )}
          </Section>
          <Section title="Reply draft" aside="UNSENT · not saved">
            <TextArea label="Draft text" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} hint="Do not include clinical detail or promises. Use the clinic’s verified contact channel." />
            {findings > 0 && <Banner tone="danger" title="Possible personal or clinical detail found" className="mt-3">Remove contact numbers, emails or clinical wording from the reply.</Banner>}
            <div className="mt-3 flex gap-3"><ActionButton onClick={saveDraft}>Save draft</ActionButton><ActionButton disabled title="No live channel is verified">Send reply</ActionButton></div>
            <p className="mt-2 text-[11px] text-outline">Send is unavailable until a messaging channel is verified in channel configuration.</p>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Patient context" aside={thread.linked ? 'Linked' : 'Current · Unlinked'}>
            <StatusPill>Unlinked · no patient record</StatusPill><p className="mt-3 text-xl leading-7 font-semibold">No patient chart is linked to this conversation</p>
            <p className="mt-3 rounded-md bg-surface-low p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-on-surface">Patient identity not verified — no chart access</strong>No clinical or financial preview, patient candidates or identifiers are shown. Conversation access is not chart-read or patient-link permission.</p>
            <ActionButton className="mt-4" disabled title="Needs identity-link permission and verification evidence">Review identity to link</ActionButton>
            <p className="mt-3 text-[11px] text-outline">Gated: live role, branch scope and identity evidence requirements are not verified. A review alias or phone alone is never sufficient.</p>
          </Section>
          <Section title="Identity states" aside="Definitions · not new states"><ul className="space-y-3 text-xs">{IDENTITY.map(([title, text]) => <li key={title}><StatusPill tone={title.startsWith('Ambiguous') ? 'warning' : title.startsWith('Verified') ? 'success' : 'neutral'}>{title}</StatusPill><p className="mt-1 leading-5 text-on-surface-variant">{text}</p></li>)}</ul></Section>
          <Section title="Related"><p className="space-y-2 text-xs"><Link to={pathFor(ROUTES.communicationHistory, { threadId: thread.id })} state={state} className="block font-semibold text-brand hover:underline">Communication history & preferences → GO24</Link><button type="button" onClick={markRead} disabled={!thread.unread} className="font-semibold text-brand hover:underline disabled:text-outline">Mark conversation read</button></p></Section>
        </div>
      </div>
      <GrowthFooter code="GO-22" back={{ to: backPath, label: 'Back to inbox · GO21' }} />
    </GrowthFrame>
  )
}
