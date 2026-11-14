import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { cn } from '../../../lib/cn'
import { OptionSelect, TextArea } from '../components/parts'
import { CHANNELS, MESSAGE_PURPOSES, MESSAGE_TEMPLATES } from '../data/catalog'
import { validateMessage } from '../validation'

const fill = (body, doctor) => body.replaceAll('{doctor}', doctor)

// Compose an outbound message to the patient or an authorized contact. `onSend` receives the message fields.
export function ComposeMessageDrawer({ open, onClose, patient, contacts, doctor, onSend }) {
  const recipients = [{ id: 'patient', name: patient.name, role: 'Primary patient', address: patient.mobile }, ...contacts.map((entry) => ({ id: entry.id, name: entry.name, role: `${entry.relationship} · ${entry.access}`, address: entry.mobile }))]
  const [values, setValues] = useState({ recipientId: 'patient', channel: 'WhatsApp', purpose: MESSAGE_PURPOSES[0], templateId: MESSAGE_TEMPLATES[0].id, body: fill(MESSAGE_TEMPLATES[0].body, doctor), memo: '' })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateMessage(values) : {}
  const templates = MESSAGE_TEMPLATES.filter((entry) => entry.purpose === values.purpose)
  const recipient = recipients.find((entry) => entry.id === values.recipientId)

  const finish = () => {
    setSubmitted(false)
    onClose()
  }
  const changePurpose = (purpose) => {
    const template = MESSAGE_TEMPLATES.find((entry) => entry.purpose === purpose)
    setValues((current) => ({ ...current, purpose, templateId: template.id, body: fill(template.body, doctor) }))
  }

  const send = () => {
    setSubmitted(true)
    if (Object.keys(validateMessage(values)).length) return
    const template = MESSAGE_TEMPLATES.find((entry) => entry.id === values.templateId)
    onSend({ channel: values.channel, recipient: recipient.name, recipientRole: recipient.role, address: recipient.address, preview: `"${values.body.trim().slice(0, 90)}${values.body.trim().length > 90 ? '…' : ''}"`, body: values.body.trim(), template: template.label, memo: values.memo.trim() })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Communication dispatch gateway · ABDM M2 care context"
      title="Compose & Dispatch Message"
      description={`Recipient: ${patient.name} (MRN ${patient.mrn})`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={finish}>Cancel (Esc)</ActionButton><ActionButton variant="brand" onClick={send}>Send Message via {values.channel} →</ActionButton></div>}
    >
      <div className="flex flex-col gap-5 p-5">
        <InfoNote tone="warning"><strong>Statutory communications governance:</strong> TRAI DLT-registered templates ≠ promotional broadcast ≠ unverified proxy messaging. Clinical alerts and transactional messages may only be dispatched to registered recipient endpoints with active consent. Never include confidential clinical diagnoses in unencrypted SMS.</InfoNote>
        <section>
          <h3 className="mb-2 text-sm font-semibold">1 · Recipient endpoint &amp; legal consent validation</h3>
          <div role="radiogroup" aria-label="Recipient" className="flex flex-col gap-2">{recipients.map((entry) => <RadioCard key={entry.id} name="recipient" value={entry.id} checked={values.recipientId === entry.id} onChange={() => setValues((current) => ({ ...current, recipientId: entry.id }))} title={`${entry.name}`} detail={`${entry.role} · ${entry.address}`} />)}</div>
          {errors.recipientId && <p role="alert" className="mt-1 text-xs text-rose-600">{errors.recipientId}</p>}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">2 · Dispatch channel</h3>
          <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-2">{CHANNELS.map((channel) => <button key={channel} type="button" role="radio" aria-checked={values.channel === channel} onClick={() => setValues((current) => ({ ...current, channel }))} className={cn('rounded-md border px-3 py-3 text-xs font-medium', values.channel === channel ? 'border-2 border-brand bg-teal-50 text-brand' : 'border-slate-200')}>{channel}</button>)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">3 · Clinical purpose &amp; template registry</h3>
          <div className="grid gap-4 sm:grid-cols-2"><OptionSelect label="Message purpose / category" required value={values.purpose} onChange={(event) => changePurpose(event.target.value)} error={errors.purpose} options={MESSAGE_PURPOSES.map((entry) => ({ value: entry, label: entry }))} /><OptionSelect label="DLT template library lookup" value={values.templateId} onChange={(event) => { const template = MESSAGE_TEMPLATES.find((entry) => entry.id === event.target.value); setValues((current) => ({ ...current, templateId: template.id, body: fill(template.body, doctor) })) }} options={templates.map((entry) => ({ value: entry.id, label: entry.label }))} /></div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">4 · Message content &amp; live preview</h3>
          <TextArea label="Message body" required rows={7} value={values.body} onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))} error={errors.body} hint={`${values.body.length} / 1024 chars`} />
          <p className="mt-3 rounded-md bg-emerald-50 p-3 text-xs whitespace-pre-wrap" aria-label="Message preview"><strong className="block text-[10px] tracking-wide text-outline uppercase">Preview to {recipient?.name}</strong>{values.body}</p>
        </section>
        <TextArea label="Internal desk audit memo (staff eyes only — non-transmitted)" rows={2} value={values.memo} onChange={(event) => setValues((current) => ({ ...current, memo: event.target.value }))} />
      </div>
    </Drawer>
  )
}

