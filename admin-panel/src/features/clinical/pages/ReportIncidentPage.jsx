import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useDraft } from '../../../lib/useDraft'
import { useAuth } from '../../auth/context/useAuth'
import { staffApi } from '../../staff/api'
import { Check, FieldError, FlowSection, OptionSelect, TextArea } from '../../patients/components/parts'
import { branchesApi, incidentsApi, patientsApi } from '../../patients/api'
import { TODAY } from '../../patients/format'
import { clockTime } from '../../patients/selectors'
import { CONTRIBUTING_FACTORS, FACILITY_ZONES, INCIDENT_CATEGORIES, OCCURRED_PRESETS, SEVERITY_LEVELS } from '../constants'
import { validateIncident } from '../logic'

const SEVERITY_STYLE = { 1: 'border-brand', 2: 'border-slate-400', 3: 'border-yellow-500', 4: 'border-orange-500', 5: 'border-red-500 bg-red-50' }

// Any member of the clinic may report. The report is stored on the server; an anonymous one keeps no record of
// who filed it, and a sentinel event (level 5) involving a patient also flags their chart.
export default function ReportIncidentPage() {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const draft = useDraft('incident-draft', {
    category: '', severity: '', preset: 'now', date: TODAY, time: clockTime(), branchId: '', zone: FACILITY_ZONES[0], associate: false, patientId: '',
    headline: '', chronology: '', factors: [], actions: '', anonymous: false, witnesses: [], notifyQuality: true, logRegister: true,
  })
  const values = draft.value
  const [attempted, setAttempted] = useState(false)
  const [search, setSearch] = useState('')
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const branches = useApiResource(() => branchesApi.list(), 'branches').data ?? []
  const staff = useApiResource(() => (can('staff.view') ? staffApi.list({ status: 'active', pageSize: 100 }) : Promise.resolve({ data: [] })), 'incident-staff').data?.data ?? []
  const matches = useApiResource(() => (search.trim().length >= 2 && can('patients.view') ? patientsApi.list({ query: search.trim(), pageSize: 8 }) : Promise.resolve({ data: [] })), search).data?.data ?? []
  const errors = attempted ? validateIncident(values) : {}
  const branchId = values.branchId || branches[0]?.id || ''
  const patient = matches.find((entry) => entry.id === values.patientId) ?? (values.patientId ? draft.value.patientSummary : null)
  const personnel = staff.map((person) => `${person.fullName} (${person.designation})`)
  const set = (name, value) => draft.setValue((current) => ({ ...current, [name]: value }))
  const toggle = (name, entry) => set(name, values[name].includes(entry) ? values[name].filter((other) => other !== entry) : [...values[name], entry])
  const choosePreset = (id) => draft.setValue((current) => ({ ...current, preset: id, ...(id === 'now' ? { date: TODAY, time: clockTime() } : {}) }))

  const choosePatient = (id) => {
    const chosen = matches.find((entry) => entry.id === id)
    draft.setValue((current) => ({ ...current, patientId: id, patientSummary: chosen ? { id: chosen.id, fullName: chosen.fullName, mrn: chosen.mrn, gender: chosen.gender } : null }))
  }

  const submit = async () => {
    setAttempted(true)
    if (Object.keys(validateIncident(values)).length) return
    setSaving(true)
    setServerError('')
    try {
      const incident = await incidentsApi.report({
        category: values.category,
        severity: Number(values.severity),
        date: values.date,
        time: values.time,
        branchId,
        zone: values.zone,
        ...(values.associate && values.patientId ? { patientId: values.patientId } : {}),
        headline: values.headline.trim(),
        chronology: values.chronology.trim(),
        factors: values.factors,
        actions: values.actions.trim(),
        witnesses: values.witnesses,
        anonymous: values.anonymous,
        notifyQuality: values.notifyQuality,
        logRegister: values.logRegister,
      })
      draft.clear()
      navigate(ROUTES.clinical, { state: { incident: incident.reference } })
    } catch (error) {
      setServerError(error.message)
      setSaving(false)
    }
  }

  return (
    <WorkspacePage>
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex gap-2 text-[10px] font-semibold tracking-wide uppercase"><span className="rounded border border-slate-200 bg-white px-2 py-1">NABH PS-01 Protocol</span><span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">Non-discoverable quality assurance record</span></p>
          <p className="text-[11px] text-outline">{draft.savedAt ? `● Auto-saved ${draft.savedAt} IST` : 'Not saved yet'}</p>
        </div>
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">Report Clinical Incident</h1>
        <p className="mt-1 mb-4 text-sm text-on-surface-variant">Document adverse events, medication errors, procedural near-misses, or equipment failures for confidential clinical governance review under WHO &amp; DISHA statutory patient safety standards.</p>
        <InfoNote tone="neutral" icon={Lock} className="mb-5"><strong>Protected clinical triage &amp; whistleblower safe harbor:</strong> this report is routed directly to the Clinical Governance Committee and Medical Directorate. It does not bypass patient-safety confidentiality or compromise physician-staff mutual trust protection.</InfoNote>
        {draft.restored && <p className="mb-4 text-xs text-on-surface-variant">Restored from your saved draft.</p>}

        <div className="flex flex-col gap-5">
          <FlowSection number="1" title="Incident classification & harm severity" aside="Mandatory field">
            <div role="radiogroup" aria-label="Primary incident classification category" className="grid gap-3 sm:grid-cols-3">
              {INCIDENT_CATEGORIES.map((entry) => (
                <label key={entry.id} className={cn('cursor-pointer rounded-md border p-3 text-xs', values.category === entry.id ? 'border-2 border-brand bg-teal-50/60' : 'border-slate-200')}>
                  <input type="radio" name="category" value={entry.id} checked={values.category === entry.id} onChange={() => set('category', entry.id)} className="sr-only" />
                  <strong className="block text-[13px]">{entry.label}</strong><span className="text-on-surface-variant">{entry.hint}</span>
                </label>
              ))}
            </div>
            <FieldError>{errors.category}</FieldError>
            <p className="mt-5 mb-2 flex justify-between text-[11px] font-semibold tracking-wide text-outline uppercase"><span>Potential &amp; actual harm severity matrix</span><span className="font-normal normal-case">Clinical safety triage standard</span></p>
            <div role="radiogroup" aria-label="Harm severity" className="grid gap-2 sm:grid-cols-5">
              {SEVERITY_LEVELS.map((entry) => {
                const selected = Number(values.severity) === entry.level
                return (
                  <button key={entry.level} type="button" role="radio" aria-checked={selected} onClick={() => set('severity', String(entry.level))} className={cn('rounded-md border-t-4 border-x border-b bg-white p-3 text-left text-[11px]', SEVERITY_STYLE[entry.level], selected ? 'ring-2 ring-brand' : 'border-x-slate-200 border-b-slate-200')}>
                    <span className="text-[10px] font-semibold tracking-wide text-outline uppercase">Level {entry.level}</span>
                    <strong className="block text-[13px]">{entry.name}</strong>
                    <span className="text-on-surface-variant">{entry.hint}</span>
                    <span className="mt-1 block font-semibold text-brand">{selected ? '✓ Selected state' : 'Click to select'}</span>
                  </button>
                )
              })}
            </div>
            <FieldError>{errors.severity}</FieldError>
          </FlowSection>

          <FlowSection number="2" title="Timing & facility zone context">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[13px] font-semibold">Estimated date &amp; time of occurrence</p>
                <div className="mb-3 flex flex-wrap gap-2">{OCCURRED_PRESETS.map((entry) => <button key={entry.id} type="button" aria-pressed={values.preset === entry.id} onClick={() => choosePreset(entry.id)} className={cn('rounded border px-2.5 py-1 text-xs', values.preset === entry.id ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-surface-lowest')}>{entry.label}</button>)}</div>
                <div className="grid grid-cols-2 gap-3"><TextInput label="Date" type="date" max={TODAY} value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} /><TextInput label="Time" type="time" value={values.time} onChange={(event) => set('time', event.target.value)} error={errors.time} /></div>
              </div>
              <div className="grid gap-3">
                <OptionSelect label="Facility & specific clinical zone" value={branchId} onChange={(event) => set('branchId', event.target.value)} options={branches.map((entry) => ({ value: entry.id, label: entry.name }))} />
                <OptionSelect label="Clinical zone" required value={values.zone} onChange={(event) => set('zone', event.target.value)} error={errors.zone} options={FACILITY_ZONES.map((entry) => ({ value: entry, label: entry }))} />
              </div>
            </div>
          </FlowSection>

          <FlowSection number="3" title="Patient & encounter association" aside={<Check checked={values.associate} onChange={(event) => set('associate', event.target.checked)} label="Associate with active patient" />}>
            {values.associate ? (
              <>
                <TextInput label="Find the patient" placeholder="Name, MRN or mobile (at least 2 characters)" value={search} onChange={(event) => setSearch(event.target.value)} />
                <div className="mt-3"><OptionSelect label="Patient" required placeholder={matches.length ? 'Select the patient involved' : 'Search to list patients'} value={values.patientId} onChange={(event) => choosePatient(event.target.value)} error={errors.patientId} options={[...(patient && !matches.some((entry) => entry.id === patient.id) ? [patient] : []), ...matches].map((entry) => ({ value: entry.id, label: `${entry.fullName} · ${entry.mrn}` }))} /></div>
                {patient && <p className="mt-3 rounded-md bg-surface-lowest p-3 text-xs"><strong className="text-sm">{patient.fullName}</strong> <span className="text-outline">{patient.gender}</span><br /><span className="font-mono text-on-surface-variant">UHID: {patient.mrn}</span></p>}
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">De-linked / general incident. No patient record is attached.</p>
            )}
            <p className="mt-3 text-[11px] text-outline">Associating a patient links the report to them without changing their medical record; a level 5 event also raises a safety alert on their chart.</p>
          </FlowSection>

          <FlowSection number="4" title="Narrative & clinical chronology" aside="Factual, objective description">
            <TextInput label="Incident summary headline" required value={values.headline} onChange={(event) => set('headline', event.target.value)} error={errors.headline} />
            <div className="mt-4"><TextArea label="Detailed clinical chronology & sequence of events" required rows={6} value={values.chronology} onChange={(event) => set('chronology', event.target.value)} error={errors.chronology} hint="What happened? Who was present? How was it caught?" /></div>
            <fieldset className="mt-4"><legend className="mb-2 text-[13px] font-semibold">Contributing factors &amp; root cause signals (select all that apply)</legend><div className="flex flex-wrap gap-2">{CONTRIBUTING_FACTORS.map((factor) => <button key={factor} type="button" aria-pressed={values.factors.includes(factor)} onClick={() => toggle('factors', factor)} className={cn('rounded border px-2.5 py-1.5 text-xs', values.factors.includes(factor) ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>{values.factors.includes(factor) ? '✓ ' : ''}{factor}</button>)}</div></fieldset>
            <div className="mt-4"><TextArea label="Immediate corrective action & mitigations deployed" rows={4} value={values.actions} onChange={(event) => set('actions', event.target.value)} error={errors.actions} hint={Number(values.severity) >= 4 ? 'Required for moderate harm or worse.' : undefined} /></div>
          </FlowSection>

          <FlowSection number="5" title="Witness & involved personnel" aside={<Check checked={values.anonymous} onChange={(event) => set('anonymous', event.target.checked)} label="Submit via anonymous safe harbor" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 text-[13px] font-semibold">Primary reporting clinician</p><p className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs"><strong className="text-sm">{values.anonymous ? 'Anonymous (identity withheld)' : user.fullName}</strong><br />{values.anonymous ? 'No record of who filed it is kept' : 'Named as the reporter'}</p></div>
              <fieldset><legend className="mb-1.5 text-[13px] font-semibold">Other personnel present / intercepting</legend><div className="flex flex-col gap-1.5">{personnel.length ? personnel.map((person) => <Check key={person} checked={values.witnesses.includes(person)} onChange={() => toggle('witnesses', person)} label={person} />) : <p className="text-xs text-on-surface-variant">No staff records to choose from.</p>}</div></fieldset>
            </div>
          </FlowSection>

          <FlowSection number="6" title="Governance notification pipeline">
            <div className="flex flex-col gap-3">
              <Check checked={values.notifyQuality} onChange={(event) => set('notifyQuality', event.target.checked)} label={<><strong>Flag for the Clinical Quality Lead:</strong> marks the report for root-cause review.</>} />
              <Check checked={values.logRegister} onChange={(event) => set('logRegister', event.target.checked)} label={<><strong>Include in the incident register:</strong> listed in the clinic's register of reported incidents.</>} />
            </div>
          </FlowSection>
        </div>

        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-surface-lowest py-4">
          {serverError ? <p role="alert" className="text-xs text-danger">{serverError}</p> : <p className="text-[11px] text-outline">Saved to the clinic's incident register on submission.</p>}
          <div className="flex items-center gap-2">
            <ActionButton onClick={() => { draft.clear(); navigate(ROUTES.clinical) }} className="border-transparent">Discard Draft</ActionButton>
            <ActionButton onClick={() => draft.setValue((current) => ({ ...current }))}>Save Draft</ActionButton>
            <ActionButton variant="primary" icon={Lock} onClick={submit} disabled={saving}>Submit Confidential Incident Report</ActionButton>
          </div>
        </div>
      </div>
    </WorkspacePage>
  )
}
