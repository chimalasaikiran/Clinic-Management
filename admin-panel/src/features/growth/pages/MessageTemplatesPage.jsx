import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CHANNEL_FORMATS, GROWTH_BRANCH, LOCALES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { renderTemplate, TEMPLATE_VARIABLES, templateVariables, unknownVariables } from '../growthLogic'

const SAMPLE = { preferred_name: 'Sample recipient', appointment_date: '27 Oct 2026', appointment_time: '10:00 IST', service_name: 'a preventive health screening' }
const CATEGORIES = ['Reminder', 'Follow-up', 'Review request', 'Prevention']

export default function MessageTemplatesPage() {
  const { data, update, add } = useGrowth()
  const [filters, setFilters] = useState({ q: '', category: '', channel: '', locale: '' })
  const [selectedId, setSelectedId] = useState(data.messageTemplates[0]?.id)
  const [saved, setSaved] = useState('')
  const needle = filters.q.trim().toLowerCase()
  const rows = data.messageTemplates.filter((entry) => (!filters.category || entry.category === filters.category) && (!filters.channel || entry.channel === filters.channel) && (!filters.locale || entry.locale === filters.locale) && (!needle || `${entry.name} ${entry.id}`.toLowerCase().includes(needle)))
  const selected = data.messageTemplates.find((entry) => entry.id === selectedId) ?? rows[0]
  const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }))

  const create = () => {
    const id = `MT-NEW${String(data.messageTemplates.filter((entry) => entry.id.startsWith('MT-NEW')).length + 1).padStart(2, '0')}`
    add('messageTemplates', { id, version: 1, name: 'New message template', category: filters.category || 'Reminder', channel: 'WhatsApp', locale: LOCALES[0], status: 'Local draft', body: 'Hello {{preferred_name}}, ' })
    setSelectedId(id); setFilters({ q: '', category: '', channel: '', locale: '' }); setSaved('')
  }

  return (
    <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27 · Restore filters & scroll' }} crumb="Owner Panel / Growth OS / Message Templates" code="GO-23" title="Message Templates" description="Find a local template, validate its variables and prepare a workflow without sending." badge={<StatusPill tone="warning">Local drafts · not provider-approved</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Template filters, search and selection are kept when you return to the workflow']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Proposed channel format ≠ configured integration" className="mb-6">No production messaging channel or provider template ID is verified. Local content approval, provider submission and channel setup are separate gates.</Banner>
      <Section title="Find message templates" aside="Template / version / approval catalog" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4"><SearchBox value={filters.q} onChange={(value) => set('q', value)} label="Search templates" placeholder="Search name or template ID" /><FilterField label="" value={filters.category} onChange={(value) => set('category', value)} options={[['', 'All categories'], ...CATEGORIES]} /><FilterField label="" value={filters.channel} onChange={(value) => set('channel', value)} options={[['', 'All proposed formats'], ...CHANNEL_FORMATS]} /><FilterField label="" value={filters.locale} onChange={(value) => set('locale', value)} options={[['', 'All languages'], ...LOCALES]} /></div>
        <div className="-mx-6 mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Template / category', 'Proposed channel', 'Language', 'Local status', 'Provider approval'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id} className={cn('border-t border-slate-100 align-top', selected?.id === entry.id && 'bg-teal-50/50')}><td className="px-6 py-3"><button type="button" onClick={() => setSelectedId(entry.id)} className="text-left font-semibold text-brand hover:underline">{entry.name}<br /><span className="font-normal">{entry.id} · v{entry.version} · {entry.category}</span></button></td><td className="px-6 py-3">{entry.channel}<br /><span className="text-outline">Setup required</span></td><td className="px-6 py-3">{entry.locale.replace(' · ', ' ')}</td><td className="px-6 py-3">{entry.status}{selected?.id === entry.id && <><br /><span className="text-outline">Selected</span></>}</td><td className="px-6 py-3">Not submitted<br /><span className="text-outline">No provider ID supplied</span></td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No templates match these filters.</p>}</div>
        <p className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-outline"><span>{rows.length} of {data.messageTemplates.length} sample templates</span><span className="flex gap-3"><ActionButton onClick={() => setFilters({ q: '', category: '', channel: '', locale: '' })}>Clear filters</ActionButton><ActionButton onClick={create}>+ New template</ActionButton></span></p>
      </Section>

      {selected && <Editor key={selected.id} template={selected} onSave={(patch) => { update('messageTemplates', selected.id, patch); setSaved(`Saved ${selected.id} as v${patch.version}. It is a local draft and is not submitted to a provider.`) }} saved={saved} />}
      <p className="mb-6 text-xs"><Link to={ROUTES.channels} className="font-semibold text-brand hover:underline">Channel configuration → GO25</Link> · <Link to={ROUTES.workflows} className="font-semibold text-brand hover:underline">Back to workflows → GO27</Link></p>
      <GrowthFooter code="GO-23" back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27' }} />
    </GrowthFrame>
  )
}

