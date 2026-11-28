import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { contentApi } from '../contentApi'
import { CONTENT_CATEGORIES, TARGETS, targetsLabel } from '../contentView'
import { useLeadContext } from '../useLeads'

const blank = () => ({ title: '', category: CONTENT_CATEGORIES[0], body: '', cta: '', targets: ['facebook', 'instagram'] })

export default function ContentTemplatesPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const navigate = useNavigate()
  const { state } = useLocation()
  const templates = useApiResource(() => contentApi.templates(), 'content-templates')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [target, setTarget] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [editing, setEditing] = useState(null)
  const all = (templates.data ?? []).filter((template) => !template.archived)
  const needle = query.trim().toLowerCase()
  const shown = all.filter((template) => (!category || template.category === category) && (!target || template.targets.includes(target)) && (!needle || `${template.title} ${template.category} ${template.code}`.toLowerCase().includes(needle)))
  const backPath = `${ROUTES.content}${state?.search ?? ''}`
  const manage = can('growth.manage')

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Content Calendar' }} crumb="Owner Panel / Growth OS / Templates" title="Content Templates" description="Start a post from approved clinic copy. A template is a starting point; every post is still reviewed by a second person." actions={<>{manage && <ActionButton onClick={() => setEditing(blank())}>New template</ActionButton>}<ActionButton to={ROUTES.contentNew} state={state}>Return to edit</ActionButton></>} context={[context.line, 'Calendar filters are kept on return']} today={context.today} sample="Live records · Saving a template moves its version on; posts keep the version they started from">
      {editing && <TemplateEditor key={editing.id ?? 'new'} template={editing} onDone={() => { setEditing(null); templates.reload() }} onCancel={() => setEditing(null)} />}
      <Section title="Browse templates" aside={`${shown.length} of ${all.length} templates`} className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2"><SearchBox value={query} onChange={setQuery} label="Search templates" placeholder="Search title, category or code" /><FilterField label="" value={target} onChange={setTarget} options={[['', 'All networks'], ...Object.entries(TARGETS)]} /></div>
        <div role="tablist" aria-label="Category" className="mt-4 flex flex-wrap gap-2">{[['', 'All templates'], ...CONTENT_CATEGORIES.map((entry) => [entry, entry])].map(([id, label]) => <button key={label} type="button" role="tab" aria-selected={category === id} onClick={() => setCategory(id)} className={cn('rounded border px-3.5 py-2 text-[13px] font-medium', category === id ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-brand')}>{label}{category === id ? ' · selected' : ''}</button>)}</div>
      </Section>
      <Banner title="Templates do not approve anything" className="mb-6">Offers need locally approved terms and valid dates. Health claims and suitability promises must not appear in templates.</Banner>
      {!templates.data ? <LoadingState label="Loading templates…" error={templates.error} onRetry={templates.reload} /> : (
        <div className="mb-6 grid gap-5 md:grid-cols-2">
          {shown.map((template) => (
            <article key={template.id} className={cn('overflow-hidden rounded-md border bg-white', previewId === template.id ? 'border-brand' : 'border-slate-200')}>
              <div className={cn('p-6', previewId === template.id ? 'bg-teal-50' : 'bg-surface-low')}><p className="flex justify-between text-[11px] font-semibold tracking-wide text-brand uppercase"><span>{template.category}</span><span className="font-normal text-outline">v{template.version}</span></p><div className="my-3 h-0.5 w-8 bg-brand" /><p className="text-2xl leading-7 font-semibold">{template.title}</p></div>
              <div className="p-5 text-xs"><p className="flex items-center justify-between"><strong className="text-brand">{template.code} · v{template.version}</strong>{previewId === template.id && <StatusPill tone="success">Preview selected</StatusPill>}</p><p className="mt-3 leading-5 text-on-surface-variant">{template.body}</p><p className="mt-2 font-semibold">{template.cta} →</p><p className="mt-3 text-outline">For {targetsLabel(template.targets)} · updated by {template.updatedBy ?? '—'}</p>
                <div className="mt-4 flex flex-wrap gap-3"><ActionButton onClick={() => setPreviewId(template.id)}>Preview</ActionButton>{manage && <ActionButton onClick={() => setEditing(template)}>Edit</ActionButton>}{manage && <ActionButton variant="brand" onClick={() => navigate(`${ROUTES.contentNew}?template=${template.id}`, { state })}>Use template →</ActionButton>}</div></div>
            </article>))}
        </div>
      )}
      {templates.data && shown.length === 0 && <p className="mb-6 rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-sm text-on-surface-variant">{all.length ? 'No templates match these filters.' : 'No templates yet.'}</p>}
      <GrowthFooter back={{ to: backPath, label: 'Back to Content Calendar' }} />
    </GrowthFrame>
  )
}

function TemplateEditor({ template, onDone, onCancel }) {
  const [values, setValues] = useState({ title: template.title, category: template.category, body: template.body, cta: template.cta, targets: template.targets })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const save = async (archived = false) => {
    setBusy(true)
    setError(null)
    try {
      if (template.id) await contentApi.updateTemplate(template.id, { ...values, archived, version: template.version })
      else await contentApi.createTemplate(values)
      onDone()
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }
  return (
    <Section title={template.id ? `Edit ${template.code}` : 'New template'} aside={template.id ? `Saves as v${template.version + 1}` : 'Starts at v1'} className="mb-6">
      {error && <Banner tone="danger" title={error} className="mb-4" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Title" required value={values.title} onChange={(event) => set('title', event.target.value)} />
        <SelectInput label="Category" required value={values.category} onChange={(event) => set('category', event.target.value)} options={CONTENT_CATEGORIES} />
        <div className="sm:col-span-2"><TextArea label="Template copy" required rows={3} value={values.body} onChange={(event) => set('body', event.target.value)} /></div>
        <TextInput label="Call to action" required value={values.cta} onChange={(event) => set('cta', event.target.value)} />
        <fieldset><legend className="text-xs font-medium text-on-surface-variant">Networks</legend><div className="mt-2 flex gap-2">{Object.entries(TARGETS).map(([id, label]) => <label key={id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={values.targets.includes(id)} onChange={() => set('targets', values.targets.includes(id) ? values.targets.filter((entry) => entry !== id) : [...values.targets, id])} />{label}</label>)}</div></fieldset>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><ActionButton variant="brand" disabled={busy || !values.title.trim() || !values.body.trim() || !values.cta.trim() || !values.targets.length} onClick={() => save(false)}>Save template</ActionButton>{template.id && <ActionButton disabled={busy} onClick={() => save(true)}>Archive</ActionButton>}<ActionButton onClick={onCancel}>Cancel</ActionButton></div>
    </Section>
  )
}
