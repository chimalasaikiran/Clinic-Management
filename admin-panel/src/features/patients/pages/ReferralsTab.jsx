import { useState } from 'react'
import { AlertTriangle, Inbox, Plus, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import { CreateReferralDrawer, FollowUpDrawer, InboundReferralDrawer, ReferralDetailDrawer } from '../drawers/ReferralDrawers'
import { TODAY, formatDate, formatTime } from '../format'
import { byNewest, clockTime, slaState } from '../selectors'

const ATTENTION = ['Pending Acceptance', 'Awaiting Review', 'Info Requested']
const ACTIVE = ['Scheduled', 'Accepted']
const TABS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'attention', label: 'Needs Attention', test: (referral) => ATTENTION.includes(referral.status) },
  { id: 'active', label: 'Active / In Progress', test: (referral) => ACTIVE.includes(referral.status) },
  { id: 'completed', label: 'Completed', test: (referral) => ['Completed', 'Closed'].includes(referral.status) },
  { id: 'declined', label: 'Declined / Cancelled', test: (referral) => ['Declined', 'Cancelled'].includes(referral.status) },
]

const STATUS_TONE = { 'Pending Acceptance': 'warning', 'Awaiting Review': 'info', 'Info Requested': 'warning', Scheduled: 'brand', Accepted: 'brand', Completed: 'success', Closed: 'neutral', Declined: 'danger', Cancelled: 'neutral' }

