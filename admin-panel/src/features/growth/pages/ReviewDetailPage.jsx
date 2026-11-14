import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, GROWTH_TODAY, OWNERS, SEVERITIES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { privacyFindings } from '../growthLogic'

export default function ReviewDetailPage() {
  const { reviewId } = useParams()
  const { data } = useGrowth()
  const review = data.reviews.find((entry) => entry.id === reviewId)
  if (!review) {
    return (
      <GrowthFrame back={{ to: ROUTES.reviews, label: 'Back to reviews' }} crumb="Owner Panel / Growth OS / Reviews & Reputation" code="GO-17" title="Review not found">
        <Banner tone="warning" title="No review matches this link">Open the register to find the review.</Banner>
      </GrowthFrame>
    )
  }
  return <ReviewDetail key={reviewId} review={review} />
}

function ReviewDetail({ review }) {
  const { data, update, add, newId } = useGrowth()
  const { state } = useLocation()
  const escalation = data.escalations.find((entry) => entry.reviewId === review.id)
  const [response, setResponse] = useState(review.response)
  const [note, setNote] = useState(review.note)
  const [proposal, setProposal] = useState({ owner: escalation?.owner ?? OWNERS[0], severity: escalation?.severity ?? 'Medium' })
  const [saved, setSaved] = useState('')
  const findings = privacyFindings(response)
  const backPath = `${ROUTES.reviews}${state?.search ?? ''}`

  const saveResponse = () => { update('reviews', review.id, { response, responseState: response.trim() ? 'Draft · approval required' : 'No response recorded' }); setSaved('Response draft saved. It is not approved or published.') }
  const requestApproval = () => { update('reviews', review.id, { response, responseState: 'Approval requested' }); setSaved('Approval requested. Publishing to the provider stays blocked until a connection is verified.') }
  const saveNote = () => { update('reviews', review.id, { note }); setSaved('Internal note saved. It is never copied into the public response.') }
  const escalate = () => {
    if (escalation) update('escalations', escalation.id, proposal)
    else add('escalations', { id: newId('ESC-DEMO', 'escalations', 3), reviewId: review.id, topic: review.text.split(/[.,]/)[0].slice(0, 40), summary: 'Operations review proposed', ...proposal, due: '2026-10-26', dueTime: '12:00', status: 'Open', note: '' })
    setSaved(escalation ? 'Escalation updated.' : 'Internal escalation opened.')
  }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to reviews · GO16 · Filters & scroll retained' }} crumb="Owner Panel / Growth OS / Reviews & Reputation" code="GO-17" title="Review Details & Response" description={`Prepare a privacy-safe response to ${review.id}. Internal follow-up stays separate from public content.`} badge={<StatusPill tone="warning">{review.responseState}</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Google sample · 01–23 Oct 2026 · Rating / Response / Escalation: All · Scroll anchor retained']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Provider identity not verified — response submission blocked" className="mb-6">Google review example only. No provider review ID, live ingestion, ownership or reply permission is verified. Confirm the official public contact before any actual submission.</Banner>
      {saved && <Banner tone="brand" title={saved} className="mb-6" />}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title={review.alias} aside={`${review.id} · supplied sample`}>
            <p className="mb-4 flex flex-wrap items-center gap-3 text-xs"><StatusPill tone="warning">{review.rating} / 5 ★</StatusPill><StatusPill>Google review example</StatusPill><span className="text-outline">{day(review.date)} · {review.time} IST</span></p>
            <blockquote className="text-lg leading-7">“{review.text}”</blockquote>
            <p className="mt-3 text-[11px] text-outline">{GROWTH_BRANCH.name} · {GROWTH_BRANCH.code} · Rating and date are samples</p>
            <p className="mt-4 rounded-md bg-surface-low p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-on-surface">Public alias is not proof of a visit or patient record</strong>Never link an alias to a patient. Do not confirm or deny whether this reviewer received care.</p>
          </Section>
          <Section title="Public response editor" aside={review.responseState}>
            <TextArea label="Response draft · public text only" rows={5} value={response} onChange={(event) => setResponse(event.target.value)} hint="Never include patient status, diagnoses, treatment, appointment details, names or identifiers." />
            {findings > 0 ? <Banner tone="danger" title="Possible personal or clinical detail found" className="mt-3">Remove contact numbers, emails or clinical wording before requesting approval.</Banner> : <Banner tone="brand" title="Privacy guard · required before approval" className="mt-3">No personal or medical data detected. Do not copy internal notes, promise results or offer compensation conditional on review removal.</Banner>}
            <div className="mt-4 flex gap-3"><ActionButton onClick={saveResponse}>Save response draft</ActionButton><ActionButton variant="brand" disabled={!response.trim() || findings > 0} onClick={requestApproval}>Request approval</ActionButton></div>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Provider evidence"><StatusPill tone="warning">No provider identity verified</StatusPill><p className="mt-3 text-xs leading-5">Provider review ID: not received — verify live ingest and branch mapping before responding.</p><Link to={ROUTES.businessProfile} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Verify business profile · GO15</Link></Section>
          <Section title="Internal note" aside="Not public"><TextArea label="Note draft" rows={3} value={note} onChange={(event) => setNote(event.target.value)} hint="Restricted internal-note access. Never copied into response text." /><ActionButton className="mt-3" onClick={saveNote}>Save internal note</ActionButton></Section>
          <Section title="Internal escalation" aside={escalation ? escalation.status : 'None open'}>
            {escalation && <StatusPill className="mb-3">{escalation.id}</StatusPill>}
            <div className="space-y-3"><SelectInput label="Proposed owner" value={proposal.owner} onChange={(event) => setProposal((current) => ({ ...current, owner: event.target.value }))} options={OWNERS} /><SelectInput label="Severity" value={proposal.severity} onChange={(event) => setProposal((current) => ({ ...current, severity: event.target.value }))} options={SEVERITIES} /></div>
            <div className="mt-3 flex gap-3"><ActionButton onClick={escalate}>{escalation ? 'Update escalation' : 'Open escalation'}</ActionButton><ActionButton to={ROUTES.escalations}>Open in GO19</ActionButton></div>
            <p className="mt-3 text-[11px] text-outline">Escalation is internal and independent of the public response. Proposed {day(GROWTH_TODAY)}.</p>
          </Section>
        </div>
      </div>
      <GrowthFooter code="GO-17" back={{ to: backPath, label: 'Back to reviews · GO16' }} />
    </GrowthFrame>
  )
}
