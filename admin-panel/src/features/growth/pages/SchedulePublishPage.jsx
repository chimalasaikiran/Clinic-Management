import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import MediaPreview from '../components/MediaPreview'
import { contentApi } from '../contentApi'
import { CONTENT_STATUSES, CONTENT_TONE, PUBLICATION_STATUSES, PUBLICATION_TONE, TARGETS, targetsLabel } from '../contentView'
import { day, when } from '../format'
import { clinicNow, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

export default function SchedulePublishPage() {
  const { contentId } = useParams()
  const resource = useApiResource(() => contentApi.post(contentId), `content:${contentId}`)
  // Kept here: each change reloads the post, which rebuilds the screen below.
  const [message, setMessage] = useState(null)
  const frame = { back: { to: ROUTES.content, label: 'Back to Content Calendar' }, crumb: 'Owner Panel / Growth OS / Content Calendar', sample: 'Live records' }
  if (resource.error?.status === 404) return <GrowthFrame {...frame} title="Content not found"><Banner tone="warning" title="No content matches this link">Open the Content Calendar to find the draft.</Banner></GrowthFrame>
  if (!resource.data) return <GrowthFrame {...frame} title="Schedule/Publish"><LoadingState label="Loading the post…" error={resource.error} onRetry={resource.reload} /></GrowthFrame>
  return <Schedule key={`${contentId}:${resource.data.version}`} item={resource.data} reload={resource.reload} message={message} setMessage={setMessage} />
}

function Schedule({ item, reload, message, setMessage }) {
  const { state } = useLocation()
  const { can, user } = useAuth()
  const context = useLeadContext()
  const at = stampOf(item.scheduledAt)
  const [when_, setWhen] = useState({ date: at.date, time: at.time })
  const [checks, setChecks] = useState({ rights: item.rightsReviewed, wording: false })
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)
  const manage = can('growth.manage')
  const mine = item.submittedById === user?.id
  const editPath = pathFor(ROUTES.contentEdit, { contentId: item.id })
  const backPath = `${ROUTES.content}${state?.search ?? ''}`
  const past = when_.date < clinicNow().date
  const run = async (call, success) => {
    setBusy(true)
    setMessage(null)
    try {
      await call()
      setMessage(success ? { tone: 'brand', title: success } : null)
      reload()
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not done', text: error.message })
      setBusy(false)
    }
  }
  const unknown = item.publications.filter((entry) => entry.status === 'unknown')

  return (
    <GrowthFrame back={{ to: item.status === 'draft' ? editPath : backPath, label: item.status === 'draft' ? 'Back to edit draft' : 'Back to Content Calendar' }} crumb={`Owner Panel / Growth OS / Content Calendar / ${item.code} / Publishing`} title="Schedule/Publish" description={`Submit ${item.code}, have a second person approve it, and follow what each network reports.`} badge={<StatusPill tone={CONTENT_TONE[item.status]}>{CONTENT_STATUSES[item.status]}</StatusPill>} context={[context.line, 'Calendar filters are kept on return']} today={context.today} sample="Live records · Publishing uses the connected Facebook Page and Instagram account">
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      {!item.readiness.metaConnected && <Banner tone="warning" title="No Facebook Page is connected" className="mb-6">Posts can be drafted and submitted, but not approved until an administrator connects Meta on the Channels screen.</Banner>}
      {item.media && !item.readiness.publicUrlReady && <Banner tone="warning" title="Images cannot reach Meta yet" className="mb-6">Set PUBLIC_API_URL in backend.env so Meta can fetch the image when publishing.</Banner>}
      <Section title="Final content preview" aside={`${item.code} · exactly what is published`} className="mb-6">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div><MediaPreview title={item.title} cta={item.cta} branch={item.branch.name} category={item.category} imageSrc={item.media ? contentApi.imageUrl(item.media.id) : null} alt={item.altText} /><p className="mt-3 text-[11px] leading-4 text-outline">Alt text: {item.altText}</p></div>
          <div className="text-xs"><p className="text-[13px] font-semibold text-brand">{item.title}</p><p className="mt-3 whitespace-pre-line leading-5">{item.caption}{'\n\n'}{item.cta}: {item.url}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2"><KeyValue label="Branch">{item.branch.name}</KeyValue><KeyValue label="Owner / category">{item.owner.name} · {item.category}</KeyValue><KeyValue label="Networks" className="sm:col-span-2">{targetsLabel(item.targets)}</KeyValue><KeyValue label="Publishes">{when(at)}</KeyValue><KeyValue label="Submitted / approved">{item.submittedBy ?? '—'} · {item.approvedBy ?? '—'}</KeyValue></dl></div>
        </div>
      </Section>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        {item.status === 'draft' && (
          <Section title="Submit for review" aside="Step 1 of 2">
            {item.reviewNote && <Banner tone="warning" title="Sent back by the reviewer" className="mb-4">{item.reviewNote}</Banner>}
            <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Publish on" required type="date" min={clinicNow().date} value={when_.date} onChange={(event) => setWhen((current) => ({ ...current, date: event.target.value }))} error={past ? 'Choose today or later.' : undefined} /><TextInput label="At · IST" required type="time" value={when_.time} onChange={(event) => setWhen((current) => ({ ...current, time: event.target.value }))} /></div>
            <div className="mt-4 space-y-3"><Check checked={checks.rights} onChange={(event) => setChecks((current) => ({ ...current, rights: event.target.checked }))} label="We have the rights to use the image" /><Check checked={checks.wording} onChange={(event) => setChecks((current) => ({ ...current, wording: event.target.checked }))} label="The wording promises no results and contains no patient detail" /></div>
            <div className="mt-4 flex gap-3">{manage && <ActionButton variant="brand" disabled={busy || past || !checks.rights || !checks.wording} onClick={() => run(() => contentApi.submitPost(item.id, { date: when_.date, time: when_.time, rightsReviewed: true, version: item.version }), 'Submitted. A different person must now approve it.')}>Submit for review</ActionButton>}<ActionButton to={editPath} state={state}>Edit draft</ActionButton></div>
          </Section>
        )}
        {item.status === 'in_review' && (
          <Section title="Second-person review" aside="Step 2 of 2">
            <p className="text-xs leading-5">Submitted by {item.submittedBy} {when(stampOf(item.submittedAt))}, to publish {when(at)} on {targetsLabel(item.targets)}.</p>
            {mine ? <Banner tone="brand" title="Waiting for someone else to review" className="mt-4">You submitted this post, so a different person with “Run campaigns” must approve it.</Banner> : manage ? (
              <>
                <div className="mt-4"><TextArea label="Note to the author" rows={2} value={note} onChange={(event) => setNote(event.target.value)} hint="Required when sending it back" /></div>
                <div className="mt-4 flex flex-wrap gap-3"><ActionButton variant="brand" disabled={busy || !item.readiness.metaConnected} onClick={() => run(() => contentApi.decidePost(item.id, { decision: 'approve', note: note.trim() || null, version: item.version }), `Approved. It publishes ${when(at)}.`)}>Approve & schedule</ActionButton><ActionButton disabled={busy || !note.trim()} onClick={() => run(() => contentApi.decidePost(item.id, { decision: 'reject', note: note.trim(), version: item.version }), 'Sent back to draft with your note.')}>Send back to draft</ActionButton></div>
              </>
            ) : <p className="mt-4 text-xs text-outline">Reviewing needs “Run campaigns & patient messaging”.</p>}
          </Section>
        )}
        {['scheduled', 'publishing', 'published', 'failed'].includes(item.status) && (
          <Section title="Networks" aside={CONTENT_STATUSES[item.status]}>
            {item.status === 'scheduled' && <p className="mb-3 text-xs">Approved by {item.approvedBy}. Publishes {when(at)}.</p>}
            <ul className="divide-y divide-slate-100 text-xs">{item.publications.map((publication) => (
              <li key={publication.target} className="py-3">
                <p className="flex items-center justify-between"><strong className="text-[13px]">{TARGETS[publication.target]}</strong><StatusPill tone={PUBLICATION_TONE[publication.status]}>{PUBLICATION_STATUSES[publication.status]}</StatusPill></p>
                {publication.publishedAt && <p className="mt-1 text-outline">Published {when(stampOf(publication.publishedAt))}{publication.permalink && <> · <a href={publication.permalink} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">View post</a></>}</p>}
                {publication.errorMessage && publication.status !== 'published' && <p className="mt-1 text-rose-700">{publication.errorMessage}</p>}
              </li>))}</ul>
            {manage && unknown.length > 0 && (
              <div className="mt-4 rounded-md bg-amber-50 p-3 text-xs">
                <p className="font-semibold">Check the Page or account first</p><p className="mt-1">ClinicOS could not tell whether {unknown.map((entry) => TARGETS[entry.target]).join(' and ')} published. Record what it shows; it is never resent blindly.</p>
                <div className="mt-3"><TextInput label="What the Page or account shows" value={resolution} onChange={(event) => setResolution(event.target.value)} /></div>
                <div className="mt-3 flex gap-2">{unknown.map((entry) => <span key={entry.target} className="flex gap-2"><ActionButton disabled={busy || !resolution.trim()} onClick={() => run(() => contentApi.resolvePublication(item.id, entry.target, { outcome: 'published', note: resolution.trim() }), 'Recorded.')}>{TARGETS[entry.target]}: it is published</ActionButton><ActionButton disabled={busy || !resolution.trim()} onClick={() => run(() => contentApi.resolvePublication(item.id, entry.target, { outcome: 'failed', note: resolution.trim() }), 'Recorded.')}>It is not</ActionButton></span>)}</div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {manage && item.status === 'failed' && !unknown.length && <ActionButton variant="brand" disabled={busy} onClick={() => run(() => contentApi.retryPost(item.id, item.version), 'Retrying the networks that failed.')}>Retry failed networks</ActionButton>}
              {manage && ['scheduled', 'failed'].includes(item.status) && !item.publications.some((entry) => ['published', 'unknown'].includes(entry.status)) && <ActionButton disabled={busy} onClick={() => run(() => contentApi.withdrawPost(item.id, item.version), 'Returned to draft.')}>Return to draft</ActionButton>}
            </div>
          </Section>
        )}
        <Section title="History" aside="Append only">
          <ul className="space-y-2 text-xs">{item.events.map((event) => <li key={event.id}><strong>{when(stampOf(event.createdAt))}</strong> · {event.text} <span className="text-outline">{event.actor ?? 'ClinicOS'}</span></li>)}</ul>
        </Section>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">{CONTENT_STATUSES[item.status]}</strong>Planned for {day(at.date)} · {at.time} IST.</p>
        <ActionButton to={backPath} state={state}>Back to calendar</ActionButton>
      </div>
      <GrowthFooter back={{ to: backPath, label: 'Back to Content Calendar' }} />
    </GrowthFrame>
  )
}
