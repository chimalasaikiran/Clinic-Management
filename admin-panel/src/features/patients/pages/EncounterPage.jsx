import { useState } from 'react'
import { Activity, CheckCircle2, ClipboardList, FileText, FlaskConical, Pill, Plus, Share2, Stethoscope } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { KeyValueRows, SideCard, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { usePatient } from '../context/usePatient'
import CreateOrderDrawer from '../drawers/CreateOrderDrawer'
import CreatePrescriptionDrawer from '../drawers/CreatePrescriptionDrawer'
import RecordVitalsDrawer from '../drawers/RecordVitalsDrawer'
import { formatDate, formatINR, formatTime } from '../format'
import { auditEntry, byNewest } from '../selectors'
import { bmiClass, bmiOf, bpStage } from '../validation'

function Block({ icon: Icon, title, aside, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface"><Icon className="size-4 text-brand" aria-hidden="true" />{title}</h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

const BP_TONE = { Normal: 'text-brand', Elevated: 'text-amber-700' }

export default function EncounterPage() {
  const { patient, patientId, mine, find, add, update, newId } = usePatient()
  const { encounterId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const encounter = find('encounters', encounterId)
  const [overlay, setOverlay] = useState(location.state?.open ?? null)
  const [draft, setDraft] = useState(() => ({ complaint: encounter?.complaint ?? '', ...(encounter?.soap ?? { subjective: '', objective: '', assessment: '', plan: '' }) }))
  const [notice, setNotice] = useState(null)

  if (!patient || !encounter || encounter.patientId !== patient.id) return <FlowMissing patient={patient} what="encounter" />

  const open = encounter.status === 'In Progress'
  const allVitals = mine('vitals').filter((entry) => entry.encounterId === encounter.id).sort(byNewest)
  const vitals = allVitals[0]
  const diagnoses = mine('diagnoses').filter((entry) => entry.encounterId === encounter.id && entry.status !== 'Resolved')
  const prescriptions = mine('prescriptions').filter((entry) => entry.encounterId === encounter.id)
  const orders = mine('orders').filter((entry) => entry.encounterId === encounter.id)
  const allergies = mine('allergies')
  const activeMeds = mine('prescriptions').filter((entry) => entry.status === 'Active').flatMap((entry) => entry.items)
  const appointment = encounter.appointmentId ? find('appointments', encounter.appointmentId) : null
  const bmi = vitals ? bmiOf(vitals.weight, vitals.height) : null
  const stage = vitals ? bpStage(vitals.bp.sys, vitals.bp.dia) : null
  const latestVitals = mine('vitals').sort(byNewest)[0]

  const activity = [
    { key: 'start', at: encounter.time, title: `Encounter ${encounter.id} initiated`, detail: appointment ? `From ${appointment.id}` : 'Walk-in' },
    ...(appointment?.arrivedAt ? [{ key: 'arrive', at: appointment.arrivedAt, title: 'Patient checked-in at Reception Desk', detail: `Token ${appointment.queueToken} issued` }] : []),
    ...allVitals.map((entry) => ({ key: entry.id, at: entry.time, title: 'Vitals recorded', detail: `BP ${entry.bp.sys}/${entry.bp.dia} · Pulse ${entry.pulse}` })),
    ...prescriptions.map((entry) => ({ key: entry.id, at: entry.time, title: `E-Prescription generated (${entry.items.length} items)`, detail: entry.prescriber })),
    ...orders.map((entry) => ({ key: entry.id, at: entry.time, title: `Order ${entry.id} placed`, detail: entry.title })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const saveNote = () => {
    const { complaint, ...soap } = draft
    update('encounters', encounter.id, { complaint, soap })
    setNotice({ tone: 'brand', text: 'Clinical documentation saved to the encounter.' })
  }

  const complete = () => {
    if (!draft.complaint.trim()) return setNotice({ tone: 'danger', text: 'Document the chief complaint before completing the encounter.' })
    if (diagnoses.length === 0) return setNotice({ tone: 'danger', text: 'Attach at least one diagnosis before completing the encounter.' })
    const { complaint, ...soap } = draft
    update('encounters', encounter.id, {
      status: 'Signed & Locked', complaint, soap, icd: `ICD-10: ${diagnoses.map((entry) => entry.icd).join(', ')}`,
      artifacts: [...(prescriptions.length ? [`${prescriptions.length} Rx Issued`] : []), ...(orders.length ? [`${orders.length} Orders`] : []), 'EHR Signed'],
    })
    if (appointment) update('appointments', appointment.id, (current) => ({ status: 'Completed', audit: [auditEntry(`Encounter ${encounter.id} completed`, encounter.doctor), ...(current.audit ?? [])] }))
    navigate(pathFor(ROUTES.patientEncounters, { patientId }))
  }

  const addPrescription = (rx) => {
    add('prescriptions', {
      ...rx, id: `RX-2026-${encounter.id.slice(-4)}-${String.fromCharCode(65 + prescriptions.length)}`,
      patientId, encounterId: encounter.id, prescriber: encounter.doctor, department: encounter.department, registration: 'NMC #61820', branch: encounter.branch, status: 'Active', dispensing: 'Awaiting pharmacy acknowledgement',
      hash: 'sha256:pending', events: [{ time: formatTime(rx.time), title: 'Prescription authorized & digitally signed', actor: encounter.doctor, note: `Linked to ${encounter.id}.` }],
    })
  }

  const addOrder = (order) => add('orders', { ...order, id: newId('ORD-2026-', 'orders', 4), patientId, encounterId: encounter.id, ordering: `${encounter.doctor} (${encounter.department})` })

  const launch = [
    { label: 'Note', hint: 'Clinical note', icon: FileText, onClick: () => document.getElementById('soap-subjective')?.focus() },
    { label: 'Vitals', hint: 'Triage entry', icon: Activity, onClick: () => setOverlay('vitals') },
    { label: 'Diagnosis', hint: 'ICD-10 code', icon: ClipboardList, to: pathFor(ROUTES.encounterDiagnoses, { patientId, encounterId: encounter.id }) },
    { label: 'Rx', hint: 'E-Prescription', icon: Pill, onClick: () => setOverlay('rx') },
    { label: 'Lab Order', hint: 'Diagnostic test', icon: FlaskConical, onClick: () => setOverlay('order') },
    { label: 'Referral', hint: 'Specialist care', icon: Share2, to: pathFor(ROUTES.patientReferrals, { patientId }) },
  ]

  return (
    <FlowFrame
      title="Consultation"
      badge={<StatusPill tone={open ? 'success' : 'neutral'} dot>{open ? 'IN PROGRESS' : encounter.status.toUpperCase()}</StatusPill>}
      description={`Encounter ${encounter.id} · ${formatDate(encounter.date)} · Started ${formatTime(encounter.time)} IST · ${encounter.doctor} · ${encounter.department}`}
      actions={
        <>
          <BackLink to={pathFor(ROUTES.patientEncounters, { patientId })}>Encounters</BackLink>
          {open && <ActionButton variant="primary" icon={CheckCircle2} onClick={complete}>Complete encounter</ActionButton>}
        </>
      }
    >
      {notice && <InfoNote tone={notice.tone} className="mb-4"><span role="status">{notice.text}</span></InfoNote>}

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><strong className="text-base">{patient.name}</strong> <span className="text-on-surface-variant">{patient.age}y / {patient.gender} · UHID: <span className="font-mono">{patient.mrn}</span> · ABHA: {patient.abha} · {patient.mobile}</span></p>
          <p className="flex gap-2 text-xs"><StatusPill>Blood Group: {patient.bloodGroup}</StatusPill><StatusPill>Attending: {encounter.doctor}</StatusPill></p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {allergies.length ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs"><p className="font-semibold text-danger">{allergies[0].severity.toUpperCase()} ALLERGY RECORDED</p><p className="mt-1 font-semibold">{allergies[0].name} — {allergies[0].reaction}</p><p className="text-on-surface-variant">{allergies[0].classLabel} medications are strictly contraindicated.</p></div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs text-on-surface-variant">No allergies documented. Missing allergy documentation is not equivalent to No Known Allergies.</div>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs"><p className="font-semibold text-amber-900">ACTIVE MEDICATION RECONCILIATION</p><p className="mt-1">{activeMeds.length ? activeMeds.map((entry) => `${entry.name} ${entry.strength}`).join(' · ') : 'No active medications on record.'}</p></div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Block icon={Stethoscope} title="Chief complaint & reason for visit" aside={<span className="text-[11px] text-outline">{formatDate(encounter.date)}</span>}>
            {open ? <TextArea label="Chief complaint" rows={3} value={draft.complaint} onChange={(event) => setDraft((current) => ({ ...current, complaint: event.target.value }))} /> : <p className="rounded bg-surface-low p-3 text-sm">{encounter.complaint || 'Not documented.'}</p>}
          </Block>

          <Block icon={Activity} title="Physiological vitals" aside={open && <ActionButton size="sm" icon={Plus} onClick={() => setOverlay('vitals')}>Record / Update Vitals</ActionButton>}>
            {vitals ? (
              <dl className="grid gap-3 sm:grid-cols-5">
                {[
                  ['Blood pressure', `${vitals.bp.sys} / ${vitals.bp.dia}`, 'mmHg', stage, BP_TONE[stage] ?? 'text-danger'],
                  ['Heart rate', vitals.pulse, 'bpm', 'Regular sinus', 'text-brand'],
                  ['SpO₂ (room air)', `${vitals.spo2}%`, 'Ambient air', vitals.spo2 >= 95 ? 'Optimal saturation' : 'Low saturation', vitals.spo2 >= 95 ? 'text-brand' : 'text-danger'],
                  ['Temperature', vitals.temp, '°F (Oral)', vitals.temp < 99.5 ? 'Afebrile' : 'Febrile', 'text-brand'],
                  ['BMI & mass', bmi ?? '—', `${vitals.weight} kg · ${vitals.height} cm`, bmiClass(bmi), 'text-brand'],
                ].map(([label, value, unit, note, tone]) => (
                  <div key={label} className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="text-xl font-bold">{value}</dd><p className="text-[11px] text-on-surface-variant">{unit}</p><p className={cn('text-[11px] font-medium', tone)}>{note}</p></div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-on-surface-variant">No vitals recorded for this encounter yet.</p>
            )}
          </Block>

          <Block icon={ClipboardList} title="Active diagnoses & encounter problems" aside={open && <Link to={pathFor(ROUTES.encounterDiagnoses, { patientId, encounterId: encounter.id })} className="text-xs font-semibold text-brand hover:underline">+ Add Diagnosis / Problem</Link>}>
            {diagnoses.length ? (
              <ul className="flex flex-col gap-3">
                {diagnoses.map((diagnosis) => (
                  <li key={diagnosis.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs">
                    <div><p className="text-sm font-semibold">{diagnosis.name}</p><p className="font-mono text-[11px] text-on-surface-variant">ICD-10: {diagnosis.icd} · SNOMED {diagnosis.snomed}</p><p className="mt-1 text-on-surface-variant">{diagnosis.description}</p></div>
                    <StatusPill tone={diagnosis.designation === 'Primary' ? 'brand' : 'neutral'}>{diagnosis.designation}</StatusPill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">No diagnoses attached to this encounter.</p>
            )}
          </Block>

          <Block icon={FileText} title="Clinical documentation (SOAP framework)" aside={open && <ActionButton size="sm" onClick={saveNote}>Save note</ActionButton>}>
            <div className="grid gap-4">
              {[['subjective', 'S — Subjective'], ['objective', 'O — Objective'], ['assessment', 'A — Assessment'], ['plan', 'P — Plan']].map(([key, label]) =>
                open ? (
                  <TextArea key={key} id={`soap-${key}`} label={label} rows={3} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
                ) : (
                  <div key={key}><p className="text-[11px] font-semibold text-outline uppercase">{label}</p><p className="text-sm">{encounter.soap?.[key] || 'Not documented.'}</p></div>
                ),
              )}
            </div>
          </Block>

          <Block icon={Pill} title="Encounter e-prescription (E-Rx)" aside={open && <ActionButton size="sm" onClick={() => setOverlay('rx')}>Create / Edit Prescription</ActionButton>}>
            {prescriptions.length ? (
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Medicine & formulation</th><th className="pb-2">Dosage & frequency</th><th className="pb-2">Duration</th><th className="pb-2">Instructions</th></tr></thead>
                <tbody>
                  {prescriptions.flatMap((rx) => rx.items.map((item) => (
                    <tr key={`${rx.id}-${item.id}`} className="border-t border-slate-100 align-top"><td className="py-2 font-semibold">{item.name} {item.strength}</td><td className="py-2">{item.dose ?? item.frequency}<br /><span className="text-on-surface-variant">{item.frequency}</span></td><td className="py-2">{item.durationDays} days</td><td className="py-2 text-on-surface-variant">{item.instructions || item.frequencyNote}</td></tr>
                  )))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-on-surface-variant">No prescription issued in this encounter.</p>
            )}
          </Block>

          <Block icon={FlaskConical} title="Diagnostic orders (lab & imaging)" aside={open && <ActionButton size="sm" onClick={() => setOverlay('order')}>Create Lab / Imaging Order</ActionButton>}>
            {orders.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {orders.map((order) => (
                  <li key={order.id} className="rounded-md border border-slate-200 p-3 text-xs"><p className="flex items-start justify-between gap-2 text-sm font-semibold">{order.title} <StatusPill>{order.status}</StatusPill></p><p className="mt-1 text-on-surface-variant">{order.category} · {order.id}</p></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">No diagnostic orders placed in this encounter.</p>
            )}
          </Block>
        </div>

        <div className="flex flex-col gap-5">
          <SideCard title="Encounter architecture" tag={<span className="font-mono text-[10px] text-outline">FHIR R4 Bound</span>}>
            <KeyValueRows rows={[
              ['Linked appointment', appointment ? <Link key="apt" to={pathFor(ROUTES.appointment, { patientId, appointmentId: appointment.id })} className="font-semibold text-brand hover:underline">{appointment.id}</Link> : 'Walk-in'],
              ['Queue token state', appointment?.queueToken ? `${appointment.queueToken} · ${open ? 'In consulting' : 'Closed'}` : '—'],
              ['Encounter class', 'AMB (Ambulatory OPD)'],
              ['Source / referral', appointment ? 'Scheduled appointment handoff' : 'Direct'],
            ]} />
          </SideCard>

          {open && (
            <SideCard title="Workflow launchpad" tag={<span className="text-[10px] text-outline">Shortcuts</span>}>
              <div className="grid grid-cols-2 gap-2">
                {launch.map((item) => {
                  const body = <><item.icon className="size-4 text-brand" aria-hidden="true" /><span className="text-xs font-semibold">+ {item.label}</span><span className="text-[10px] text-outline">{item.hint}</span></>
                  const classes = 'flex flex-col items-start gap-1 rounded-md border border-slate-200 p-3 text-left hover:bg-surface-lowest'
                  return item.to ? <Link key={item.label} to={item.to} className={classes}>{body}</Link> : <button key={item.label} type="button" onClick={item.onClick} className={classes}>{body}</button>
                })}
              </div>
            </SideCard>
          )}

          <SideCard title="Encounter activity timeline" tag={<span className="text-[10px] text-outline">Real-time</span>}>
            <Timeline events={activity.map((event) => ({ time: formatTime(event.at), title: event.title, detail: event.detail }))} />
          </SideCard>

          <SideCard title="Billing context (read-only)" tag={<span className="text-[10px] text-outline">Staged draft</span>}>
            <p className="text-2xl font-bold">{formatINR(appointment?.tariff ?? 0, 2)}</p>
            <p className="text-[11px] text-on-surface-variant">{appointment?.service ?? encounter.type} · standard tariff</p>
            <p className="mt-2 text-[11px] text-on-surface-variant">Encounter completion does not auto-debit payments.</p>
            <Link to={pathFor(ROUTES.patientBilling, { patientId })} className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">View billing →</Link>
          </SideCard>
        </div>
      </div>

      {open && (
        <>
          <RecordVitalsDrawer open={overlay === 'vitals'} onClose={() => setOverlay(null)} patient={patient} encounter={encounter} onSave={(record) => add('vitals', { ...record, id: newId('VIT-', 'vitals', 4) })} />
          <CreatePrescriptionDrawer open={overlay === 'rx'} onClose={() => setOverlay(null)} patient={patient} encounter={encounter} allergies={allergies} diagnoses={diagnoses} latestVitals={latestVitals} onAuthorize={addPrescription} />
          <CreateOrderDrawer open={overlay === 'order'} onClose={() => setOverlay(null)} patient={patient} encounter={encounter} diagnoses={diagnoses} onSubmit={addOrder} />
        </>
      )}
    </FlowFrame>
  )
}
