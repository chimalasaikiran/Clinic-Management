import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { LEAD_STAGES, OWNERS } from '../constants'
import { useGrowth } from '../context/growthContext'
import { TONES, when } from '../format'
import { dueState } from '../growthLogic'

export default function LeadDetailPage() {
  const { leadId } = useParams()
  const { state } = useLocation()
  const { data, update } = useGrowth()
  const lead = data.leads.find((entry) => entry.id === leadId)
  const registerPath = `${ROUTES.leads}${state?.search ?? ''}`

  if (!lead) {
    return (
      <GrowthFrame back={{ to: registerPath, label: 'Back to Lead Register' }} crumb="Owner Panel / Growth OS / Leads" code="GO-03" title="Lead not found">
        <Banner tone="warning" title="No lead matches this link">Open the Lead Register to find the record.</Banner>
      </GrowthFrame>
    )
  }

  const due = dueState(lead)
  const here = { search: state?.search }
  const converted = lead.stage === 'Converted'
  const patch = (changes, entry) => update('leads', lead.id, (current) => ({ ...changes, activities: [{ id: `a${current.activities.length + 1}`, at: { date: '2026-10-22', time: '10:00' }, ...entry }, ...current.activities] }))
  const stages = [['Campaign', lead.campaign, lead.campaignId ? 'Attribution unverified' : 'Organic', true], ['Lead', `${lead.id.replace('LD', 'LD ')} · ${lead.stage}`, 'Sample record', true], ['Appointment', 'Not yet reached', 'Not booked', false], ['Consultation', 'Not yet reached', 'No consultation linked', false], ['Revenue', 'Not yet reached', 'No revenue attributed', false]]

  return (
    <GrowthFrame back={{ to: registerPath, label: 'Back to Lead Register' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name}`} code="GO-03" title={<>{lead.name}<StatusPill tone="success">{lead.stage}</StatusPill>{due !== 'None' && <StatusPill tone={TONES[due]}>{due}</StatusPill>}</>} description={`${lead.id.replace('LD', 'LD ')} · ${lead.summary}`} actions={<><ActionButton to={pathFor(ROUTES.leadEdit, { leadId })} state={here}>Edit Lead</ActionButton><ActionButton variant="brand" to={pathFor(ROUTES.leadFollowUp, { leadId })} state={here}>Record Follow up</ActionButton><ActionButton to={converted ? undefined : pathFor(ROUTES.leadConvert, { leadId })} state={here} disabled={converted}>Convert Lead</ActionButton></>} actionNote="Changes are recorded in the activity history" context={[`Return to: Aura Health · All locations (3) · 01–22 Oct 2026`, `Lead branch: ${lead.branch}. Returning keeps the register’s all-location scope, not this lead’s branch.`]}>
      <div className="mb-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Section title="Overview" aside="Lead record">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 text-xs">
            <KeyValue label="Phone">{lead.phone}</KeyValue>
            <KeyValue label="Interest">{lead.interest}</KeyValue>
            <div><dt className="text-on-surface-variant">Stage</dt><dd className="mt-1.5"><SelectInput aria-label="Change stage" label="" value={lead.stage} options={LEAD_STAGES.filter((stage) => stage !== 'Converted' || converted)} onChange={(event) => patch({ stage: event.target.value }, { title: 'Stage changed', text: `${lead.stage} → ${event.target.value}. Original attribution retained.` })} /></dd></div>
            <div><dt className="text-on-surface-variant">Owner</dt><dd className="mt-1.5"><SelectInput aria-label="Reassign owner" label="" value={lead.owner} options={OWNERS} onChange={(event) => patch({ owner: event.target.value }, { title: 'Owner reassigned', text: `${lead.owner} → ${event.target.value}.` })} /></dd></div>
            <KeyValue label="Branch">{lead.branch}</KeyValue>
            <KeyValue label="Created · IST">{when(lead.created)}</KeyValue>
            <KeyValue label="Last activity · IST">{when(lead.lastActivity)}</KeyValue>
            <KeyValue label="Follow-up status">{due === 'None' ? 'No open follow-up' : `${due} · Open follow-up`}</KeyValue>
          </dl>
          <p className="mt-5 text-[11px] text-outline">Stage changes and reassignment are appended to the activity history. Original attribution is preserved and shared patient data is never changed silently.</p>
        </Section>
        <Section title="Follow up" aside={due !== 'None' && <StatusPill tone={TONES[due]}>{due}</StatusPill>}>
          <p className="text-xs text-on-surface-variant">Next action</p>
          <p className="mt-1 text-lg font-semibold">{lead.nextAction || 'No next action set'}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><KeyValue label="Due date · IST">{lead.due ? when(lead.due) : '—'}</KeyValue><KeyValue label="Assigned owner">{lead.owner}</KeyValue></dl>
          {due === 'Overdue' && <Banner tone="warning" className="mt-4">Still open as of 22 Oct 2026 IST. Later activity did not resolve this follow-up.</Banner>}
          <ActionButton variant="brand" className="mt-4" to={pathFor(ROUTES.leadFollowUp, { leadId })} state={here}>Record Follow up</ActionButton>
          <p className="mt-3 text-[11px] text-outline">Log the outcome and confirm completion or rescheduling. The original due date is kept in the audit history.</p>
        </Section>
      </div>

      <Section title="Attribution" aside="Original source retained through edits and conversion" className="mb-6">
        <dl className="mb-5 grid gap-4 text-xs sm:grid-cols-4"><KeyValue label="Source">{lead.source}</KeyValue><KeyValue label="Channel" hint="Attribution unverified">{lead.channel}</KeyValue><KeyValue label="Campaign">{lead.campaign}</KeyValue><KeyValue label="Landing page">Not captured in sample record</KeyValue></dl>
        <p className="mb-3 flex items-center justify-between text-xs"><strong>Campaign → Lead → Appointment → Consultation → Revenue</strong><StatusPill>Sample journey</StatusPill></p>
        <ol className="grid gap-3 sm:grid-cols-5">{stages.map(([stage, name, note, reached]) => <li key={stage} className={`rounded-md border p-3 text-xs ${reached ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-surface-lowest'}`}><p className="font-semibold">{stage}</p><p className="mt-1">{name}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
        {lead.campaignId && <Link to={pathFor(ROUTES.campaignAttribution, { campaignId: lead.campaignId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Trace attribution for {lead.campaign} →</Link>}
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Section title="Activity timeline" aside="All times IST">
          <ol className="space-y-5">{lead.activities.map((activity) => <li key={activity.id} className="text-xs"><p className="flex justify-between gap-3"><strong className="text-[13px]">{activity.title}</strong><span className="text-outline">{when(activity.at)}</span></p><p className="mt-1 leading-5 text-on-surface-variant">{activity.text}</p></li>)}</ol>
          <p className="mt-5 rounded-md bg-surface-low p-3 text-[11px] leading-4 text-outline">Audit history is immutable. Edits, stage changes, reassignment and conversion record the actor, timestamp and old → new values.</p>
        </Section>
        <Section title="Related records" aside={converted ? 'Converted' : 'Not converted'}>
          <div className="grid gap-3 sm:grid-cols-2 text-xs"><div className="rounded-md bg-surface-lowest p-3"><p className="text-outline">Shared patient</p><p className="mt-1 text-[13px] font-semibold">{!converted ? 'Patient link not verified' : lead.patientId ? <Link to={pathFor(ROUTES.patientHub, { patientId: lead.patientId })} className="text-brand hover:underline">Open linked patient ↗</Link> : 'New patient pending'}</p><p className="mt-1 text-outline">{!converted ? 'No patient record confirmed' : lead.patientId ? 'Linked at conversion' : <Link to={ROUTES.patientNew} className="text-brand hover:underline">Register the patient →</Link>}</p></div><div className="rounded-md bg-surface-lowest p-3"><p className="text-outline">Appointment</p><p className="mt-1 text-[13px] font-semibold">Not booked</p><p className="mt-1 text-outline">Booking is a separate workflow</p></div></div>
          <Banner tone="warning" title="Possible duplicate · Review required" className="mt-4">Detection state only, not a verified match. Compare permitted contact details in shared patient and lead records before linking or creating.</Banner>
          {!converted && <><p className="mt-5 text-[13px] font-semibold">Before converting this lead</p><ul className="mt-2 space-y-2 text-xs text-on-surface-variant"><li>Review shared records.</li><li>Resolve identity before creation.</li><li>Confirm conversion separately.</li></ul><ActionButton variant="brand" className="mt-4" to={pathFor(ROUTES.leadConvert, { leadId })} state={here}>Convert Lead</ActionButton></>}
        </Section>
      </div>
      <GrowthFooter code="GO-03" back={{ to: registerPath, label: 'Back to Lead Register · Origin context retained' }} />
    </GrowthFrame>
  )
}
