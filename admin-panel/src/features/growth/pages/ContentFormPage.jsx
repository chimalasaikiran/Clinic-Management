import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import MediaPreview from '../components/MediaPreview'
import { CONTENT_CATEGORIES, CONTENT_CHANNELS, CONTENT_TYPES, GROWTH_BRANCHES, GROWTH_TODAY, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { validateContent } from '../growthLogic'

export default function ContentFormPage() {
  const { contentId } = useParams()
  const { data } = useGrowth()
  const item = contentId ? data.content.find((entry) => entry.id === contentId) : null
  if (contentId && !item) {
    return (
      <GrowthFrame back={{ to: ROUTES.content, label: 'Back to Content Calendar' }} crumb="Owner Panel / Growth OS / Content Calendar" code="GO-12" title="Content not found">
        <Banner tone="warning" title="No content matches this link">Open the Content Calendar to find the draft.</Banner>
      </GrowthFrame>
    )
  }
  return <ContentForm key={contentId ?? 'new'} item={item} />
}

function ContentForm({ item }) {
  const { data, add, update, newId } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const template = data.contentTemplates.find((entry) => entry.id === params.get('template'))
  const [values, setValues] = useState({
    title: item?.title ?? template?.title ?? '', category: item?.category ?? template?.category ?? CONTENT_CATEGORIES[0], owner: item?.owner ?? OWNERS[0], branch: item?.branch ?? GROWTH_BRANCHES[0], type: item?.type ?? CONTENT_TYPES[0],
    caption: item?.caption ?? template?.body ?? '', channels: item?.channels ?? template?.channels ?? CONTENT_CHANNELS[2], cta: item?.cta ?? template?.cta ?? '', url: item?.url ?? '', alt: item?.alt ?? '', date: item?.date ?? '', time: item?.time ?? '10:00', rightsReviewed: item?.rightsReviewed ?? false, scope: false,
  })
  const [attempted, setAttempted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const errors = attempted ? validateContent(values) : {}
  const backPath = `${ROUTES.content}${state?.search ?? ''}`
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }
  const locked = item && ['Scheduled', 'Published'].includes(item.status)

  const persist = () => {
    setAttempted(true)
    if (Object.keys(validateContent(values)).length || !values.scope) return null
    const fields = { title: values.title.trim(), category: values.category, owner: values.owner, branch: values.branch, type: values.type, caption: values.caption.trim(), channels: values.channels, cta: values.cta.trim(), url: values.url.trim(), alt: values.alt.trim(), date: values.date, time: values.time, rightsReviewed: values.rightsReviewed }
    if (item) { update('content', item.id, fields); return item.id }
    const id = newId('CNT', 'content')
    add('content', { id, status: 'Draft', templateId: template?.id ?? null, ...fields })
    return id
  }
  const saveDraft = () => { if (persist()) navigate(backPath, { state }) }
  const toSchedule = () => { const id = persist(); if (id) navigate(pathFor(ROUTES.contentSchedule, { contentId: id }), { state }) }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} crumb={`Owner Panel / Growth OS / Content Calendar / ${item ? `${item.id} / Edit draft` : 'New content'}`} code="GO-12" title="Create/Edit Content" description={item ? `Edit ${item.status} ${item.id}. Prepare the creative and retain your calendar context. Publishing is a separate reviewed action.` : 'Prepare new content. Saving keeps an internal draft; publishing is a separate reviewed action.'} context={['Calendar origin · Month view · Jubilee Hills Clinic', 'Date, view and filters are kept on return']}>
      {locked && <Banner tone="warning" title={`${item.status} content is locked`} className="mb-6">Editing a {item.status.toLowerCase()} item is blocked. Create a new draft from it instead.</Banner>}
      {template && !item && <Banner tone="brand" title={`New from template · ${template.id} v${template.version}`} className="mb-6">A separate unsaved draft was created from this template. Recheck branch, channels, copy, rights and clinical approval before saving.</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Content information" aside={`${item?.id ?? 'New'} · * Required`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Title" required disabled={locked} value={values.title} onChange={(event) => set('title', event.target.value)} error={errors.title} hint="Internal title and creative heading" /></div>
              <SelectInput label="Category" required disabled={locked} value={values.category} onChange={(event) => set('category', event.target.value)} options={CONTENT_CATEGORIES} />
              <SelectInput label="Owner" required disabled={locked} value={values.owner} onChange={(event) => set('owner', event.target.value)} options={OWNERS} hint="Assignment requires branch scope" />
              <SelectInput label="Record branch" required disabled={locked} value={values.branch} onChange={(event) => set('branch', event.target.value)} options={GROWTH_BRANCHES} />
              <SelectInput label="Content type" required disabled={locked} value={values.type} onChange={(event) => set('type', event.target.value)} options={CONTENT_TYPES} hint={values.type === 'Organic public post' ? 'No recipient audience selected' : 'Targeted outreach needs separate consent and suppression checks'} />
              <div className="sm:col-span-2"><TextArea label="Caption" required rows={4} disabled={locked} value={values.caption} onChange={(event) => set('caption', event.target.value)} error={errors.caption} hint="Clinical wording review pending; no outcome or suitability guarantee" /></div>
              <div className="sm:col-span-2"><SelectInput label="Planned channels" required disabled={locked} value={values.channels} onChange={(event) => set('channels', event.target.value)} options={CONTENT_CHANNELS} hint="Formatting compatibility only; connector and authorization are not verified" /></div>
            </div>
          </Section>
          <Section title="CTA & destination" aside="Draft proposal">
            <div className="grid gap-4"><TextInput label="Call to action" required disabled={locked} value={values.cta} onChange={(event) => set('cta', event.target.value)} error={errors.cta} /><TextInput label="Destination URL" required disabled={locked} value={values.url} onChange={(event) => set('url', event.target.value)} error={errors.url} hint="HTTPS format only · live page, domain and destination content are unverified" /></div>
          </Section>
          <Section title="Media & accessibility" aside="Designed graphic · no patient photos">
            <TextArea label="Alt text" required rows={3} disabled={locked} value={values.alt} onChange={(event) => set('alt', event.target.value)} error={errors.alt} hint="Describe the graphic. Do not depict people or clinical outcomes." />
            <div className="mt-3"><Check checked={values.rightsReviewed} disabled={locked} onChange={(event) => set('rightsReviewed', event.target.checked)} label="Asset rights and approval reviewed" /></div>
          </Section>
          <Section title="Schedule intent" aside="Not submitted or booked">
            <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Intended date" required type="date" min={GROWTH_TODAY} disabled={locked} value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} hint={`After sample today, ${day(GROWTH_TODAY)}`} /><TextInput label="Intended local time" required type="time" disabled={locked} value={values.time} onChange={(event) => set('time', event.target.value)} error={errors.time} /></div>
            <p className="mt-3 text-[11px] text-outline">Timezone Asia/Kolkata (UTC+05:30). Intent is not an acknowledged schedule; provider capability and cut-off are checked in GO14.</p>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Media preview" aside="Draft asset"><MediaPreview title={values.title} cta={values.cta} branch={values.branch} category={values.category} /><p className="mt-3 text-[11px] text-outline">{values.channels} · Sample layout, not a provider-rendered preview</p></Section>
          <Section title="Validation & readiness" aside="Save gated">
            <p className="text-[13px] font-semibold text-brand">{Object.keys(validateContent(values)).length ? 'Required fields still need attention' : '✓ Required text and intent populated'}</p>
            <div className="mt-3"><Check checked={values.scope} onChange={(event) => set('scope', event.target.checked)} label={`Verify content-write + ${values.branch} scope`} /></div>
            <Banner tone="warning" title="Clinical approval pending" className="mt-4">Caption, example URL and media require review. Approval must bind to the exact content snapshot; edits invalidate approval.</Banner>
            <Banner tone="warning" title="INTEGRATION DEPENDENT" className="mt-3">No verified connection or authorization for the planned channels. No send or schedule request is allowed.</Banner>
          </Section>
          {leaving && <Banner tone="warning" title="Discard the caption/media proposal?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Review discard</ActionButton></div>}>Keep editing retains everything. Discard requires explicit review.</Banner>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Review now; persistence and publishing are separate</strong>Saving stores an internal proposal only. Continue opens Schedule/Publish with this exact snapshot.</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton disabled={locked || !values.scope} onClick={saveDraft}>Save Draft</ActionButton>
        <ActionButton variant="brand" disabled={locked || !values.scope} onClick={toSchedule}>Continue to Schedule/Publish →</ActionButton>
      </div>
      <GrowthFooter code="GO-12" back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} />
    </GrowthFrame>
  )
}
