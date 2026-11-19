import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, KeyValue, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import LeadGate from '../components/LeadGate'
import { day, TONES, when } from '../format'
import { leadsApi } from '../leadsApi'
import { messagingApi } from '../messagingApi'
import { LIVE_NOTE, leadPayload, ownerOptions, STAGES, stageId } from '../leadsView'
import { useLeadContext, useLeadOwners } from '../useLeads'

const APPOINTMENT_STATUS = { pending: 'Pending', confirmed: 'Confirmed', arrived: 'Arrived', in_progress: 'In progress', completed: 'Completed', no_show: 'No-show' }

export default function LeadDetailPage() {
  const { leadId } = useParams()
  const { state } = useLocation()
  const back = { to: `${ROUTES.leads}${state?.search ?? ''}`, label: 'Back to Lead Register' }
  return <LeadGate leadId={leadId} code="GO-03" back={back}>{(lead, reload) => <LeadDetail lead={lead} reload={reload} />}</LeadGate>
}

function LeadDetail({ lead, reload }) {
  const { state } = useLocation()
  const { can } = useAuth()
  const context = useLeadContext()
  const owners = useLeadOwners()
  const [failure, setFailure] = useState('')
  const navigate = useNavigate()
  const writer = can('growth.leads')
  const registerPath = `${ROUTES.leads}${state?.search ?? ''}`
  const leadId = lead.id
  const here = { search: state?.search }
  const converted = lead.stage === STAGES.converted
  const due = lead.dueState
  const duplicates = useApiResource(() => (writer ? leadsApi.duplicates(lead.mobile, lead.id) : Promise.resolve([])), `${lead.mobile}:${writer}`).data ?? []

  // Stage and owner changes save at once; the server adds them to the activity history.
  const change = async (patch) => {
    setFailure('')
    try {
      await leadsApi.update(lead.id, { ...leadPayload({ ...lead, ...patch, reviewed: true }), stage: stageId(patch.stage ?? lead.stage), version: lead.version })
      reload()
    } catch (error) {
      setFailure(error.message)
      if (error.code === 'LEAD_CHANGED') reload()
    }
  }

  // Opens the conversation with this lead on a channel, creating it the first time.
  const message = async (channel) => {
    setFailure('')
    try {
      const conversation = await messagingApi.start({ channel, leadId: lead.id })
      navigate(pathFor(ROUTES.conversation, { threadId: conversation.id }))
    } catch (error) {
      setFailure(error.message)
    }
  }

  const appointment = lead.journey?.appointment
  const consultation = lead.journey?.consultation
  const stages = [
    ['Campaign', 'No campaign', 'Campaigns are not linked to leads yet', false],
    ['Lead', `${lead.number} · ${lead.stage}`, `Recorded ${day(lead.created.date)}`, true],
    ['Appointment', appointment ? `${appointment.reference} · ${day(appointment.date)}` : 'Not booked', appointment ? APPOINTMENT_STATUS[appointment.status] : converted ? 'No appointment since conversion' : 'Not converted', Boolean(appointment)],
    ['Consultation', consultation ? `${consultation.reference} · ${day(consultation.date)}` : 'Not yet reached', consultation ? 'Completed visit' : 'No completed visit linked', Boolean(consultation)],
    ['Revenue', 'Not attributed', 'Revenue is not traced to leads', false],
  ]

  return (
    <GrowthFrame back={{ to: registerPath, label: 'Back to Lead Register' }} crumb={`Owner Panel / Growth OS / Leads / ${lead.name}`} code="GO-03" title={<>{lead.name}<StatusPill tone="success">{lead.stage}</StatusPill>{due !== 'None' && <StatusPill tone={TONES[due]}>{due}</StatusPill>}</>} description={`${lead.number} · ${lead.summary}`} actions={writer && <><ActionButton to={pathFor(ROUTES.leadEdit, { leadId })} state={here}>Edit Lead</ActionButton><ActionButton variant="brand" to={pathFor(ROUTES.leadFollowUp, { leadId })} state={here}>Record Follow up</ActionButton><ActionButton to={converted ? undefined : pathFor(ROUTES.leadConvert, { leadId })} state={here} disabled={converted}>Convert Lead</ActionButton></>} actionNote={writer ? 'Changes are recorded in the activity history' : 'View only · your role cannot change leads'} context={[context.line, `Lead branch: ${lead.branch}.`]} today={context.today} sample={LIVE_NOTE}>
      {failure && <Banner tone="danger" title="Not saved" className="mb-6">{failure}</Banner>}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Section title="Overview" aside="Lead record">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 text-xs">
            <KeyValue label="Phone">{lead.phone}</KeyValue>
            <KeyValue label="Interest">{lead.interest || '—'}</KeyValue>
            <div><dt className="text-on-surface-variant">Stage</dt><dd className="mt-1.5"><SelectInput aria-label="Change stage" label="" value={lead.stage} disabled={!writer || converted} options={Object.values(STAGES).filter((stage) => stage !== STAGES.converted || converted)} onChange={(event) => change({ stage: event.target.value })} /></dd></div>
            <div><dt className="text-on-surface-variant">Owner</dt><dd className="mt-1.5"><SelectInput aria-label="Reassign owner" label="" value={lead.ownerId} disabled={!writer} options={ownerOptions(owners, lead.branchId).concat(owners.some((owner) => owner.membershipId === lead.ownerId) ? [] : [{ value: lead.ownerId, label: lead.owner }])} onChange={(event) => change({ ownerId: event.target.value })} /></dd></div>
            <KeyValue label="Branch">{lead.branch}</KeyValue>
            <KeyValue label="Created · IST">{when(lead.created)}</KeyValue>
            <KeyValue label="Last activity · IST">{when(lead.lastActivity)}</KeyValue>
            <KeyValue label="Follow-up status">{due === 'None' ? 'No open follow-up' : `${due} · Open follow-up`}</KeyValue>
          </dl>
          <p className="mt-5 text-[11px] text-outline">Stage changes and reassignment are added to the activity history. Closing a lead ends its open follow-up. Shared patient data is never changed from here.</p>
        </Section>
        <Section title="Follow up" aside={due !== 'None' && <StatusPill tone={TONES[due]}>{due}</StatusPill>}>
          <p className="text-xs text-on-surface-variant">Next action</p>
          <p className="mt-1 text-lg font-semibold">{lead.nextAction || 'No next action set'}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><KeyValue label="Due date · IST">{lead.due ? when(lead.due) : '—'}</KeyValue><KeyValue label="Assigned owner">{lead.owner}</KeyValue></dl>
          {due === 'Overdue' && <Banner tone="warning" className="mt-4">Still open. Later activity did not resolve this follow-up.</Banner>}
          {writer && <ActionButton variant="brand" className="mt-4" to={pathFor(ROUTES.leadFollowUp, { leadId })} state={here}>Record Follow up</ActionButton>}
          <p className="mt-3 text-[11px] text-outline">Log the outcome and confirm completion or rescheduling. The original due date is kept in the activity history.</p>
        </Section>
      </div>

      <Section title="Source & journey" aside="Original source kept through edits and conversion" className="mb-6">
        <dl className="mb-5 grid gap-4 text-xs sm:grid-cols-4"><KeyValue label="Source">{lead.source}</KeyValue><KeyValue label="Branch">{lead.branch}</KeyValue><KeyValue label="Campaign">No campaign</KeyValue><KeyValue label="Converted">{lead.convertedAt ? when(lead.convertedAt) : 'Not converted'}</KeyValue></dl>
        <p className="mb-3 flex items-center justify-between text-xs"><strong>Campaign → Lead → Appointment → Consultation → Revenue</strong><StatusPill>{converted ? 'Visits since conversion' : 'Lead only'}</StatusPill></p>
        <ol className="grid gap-3 sm:grid-cols-5">{stages.map(([stage, name, note, reached]) => <li key={stage} className={`rounded-md border p-3 text-xs ${reached ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-surface-lowest'}`}><p className="font-semibold">{stage}</p><p className="mt-1">{name}</p><p className="mt-1 text-outline">{note}</p></li>)}</ol>
        {converted && !lead.journey && <p className="mt-3 text-[11px] text-outline">Appointments are shown to roles that can view bookings.</p>}
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Section title="Activity timeline" aside="All times IST">
          <ol className="space-y-5">{lead.activities.map((activity) => <li key={activity.id} className="text-xs"><p className="flex justify-between gap-3"><strong className="text-[13px]">{activity.title}</strong><span className="text-outline">{when(activity.at)}</span></p><p className="mt-1 leading-5 text-on-surface-variant">{activity.text}</p>{activity.actor && <p className="mt-1 text-[11px] text-outline">Recorded by {activity.actor}</p>}</li>)}</ol>
          <p className="mt-5 rounded-md bg-surface-low p-3 text-[11px] leading-4 text-outline">The activity history cannot be edited. Edits, stage changes, reassignment and conversion record who made them, when, and the old → new values.</p>
        </Section>
        <Section title="Related records" aside={converted ? 'Converted' : 'Not converted'}>
          <div className="grid gap-3 sm:grid-cols-2 text-xs"><div className="rounded-md bg-surface-lowest p-3"><p className="text-outline">Shared patient</p><p className="mt-1 text-[13px] font-semibold">{lead.patient ? <Link to={pathFor(ROUTES.patientHub, { patientId: lead.patient.id })} className="text-brand hover:underline">{lead.patient.name} ↗</Link> : 'No patient linked'}</p><p className="mt-1 text-outline">{lead.patient ? `${lead.patient.mrn} · Linked at conversion` : 'Linked when the lead is converted'}</p></div><div className="rounded-md bg-surface-lowest p-3"><p className="text-outline">Appointment</p><p className="mt-1 text-[13px] font-semibold">{appointment ? <Link to={pathFor(ROUTES.appointment, { patientId: lead.patient.id, appointmentId: appointment.id })} className="text-brand hover:underline">{appointment.reference} ↗</Link> : 'Not booked'}</p><p className="mt-1 text-outline">{appointment ? `${day(appointment.date)} · ${APPOINTMENT_STATUS[appointment.status]}` : 'Booking is a separate workflow'}</p></div></div>
          {can('growth.manage') && <div className="mt-4 rounded-md bg-surface-lowest p-3 text-xs"><p className="text-outline">Message this lead</p><div className="mt-2 flex flex-wrap gap-2"><ActionButton onClick={() => message('whatsapp')}>WhatsApp</ActionButton><ActionButton onClick={() => message('sms')}>SMS</ActionButton>{lead.email && <ActionButton onClick={() => message('email')}>Email</ActionButton>}</div><p className="mt-2 text-[11px] text-outline">Opens the conversation; sending checks the channel and their recorded permission.</p></div>}
          {duplicates.length > 0 && <Banner tone="warning" title="Possible duplicate · Review required" className="mt-4">{duplicates.map((entry) => `${entry.fullName} (${entry.number})`).join(', ')} uses the same mobile number. A match is not a verified identity; compare details before linking or creating.</Banner>}
          {!converted && writer && <><p className="mt-5 text-[13px] font-semibold">Before converting this lead</p><ul className="mt-2 space-y-2 text-xs text-on-surface-variant"><li>Review shared records.</li><li>Resolve identity before creation.</li><li>Confirm conversion separately.</li></ul><ActionButton variant="brand" className="mt-4" to={pathFor(ROUTES.leadConvert, { leadId })} state={here}>Convert Lead</ActionButton></>}
        </Section>
      </div>
      <GrowthFooter code="GO-03" back={{ to: registerPath, label: 'Back to Lead Register · Filters kept' }} />
    </GrowthFrame>
  )
}