export default function ReferralsTab() {
  const { patient, patientId, mine, add, update, newId } = usePatient()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [drawer, setDrawer] = useState(null)
  const referrals = mine('referrals').sort(byNewest)
  const encounter = mine('encounters').find((entry) => entry.status === 'In Progress') ?? mine('encounters').sort(byNewest)[0]

  const outgoingPending = referrals.find((entry) => entry.direction === 'Outgoing' && ATTENTION.includes(entry.status))
  const incomingReview = referrals.find((entry) => entry.direction === 'Incoming' && entry.status === 'Awaiting Review')
  const active = referrals.filter((entry) => ATTENTION.includes(entry.status) || ACTIVE.includes(entry.status))
  const selected = TABS.find((entry) => entry.id === tab)
  const needle = query.trim().toLowerCase()
  const rows = referrals.filter((entry) => selected.test(entry) && (!direction || entry.direction === direction) && (!specialty || entry.specialty === specialty) && (!needle || `${entry.id} ${entry.specialty} ${entry.indication} ${entry.facility}`.toLowerCase().includes(needle)))
  const current = drawer?.id ? referrals.find((entry) => entry.id === drawer.id) : null

  const records = [
    ...mine('orders').slice(0, 3).map((entry) => ({ id: entry.id, label: `Diagnostic order: ${entry.title} (${entry.id})` })),
    ...(encounter ? [{ id: encounter.id, label: `Encounter note: ${encounter.type} (${encounter.id})` }] : []),
    ...mine('prescriptions').filter((entry) => entry.status === 'Active').slice(0, 1).map((entry) => ({ id: entry.id, label: `Active medication regimen (${entry.id})` })),
  ]

  const create = (draft) => add('referrals', { ...draft, id: newId('REF-2026-', 'referrals', 3), patientId })
  const logFollowUp = (id, { outcome, method, representative, staff, notes }) =>
    update('referrals', id, (referral) => ({
      status: outcome.status,
      log: [{ time: `${formatDate(TODAY)}, ${formatTime(clockTime())} IST`, title: `${method} outreach — ${outcome.title}`, text: `${staff} spoke with ${representative}. ${notes}` }, ...referral.log],
    }))
  const reroute = (id) => update('referrals', id, (referral) => ({ status: 'Cancelled', log: [{ time: `${formatDate(TODAY)}, ${formatTime(clockTime())} IST`, title: 'Re-routed to backup specialist', text: 'Original referral closed; a new request is required for the backup panelist.' }, ...referral.log] }))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold">Referrals <span className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-[10px] font-normal text-on-surface-variant">FHIR ServiceRequest: Active</span></h2><p className="text-sm text-on-surface-variant">Track referrals sent to and received from other clinicians, specialists, and external care networks.</p></div>
        <div className="flex gap-2"><ActionButton onClick={() => window.print()}>Batch Referral Export (PDF)</ActionButton><ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create referral</ActionButton></div>
      </div>

      {referrals.length === 0 ? (
        <EmptyState icon={Share2} title="No referrals yet" action={<ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create referral</ActionButton>}>Outbound and inbound care referrals for {patient.name} are tracked here.</EmptyState>
      ) : (
        <>
          <StatTiles
            className="mb-5 lg:grid-cols-5"
            items={[
              { label: 'Active referrals', value: `${active.length} Active`, hint: `${active.filter((entry) => entry.direction === 'Outgoing').length} Outgoing · ${active.filter((entry) => entry.direction === 'Incoming').length} Incoming` },
              { label: 'Awaiting response', value: `${referrals.filter((entry) => entry.direction === 'Outgoing' && ATTENTION.includes(entry.status)).length} Outgoing`, hint: outgoingPending ? outgoingPending.facility : 'No pending requests' },
              { label: 'Scheduled appointments', value: `${referrals.filter((entry) => entry.status === 'Scheduled').length} Linked`, hint: 'Booked with receiving team' },
              { label: 'Completed & closed', value: `${referrals.filter((entry) => ['Completed', 'Closed'].includes(entry.status)).length} Historical`, hint: 'Past 12 months records' },
              { label: 'ABDM care network', value: 'Milestone 3 Synced', hint: 'FHIR v4.0.1 validated' },
            ]}
          />

          {outgoingPending && (
            <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-5">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Variant A · Outbound referral requiring action</p>
              <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />Action Required — Referral Awaiting Acceptance</h3><StatusPill tone="warning">{outgoingPending.status}</StatusPill>{slaState(outgoingPending) && <StatusPill tone={slaState(outgoingPending).overdue ? 'danger' : 'info'}>{outgoingPending.sla.windowHours}h SLA · {slaState(outgoingPending).text}</StatusPill>}<span className="ml-auto font-mono text-[11px]">{outgoingPending.id}</span></div>
              <p className="mt-2 text-xs leading-5"><strong>Clinical indication:</strong> {outgoingPending.clinicalIndication}</p>
              <p className="mt-1 text-[11px] text-on-surface-variant">Referring: {outgoingPending.clinician} · Target: {outgoingPending.facility} ({outgoingPending.facilityNote}) · Dispatched: {formatDate(outgoingPending.date)}, {formatTime(outgoingPending.time)} IST</p>
              <div className="mt-3 flex flex-wrap gap-2"><ActionButton onClick={() => setDrawer({ type: 'detail', id: outgoingPending.id })}>View Referral Details</ActionButton><ActionButton onClick={() => setDrawer({ type: 'detail', id: outgoingPending.id })}>Review Clinical Notes Attached ({outgoingPending.attachments} Docs)</ActionButton><ActionButton variant="brand" onClick={() => setDrawer({ type: 'followup', id: outgoingPending.id })}>Follow Up with Receiving Center →</ActionButton></div>
            </section>
          )}

          {incomingReview && (
            <section className="mb-5 rounded-lg border border-sky-200 bg-sky-50/50 p-5">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Variant B · Inbound referral requiring action</p>
              <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-sky-700" aria-hidden="true" />Action Required — New Referral Received</h3><StatusPill tone="info">Awaiting Review</StatusPill><span className="ml-auto font-mono text-[11px]">{incomingReview.id}</span></div>
              <p className="mt-2 text-xs leading-5"><strong>Referral reason:</strong> {incomingReview.clinicalIndication}</p>
              <p className="mt-1 text-[11px] text-on-surface-variant">Referring org: {incomingReview.clinicianNote} · Referring clinician: {incomingReview.clinician} · Target: {incomingReview.facilityNote} · Received: {formatDate(incomingReview.date)}, {formatTime(incomingReview.time)} IST</p>
              <div className="mt-3 flex flex-wrap gap-2"><ActionButton onClick={() => setDrawer({ type: 'detail', id: incomingReview.id })}>View Referral Details</ActionButton><ActionButton onClick={() => setDrawer({ type: 'inbound', id: incomingReview.id })}>Review Documents ({incomingReview.attachments} Records)</ActionButton><ActionButton variant="brand" onClick={() => setDrawer({ type: 'inbound', id: incomingReview.id })}>Review Referral &amp; Triage →</ActionButton></div>
            </section>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <SearchBox value={query} onChange={setQuery} label="Search referrals" placeholder="Search by referral ID, specialty, clinician, receiving facility…" className="w-80 max-w-full" />
              <div className="flex gap-2"><FilterSelect label="Direction" value={direction} onChange={setDirection} allLabel="All Directions (Outgoing & Incoming)" options={['Outgoing', 'Incoming']} /><FilterSelect label="Specialty" value={specialty} onChange={setSpecialty} allLabel="All Specialties" options={[...new Set(referrals.map((entry) => entry.specialty))]} /></div>
            </div>
            <div className="border-b border-slate-100 px-4 py-3"><FilterTabs label="Referral status" value={tab} onChange={setTab} options={TABS.map((entry) => ({ id: entry.id, label: entry.label, count: referrals.filter(entry.test).length }))} /></div>
            <Table headings={['Referral ID & date', 'Specialty & indication', 'Direction', 'Referring clinician', 'Destination facility', 'Lifecycle status', 'Linked entity / outcome', 'Actions']} minWidth={1180} empty={rows.length ? null : 'No referrals match the current filters.'}>
              {rows.map((entry) => {
                const sla = slaState(entry)
                return (
                  <Row key={entry.id}>
                    <Cell><p className="font-mono text-[11px] font-semibold">#{entry.id}</p><p className="text-[11px] text-on-surface-variant">{formatDate(entry.date)} · {formatTime(entry.time)}</p>{sla && ATTENTION.includes(entry.status) && <StatusPill tone={sla.overdue ? 'danger' : 'info'} className="mt-1">SLA: {sla.text}</StatusPill>}</Cell>
                    <Cell><p className="font-semibold">{entry.specialty}</p><p className="max-w-56 text-[11px] text-on-surface-variant">{entry.indication}</p></Cell>
                    <Cell><StatusPill tone={entry.direction === 'Outgoing' ? 'info' : 'brand'}>{entry.direction === 'Outgoing' ? '↗' : '↙'} {entry.direction}</StatusPill></Cell>
                    <Cell><p className="font-medium">{entry.clinician}</p><p className="text-[11px] text-on-surface-variant">{entry.clinicianNote}</p></Cell>
                    <Cell><p className="font-medium">{entry.facility}</p><p className="text-[11px] text-on-surface-variant">{entry.facilityNote}</p></Cell>
                    <Cell><StatusPill tone={STATUS_TONE[entry.status] ?? 'neutral'}>{entry.status}</StatusPill></Cell>
                    <Cell><p className="text-xs font-medium">{entry.outcome}</p>{entry.outcomeNote && <p className="text-[11px] text-brand">{entry.outcomeNote}</p>}</Cell>
                    <Cell>
                      <span className="flex flex-wrap gap-1.5">
                        {entry.direction === 'Outgoing' && ATTENTION.includes(entry.status) && <ActionButton size="sm" variant="danger" className="border-danger bg-danger text-white hover:bg-red-800" onClick={() => setDrawer({ type: 'followup', id: entry.id })}>Follow Up</ActionButton>}
                        {entry.direction === 'Incoming' && entry.status === 'Awaiting Review' && <ActionButton size="sm" variant="brand" onClick={() => setDrawer({ type: 'inbound', id: entry.id })}>Triage</ActionButton>}
                        {entry.status === 'Scheduled' && <ActionButton size="sm" to={pathFor(ROUTES.patientAppointments, { patientId })}>View Appt</ActionButton>}
                        <ActionButton size="sm" onClick={() => setDrawer({ type: 'detail', id: entry.id })} aria-label={`Details for ${entry.id}`}>Details</ActionButton>
                      </span>
                    </Cell>
                  </Row>
                )
              })}
            </Table>
            <TableFooter summary={`Showing ${rows.length} of ${referrals.length} total referral requests · Patient ${patient.name} (${patient.mrn})`}><Link to={pathFor(ROUTES.patientEncounters, { patientId })} className="text-brand hover:underline">View encounters</Link></TableFooter>
          </div>
        </>
      )}

      <CreateReferralDrawer key={String(drawer?.type === 'create')} open={drawer?.type === 'create'} onClose={() => setDrawer(null)} patient={patient} encounter={encounter} records={records} onCreate={create} />
      {drawer?.type === 'detail' && <ReferralDetailDrawer referral={current} patient={patient} onClose={() => setDrawer(null)} onFollowUp={() => setDrawer({ type: 'followup', id: drawer.id })} />}
      {drawer?.type === 'followup' && <FollowUpDrawer key={drawer.id} referral={current} onClose={() => setDrawer(null)} onSave={logFollowUp} onReroute={reroute} />}
      {drawer?.type === 'inbound' && <InboundReferralDrawer key={drawer.id} referral={current} onClose={() => setDrawer(null)} onAccept={(id) => update('referrals', id, { status: 'Accepted', outcome: 'Accepted for clinical intake' })} onDecline={(id) => update('referrals', id, { status: 'Declined', outcome: 'Declined at triage' })} />}
    </div>
  )
}
