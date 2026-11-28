import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { ESCALATION_STATUSES, privacyFindings, RESPONSE_STATES, RESPONSE_TONE, SEVERITIES, stars } from '../contentView'
import { when } from '../format'
import { clinicNow, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

export default function ReviewDetailPage() {
  const { reviewId } = useParams()
  const resource = useApiResource(() => contentApi.review(reviewId), `review:${reviewId}`)
  // Kept here: each change reloads the review, which rebuilds the detail below.
  const [message, setMessage] = useState(null)
  const frame = { back: { to: ROUTES.reviews, label: 'Back to reviews' }, crumb: 'Owner Panel / Growth OS / Reviews & Reputation', sample: 'Live records' }
  if (resource.error?.status === 404) return <GrowthFrame {...frame} title="Review not found"><Banner tone="warning" title="No review matches this link">Open the register to find the review.</Banner></GrowthFrame>
  if (!resource.data) return <GrowthFrame {...frame} title="Review Details & Response"><LoadingState label="Loading the review…" error={resource.error} onRetry={resource.reload} /></GrowthFrame>
  return <ReviewDetail key={`${reviewId}:${resource.data.response?.version ?? 0}:${resource.data.notes.length}:${resource.data.escalations.length}`} review={resource.data} reload={resource.reload} message={message} setMessage={setMessage} />
}

function ReviewDetail({ review, reload, message, setMessage }) {
  const { state } = useLocation()
  const { can, canAny, user } = useAuth()
  const context = useLeadContext()
  const response = review.response
  const editable = !response || ['draft', 'failed'].includes(response.status)
  const [text, setText] = useState(response?.text ?? '')
  const [decisionNote, setDecisionNote] = useState('')
  const [note, setNote] = useState('')
  const owners = useApiResource(() => contentApi.escalationOwners(), 'escalation-owners').data ?? []
  const [proposal, setProposal] = useState({ topic: (review.comment ?? '').split(/[.,!?]/)[0].slice(0, 60) || 'Review follow-up', severity: review.rating <= 2 ? 'high' : 'medium', ownerMembershipId: '', dueDate: clinicNow().date, dueTime: '17:00' })
  const [busy, setBusy] = useState(false)
  const findings = privacyFindings(text)
  const manage = can('growth.manage')
  const operations = canAny(['growth.leads', 'growth.manage'])
  const mine = response?.submittedById === user?.id
  const backPath = `${ROUTES.reviews}${state?.search ?? ''}`
  const owner = proposal.ownerMembershipId || owners[0]?.membershipId || ''

  const run = async (call, success) => {
    setBusy(true)
    setMessage(null)
    try {
      await call()
      setMessage({ tone: 'brand', title: success })
      reload()
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not done', text: error.message })
      setBusy(false)
    }
  }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to reviews · Filters retained' }} crumb="Owner Panel / Growth OS / Reviews & Reputation" title="Review Details & Response" description="Prepare a privacy-safe public reply, approved by a second person. Internal notes and escalations are never public." badge={<StatusPill tone={RESPONSE_TONE[review.responseState]}>{RESPONSE_STATES[review.responseState]}</StatusPill>} context={[context.line, `${review.branch.name} · Google review`]} today={context.today} sample="Live records · Replies are posted to Google after a second person approves">
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title={review.reviewerName} aside="Google review">
            <p className="mb-4 flex flex-wrap items-center gap-3 text-xs"><StatusPill tone={review.rating <= 3 ? 'warning' : 'success'}>{stars(review.rating)}</StatusPill><span className="text-outline">{when(stampOf(review.postedAt))} · {review.branch.name}</span></p>
            <blockquote className="text-lg leading-7">{review.comment ? `“${review.comment}”` : <span className="text-outline">The reviewer left a rating without text.</span>}</blockquote>
            <p className="mt-4 rounded-md bg-surface-low p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-on-surface">A reviewer name is not a patient record</strong>Never link a reviewer to a patient, and never confirm or deny that they received care.</p>
            {review.publicReply && <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-4 text-xs"><p className="font-semibold text-brand">Reply shown on Google · {when(stampOf(review.publicReplyAt))}</p><p className="mt-2 leading-5">{review.publicReply}</p></div>}
          </Section>
          <Section title="Public reply" aside={response ? RESPONSE_STATES[response.status] : 'No draft'}>
            {response?.reviewNote && response.status === 'draft' && <Banner tone="warning" title="Sent back by the reviewer" className="mb-3">{response.reviewNote}</Banner>}
            {response?.status === 'failed' && <Banner tone="danger" title="Google did not accept the reply" className="mb-3">{response.errorMessage} Edit it and submit again.</Banner>}
            <TextArea label="Reply · public text only" rows={5} disabled={!manage || !editable} value={text} onChange={(event) => setText(event.target.value)} hint="No names, contact numbers, appointment details, diagnoses or treatment. Never offer anything in exchange for changing a review." />
            {findings.length > 0 ? <Banner tone="danger" title="Possible personal or clinical detail" className="mt-3">Remove {findings.join(' and ')} before submitting.</Banner> : <Banner tone="brand" title="Privacy check passed" className="mt-3">No phone number, email address or clinical wording found. The server checks again before submitting.</Banner>}
            {manage && editable && <div className="mt-4 flex flex-wrap gap-3"><ActionButton disabled={busy || !text.trim()} onClick={() => run(() => contentApi.saveResponse(review.id, { text: text.trim(), version: response?.version }), 'Draft saved. It is not posted.')}>Save draft</ActionButton><ActionButton variant="brand" disabled={busy || !response || response.status !== 'draft' || text.trim() !== response.text || findings.length > 0} title={response && text.trim() !== response.text ? 'Save the draft first' : undefined} onClick={() => run(() => contentApi.submitResponse(review.id, response.version), 'Submitted. A different person must approve it before it is posted.')}>Submit for approval</ActionButton></div>}
            {response?.status === 'in_review' && (
              <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
                <p>Submitted by {response.submittedBy} {when(stampOf(response.submittedAt))}.</p>
                {mine ? <p className="mt-2 font-semibold">Waiting for someone else to approve.</p> : manage && (
                  <>
                    <div className="mt-3"><TextInput label="Note to the author" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} hint="Required when sending it back" /></div>
                    <div className="mt-3 flex flex-wrap gap-3"><ActionButton variant="brand" disabled={busy} onClick={() => run(() => contentApi.decideResponse(review.id, { decision: 'approve', note: decisionNote.trim() || null, version: response.version }), 'Approved. It is posted to Google within a minute.')}>Approve & post</ActionButton><ActionButton disabled={busy || !decisionNote.trim()} onClick={() => run(() => contentApi.decideResponse(review.id, { decision: 'reject', note: decisionNote.trim(), version: response.version }), 'Sent back to draft.')}>Send back</ActionButton></div>
                  </>
                )}
              </div>
            )}
            {response?.status === 'posting' && <p className="mt-4 text-xs">Approved by {response.approvedBy}. Posting to Google…</p>}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Internal notes" aside="Never public">
            <ul className="mb-3 space-y-2 text-xs">{review.notes.map((entry) => <li key={entry.id}><p>{entry.text}</p><p className="text-outline">{entry.author} · {when(stampOf(entry.createdAt))}</p></li>)}{!review.notes.length && <li className="text-outline">No notes yet.</li>}</ul>
            {operations && <><TextArea label="Add a note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} hint="Never copied into the public reply" /><ActionButton className="mt-3" disabled={busy || !note.trim()} onClick={() => run(() => contentApi.addReviewNote(review.id, note.trim()), 'Note added.')}>Add note</ActionButton></>}
          </Section>
          <Section title="Internal escalation" aside={review.escalations[0] ? ESCALATION_STATUSES[review.escalations[0].status] : 'None open'}>
            {review.escalations.map((entry) => <p key={entry.id} className="mb-2 text-xs"><StatusPill>{entry.code}</StatusPill> {SEVERITIES[entry.severity]} · due {when(stampOf(entry.dueAt))} · {ESCALATION_STATUSES[entry.status]}</p>)}
            {operations && !review.escalations.some((entry) => entry.status !== 'resolved') && (
              <div className="space-y-3">
                <TextInput label="Topic" value={proposal.topic} onChange={(event) => setProposal((current) => ({ ...current, topic: event.target.value }))} />
                <SelectInput label="Owner" value={owner} onChange={(event) => setProposal((current) => ({ ...current, ownerMembershipId: event.target.value }))} options={owners.map((entry) => ({ value: entry.membershipId, label: entry.name }))} />
                <SelectInput label="Severity" value={proposal.severity} onChange={(event) => setProposal((current) => ({ ...current, severity: event.target.value }))} options={Object.entries(SEVERITIES).map(([value, label]) => ({ value, label }))} />
                <div className="grid grid-cols-2 gap-3"><TextInput label="Due date" type="date" value={proposal.dueDate} onChange={(event) => setProposal((current) => ({ ...current, dueDate: event.target.value }))} /><TextInput label="Due time" type="time" value={proposal.dueTime} onChange={(event) => setProposal((current) => ({ ...current, dueTime: event.target.value }))} /></div>
                <ActionButton disabled={busy || !proposal.topic.trim() || !owner} onClick={() => run(() => contentApi.createEscalation({ reviewId: review.id, ...proposal, topic: proposal.topic.trim(), ownerMembershipId: owner }), 'Escalation opened.')}>Open escalation</ActionButton>
              </div>
            )}
            <p className="mt-3 text-xs"><Link to={ROUTES.escalations} className="font-semibold text-brand hover:underline">Open escalation →</Link></p>
            <p className="mt-3 text-[11px] text-outline">Escalations are internal and independent of the public reply.</p>
          </Section>
          <Section title="Other reviews"><Link to={ROUTES.reputation} className="text-xs font-semibold text-brand hover:underline">Reputation report →</Link></Section>
        </div>
      </div>
      <GrowthFooter back={{ to: backPath, label: 'Back to reviews' }} />
    </GrowthFrame>
  )
}
