import { useState } from 'react'
import { AlertTriangle, MessageSquare, Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import { ComposeMessageDrawer, ReplyDrawer } from '../drawers/MessageDrawers'
import { TODAY, formatDate, formatTime } from '../format'
import { byNewest, clockTime, datesFrom } from '../selectors'

const VIEWS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'wa', label: 'WhatsApp', test: (message) => message.channel === 'WhatsApp' },
  { id: 'sms', label: 'SMS', test: (message) => message.channel === 'SMS' },
  { id: 'in', label: 'Incoming / Responses', test: (message) => message.direction === 'Incoming' },
  { id: 'failed', label: 'Failed', test: (message) => message.failed },
]
const CHANNEL_STYLE = { WhatsApp: 'bg-emerald-50 text-emerald-800', SMS: 'bg-sky-50 text-sky-800', Email: 'bg-violet-50 text-violet-800' }

export default function CommunicationTab() {
  const { patient, patientId, mine, add, update, newId } = usePatient()
  const location = useLocation()
  const [showConsents, setShowConsents] = useState(location.state?.view === 'consents')
  const [view, setView] = useState('all')
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState('')
  const [drawer, setDrawer] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const messages = mine('messages').sort(byNewest)
  const consents = mine('consents')
  const family = mine('family')
  const proxy = family.find((member) => member.access === 'Legal Proxy')
  const failed = messages.filter((message) => message.failed)
  const awaiting = messages.filter((message) => message.needsReply)
  const latest = messages[0]
  const doctor = mine('appointments').find((appointment) => appointment.status !== 'Cancelled')?.doctorShort ?? 'the clinic'
  const selected = VIEWS.find((entry) => entry.id === view)
  const needle = query.trim().toLowerCase()
  const rows = messages.filter((message) => selected.test(message) && (!channel || message.channel === channel) && (!needle || `${message.id} ${message.preview} ${message.recipient} ${message.related}`.toLowerCase().includes(needle)))
  const replying = drawer?.type === 'reply' ? messages.find((message) => message.id === drawer.id) : null

  const push = (fields) => add('messages', { id: newId('MSG-', 'messages', 4), patientId, date: TODAY, time: clockTime(), direction: 'Outgoing', related: '—', relatedNote: 'Manual dispatch', status: 'Sent', tone: 'neutral', sentBy: 'Reception', sentByNote: 'Desk operator', ...fields })
  const send = (fields) => push(fields)
  const reply = (id, body) => {
    const original = messages.find((message) => message.id === id)
    push({ channel: original.channel, recipient: original.recipient, recipientRole: original.recipientRole, address: original.address, preview: `"${body.slice(0, 90)}${body.length > 90 ? '…' : ''}"`, body, related: original.related, relatedNote: 'Reply', status: 'Sent' })
    update('messages', id, { needsReply: false, status: 'Replied', tone: 'neutral' })
  }
  const retry = (message) => {
    push({ channel: 'WhatsApp', recipient: message.recipient, recipientRole: message.recipientRole, address: message.address, preview: message.preview, related: message.related, relatedNote: 'Retry via WhatsApp', template: message.template })
    update('messages', message.id, { failed: false, status: 'Superseded by WhatsApp', tone: 'neutral' })
  }
  const renew = (id) => update('consents', id, { status: 'Active', tone: 'success', validity: datesFrom(TODAY, 366)[365], validityNote: 'Renewed for 1 year', renewable: false })
  const withdraw = (id) => update('consents', id, { status: 'Withdrawn', tone: 'neutral', validity: 'Revoked', validityNote: formatDate(TODAY), withdrawn: true })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold">Communication <span className="rounded bg-surface-low px-1.5 py-0.5 text-[10px] font-normal text-on-surface-variant">Omnichannel Hub</span></h2><p className="text-sm text-on-surface-variant">View and manage patient communications across supported channels (WhatsApp, SMS, Email, Internal).</p></div>
        <ActionButton variant="brand" icon={Plus} onClick={() => setDrawer({ type: 'compose' })}>New message</ActionButton>
      </div>

      {messages.length === 0 && consents.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No communication yet" action={<ActionButton variant="brand" icon={Plus} onClick={() => setDrawer({ type: 'compose' })}>New message</ActionButton>}>Messages and consent artefacts for {patient.name} will be listed here.</EmptyState>
      ) : (
        <>
          <StatTiles
            className="mb-5"
            items={[
              { label: 'Recent activity', value: latest ? `${latest.date === TODAY ? 'Today' : formatDate(latest.date)}, ${formatTime(latest.time)}` : '—', hint: latest ? `Last: ${latest.channel} ${latest.direction === 'Incoming' ? 'reply' : 'message'}` : '' },
              { label: 'Active channels', value: `${[...new Set(messages.map((message) => message.channel))].length} Configured`, hint: [...new Set(messages.map((message) => message.channel))].join(', ') },
              { label: 'Awaiting response', value: `${awaiting.length} Incoming`, hint: awaiting.length ? 'Needs a reply from the care team' : 'No replies pending' },
              { label: 'Failed / attention', value: `${failed.length} Failed`, hint: failed.length ? 'Carrier routing timeout' : 'All deliveries healthy' },
            ]}
          />

          {failed[0] && !alertDismissed && (
            <section className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" /><div><p className="text-sm font-semibold text-danger">Delivery Failure · Carrier Timeout on {failed[0].channel}</p><p className="mt-1 max-w-3xl text-xs text-red-800">{failed[0].channel} notification to {failed[0].recipient} ({failed[0].address}) failed on {formatDate(failed[0].date)}, {formatTime(failed[0].time)}. Reason: carrier handset unreachable timeout.</p></div></div>
                <div className="flex items-center gap-2"><ActionButton variant="brand" onClick={() => retry(failed[0])}>Retry via WhatsApp (Verified)</ActionButton><ActionButton onClick={() => { setView('failed'); setShowConsents(false) }}>View Dispatch Log</ActionButton><button type="button" onClick={() => setAlertDismissed(true)} className="text-xs font-medium underline">Dismiss Alert</button></div>
              </div>
            </section>
          )}

          <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
            <header className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Recipient channels, consents &amp; caregiver proxies</h3><button type="button" onClick={() => setShowConsents((current) => !current)} className="text-xs font-semibold text-brand hover:underline">{showConsents ? 'Back to message log' : 'Manage Consent Artifacts →'}</button></header>
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Primary patient profile <StatusPill tone="success" className="ml-2">Consent Active</StatusPill></p><p className="mt-1 text-sm font-semibold">{patient.name} <span className="font-normal text-on-surface-variant">({patient.mobile}{patient.email && ` · ${patient.email}`})</span></p><p className="mt-1 text-xs text-on-surface-variant">Preferred: WhatsApp · Clinical alerts: ABDM M2 consent</p></div>
              <div><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Authorized caregiver &amp; proxy {proxy && <StatusPill tone="success" className="ml-2">Legal proxy valid</StatusPill>}</p>{proxy ? <><p className="mt-1 text-sm font-semibold">{proxy.name} <span className="font-normal text-on-surface-variant">({proxy.relationship} / Legal Proxy · {proxy.mobile})</span></p><p className="mt-1 text-xs text-on-surface-variant">Authorized for: {proxy.scope}</p></> : <p className="mt-1 text-sm text-on-surface-variant">No authorized proxy designated.</p>}</div>
            </div>
          </section>

          {showConsents ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Table headings={['Consent & artifact ID', 'Scope & permitted workflows', 'Status', 'Given by & method', 'Validity / expiry', 'Actions']} minWidth={980} empty={consents.length ? null : 'No consent artefacts are on file.'}>
                {consents.map((consent) => (
                  <Row key={consent.id} muted={consent.withdrawn}>
                    <Cell><p className={cn('font-semibold', consent.withdrawn && 'line-through')}>{consent.title}</p><p className="font-mono text-[10px] text-outline">#{consent.id} · {consent.version}</p></Cell>
                    <Cell className="text-xs"><p>{consent.scope}</p><p className="text-[11px] text-outline">{consent.scopeNote}</p></Cell>
                    <Cell><StatusPill tone={consent.tone} dot>{consent.status}</StatusPill></Cell>
                    <Cell className="text-xs"><p className="font-semibold">{consent.givenBy}</p><p className="text-[11px] text-outline">{consent.method}</p></Cell>
                    <Cell className="text-xs"><p className="font-semibold">{consent.validity.startsWith('20') ? formatDate(consent.validity) : consent.validity}</p><p className="text-[11px] text-outline">{consent.validityNote}</p></Cell>
                    <Cell><span className="flex gap-1.5">{consent.renewable && <ActionButton size="sm" variant="brand" onClick={() => renew(consent.id)} aria-label={`Renew ${consent.title}`}>Renew</ActionButton>}{consent.status === 'Active' && <ActionButton size="sm" variant="danger" onClick={() => withdraw(consent.id)} aria-label={`Withdraw ${consent.title}`}>Withdraw</ActionButton>}</span></Cell>
                  </Row>
                ))}
              </Table>
              <TableFooter summary={`Showing ${consents.length} of ${consents.length} governance records`}><span>ABDM &amp; DISHA statutory synchronized</span></TableFooter>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={query} onChange={setQuery} label="Search messages" placeholder="Search message preview, ID, recipient, or context… (e.g. #MSG-0412)" className="w-96 max-w-full" /><FilterSelect label="Channel" value={channel} onChange={setChannel} allLabel="All Channels" options={['WhatsApp', 'SMS', 'Email']} /><ActionButton onClick={() => window.print()}>Export Log</ActionButton></div>
              <div className="mb-3 flex items-center gap-3 text-xs text-on-surface-variant">Views: <FilterTabs label="Message view" value={view} onChange={setView} options={VIEWS.map((entry) => ({ id: entry.id, label: entry.label, count: messages.filter(entry.test).length }))} /></div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Table headings={['Date & time', 'Channel', 'Recipient / sender', 'Message preview & content', 'Related context', 'Delivery & status', 'Sent by / trigger', 'Actions']} minWidth={1180} empty={rows.length ? null : 'No messages match the current filters.'}>
                  {rows.map((message) => (
                    <Row key={message.id}>
                      <Cell><p className={cn('font-semibold', message.failed && 'text-danger')}>{message.date === TODAY ? 'Today' : formatDate(message.date)}, {formatTime(message.time)}</p><p className="font-mono text-[10px] text-outline">#{message.id}</p></Cell>
                      <Cell><span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', CHANNEL_STYLE[message.channel])}>{message.channel === 'WhatsApp' ? 'WA' : message.channel} {message.direction}</span></Cell>
                      <Cell className="text-xs"><p className="font-semibold">{message.recipient}</p><p className="text-outline">{message.recipientRole} · {message.address}</p></Cell>
                      <Cell className="max-w-72 text-xs"><p>{expanded === message.id && message.body ? message.body : message.preview}</p>{message.template && <p className="font-mono text-[10px] text-brand">{message.template}</p>}</Cell>
                      <Cell className="text-xs"><p className="font-mono text-brand">{message.related}</p><p className="text-outline">{message.relatedNote}</p></Cell>
                      <Cell><StatusPill tone={message.tone}>{message.status}</StatusPill></Cell>
                      <Cell className="text-xs"><p className="font-medium">{message.sentBy}</p><p className="text-outline">{message.sentByNote}</p></Cell>
                      <Cell>
                        <span className="flex flex-wrap gap-1.5">
                          {message.needsReply && <ActionButton size="sm" variant="primary" onClick={() => setDrawer({ type: 'reply', id: message.id })} aria-label={`Reply to ${message.id}`}>Reply</ActionButton>}
                          {message.failed && <ActionButton size="sm" variant="danger" onClick={() => retry(message)} aria-label={`Retry ${message.id} via WhatsApp`}>Retry WA</ActionButton>}
                          {message.direction === 'Incoming' && message.status.startsWith('Received') && <ActionButton size="sm" onClick={() => update('messages', message.id, { status: 'Read', tone: 'neutral', needsReply: false })}>Mark Read</ActionButton>}
                          {message.body && <ActionButton size="sm" onClick={() => setExpanded((current) => (current === message.id ? null : message.id))}>{expanded === message.id ? 'Hide' : 'View'}</ActionButton>}
                        </span>
                      </Cell>
                    </Row>
                  ))}
                </Table>
                <TableFooter summary={`Showing ${rows.length} of ${messages.length} communication logs`}><span className="font-mono text-[10px]">Ledger node #COMM-HYD-04 · audit stream live</span></TableFooter>
              </div>
            </>
          )}
        </>
      )}

      <ComposeMessageDrawer key={String(drawer?.type === 'compose')} open={drawer?.type === 'compose'} onClose={() => setDrawer(null)} patient={patient} contacts={family} doctor={doctor} onSend={send} />
      {drawer?.type === 'reply' && <ReplyDrawer key={drawer.id} message={replying} patient={patient} doctor={doctor} onClose={() => setDrawer(null)} onSend={reply} />}
    </div>
  )
}
