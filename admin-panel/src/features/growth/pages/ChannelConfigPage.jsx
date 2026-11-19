import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { messagingApi } from '../messagingApi'
import { CHANNEL_STATUS, CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

// What each adapter actually does in ClinicOS today.
const CAPABILITIES = {
  whatsapp: [['Approved templates', true], ['Free-text replies within 24 hours of their message', true], ['Delivery and read receipts', true], ['Messages people send to the clinic', true], ['STOP / START replies', true]],
  sms: [['DLT-registered templates (MSG91 Flow)', true], ['Free text', false], ['Delivery reports', true], ['Replies', false]],
  email: [['Templates and free text', true], ['Accepted by the mail server', true], ['Delivery or read receipts', false], ['Replies', false]],
}

const FIELDS = {
  whatsapp: [['phoneNumberId', 'Phone number ID', 'From Meta: WhatsApp › API Setup'], ['businessAccountId', 'WhatsApp Business account ID', 'Optional'], ['accessToken', 'Permanent access token', 'A system-user token with whatsapp_business_messaging', true], ['appSecret', 'App secret', 'Meta app › Settings › Basic; used to check webhook signatures', true]],
  sms: [['senderId', 'DLT sender ID', '6 letters, as registered on DLT'], ['entityId', 'DLT principal entity ID', 'Optional'], ['authKey', 'MSG91 auth key', 'MSG91 › Authkey', true]],
  email: [['host', 'SMTP host', 'For example email-smtp.ap-south-1.amazonaws.com'], ['port', 'Port', '465 for SSL, 587 for STARTTLS'], ['user', 'SMTP user name', ''], ['password', 'SMTP password', '', true], ['fromAddress', 'From address', 'A verified sender on your domain'], ['fromName', 'From name', 'Optional, for example the clinic name']],
}

const STEPS = {
  whatsapp: ['In Meta Business, create an app with the WhatsApp product and add your clinic’s number.', 'Create a system user with a permanent token that has whatsapp_business_messaging and whatsapp_business_management.', 'Enter the phone number ID, token and app secret here and save.', 'In the app’s WhatsApp › Configuration, set the callback URL and verify token shown here, and subscribe to “messages”.', 'Submit message templates to Meta; once approved, enter each template name on the Message Templates screen.'],
  sms: ['Register your business, sender ID and each message template on a DLT portal (Jio, Airtel, Vodafone Idea or BSNL).', 'In MSG91, add the sender ID and create a Flow for each DLT template.', 'Enter the sender ID and auth key here and save.', 'In MSG91 › Webhooks, send delivery reports to the address shown here.', 'Enter each Flow’s template ID on the Message Templates screen.'],
  email: ['Verify your sending domain with your mail provider (SPF, DKIM).', 'Create SMTP credentials.', 'Enter them here and save; ClinicOS checks them with the server.'],
}

export default function ChannelConfigPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const admin = can('settings.organisation')
  const channels = useApiResource(() => (admin ? messagingApi.channels() : Promise.resolve(null)), `channels:${admin}`)
  const [selectedId, setSelectedId] = useState('whatsapp')
  // Kept here: saving reloads the channel, which rebuilds the form below.
  const [message, setMessage] = useState(null)
  const list = channels.data ?? []
  const selected = list.find((entry) => entry.channel === selectedId)
  const connected = list.filter((entry) => entry.status === 'connected').length

  return (
    <GrowthFrame back={{ to: ROUTES.messageTemplates, label: 'Message templates · GO23' }} crumb="Owner Panel / Growth OS / Channel Configuration" code="GO-25" title="Channel / Integration Configuration" description="Connect the clinic’s WhatsApp number, SMS sender and mail server. Nothing is sent on a channel until it is connected and checked." badge={<StatusPill tone={connected ? 'success' : 'warning'}>{admin && channels.data ? `${connected} of 3 connected` : 'Administrators only'}</StatusPill>} context={[context.line, 'Credentials are encrypted and never shown again after saving']} today={context.today} sample="Live configuration · Each organisation connects its own accounts">
      {!admin && <Banner tone="warning" title="Only organisation administrators can view or change channels" className="mb-6">Ask someone with “Manage organization settings” to connect WhatsApp, SMS or email.</Banner>}
      {admin && !channels.data && <LoadingState label="Loading channels…" error={channels.error} onRetry={channels.reload} />}
      {admin && channels.data && (
        <>
          {!list[0].encryptionReady && <Banner tone="danger" title="Channel credentials cannot be stored yet" className="mb-6">The server has no MESSAGING_SECRET_KEY. Add it to backend.env and restart the API (see backend README, Messaging).</Banner>}
          <div role="radiogroup" aria-label="Channel" className="mb-6 grid gap-4 md:grid-cols-3">{list.map((channel) => {
            const [label, tone] = CHANNEL_STATUS[channel.status]
            return (
              <button key={channel.channel} type="button" role="radio" aria-checked={selectedId === channel.channel} onClick={() => { setSelectedId(channel.channel); setMessage(null) }} className={cn('rounded-md border bg-white p-5 text-left text-xs', selectedId === channel.channel ? 'border-2 border-brand' : 'border-slate-200')}>
                <p className="flex justify-between"><strong className="text-[17px]">{CHANNELS[channel.channel]}</strong><span className="text-brand">{selectedId === channel.channel ? 'Selected' : ''}</span></p>
                <StatusPill tone={tone} className="my-3">{label}</StatusPill>
                <p className="leading-5">{channel.status === 'connected' ? `Checked ${when(stampOf(channel.verifiedAt))}` : channel.lastError ?? 'Not set up yet.'}</p>
              </button>
            )
          })}</div>
          {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
          {selected && <ChannelForm key={`${selected.channel}:${selected.version}`} channel={selected} onSaved={channels.reload} setMessage={setMessage} />}
        </>
      )}
      <GrowthFooter code="GO-25" back={{ to: ROUTES.messageTemplates, label: 'Message templates · GO23' }} />
    </GrowthFrame>
  )
}

function ChannelForm({ channel, onSaved, setMessage }) {
  const name = channel.channel
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS[name].map(([field]) => [field, channel.config[field] ?? (field === 'port' ? '465' : '')])))
  const [secure, setSecure] = useState(channel.config.secure !== 'false')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (field, value) => setValues((current) => ({ ...current, [field]: value }))

  const run = async (call, done) => {
    setSaving(true)
    setMessage(null)
    setErrors({})
    try {
      const saved = await call()
      setMessage(done(saved))
      onSaved()
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
    } finally {
      setSaving(false)
    }
  }
  const save = () => run(
    () => messagingApi.saveChannel(name, { ...values, ...(name === 'email' ? { secure, port: Number(values.port) } : {}) }),
    (saved) => (saved.status === 'connected' ? { tone: 'brand', title: `${CHANNELS[name]} connected`, text: 'The provider accepted the credentials.' } : { tone: 'danger', title: 'Saved, but the provider refused the credentials', text: saved.lastError }),
  )
  const disconnect = () => run(() => messagingApi.disconnect(name), () => ({ tone: 'brand', title: `${CHANNELS[name]} disconnected`, text: 'Saved credentials were removed; queued messages on this channel will fail.' }))

  return (
    <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Section title={`${CHANNELS[name]} · connection`} aside={CHANNEL_STATUS[channel.status][0]}>
        <div className="grid gap-4 sm:grid-cols-2">{FIELDS[name].map(([field, label, hint, isSecret]) => (
          <TextInput key={field} label={label} type={isSecret ? 'password' : 'text'} autoComplete="off" value={values[field]} onChange={(event) => set(field, event.target.value)} error={errors[field]}
            placeholder={isSecret && channel.saved[field] ? 'Saved · leave blank to keep' : undefined} hint={isSecret && channel.saved[field] ? 'Saved securely. Enter a new value to replace it.' : hint} />
        ))}</div>
        {name === 'email' && <div className="mt-4"><Check checked={secure} onChange={(event) => setSecure(event.target.checked)} label="Use SSL/TLS from the start (port 465)" /></div>}
        <div className="mt-5 flex flex-wrap gap-3"><ActionButton variant="brand" disabled={saving} onClick={save}>{saving ? 'Checking…' : channel.status === 'not_connected' ? 'Connect & verify' : 'Save & verify again'}</ActionButton>{channel.status !== 'not_connected' && <ActionButton disabled={saving} onClick={disconnect}>Disconnect</ActionButton>}</div>
        {channel.webhook && (
          <dl className="mt-6 grid gap-3 rounded-md bg-surface-low p-4 text-xs">
            <KeyValue label={name === 'whatsapp' ? 'Callback URL (Meta webhook)' : 'Delivery report URL (MSG91 webhook)'}><code className="break-all">{channel.webhook.url ?? 'Set PUBLIC_API_URL in backend.env to show the full address'}</code></KeyValue>
            {channel.webhook.verifyToken && <KeyValue label="Verify token"><code className="break-all">{channel.webhook.verifyToken}</code></KeyValue>}
          </dl>
        )}
      </Section>
      <div className="space-y-6">
        <Section title="What this channel does" aside="ClinicOS adapter">
          <ul className="space-y-2 text-xs">{CAPABILITIES[name].map(([capability, supported]) => <li key={capability} className={supported ? 'text-brand' : 'text-outline'}>{supported ? '✓' : '—'} {capability}</li>)}</ul>
        </Section>
        <Section title="Setting it up" aside="Step by step"><ol className="list-decimal space-y-2 pl-4 text-xs leading-5 text-on-surface-variant">{STEPS[name].map((step) => <li key={step}>{step}</li>)}</ol></Section>
      </div>
    </div>
  )
}