function Editor({ template, onSave, saved }) {
  const [values, setValues] = useState({ name: template.name, locale: template.locale, channel: template.channel, body: template.body, reason: '' })
  const unknown = unknownVariables(values.body)
  const used = templateVariables(values.body)
  const changed = values.name !== template.name || values.locale !== template.locale || values.channel !== template.channel || values.body !== template.body
  const errors = { name: values.name.trim() ? undefined : 'Enter a display name.', body: !values.body.trim() ? 'Enter the message body.' : unknown.length ? `Unknown variable${unknown.length === 1 ? '' : 's'}: ${unknown.map((name) => `{{${name}}}`).join(', ')}` : undefined, reason: changed && !values.reason.trim() ? 'Give a change reason.' : undefined }
  const valid = !errors.name && !errors.body && !errors.reason && changed
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  return (
    <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Section title="Edit selected template" aside={`${template.id} · v${template.version} baseline`}>
        {saved && <Banner tone="brand" title={saved} className="mb-4" />}
        {changed && <StatusPill tone="warning" className="mb-3">Unsaved copy proposal</StatusPill>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><TextInput label="Display name · proposed edit" value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div><SelectInput label="Locale" required value={values.locale} onChange={(event) => set('locale', event.target.value)} options={LOCALES} /><SelectInput label="Channel format" required value={values.channel} onChange={(event) => set('channel', event.target.value)} options={CHANNEL_FORMATS} /></div>
        <div className="mt-4"><TextArea label="Message body · editable local copy" required rows={5} value={values.body} onChange={(event) => set('body', event.target.value)} error={errors.body} hint={`Allowed variables: ${TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(', ')}`} /></div>
        {changed && <div className="mt-4"><TextInput label="Change reason" required value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} /></div>}
        <div className="mt-4 flex gap-3"><ActionButton variant="brand" disabled={!valid} onClick={() => onSave({ name: values.name.trim(), locale: values.locale, channel: values.channel, body: values.body.trim(), version: template.version + 1 })}>Save as new version</ActionButton><ActionButton disabled={!changed} onClick={() => setValues({ name: template.name, locale: template.locale, channel: template.channel, body: template.body, reason: '' })}>Discard edits</ActionButton></div>
      </Section>
      <div className="space-y-6">
        <Section title="Message preview" aside="Synthetic values only"><StatusPill>{values.channel} proposed · {values.locale.split(' · ')[1]}</StatusPill><p className="mt-3 rounded-md bg-teal-50 p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-brand">Aura Health</strong>{renderTemplate(values.body, SAMPLE)}</p><p className="mt-3 text-[11px] text-outline">No recipient, phone, timestamp or delivery tick. Verify the clinic’s contact details before this wording is used.</p></Section>
        <Section title="Validation & approval" aside="Not send-ready"><ul className="space-y-2 text-xs"><li className={unknown.length ? 'text-danger' : 'text-brand'}>{unknown.length ? '✗' : '✓'} Variables: {used.length ? used.map((name) => `{{${name}}}`).join(', ') : 'none used'}</li><li className="text-amber-700">○ Provider template approval — not submitted</li><li className="text-amber-700">○ Channel setup — not verified</li></ul></Section>
      </div>
    </div>
  )
}
