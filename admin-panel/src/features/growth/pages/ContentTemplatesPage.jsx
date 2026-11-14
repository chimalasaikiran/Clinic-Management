import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CONTENT_CATEGORIES, CONTENT_CHANNELS } from '../constants'
import { useGrowth } from '../context/growthContext'

export default function ContentTemplatesPage() {
  const { data } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [channel, setChannel] = useState('')
  const [previewId, setPreviewId] = useState(data.contentTemplates[0]?.id)
  const needle = query.trim().toLowerCase()
  const templates = data.contentTemplates.filter((template) => (!category || template.category === category) && (!channel || template.channels.includes(channel)) && (!needle || `${template.title} ${template.category} ${template.id}`.toLowerCase().includes(needle)))
  const backPath = `${ROUTES.content}${state?.search ?? ''}`

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} crumb="Owner Panel / Growth OS / Templates" code="GO-13" title="Content Templates" description="Start with editable clinic copy, not a publishing approval. Every template requires branch and clinical review." actions={<ActionButton to={ROUTES.contentNew} state={state}>Return to edit · GO12</ActionButton>} context={['Calendar origin · Month view · Jubilee Hills Clinic', 'Date, view and filters are kept on return']}>
      <Section title="Browse templates" aside={`${templates.length} of ${data.contentTemplates.length} templates`} className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2"><SearchBox value={query} onChange={setQuery} label="Search templates" placeholder="Search title, category or template ID" /><FilterField label="" value={channel} onChange={setChannel} options={[['', 'All channels'], ...CONTENT_CHANNELS]} /></div>
        <div role="tablist" aria-label="Category" className="mt-4 flex flex-wrap gap-2">{[['', 'All templates'], ...CONTENT_CATEGORIES.map((entry) => [entry, entry])].map(([id, label]) => <button key={label} type="button" role="tab" aria-selected={category === id} onClick={() => setCategory(id)} className={cn('rounded border px-3.5 py-2 text-[13px] font-medium', category === id ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-brand')}>{label}{category === id ? ' · selected' : ''}</button>)}</div>
      </Section>
      <Banner tone="warning" title="Formatting compatibility only · Not clinical endorsement or publishing authorization" className="mb-6">Templates do not verify provider connection, patient consent or offer eligibility. Offers require locally approved terms and valid dates. Health claims must not auto-publish.</Banner>
      <div className="mb-6 grid gap-5 md:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className={cn('overflow-hidden rounded-md border bg-white', previewId === template.id ? 'border-brand' : 'border-slate-200')}>
            <div className={cn('p-6', previewId === template.id ? 'bg-teal-50' : 'bg-surface-low')}><p className="flex justify-between text-[11px] font-semibold tracking-wide text-brand uppercase"><span>Aura Health</span><span className="font-normal text-outline">Sample draft</span></p><div className="my-3 h-0.5 w-8 bg-brand" /><p className="text-2xl leading-7 font-semibold">{template.title}</p><p className="mt-4 text-xs text-outline">{template.category}</p></div>
            <div className="p-5 text-xs"><p className="flex items-center justify-between"><strong className="text-brand">{template.id} · v{template.version}</strong>{previewId === template.id && <StatusPill tone="success">Preview selected</StatusPill>}</p><p className="mt-3 text-[13px] font-semibold">{template.title}</p><p className="mt-2 leading-5 text-on-surface-variant">{template.body}</p><p className="mt-3 text-outline">Compatible formats: {template.channels}</p><StatusPill tone="warning" className="mt-3">Draft · Clinical approval pending</StatusPill>
              <div className="mt-4 flex gap-3"><ActionButton onClick={() => setPreviewId(template.id)}>Preview</ActionButton><ActionButton variant="brand" onClick={() => navigate(`${ROUTES.contentNew}?template=${template.id}`, { state })}>Use template → GO12</ActionButton></div></div>
          </article>))}
      </div>
      {templates.length === 0 && <p className="mb-6 rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-sm text-on-surface-variant">No templates match these filters.</p>}
      <GrowthFooter code="GO-13" back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} />
    </GrowthFrame>
  )
}
