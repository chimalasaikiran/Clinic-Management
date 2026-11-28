import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { messagingApi } from '../messagingApi'
import { CHANNELS, LOCALES, renderTemplate, TEMPLATE_CATEGORIES, TEMPLATE_STATUS, TEMPLATE_VARIABLES, templateVariables, unknownVariables } from '../messagingView'
import { useLeadContext } from '../useLeads'

const EXAMPLE = { preferred_name: 'Nisha', appointment_date: '27 Nov 2026', appointment_time: '10:00 AM', service_name: 'a physiotherapy assessment', clinic_name: 'the clinic' }
const PROVIDER_REF = { whatsapp: 'Meta template name', sms: 'MSG91 / DLT template ID', email: '' }
const EMPTY = { q: '', category: '', channel: '', status: '' }

export default function MessageTemplatesPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const editor = can('growth.manage')
  const templates = useApiResource(() => messagingApi.templates(), 'templates')
  const [filters, setFilters] = useState(EMPTY)
  const [selectedId, setSelectedId] = useState(null)
  const [saved, setSaved] = useState('')
  const [failure, setFailure] = useState('')
  const all = templates.data ?? []
  const needle = filters.q.trim().toLowerCase()
  const rows = all.filter((entry) => (!filters.category || entry.category === filters.category) && (!filters.channel || entry.channel === filters.channel) && (!filters.status || entry.status === filters.status) && (!needle || `${entry.name} ${entry.code}`.toLowerCase().includes(needle)))
  const selected = all.find((entry) => entry.id === selectedId) ?? rows[0]
  const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }))

  const create = async () => {
    setFailure('')
    try {
      const created = await messagingApi.createTemplate({ name: 'New message template', category: filters.category || 'Follow-up', channel: filters.channel || 'whatsapp', locale: 'en', body: 'Hello {{preferred_name}}, ' })
      setFilters(EMPTY)
      setSelectedId(created.id)
      setSaved(`Created ${created.code} as a draft.`)
      templates.reload()
    } catch (error) {
      setFailure(error.message)
    }
  }

  return (
    <GrowthFrame back={{ to: ROUTES.conversations, label: 'Conversations inbox' }} crumb="Owner Panel / Growth OS / Message Templates" title="Message Templates" description="Write the wording ClinicOS sends, check its variables, and record the provider’s approval before it is used." badge={<StatusPill tone="brand">{all.filter((entry) => entry.status === 'approved').length} approved</StatusPill>} context={[context.line, 'Every save is a new version; sent messages keep the version they went out with']} today={context.today} sample="Live templates · WhatsApp and SMS templates also need the provider’s approval">
      <Banner tone="neutral" title="Approval happens in two places" className="mb-6">WhatsApp templates are approved by Meta and SMS templates registered on DLT. Mark a template Approved here only after that, with the provider’s template name or ID; email templates need no provider approval.</Banner>
      {failure && <Banner tone="danger" title="Not saved" className="mb-6">{failure}</Banner>}
      <Section title="Find message templates" aside="Name / category / channel / status" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><SearchBox value={filters.q} onChange={(value) => set('q', value)} label="Search templates" placeholder="Search name or template code" /><FilterField label="" value={filters.category} onChange={(value) => set('category', value)} options={[['', 'All categories'], ...TEMPLATE_CATEGORIES]} /><FilterField label="" value={filters.channel} onChange={(value) => set('channel', value)} options={[['', 'All channels'], ...Object.entries(CHANNELS)]} /><FilterField label="" value={filters.status} onChange={(value) => set('status', value)} options={[['', 'All statuses'], ...Object.entries(TEMPLATE_STATUS)]} /></div>
        {!templates.data ? <LoadingState label="Loading templates…" error={templates.error} onRetry={templates.reload} /> : <div className="-mx-6 mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Template / category', 'Channel', 'Language', 'Status', 'Provider approval'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id} className={cn('border-t border-slate-100 align-top', selected?.id === entry.id && 'bg-teal-50/50')}><td className="px-6 py-3"><button type="button" onClick={() => { setSelectedId(entry.id); setSaved('') }} className="text-left font-semibold text-brand hover:underline">{entry.name}<br /><span className="font-normal">{entry.code} · v{entry.version} · {entry.category}</span></button></td><td className="px-6 py-3">{CHANNELS[entry.channel]}</td><td className="px-6 py-3">{LOCALES[entry.locale]}</td><td className="px-6 py-3">{TEMPLATE_STATUS[entry.status]}</td><td className="px-6 py-3">{entry.channel === 'email' ? 'Not needed' : entry.providerRef ?? 'Not recorded'}</td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">{all.length ? 'No templates match these filters.' : 'No templates yet.'}</p>}</div>}
        <p className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-outline"><span>{rows.length} of {all.length} templates</span><span className="flex gap-3"><ActionButton onClick={() => setFilters(EMPTY)}>Clear filters</ActionButton>{editor && <ActionButton onClick={create}>+ New template</ActionButton>}</span></p>
      </Section>

      {selected && <Editor key={`${selected.id}:${selected.version}`} template={selected} editor={editor} saved={saved} onSaved={(next) => { setSaved(`Saved ${next.code} as v${next.version}.`); templates.reload() }} />}
      <p className="mb-6 text-xs"><Link to={ROUTES.channels} className="font-semibold text-brand hover:underline">Channel configuration →</Link> · <Link to={ROUTES.conversations} className="font-semibold text-brand hover:underline">Conversations inbox →</Link></p>
      <GrowthFooter back={{ to: ROUTES.conversations, label: 'Conversations inbox' }} />
    </GrowthFrame>
  )
}