export function ReplyDrawer({ message, patient, doctor, onClose, onSend }) {
  const [body, setBody] = useState('')
  const [submitted, setSubmitted] = useState(false)
  if (!message) return null
  const error = submitted && !body.trim() ? 'Write the reply to send.' : null
  const snippets = ['Exertional dyspnea triaged: rest, log vitals & book morning ECG.', 'Schedule next OPD visit and bring the recent reports.', 'RED FLAG: if shortness of breath occurs at rest or radiates to arm/jaw, call our emergency desk immediately.']

  const send = () => {
    setSubmitted(true)
    if (!body.trim()) return
    onSend(message.id, body.trim())
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Inbound thread ${message.id} · reply composer`}
      title="Reply to Inbound Patient Message"
      description={`Replying to ${message.recipient} (${message.address}) · Attending clinician: ${doctor}`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Cancel &amp; Discard (Esc)</ActionButton><ActionButton variant="primary" onClick={send}>Send Reply via {message.channel}</ActionButton></div>}
    >
      <div className="flex flex-col gap-5 p-5">
        <InfoNote tone="warning"><strong>Statutory communications governance:</strong> 2-way patient reply ≠ tele-prescription ≠ emergency triage. Never adjust cardiac dosages or introduce new medications via unsecured messaging; for suspected myocardial infarction or severe chest pain, prompt the patient to dial the emergency number.</InfoNote>
        <section className="rounded-md border border-slate-200 p-4"><h3 className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">Original inbound message context</h3><blockquote className="border-l-4 border-brand bg-surface-low p-3 text-sm italic">{message.body ?? message.preview}</blockquote><p className="mt-2 text-[11px] text-outline">Sender: {message.recipient} ({message.recipientRole}) · {message.channel}</p></section>
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">Approved clinical templates &amp; fast-triage snippets</h3>
          <div className="flex flex-wrap gap-2">{snippets.map((snippet) => <ActionButton key={snippet} size="sm" onClick={() => setBody((current) => (current ? `${current}\n\n${snippet}` : snippet))}>{snippet.slice(0, 44)}…</ActionButton>)}</div>
        </section>
        <TextArea label="Outbound reply composer" required rows={8} value={body} onChange={(event) => setBody(event.target.value)} error={error} hint={`${body.length} / 1024 chars · reply is sent as ${doctor}'s cardiology team to ${patient.name}`} />
      </div>
    </Drawer>
  )
}
