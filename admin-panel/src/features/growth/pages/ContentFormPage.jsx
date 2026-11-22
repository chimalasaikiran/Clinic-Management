import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import LoadingState from '../../patients/components/LoadingState'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import MediaPreview from '../components/MediaPreview'
import { contentApi } from '../contentApi'
import { CONTENT_CATEGORIES, CONTENT_STATUSES, TARGETS } from '../contentView'
import { day } from '../format'
import { clinicNow, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

const MAX_BYTES = 5 * 1024 * 1024

function validate(values) {
  const errors = {}
  if (!values.title.trim()) errors.title = 'Enter a title.'
  if (!values.caption.trim()) errors.caption = 'Enter the caption.'
  if (!values.cta.trim()) errors.cta = 'Enter the call to action.'
  if (!/^https:\/\/\S+\.\S+$/.test(values.url.trim())) errors.url = 'Enter an https:// destination URL.'
  if (!values.altText.trim()) errors.altText = 'Add alt text describing the image or card.'
  if (!values.targets.length) errors.targets = 'Choose Facebook, Instagram or both.'
  if (!values.date) errors.date = 'Choose the intended date.'
  else if (values.date < clinicNow().date) errors.date = 'The intended date must not be in the past.'
  if (!values.time) errors.time = 'Choose the intended time.'
  return errors
}

export default function ContentFormPage() {
  const { contentId } = useParams()
  const post = useApiResource(() => (contentId ? contentApi.post(contentId) : Promise.resolve(null)), `content-form:${contentId ?? 'new'}`)
  const frame = { back: { to: ROUTES.content, label: 'Back to Content Calendar' }, crumb: 'Owner Panel / Growth OS / Content Calendar', code: 'GO-12', sample: 'Live records' }
  if (contentId && post.error?.status === 404) return <GrowthFrame {...frame} title="Content not found"><Banner tone="warning" title="No content matches this link">Open the Content Calendar to find the draft.</Banner></GrowthFrame>
  if (contentId && !post.data) return <GrowthFrame {...frame} title="Create/Edit Content"><LoadingState label="Loading the post…" error={post.error} onRetry={post.reload} /></GrowthFrame>
  return <ContentForm key={contentId ?? 'new'} item={post.data} />
}

function ContentForm({ item }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const context = useLeadContext()
  const owners = useApiResource(() => contentApi.owners(), 'content-owners').data ?? []
  const templates = useApiResource(() => contentApi.templates(), 'content-templates').data ?? []
  const template = !item ? templates.find((entry) => entry.id === params.get('template')) : null
  const at = item ? stampOf(item.scheduledAt) : null
  const [values, setValues] = useState({
    title: item?.title ?? '', category: item?.category ?? CONTENT_CATEGORIES[0], ownerMembershipId: item?.owner.membershipId ?? '', branchId: item?.branch.id ?? (context.branchId || context.branches[0]?.id || ''),
    caption: item?.caption ?? '', targets: item?.targets ?? ['facebook', 'instagram'], cta: item?.cta ?? '', url: item?.url ?? '', altText: item?.altText ?? '', date: at?.date ?? '', time: at?.time ?? '10:00', rightsReviewed: item?.rightsReviewed ?? false,
  })
  const [media, setMedia] = useState(item?.media ?? null)
  const [fromTemplate, setFromTemplate] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  // A template's copy fills an empty new draft once it has loaded.
  if (template && !fromTemplate) {
    setFromTemplate(true)
    setValues((current) => ({ ...current, title: current.title || template.title, category: template.category, caption: current.caption || template.body, cta: current.cta || template.cta, targets: template.targets }))
  }
  const errors = { ...(attempted ? validate(values) : {}), ...serverErrors }
  const owner = values.ownerMembershipId || owners[0]?.membershipId || ''
  const locked = item && item.status !== 'draft'
  const backPath = `${ROUTES.content}${state?.search ?? ''}`
  const branchName = context.branches.find((branch) => branch.id === values.branchId)?.name ?? item?.branch.name ?? ''
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }
  const toggle = (target) => set('targets', values.targets.includes(target) ? values.targets.filter((entry) => entry !== target) : [...values.targets, target])

  const upload = async (file) => {
    setMessage(null)
    if (!file) return
    if (file.size > MAX_BYTES) return setMessage({ tone: 'danger', title: 'Image too large', text: 'Use an image of at most 5 MB.' })
    setBusy(true)
    try {
      setMedia(await contentApi.uploadImage(file))
      setDirty(true)
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Image not uploaded', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const persist = async () => {
    setAttempted(true)
    setServerErrors({})
    if (Object.keys(validate(values)).length) return null
    setBusy(true)
    setMessage(null)
    const body = { ...values, title: values.title.trim(), caption: values.caption.trim(), cta: values.cta.trim(), url: values.url.trim(), altText: values.altText.trim(), ownerMembershipId: owner, mediaId: media?.id ?? null, templateId: item ? undefined : template?.id ?? null }
    try {
      const saved = item ? await contentApi.updatePost(item.id, { ...body, version: item.version }) : await contentApi.createPost(body)
      return saved.id
    } catch (error) {
      setServerErrors(error.fieldErrors?.() ?? {})
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
      setBusy(false)
      return null
    }
  }
  const saveDraft = async () => { if (await persist()) navigate(backPath, { state }) }
  const toSchedule = async () => { const id = await persist(); if (id) navigate(pathFor(ROUTES.contentSchedule, { contentId: id }), { state }) }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} crumb={`Owner Panel / Growth OS / Content Calendar / ${item ? `${item.code} / Edit draft` : 'New content'}`} code="GO-12" title="Create/Edit Content" description={item ? `Edit ${item.code}. Publishing needs submitting and a second person’s approval.` : 'Prepare a new post. Saving keeps a draft; nothing is published.'} context={[context.line, 'Calendar filters are kept on return']} today={context.today} sample="Live records · Drafts are saved; publishing needs a second person’s approval">
      {locked && <Banner tone="warning" title={`${CONTENT_STATUSES[item.status]} content is locked`} className="mb-6">Only a draft can be edited. Send it back to draft on the publishing screen to change it.</Banner>}
      {item?.reviewNote && item.status === 'draft' && <Banner tone="warning" title="Sent back by the reviewer" className="mb-6">{item.reviewNote}</Banner>}
      {template && <Banner tone="brand" title={`New from template · ${template.code} v${template.version}`} className="mb-6">The template’s copy is a starting point. Check the branch, networks, wording and image before saving.</Banner>}
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Content information" aside={`${item?.code ?? 'New'} · * Required`}>
            <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Title" required value={values.title} onChange={(event) => set('title', event.target.value)} error={errors.title} hint="Internal title and the card heading" /></div>
              <SelectInput label="Category" required value={values.category} onChange={(event) => set('category', event.target.value)} options={CONTENT_CATEGORIES} />
              <SelectInput label="Owner" required value={owner} onChange={(event) => set('ownerMembershipId', event.target.value)} options={owners.map((entry) => ({ value: entry.membershipId, label: entry.name }))} error={errors.ownerMembershipId} />
              <SelectInput label="Record branch" required value={values.branchId} onChange={(event) => set('branchId', event.target.value)} options={context.branches.map((branch) => ({ value: branch.id, label: branch.name }))} error={errors.branchId} />
              <div className="sm:col-span-2"><TextArea label="Caption" required rows={4} value={values.caption} onChange={(event) => set('caption', event.target.value)} error={errors.caption} hint="No outcome or suitability guarantees. The call to action and link are added after it." /></div>
              <fieldset className="sm:col-span-2"><legend className="text-xs font-medium text-on-surface-variant">Networks *</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(TARGETS).map(([id, label]) => <label key={id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', values.targets.includes(id) ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="checkbox" checked={values.targets.includes(id)} onChange={() => toggle(id)} className="accent-[#006a61]" />{label}</label>)}</div>{errors.targets && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.targets}</p>}<p className="mt-2 text-[11px] text-outline">Instagram needs an image.</p></fieldset>
            </fieldset>
          </Section>
          <Section title="CTA & destination" aside="Added to the caption">
            <fieldset disabled={locked} className="grid gap-4"><TextInput label="Call to action" required value={values.cta} onChange={(event) => set('cta', event.target.value)} error={errors.cta} /><TextInput label="Destination URL" required value={values.url} onChange={(event) => set('url', event.target.value)} error={errors.url} hint="https:// page the post points to" /></fieldset>
          </Section>
          <Section title="Media & accessibility" aside="No patient photos">
            <fieldset disabled={locked}>
              <label className="block text-xs font-medium text-on-surface-variant">Image · JPEG, PNG or WebP, at most 5 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])} className="mt-2 block w-full text-xs" /></label>
              {media && <p className="mt-2 flex items-center gap-3 text-xs">{media.fileName} · {Math.round(media.size / 1024)} KB<button type="button" onClick={() => { setMedia(null); setDirty(true) }} className="font-semibold text-brand hover:underline">Remove image</button></p>}
              <div className="mt-4"><TextArea label="Alt text" required rows={3} value={values.altText} onChange={(event) => set('altText', event.target.value)} error={errors.altText} hint="Describe the image. Do not show people or clinical outcomes." /></div>
              <div className="mt-3"><Check checked={values.rightsReviewed} onChange={(event) => set('rightsReviewed', event.target.checked)} label="We have the rights to use this image" /></div>
            </fieldset>
          </Section>
          <Section title="Publishing time" aside="Confirmed when submitting">
            <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2"><TextInput label="Intended date" required type="date" min={clinicNow().date} value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} hint={`From today, ${day(clinicNow().date)}`} /><TextInput label="Intended local time" required type="time" value={values.time} onChange={(event) => set('time', event.target.value)} error={errors.time} /></fieldset>
            <p className="mt-3 text-[11px] text-outline">Asia/Kolkata (UTC+05:30). The post is published at this time only once a second person approves it.</p>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Media preview" aside={media ? 'Uploaded image' : 'Text card'}><MediaPreview title={values.title} cta={values.cta} branch={branchName} category={values.category} imageSrc={media ? contentApi.imageUrl(media.id) : null} alt={values.altText} /><p className="mt-3 text-[11px] text-outline">{values.targets.map((target) => TARGETS[target]).join(' + ') || 'No network chosen'} · Each network shows it in its own layout.</p></Section>
          <Section title="Validation & readiness" aside="Two people">
            <p className="text-[13px] font-semibold text-brand">{Object.keys(validate(values)).length ? 'Required fields still need attention' : '✓ Required fields filled'}</p>
            {values.targets.includes('instagram') && !media && <p className="mt-2 text-xs text-amber-700">Add an image, or post to Facebook only: Instagram needs one.</p>}
            <Banner title="Approval binds to this exact post" className="mt-4">Editing a submitted post sends it back to draft, so the approval always covers what is published.</Banner>
          </Section>
          {leaving && <Banner tone="warning" title="Discard the unsaved changes?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Discard</ActionButton></div>}>Keep editing retains everything.</Banner>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save, then submit for review</strong>Saving keeps a draft. Continue opens the publishing screen to submit it.</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton disabled={locked || busy} onClick={saveDraft}>Save Draft</ActionButton>
        <ActionButton variant="brand" disabled={locked || busy} onClick={toSchedule}>Continue to Schedule/Publish →</ActionButton>
      </div>
      <GrowthFooter code="GO-12" back={{ to: backPath, label: 'Back to Content Calendar · GO11' }} />
    </GrowthFrame>
  )
}
