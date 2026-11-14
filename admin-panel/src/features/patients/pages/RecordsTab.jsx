import { useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardCheck, HeartPulse, ShieldAlert, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { formatDate, formatTime } from '../format'
import CareProgressDrawer from '../../clinical/drawers/CareProgressDrawer'
import { applyReview } from '../../clinical/logic'
import { AllergyDrawer, CarePlanDrawer, NoteDrawer, SafetyAlertDrawer, VitalDetailDrawer } from '../drawers/RecordDrawers'
import { usePatient } from '../context/usePatient'
import { activeAlerts, byNewest, startEncounterPath } from '../selectors'
import { bmiOf, bpStage } from '../validation'

function Card({ icon: Icon, title, aside, children, className }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{Icon && <Icon className="size-4 text-brand" aria-hidden="true" />}{title}</h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

const SEVERITY_BG = { Severe: 'border-red-200 bg-red-50', Moderate: 'border-amber-200 bg-amber-50' }

export default function RecordsTab() {
  const { patient, patientId, mine, update, add, newId } = usePatient()
  const [drawer, setDrawer] = useState(null)
  const alerts = mine('alerts')
  const active = activeAlerts(alerts)
  const allergies = mine('allergies')
  const diagnoses = mine('diagnoses').filter((entry) => entry.status === 'Active')
  const notes = mine('notes').sort(byNewest)
  const plans = mine('carePlans')
  const vitalsHistory = mine('vitals').sort(byNewest)
  const vitals = vitalsHistory[0]
  const encounter = mine('encounters').find((entry) => entry.status === 'In Progress')
  const activeRx = mine('prescriptions').filter((entry) => entry.status === 'Active').flatMap((entry) => entry.items)
  const pendingOrders = mine('orders').filter((entry) => entry.status === 'Awaiting Review')
  const referrals = mine('referrals').filter((entry) => ['Pending Acceptance', 'Awaiting Review'].includes(entry.status))
  const plan = plans[0]
  const bmi = vitals ? bmiOf(vitals.weight, vitals.height) : null
  const close = () => setDrawer(null)
  const route = (pattern) => pathFor(pattern, { patientId })

  const acknowledge = (id, { dispositionId, justification }) =>
    update('alerts', id, (alert) => ({ status: 'Acknowledged', disposition: dispositionId, justification: justification.trim(), audit: [{ time: 'Just now', text: 'Acknowledged with mitigation', by: justification.trim() }, ...alert.audit] }))
  const addAddendum = (id, text) => update('notes', id, (note) => ({ addenda: [...note.addenda, { id: `${id}-${note.addenda.length + 1}`, time: 'Addendum · just now', text }] }))
  const saveReview = (id, values, { complete, escalate }) => {
    const current = plans.find((entry) => entry.id === id)
    update('carePlans', id, applyReview(current, values, { complete, by: current.lead }))
    if (escalate) {
      add('alerts', {
        id: newId('ALT-', 'alerts', 5), patientId, kind: 'CLINICAL FLAG: CARE PLAN ESCALATION', title: `Care plan escalated for attending review — ${current.title}`, severity: 'High', status: 'Active',
        detail: values.observation.trim(), statement: 'The care plan review was escalated. The attending clinician reviews the plan before the next scheduled follow-up.', evidence: [{ label: 'Care plan', detail: `${current.id} · ${current.title}` }],
        audit: [{ time: 'Just now', text: 'Escalated from a care plan progress review', by: current.lead }],
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {active.length > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded bg-danger text-white"><ShieldAlert className="size-5" aria-hidden="true" /></span>
              <div>
                <h2 className="text-base font-semibold text-danger">Clinical Safety &amp; Attention Required ({active.length} Active Alerts) <StatusPill tone="danger" className="ml-1 uppercase">Level 1 triage flag</StatusPill></h2>
                <p className="text-xs text-red-800">Critical safety markers flagged across verified electronic records. Must be reconciled prior to procedural or pharmacologic orders.</p>
              </div>
            </div>
            <ActionButton variant="danger" className="border-danger bg-danger text-white hover:bg-red-800" onClick={() => setDrawer({ type: 'alert', id: active[0].id })}>Acknowledge Safety Context</ActionButton>
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-3">
            {active.map((alert) => (
              <li key={alert.id}>
                <button type="button" onClick={() => setDrawer({ type: 'alert', id: alert.id })} className="flex h-full w-full gap-2 rounded-md border border-red-200 bg-white p-3 text-left text-[11px] hover:bg-red-50">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden="true" />
                  <span><strong className="block text-danger">{alert.kind}</strong>{alert.detail.toUpperCase()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-sm text-brand"><ClipboardCheck className="mr-2 inline size-4" aria-hidden="true" />All clinical safety alerts have been acknowledged.</p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Card icon={Stethoscope} title="Current care context" aside={encounter && <StatusPill tone="brand" dot>In consultation</StatusPill>}>
            {encounter ? (
              <>
                <p className="text-sm font-semibold">Today&apos;s encounter <span className="font-mono text-xs text-brand">#{encounter.id}</span></p>
                <p className="text-xs text-on-surface-variant">{encounter.doctor} · {encounter.chamber}, {encounter.campus} · Started {formatTime(encounter.time)}</p>
                <div className="mt-4"><ActionButton variant="brand" to={pathFor(ROUTES.encounter, { patientId, encounterId: encounter.id })}>Open encounter &amp; document care →</ActionButton></div>
              </>
            ) : (
              <>
                <p className="text-sm text-on-surface-variant">No encounter is open for this patient right now.</p>
                <div className="mt-3"><ActionButton to={startEncounterPath(patientId, mine('appointments'))}>Start Encounter</ActionButton></div>
              </>
            )}
          </Card>

          <Card title={`Active problems & diagnoses (${diagnoses.length} Active)`} aside={<Link to={route(ROUTES.patientEncounters)} className="text-xs font-semibold text-brand hover:underline">View clinical history →</Link>}>
            {diagnoses.length === 0 && <p className="text-sm text-on-surface-variant">No active problems are documented.</p>}
            <ul className="flex flex-col gap-3">
              {diagnoses.map((entry) => (
                <li key={entry.id} className="rounded-md border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-start gap-3"><span className="rounded bg-black px-2 py-1 font-mono text-[10px] leading-4 text-white">ICD-10:<br />{entry.icd}</span><span className="text-sm font-semibold">{entry.name}</span></p>
                    <StatusPill tone="success">{entry.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">{entry.description}</p>
                  <p className="mt-2 text-[11px] text-outline">Severity: <strong className="text-on-surface">{entry.severity ?? entry.designation}</strong> · Verification: <strong className="text-on-surface">{entry.verification}</strong>{entry.careStage && <> · Care stage: <strong className="text-on-surface">{entry.careStage}</strong></>}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Recent clinical notes & consult summaries">
            {notes.length === 0 && <p className="text-sm text-on-surface-variant">No signed notes yet.</p>}
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold">{note.title}</p><span className="flex items-center gap-2"><StatusPill tone="success">{note.status}</StatusPill><span className="text-[11px] text-outline">{formatDate(note.date)}</span></span></div>
                  <p className="text-[11px] text-on-surface-variant">By {note.author} · {note.department}</p>
                  <blockquote className="mt-2 rounded bg-surface-low p-3 text-xs italic leading-5">&ldquo;{note.quote}&rdquo;</blockquote>
                  <button type="button" onClick={() => setDrawer({ type: 'note', id: note.id })} className="mt-2 text-xs font-semibold text-brand hover:underline" aria-label={`View note ${note.title}`}>View note →</button>
                </li>
              ))}
            </ul>
          </Card>

          {plan && (
            <Card title="Active care plan" aside={<span className="flex items-center gap-3 text-[11px] text-outline">Updated {formatDate(plan.updated)} by {plan.updatedBy}<Link to={route(ROUTES.patientCarePlanNew)} className="font-semibold text-brand hover:underline">+ New care plan</Link></span>}>
              <p className="mb-3 text-xs text-on-surface-variant">{plan.title}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {plan.milestones.map((item) => <div key={item.no} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs"><p className="text-[10px] font-semibold text-brand">MILESTONE {item.no}</p><p className="font-semibold">{item.title}</p><p className="mt-1 text-on-surface-variant">{item.detail}</p></div>)}
              </div>
              <p className="mt-3 flex items-center justify-between text-xs"><span className="text-brand">Plan status: {plan.status} ({plan.compliance}% milestone compliance)</span><button type="button" onClick={() => setDrawer({ type: 'plan', id: plan.id })} className="font-semibold text-brand hover:underline">View full care plan →</button></p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Documented allergies" aside={<StatusPill tone="danger">{allergies.length} Recorded</StatusPill>} className="border-red-200">
            {allergies.length === 0 && <p className="text-sm text-on-surface-variant">No food, latex, drug or environmental allergies documented.</p>}
            <ul className="flex flex-col gap-3">
              {allergies.map((allergy) => (
                <li key={allergy.id}>
                  <button type="button" onClick={() => setDrawer({ type: 'allergy', id: allergy.id })} className={cn('w-full rounded-md border p-3 text-left text-xs', SEVERITY_BG[allergy.severity])} aria-label={`Open allergy ${allergy.name}`}>
                    <span className="flex items-start justify-between gap-2"><strong className="text-sm text-danger">{allergy.name}</strong><StatusPill tone={allergy.severity === 'Severe' ? 'danger' : 'warning'}>{allergy.severity.toUpperCase()}</StatusPill></span>
                    <span className="block text-on-surface-variant">{allergy.classLabel}</span>
                    <span className="mt-1 block font-semibold text-danger">Reaction: {allergy.reaction}</span>
                    <span className="mt-1 block text-[10px] text-outline">Recorded: {allergy.recorded} · {allergy.verification}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={HeartPulse} title="Latest vitals" aside={vitals && <span className="text-[10px] text-outline">Recorded {formatDate(vitals.date)}, {formatTime(vitals.time)}</span>}>
            {vitals ? (
              <>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ['Blood pressure', `${vitals.bp.sys}/${vitals.bp.dia}`, 'mmHg', bpStage(vitals.bp.sys, vitals.bp.dia), true],
                    ['Heart rate', vitals.pulse, 'bpm', 'Regular sinus'],
                    ['SpO₂ pulse ox', `${vitals.spo2}%`, 'Room air', 'Ambient air'],
                    ['Body temp', vitals.temp, '°F', 'Normal oral'],
                    ['Weight & BMI', vitals.weight, 'kg', bmi ? `BMI ${bmi} kg/m²` : ''],
                    ['Random glucose', vitals.rbs ?? '—', 'mg/dL', vitals.rbs ? 'Euglycemic' : ''],
                  ].map(([label, value, unit, note, clickable]) => {
                    const body = <><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="text-lg font-bold">{value} <span className="text-[11px] font-normal text-on-surface-variant">{unit}</span></dd><span className="text-[10px] font-medium text-brand">{note}</span></>
                    return clickable ? (
                      <button key={label} type="button" onClick={() => setDrawer({ type: 'vital' })} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-left hover:border-brand" aria-label="Open blood pressure detail">{body}</button>
                    ) : (
                      <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-3">{body}</div>
                    )
                  })}
                </dl>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">No vitals have been recorded for this patient.</p>
            )}
          </Card>

          <Card title="Cross-domain bridges" aside={<span className="text-[10px] text-outline">EHR links</span>}>
            <dl className="flex flex-col gap-4 text-xs">
              <div><dt className="flex items-center justify-between font-semibold text-brand">CURRENT MEDICATIONS <StatusPill tone="success">{activeRx.length} Active</StatusPill></dt><dd className="mt-1 text-on-surface-variant">{activeRx.length ? activeRx.map((item) => `${item.name} ${item.strength}`).join(', ') : 'No active medications.'}</dd><Link to={route(ROUTES.patientPrescriptions)} className="font-semibold text-brand hover:underline">View prescriptions →</Link></div>
              <div><dt className="flex items-center justify-between font-semibold text-amber-700">DIAGNOSTIC ORDERS &amp; RESULTS <StatusPill tone="warning">{pendingOrders.length} Awaiting</StatusPill></dt><dd className="mt-1 text-on-surface-variant">{pendingOrders.length ? `${pendingOrders.length} result awaiting review: ${pendingOrders[0].title}` : 'No results awaiting review.'}</dd><Link to={route(ROUTES.patientOrders)} className="font-semibold text-brand hover:underline">View orders &amp; results →</Link></div>
              <div><dt className="flex items-center justify-between font-semibold text-brand">ACTIVE REFERRALS <StatusPill>{referrals.length ? 'Pending' : 'None'}</StatusPill></dt><dd className="mt-1 text-on-surface-variant">{referrals.length ? `${referrals[0].specialty} (${referrals[0].status})` : 'No active referrals.'}</dd><Link to={route(ROUTES.patientReferrals)} className="font-semibold text-brand hover:underline">View referrals <ArrowRight className="inline size-3" aria-hidden="true" /></Link></div>
            </dl>
          </Card>
        </div>
      </div>

      {drawer?.type === 'alert' && <SafetyAlertDrawer key={drawer.id} alert={alerts.find((entry) => entry.id === drawer.id)} onClose={close} onAcknowledge={acknowledge} />}
      {drawer?.type === 'allergy' && <AllergyDrawer allergy={allergies.find((entry) => entry.id === drawer.id)} onClose={close} />}
      {drawer?.type === 'vital' && <VitalDetailDrawer vitals={vitals} history={vitalsHistory} onClose={close} />}
      {drawer?.type === 'note' && <NoteDrawer key={drawer.id} note={notes.find((entry) => entry.id === drawer.id)} onClose={close} onAddendum={addAddendum} />}
      {drawer?.type === 'plan' && <CarePlanDrawer key={drawer.id} plan={plans.find((entry) => entry.id === drawer.id)} onClose={close} onUpdateProgress={() => setDrawer({ type: 'progress', id: drawer.id })} />}
      {drawer?.type === 'progress' && <CareProgressDrawer key={drawer.id} plan={plans.find((entry) => entry.id === drawer.id)} patient={patient} onClose={() => setDrawer({ type: 'plan', id: drawer.id })} onSave={(values, flags) => saveReview(drawer.id, values, flags)} />}
    </div>
  )
}
