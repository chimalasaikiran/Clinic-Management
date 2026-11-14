import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import MediaPreview from '../components/MediaPreview'
import { GROWTH_TODAY } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { validateContent } from '../growthLogic'

export default function SchedulePublishPage() {
  const { contentId } = useParams()
  const { data } = useGrowth()
  const item = data.content.find((entry) => entry.id === contentId)
  if (!item) {
    return (
      <GrowthFrame back={{ to: ROUTES.content, label: 'Back to Content Calendar' }} crumb="Owner Panel / Growth OS / Content Calendar" code="GO-14" title="Content not found">
        <Banner tone="warning" title="No content matches this link">Open the Content Calendar to find the draft.</Banner>
      </GrowthFrame>
    )
  }
  return <Schedule key={contentId} item={item} />
}

function Schedule({ item }) {
  const { update } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [when, setWhen] = useState({ date: item.date, time: item.time })
  const [checks, setChecks] = useState({ rights: item.rightsReviewed, approval: false, permission: false })
  const [submitted, setSubmitted] = useState(['Needs review', 'Scheduled', 'Published'].includes(item.status))
  const problems = validateContent({ ...item, ...when })
  const textReady = !problems.title && !problems.caption && !problems.cta && !problems.url && !problems.alt
  const ready = textReady && !problems.date && !problems.time && checks.rights && checks.approval && checks.permission
  const editPath = pathFor(ROUTES.contentEdit, { contentId: item.id })
  const backPath = `${ROUTES.content}${state?.search ?? ''}`

  const submit = () => {
    update('content', item.id, { date: when.date, time: when.time, rightsReviewed: checks.rights, status: item.status === 'Draft' ? 'Needs review' : item.status })
    setSubmitted(true)
  }

  return (
    <GrowthFrame back={{ to: editPath, label: 'Back to edit draft · GO12 · Data retained' }} crumb={`Owner Panel / Growth OS / Content Calendar / ${item.id} / Schedule review`} code="GO-14" title="Schedule/Publish" description={`Review ${item.id}’s exact draft proposal. Scheduling and publishing stay blocked until a provider connection is verified.`} badge={<StatusPill tone={submitted ? 'success' : 'warning'}>{submitted ? `${item.status} · submitted for review` : 'Draft · not submitted'}</StatusPill>} context={['Calendar origin · Month view · Jubilee Hills Clinic', 'Date, view and filters are kept on return']}>
      <Banner tone="warning" title="Blocked · Approval, publishing permission and provider authorization are not verified" className="mb-6">{item.channels} have no verified connection. A review request records your intent only; no delivery or publication is confirmed.</Banner>
      <Section title="Final content preview" aside={`${item.id} · Same entered GO12 snapshot`} className="mb-6">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div><MediaPreview title={item.title} cta={item.cta} branch={item.branch} category={item.category} /><p className="mt-3 text-[11px] leading-4 text-outline">Alt text: {item.alt}</p></div>
          <div className="text-xs"><p className="text-[13px] font-semibold text-brand">{item.title}</p><p className="mt-3 leading-5">{item.caption}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2"><KeyValue label="Branch">{item.branch}</KeyValue><KeyValue label="Owner / category">{item.owner} · {item.category}</KeyValue><KeyValue label="Planned channels" hint={`${item.type} · formatting only, no verified connector`} className="sm:col-span-2">{item.channels}</KeyValue><KeyValue label="CTA" className="sm:col-span-2">{item.cta}</KeyValue></dl>
            <p className="mt-4 text-[11px] text-outline">Destination: {item.url}. Sample draft URL, not a verified live page.</p></div>
        </div>
        <Banner className="mt-5" title="Recipient eligibility is not applicable to this organic public post">Content type determines this exception; it is not a consent waiver. Targeted messaging needs separate verified channel consent, preferences, DND and suppression checks.</Banner>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Section title="Schedule proposal" aside="Intent only">
          <div className="mb-4 flex gap-3"><span className="rounded border border-brand bg-teal-50 px-4 py-2 text-[13px] font-semibold text-brand">Schedule · selected</span><button type="button" disabled className="flex items-center gap-2 rounded border border-slate-200 bg-surface-low px-4 py-2 text-[13px] font-semibold text-outline"><Lock className="size-3.5" aria-hidden="true" />Publish now</button></div>
          <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Intended date" required type="date" min={GROWTH_TODAY} value={when.date} onChange={(event) => setWhen((current) => ({ ...current, date: event.target.value }))} error={problems.date} /><TextInput label="Intended local time" required type="time" value={when.time} onChange={(event) => setWhen((current) => ({ ...current, time: event.target.value }))} error={problems.time} /></div>
          <p className="mt-3 text-xs text-on-surface-variant">{day(when.date)} · {when.time} Asia/Kolkata (UTC+05:30). Provider capability and cut-off cannot be checked without a connection.</p>
        </Section>
        <Section title="Readiness checklist" aside={ready ? 'Ready to submit' : 'Not ready to submit'}>
          <p className={`text-xs font-semibold ${textReady ? 'text-brand' : 'text-amber-700'}`}>{textReady ? '✓ Required text and intent populated' : 'Required text is missing — return to edit'}</p>
          <div className="mt-3 space-y-3"><Check checked={checks.rights} onChange={(event) => setChecks((current) => ({ ...current, rights: event.target.checked }))} label="Asset rights and approval reviewed" /><Check checked={checks.approval} onChange={(event) => setChecks((current) => ({ ...current, approval: event.target.checked }))} label="Clinical approval recorded for this exact snapshot" /><Check checked={checks.permission} onChange={(event) => setChecks((current) => ({ ...current, permission: event.target.checked }))} label={`Verify content-publish permission for ${item.branch}`} /></div>
          <p className="mt-3 text-[11px] text-outline">Provider connection: not verified — scheduling and publishing remain blocked.</p>
        </Section>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{submitted ? 'Submitted for internal review' : 'Request internal review'}</strong>{submitted ? 'No provider delivery is confirmed. The calendar shows this item as Needs review.' : 'Submitting moves the draft to Needs review; it does not schedule or publish.'}</p>
        <ActionButton onClick={() => navigate(submitted ? backPath : editPath, { state })}>{submitted ? 'Back to calendar' : 'Back to edit'}</ActionButton>
        <ActionButton variant="brand" disabled={!ready || submitted} onClick={submit}>Submit for review</ActionButton>
      </div>
      <GrowthFooter code="GO-14" back={{ to: editPath, label: 'Back to edit draft · GO12 · Data retained' }} />
    </GrowthFrame>
  )
}