function Editor({ template, editor, saved, onSaved }) {
  const initial = { name: template.name, category: template.category, channel: template.channel, locale: template.locale, subject: template.subject ?? '', body: template.body, providerRef: template.providerRef ?? '', status: template.status, changeNote: '' }
  const [values, setValues] = useState(initial)
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)
  const unknown = unknownVariables(values.body)
  const used = templateVariables(values.body)
  const changed = Object.keys(initial).some((key) => key !== 'changeNote' && values[key] !== initial[key])
  const needsRef = values.status === 'approved' && values.channel !== 'email' && !values.providerRef.trim()
  const errors = {
    name: values.name.trim() ? undefined : 'Enter a display name.',
    body: !values.body.trim() ? 'Enter the message body.' : unknown.length ? `Unknown variable${unknown.length === 1 ? '' : 's'}: ${unknown.map((name) => `{{${name}}}`).join(', ')}` : undefined,
    providerRef: needsRef ? `Enter the ${PROVIDER_REF[values.channel]} before approving.` : undefined,
    changeNote: changed && !values.changeNote.trim() ? 'Give a change reason.' : undefined,
  }
  const valid = changed && !Object.values(errors).some(Boolean)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setSaving(true)
    setFailure('')
    try {
      const next = await messagingApi.updateTemplate(template.id, { ...values, subject: values.subject.trim() || null, providerRef: values.providerRef.trim() || null, version: template.version })
      onSaved(next)
    } catch (error) {
      setSaving(false)
      setFailure(error.message)
    }
  }

  return (
    <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Section title={editor ? 'Edit selected template' : 'Selected template'} aside={`${template.code} · v${template.version}${template.updatedBy ? ` · ${template.updatedBy}` : ''}`}>
        {saved && <Banner tone="brand" title={saved} className="mb-4" />}
        {failure && <Banner tone="danger" title="Not saved" className="mb-4">{failure}</Banner>}
        {changed && <StatusPill tone="warning" className="mb-3">Unsaved changes</StatusPill>}
        <fieldset disabled={!editor} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextInput label="Display name" value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
          <SelectInput label="Category" value={values.category} onChange={(event) => set('category', event.target.value)} options={TEMPLATE_CATEGORIES} hint={values.category === 'Reminder' ? 'Care reminders may use a patient’s notification settings' : 'Needs the contact’s recorded permission'} />
          <SelectInput label="Channel" value={values.channel} onChange={(event) => set('channel', event.target.value)} options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))} />
          <SelectInput label="Language" value={values.locale} onChange={(event) => set('locale', event.target.value)} options={Object.entries(LOCALES).map(([value, label]) => ({ value, label }))} />
          <SelectInput label="Status" value={values.status} onChange={(event) => set('status', event.target.value)} options={Object.entries(TEMPLATE_STATUS).map(([value, label]) => ({ value, label }))} />
          {values.channel === 'email' ? <div className="sm:col-span-2"><TextInput label="Email subject" value={values.subject} onChange={(event) => set('subject', event.target.value)} /></div> : <div className="sm:col-span-2"><TextInput label={PROVIDER_REF[values.channel]} value={values.providerRef} onChange={(event) => set('providerRef', event.target.value)} error={errors.providerRef} hint="Exactly as the provider shows it; variables are sent in the order they appear below" /></div>}
          <div className="sm:col-span-2"><TextArea label="Message body" required rows={5} value={values.body} onChange={(event) => set('body', event.target.value)} error={errors.body} hint={`Allowed variables: ${TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(', ')}`} /></div>
          {changed && <div className="sm:col-span-2"><TextInput label="Change reason" required value={values.changeNote} onChange={(event) => set('changeNote', event.target.value)} error={errors.changeNote} /></div>}
        </fieldset>
        {editor && <div className="mt-4 flex gap-3"><ActionButton variant="brand" disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save as new version'}</ActionButton><ActionButton disabled={!changed} onClick={() => setValues(initial)}>Discard edits</ActionButton></div>}
      </Section>
      <div className="space-y-6">
        <Section title="Message preview" aside="Example values"><StatusPill>{CHANNELS[values.channel]} · {LOCALES[values.locale]}</StatusPill><p className="mt-3 rounded-md bg-teal-50 p-4 text-xs leading-5 whitespace-pre-line text-on-surface-variant">{values.channel === 'email' && values.subject && <strong className="mb-1 block text-[13px] text-on-surface">{values.subject}</strong>}{renderTemplate(values.body, EXAMPLE)}</p><p className="mt-3 text-[11px] text-outline">Preview only. preferred_name and clinic_name are filled in by ClinicOS when sending; the rest are entered by the sender.</p></Section>
        <Section title="Ready to send?" aside={values.status === 'approved' ? 'Approved' : 'Not yet'}><ul className="space-y-2 text-xs"><li className={unknown.length ? 'text-danger' : 'text-brand'}>{unknown.length ? '✗' : '✓'} Variables: {used.length ? used.map((name) => `{{${name}}}`).join(', ') : 'none used'}</li><li className={values.channel === 'email' || values.providerRef ? 'text-brand' : 'text-amber-700'}>{values.channel === 'email' ? '✓ No provider approval needed for email' : values.providerRef ? `✓ ${PROVIDER_REF[values.channel]}: ${values.providerRef}` : `○ ${PROVIDER_REF[values.channel]} not recorded`}</li><li className={values.status === 'approved' ? 'text-brand' : 'text-amber-700'}>{values.status === 'approved' ? '✓' : '○'} Marked approved in ClinicOS</li></ul></Section>
      </div>
    </div>
  )
}
