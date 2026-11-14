import { useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'
import { when } from '../format'

export default function CommunicationHistoryPage() {
  const { threadId } = useParams()
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const thread = data.conversations.find((entry) => entry.id === threadId)

  if (!thread) {
    return (
      <GrowthFrame back={{ to: ROUTES.conversations, label: 'Back to inbox' }} crumb="Owner Panel / Growth OS / Communication History" code="GO-24" title="Conversation not found">
        <Banner tone="warning" title="No conversation matches this link">Open the inbox to find the thread.</Banner>
      </GrowthFrame>
    )
  }

  const direction = filters.get('direction')
  const entries = data.messages.filter((message) => message.threadId === thread.id && (!direction || (direction === 'Inbound') === (message.from === 'visitor'))).sort((a, b) => `${a.at.date} ${a.at.time}`.localeCompare(`${b.at.date} ${b.at.time}`))
  const threadPath = pathFor(ROUTES.conversation, { threadId })

  return (
    <GrowthFrame back={{ to: threadPath, label: 'Conversation thread · GO22 · Keep inbox context' }} crumb="Owner Panel / Growth OS / Communication History" code="GO-24" title="Communication History & Preferences" description="Review the contact trail and purpose-specific evidence without inferring identity or consent." badge={<StatusPill tone="warning">Unverified contact · no patient link</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, `Origin ${thread.id} · Sample transcript · Return to the inbox · Anchor ${thread.id}`]} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Sample transcript only — no production receipts or consent evidence" className="mb-6">The ClinicOS test inbox is an isolated demo channel, not a live one. {thread.id} remains {thread.linked ? 'Linked' : 'Unlinked'} / {thread.unread ? 'Unread' : 'Read'} / {thread.status}. History access does not grant chart access, patient linking or preference-write access.</Banner>
      <Section title="Find communications" aside="History / conversation / receipt store" className="mb-6"><div className="grid gap-4 sm:grid-cols-4"><FilterField label="Channel" value="" disabled options={[['', 'All · test inbox']]} /><FilterField label="Direction" value={direction} onChange={(value) => filters.change('direction', value)} options={[['', 'All recorded directions'], 'Inbound', 'Outbound']} /><FilterField label="Source" value="" disabled options={[['', 'All sources']]} /><FilterField label="Date range · Asia/Kolkata" value="" disabled options={[['', '25 Sep–25 Oct 2026']]} /></div><p className="mt-3 text-[11px] text-outline">{entries.length} authored sample entr{entries.length === 1 ? 'y' : 'ies'} · chronological · no real phone, email or clinical chart exposed.</p></Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title={`${thread.subject} · ${thread.id}`} aside={`${when(thread.last)} · sample baseline`}>
          <p className="mb-4 flex flex-wrap gap-2"><StatusPill tone="success">{thread.status}</StatusPill><StatusPill>{thread.unread ? 'Unread' : 'Read'}</StatusPill><StatusPill>{thread.linked ? 'Linked' : 'Unlinked'}</StatusPill></p>
          <ul className="space-y-5">{entries.map((message) => <li key={message.id} className="text-xs"><p className="flex justify-between font-semibold"><span>{message.from === 'visitor' ? 'Inbound · visitor sample' : 'Outbound · team reply sample'}</span><span className="font-normal text-outline">{when(message.at)}</span></p><p className={cn('mt-1 rounded-md p-4 text-[13px] leading-5', message.from === 'team' ? 'bg-teal-50' : 'bg-surface-low')}>{message.text}<span className="mt-1 block text-[11px] text-outline">{message.note.replace('fixture dataset', 'sample dataset')} — no provider receipt</span></p></li>)}</ul>
          {entries.length === 0 && <p className="text-xs text-outline">No entries match these filters.</p>}
        </Section>
        <Section title="Contact permission evidence" aside="Current · not evaluated">
          <dl className="space-y-4 text-xs"><div><dt className="text-on-surface-variant">Purpose under review</dt><dd className="mt-1 rounded border border-slate-200 px-3 py-2 text-[13px]">Routine appointment reminder · proposed</dd></div><div><dt className="text-on-surface-variant">Channel under review</dt><dd className="mt-1 rounded border border-slate-200 px-3 py-2 text-[13px]">WhatsApp · proposed, not configured</dd></div></dl>
          <Banner tone="warning" title="Consent unverified — no current evidence supplied" className="mt-4">Sending is blocked: current channel and purpose consent is not verified. An appointment, contact entry or phone number alone is not consent.</Banner>
          <ul className="mt-4 space-y-3 text-xs"><li><strong>Opt-out</strong><br />Not checked — verified preference record required.</li><li><strong>DND / jurisdiction rule</strong><br />Not checked — registry check required.</li><li><strong>Suppression</strong><br />Not checked — current suppression list required.</li></ul>
          <ActionButton className="mt-4" to={ROUTES.channels}>Channel configuration → GO25</ActionButton>
        </Section>
      </div>
      <GrowthFooter code="GO-24" back={{ to: threadPath, label: 'Conversation thread · GO22' }} />
    </GrowthFrame>
  )
}
