import { useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardList, FileText, Pill, Search, Star } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import FlowFrame, { BackLink, FlowMissing } from '../components/FlowFrame'
import { OptionSelect, SideCard, TextArea } from '../components/parts'
import { usePatient } from '../context/usePatient'
import { CONDITIONS } from '../data/catalog'
import { TODAY, formatDate } from '../format'
import { validateDiagnosis } from '../validation'

const DESIGNATIONS = ['Primary', 'Secondary', 'Differential', 'Comorbidity']
const VERIFICATION = ['Confirmed', 'Provisional (Under Diagnostic Evaluation)']
const CHRONICITY = ['Acute (<4w)', 'Subacute', 'Chronic']
const BLANK = { term: '', icd: '', designation: 'Secondary', verification: VERIFICATION[1], description: '', chronicity: CHRONICITY[0], onset: TODAY }

export default function EncounterDiagnosesPage() {
  const { patient, patientId, mine, find, add, update, newId } = usePatient()
  const { encounterId } = useParams()
  const navigate = useNavigate()
  const encounter = find('encounters', encounterId)
  const [values, setValues] = useState(BLANK)
  const [submitted, setSubmitted] = useState(false)

  if (!patient || !encounter || encounter.patientId !== patient.id) return <FlowMissing patient={patient} what="encounter" />

  const backTo = pathFor(ROUTES.encounter, { patientId, encounterId })
  const all = mine('diagnoses')
  const attached = all.filter((entry) => entry.encounterId === encounter.id)
  const registry = all.filter((entry) => !entry.encounterId)
  const editable = encounter.status === 'In Progress'
  const needle = values.term.trim().toLowerCase()
  const matches = needle ? CONDITIONS.filter((condition) => `${condition.name} ${condition.icd}`.toLowerCase().includes(needle)).slice(0, 5) : []
  const chosen = CONDITIONS.find((condition) => condition.icd === values.icd)
  const duplicate = chosen && attached.find((entry) => entry.icd === chosen.icd && entry.status !== 'Resolved')
  const errors = submitted ? validateDiagnosis(values) : {}

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update_ = (event) => set(event.target.name, event.target.value)
  const choose = (condition) => setValues((current) => ({ ...current, term: condition.name, icd: condition.icd }))

  const attach = () => {
    setSubmitted(true)
    if (Object.keys(validateDiagnosis(values)).length || duplicate) return
    add('diagnoses', {
      id: newId('DX-', 'diagnoses', 3), patientId, encounterId: encounter.id, name: chosen.name, icd: chosen.icd, snomed: chosen.snomed, designation: values.designation,
      verification: values.verification.startsWith('Confirmed') ? 'Confirmed' : 'Provisional', status: 'Active', description: values.description.trim(), chronicity: values.chronicity,
      onset: values.onset, recorded: TODAY, recordedBy: encounter.doctor,
    })
    setValues(BLANK)
    setSubmitted(false)
  }

  const remove = (entry) => update('diagnoses', entry.id, { status: 'Resolved' })

  return (
    <FlowFrame
      title="Encounter diagnosis & problem management"
      badge={<StatusPill tone="warning" dot>In progress ({encounter.id})</StatusPill>}
      description={`${patient.name} · ${patient.age}y / ${patient.gender} · Blood Group ${patient.bloodGroup} · Attending: ${encounter.doctor}`}
      actions={
        <>
          <BackLink to={backTo}>Back to Encounter ({encounter.id})</BackLink>
          <ActionButton variant="brand" onClick={() => navigate(backTo)}>Save &amp; Commit to Encounter</ActionButton>
        </>
      }
    >
      <InfoNote tone="neutral" className="mb-5"><strong className="text-on-surface">Object boundary integrity:</strong> encounter diagnosis ≠ longitudinal medical history ≠ clinical note ≠ prescription. Diagnoses are strictly clinician-attributed and never auto-inferred from vitals or LLM transcripts.</InfoNote>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <header className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><ClipboardList className="size-4 text-brand" aria-hidden="true" />Existing encounter diagnoses</h2><StatusPill>{attached.length} Diagnoses recorded</StatusPill></header>
            {attached.length === 0 && <p className="text-sm text-on-surface-variant">No diagnoses have been attached to this encounter yet.</p>}
            <ul className="flex flex-col gap-3">
              {attached.map((entry) => (
                <li key={entry.id} className={cn('rounded-md border border-slate-200 border-l-4 p-4', entry.designation === 'Primary' ? 'border-l-brand' : 'border-l-slate-300', entry.status === 'Resolved' && 'opacity-60')}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{entry.name} {entry.designation === 'Primary' && <Star className="size-3.5 text-brand" aria-label="Primary" />}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]"><StatusPill tone="brand">{entry.designation}</StatusPill><StatusPill tone={entry.verification === 'Confirmed' ? 'success' : 'warning'}>{entry.verification}</StatusPill><span className="rounded bg-surface-low px-1.5 py-0.5 font-mono">ICD-10: {entry.icd}</span><span className="rounded bg-surface-low px-1.5 py-0.5 font-mono">SNOMED CT: {entry.snomed}</span>{entry.status === 'Resolved' && <StatusPill>Removed</StatusPill>}</p>
                  {entry.description && <p className="mt-2 text-xs text-on-surface-variant">{entry.description}</p>}
                  <p className="mt-2 text-[11px] text-outline">Recorded by {entry.recordedBy} · {formatDate(entry.recorded)}</p>
                  {editable && entry.status !== 'Resolved' && <button type="button" onClick={() => remove(entry)} className="mt-2 text-xs font-semibold text-danger hover:underline">Remove diagnosis</button>}
                </li>
              ))}
            </ul>
          </section>

          {editable ? (
            <section className="rounded-lg border-2 border-brand/40 bg-white p-5">
              <header className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><FileText className="size-4 text-brand" aria-hidden="true" />Add diagnosis / clinical problem</h2><span className="text-[11px] text-outline">ICD-10-CM &amp; SNOMED CT ontological matching</span></header>
              <div className="flex flex-col gap-4">
                <div>
                  <TextInput label="Standardized clinical search (catalogue & free text)" name="term" required value={values.term} onChange={(event) => setValues((current) => ({ ...current, term: event.target.value, icd: '' }))} error={errors.icd} placeholder="Search a condition or ICD-10 code" />
                  {matches.length > 0 && !chosen && (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white" role="listbox" aria-label="Matching conditions">
                      {matches.map((condition) => (
                        <li key={condition.icd}><button type="button" role="option" aria-selected="false" onClick={() => choose(condition)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-surface-lowest"><span><Search className="mr-1.5 inline size-3 text-outline" aria-hidden="true" />{condition.name}</span><span className="font-mono text-brand">ICD-10 {condition.icd}</span></button></li>
                      ))}
                    </ul>
                  )}
                  {chosen && <p className="mt-1 text-[11px] text-brand">Selected: ICD-10 {chosen.icd} · SNOMED CT {chosen.snomed}</p>}
                </div>
                {duplicate && (
                  <InfoNote tone="warning" icon={AlertTriangle}><strong>Possible duplicate detected:</strong> an active diagnosis for <strong>{duplicate.name}</strong> is already recorded in {encounter.id}. Edit that entry instead of creating a redundant one.</InfoNote>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <OptionSelect label="Diagnosis designation" name="designation" value={values.designation} onChange={update_} options={DESIGNATIONS.map((entry) => ({ value: entry, label: entry }))} />
                  <OptionSelect label="Verification status" name="verification" value={values.verification} onChange={update_} options={VERIFICATION.map((entry) => ({ value: entry, label: entry }))} />
                </div>
                <TextArea label="Clinical description & anatomical narrative notes" name="description" required rows={3} value={values.description} onChange={update_} error={errors.description} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <OptionSelect label="Chronicity pattern" name="chronicity" value={values.chronicity} onChange={update_} options={CHRONICITY.map((entry) => ({ value: entry, label: entry }))} />
                  <TextInput label="Recorded onset date" name="onset" type="date" value={values.onset} onChange={update_} />
                  <TextInput label="Associated encounter" value={`${encounter.id} (current session)`} readOnly />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <p className="text-[11px] text-outline">Requires attending physician signature prior to billing</p>
                  <div className="flex gap-2"><ActionButton onClick={() => { setValues(BLANK); setSubmitted(false) }}>Clear</ActionButton><ActionButton variant="primary" onClick={attach}>Attach Diagnosis to Encounter</ActionButton></div>
                </div>
              </div>
            </section>
          ) : (
            <InfoNote tone="neutral">This encounter is {encounter.status.toLowerCase()} — diagnoses can no longer be added.</InfoNote>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <SideCard title="Longitudinal problem registry" tag={<span className="font-mono text-[10px] text-outline">{patient.mrn}</span>}>
            <p className="mb-3 text-[11px] text-on-surface-variant">Patient-level historical problems remain distinct from encounter-specific diagnoses unless explicitly referenced.</p>
            <ul className="flex flex-col gap-2">
              {registry.map((entry) => (
                <li key={entry.id} className="rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">{entry.name}</p><p className="font-mono text-[11px] text-on-surface-variant">ICD-10: {entry.icd}</p><StatusPill tone={entry.status === 'Active' ? 'success' : 'neutral'} className="mt-1">{entry.status}</StatusPill></li>
              ))}
              {registry.length === 0 && <li className="text-xs text-on-surface-variant">No historical problems recorded.</li>}
            </ul>
            <Link to={pathFor(ROUTES.patientRecords, { patientId })} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Open full clinical records <ArrowRight className="size-3" aria-hidden="true" /></Link>
          </SideCard>

          <SideCard title="Downstream workflow launchpad" tag={<span className="font-mono text-[10px] text-outline">{encounter.id}</span>}>
            <div className="flex flex-col gap-2">
              {[['Create prescription (Rx)', 'rx', Pill], ['Order investigation', 'order', ClipboardList]].map(([label, open, Icon]) => (
                <Link key={label} to={backTo} state={{ open }} className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-xs hover:bg-surface-lowest"><Icon className="size-4 text-brand" aria-hidden="true" /><span className="font-semibold">{label}</span><ArrowRight className="ml-auto size-3 text-outline" aria-hidden="true" /></Link>
              ))}
            </div>
          </SideCard>
        </div>
      </div>
    </FlowFrame>
  )
}
