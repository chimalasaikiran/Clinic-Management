import { AlertTriangle, ArrowRight, CalendarPlus, History, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { ledgerSummary } from '../billing'
import EmptyState from '../components/EmptyState'
import { KeyValueRows } from '../components/parts'
import Timeline from '../components/Timeline'
import { usePatient } from '../context/usePatient'
import { formatDate, formatINR, formatLongDate, formatTime } from '../format'
import { activeAlerts, activityFeed, byNewest, daysLabel, nextAppointment } from '../selectors'

function Card({ title, tag, children, className }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className ?? ''}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
        {tag}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default function OverviewTab() {
  const { patient, patientId, mine } = usePatient()
  const appointments = mine('appointments')
  const encounters = mine('encounters').sort(byNewest)
  const orders = mine('orders')
  const consents = mine('consents')
  const family = mine('family')
  const payments = mine('payments').sort(byNewest)
  const summary = ledgerSummary({ invoices: mine('invoices'), payments, refunds: mine('refunds') })
  const next = nextAppointment(appointments)
  const recent = encounters.find((encounter) => encounter.status !== 'In Progress') ?? encounters[0]
  const active = encounters.find((encounter) => encounter.status === 'In Progress')
  const alerts = activeAlerts(mine('alerts'))
  const feed = activityFeed({ appointments, encounters, prescriptions: mine('prescriptions'), orders, payments })

  const attention = [
    ...orders.filter((order) => order.status === 'Awaiting Review').map((order) => ({ id: order.id, tag: 'RESULT PENDING', title: `${order.title} awaiting validation`, text: `Ordered ${formatDate(order.date)} by ${order.ordering}.`, label: 'Review result', to: ROUTES.patientOrders })),
    ...consents.filter((consent) => consent.status === 'Expiring Soon').map((consent) => ({ id: consent.id, tag: 'EXPIRING', title: `${consent.title} renewal`, text: `Consent ${consent.version} expires ${formatDate(consent.validity)}. Renewal is required to keep data sharing active.`, label: 'Update consent', to: ROUTES.patientCommunication })),
    ...(summary.outstanding > 0 ? [{ id: 'balance', tag: 'BALANCE DUE', title: `${formatINR(summary.outstanding)} outstanding`, text: summary.unallocated ? `${formatINR(summary.unallocated)} of unallocated credit can be applied.` : 'An invoice is awaiting payment.', label: 'Open billing', to: ROUTES.patientBilling }] : []),
  ]
  const lastPayment = payments[0]

  return (
    <div>
      <section className="mb-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Current care context</p>
          <p className="text-sm font-semibold">{active ? `${active.department} · ${active.type}` : recent ? recent.department : 'No active care context'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Attending clinician</p>
          <p className="text-sm font-semibold">{active?.doctor ?? next?.doctorShort ?? recent?.doctor ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Last visit &amp; cycle</p>
          <p className="text-sm font-semibold">{recent ? `${formatDate(recent.date)} (${daysLabel(recent.date).toLowerCase()})` : 'No visits recorded'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success" dot>{patient.consent}</StatusPill>
          <StatusPill>{mine('allergies').length ? `${mine('allergies').length} allergies flagged` : 'No allergies documented'}</StatusPill>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Card title="Next appointment" tag={next && <StatusPill tone="success">{next.status} · {daysLabel(next.date)}</StatusPill>}>
            {next ? (
              <>
                <div className="flex flex-wrap gap-4 rounded-md border border-slate-200 bg-surface-lowest p-4">
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded bg-white text-center shadow-sm">
                    <span className="text-[10px] font-semibold text-brand uppercase">{new Date(`${next.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })}</span>
                    <span className="text-xl font-bold">{next.date.slice(8)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatLongDate(next.date)} · {formatTime(next.time)} IST</p>
                    <p className="text-xs text-on-surface-variant">{next.service}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Clinician: <strong className="text-on-surface">{next.doctorShort}</strong> · Location: {next.branch}</p>
                  </div>
                </div>
                {next.prep && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">{next.prep.replace('Mandated Prep: ', 'Clinical note: ')}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <ActionButton variant="primary" to={pathFor(ROUTES.appointment, { patientId, appointmentId: next.id })}>View appointment →</ActionButton>
                    {['Scheduled', 'Confirmed'].includes(next.status) && <ActionButton to={pathFor(ROUTES.appointmentReschedule, { patientId, appointmentId: next.id })}>Reschedule</ActionButton>}
                  </div>
                  <Link to={pathFor(ROUTES.appointmentNew, { patientId })} className="text-xs font-semibold text-brand hover:underline">+ Book another appointment</Link>
                </div>
              </>
            ) : (
              <EmptyState icon={CalendarPlus} title="Nothing scheduled" action={<ActionButton variant="primary" to={pathFor(ROUTES.appointmentNew, { patientId })}>Book appointment</ActionButton>}>
                There is no upcoming appointment for {patient.name}.
              </EmptyState>
            )}
          </Card>

          <Card title="Recent encounter" tag={recent && <StatusPill tone="success"><Lock className="size-3" aria-hidden="true" />{recent.status}</StatusPill>}>
            {recent ? (
              <>
                <p className="text-base font-semibold">{recent.type} — {recent.reason}</p>
                <p className="text-xs text-on-surface-variant">{formatDate(recent.date)}, {formatTime(recent.time)} IST · Attending: <strong className="text-on-surface">{recent.doctor}</strong> ({recent.department})</p>
                {(recent.soap?.assessment || recent.complaint) && (
                  <blockquote className="mt-3 rounded-md bg-surface-low p-3 text-xs leading-5 italic text-on-surface-variant">
                    <span className="mb-1 block text-[10px] font-semibold tracking-wide uppercase not-italic text-outline">Clinician assessment note</span>
                    &ldquo;{recent.soap?.assessment || recent.complaint}&rdquo;
                  </blockquote>
                )}
                <Link to={pathFor(ROUTES.encounter, { patientId, encounterId: recent.id })} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">View encounter <ArrowRight className="size-3" aria-hidden="true" /></Link>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">No encounters have been recorded for this patient yet.</p>
            )}
          </Card>

          <Card title="Recent activity" tag={<History className="size-4 text-outline" aria-hidden="true" />}>
            {feed.length ? <Timeline events={feed.map((event) => ({ time: `${formatDate(event.date)}, ${formatTime(event.time)}`, title: event.title, detail: event.detail }))} /> : <p className="text-sm text-on-surface-variant">No activity has been recorded yet.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Needs attention" tag={<StatusPill tone="warning">{attention.length} {attention.length === 1 ? 'Item' : 'Items'}</StatusPill>} className="border-amber-200 bg-amber-50/40">
            {attention.length || alerts.length ? (
              <ul className="flex flex-col gap-3">
                {alerts.length > 0 && (
                  <li className="rounded-md border border-red-200 bg-red-50 p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-danger"><AlertTriangle className="size-3.5" aria-hidden="true" />{alerts.length} active clinical safety alerts</p>
                    <Link to={pathFor(ROUTES.patientRecords, { patientId })} className="mt-1 inline-block font-semibold text-brand hover:underline">Review alerts →</Link>
                  </li>
                )}
                {attention.map((item) => (
                  <li key={item.id} className="rounded-md border border-slate-200 bg-white p-3 text-xs">
                    <p className="mb-1"><StatusPill tone="warning">{item.tag}</StatusPill></p>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 leading-5 text-on-surface-variant">{item.text}</p>
                    <Link to={pathFor(item.to, { patientId })} className="mt-1 inline-block font-semibold text-brand hover:underline">{item.label} →</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">Nothing needs attention right now.</p>
            )}
          </Card>

          <Card title="Patient summary" tag={<Link to={pathFor(ROUTES.patientEdit, { patientId })} className="text-xs font-semibold text-brand hover:underline">Edit patient</Link>}>
            <dl className="flex flex-col gap-4 text-[13px]">
              {[
                ['Date of birth', patient.dob ? `${formatDate(patient.dob)} (${patient.age} yrs)` : `${patient.age} yrs`],
                ['Sex & blood', `${patient.gender} · ${patient.bloodGroup}`],
                ['Residential address', patient.address || '—'],
                ['Emergency / alternate contact', patient.emergencyName ? `${patient.emergencyName} (${patient.emergencyRelation}) · ${patient.emergencyPhone}` : '—'],
                ['National health address (ABDM)', patient.abhaAddress ?? patient.abha],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="font-medium">{value}</dd></div>
              ))}
            </dl>
          </Card>

          <Card title="Family & caregiver" tag={<StatusPill>{family.length} Linked</StatusPill>}>
            {family[0] ? (
              <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                <p className="font-semibold">{family[0].name} <StatusPill tone="info">{family[0].access}</StatusPill></p>
                <p className="text-on-surface-variant">{family[0].relationship} · {family[0].mobile}</p>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No family or caregiver is linked yet.</p>
            )}
            <Link to={pathFor(ROUTES.patientFamily, { patientId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">View family &amp; caregiver →</Link>
          </Card>

          <Card title="Billing & financial summary" tag={<StatusPill tone={summary.outstanding ? 'warning' : 'success'}>{summary.outstanding ? 'Balance due' : 'Settled'}</StatusPill>}>
            <p className="rounded-md bg-surface-low p-3"><span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Outstanding balance</span><br /><strong className="text-2xl">{formatINR(summary.outstanding, 2)}</strong></p>
            <KeyValueRows className="mt-3" rows={[['Last transaction', lastPayment ? `${formatINR(lastPayment.amount)} (${formatDate(lastPayment.date)})` : 'None yet'], ['Payment method', lastPayment?.instrument ?? '—'], ['Unallocated credit', formatINR(summary.unallocated)]]} />
            <Link to={pathFor(ROUTES.patientBilling, { patientId })} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">View billing &amp; ledger →</Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
