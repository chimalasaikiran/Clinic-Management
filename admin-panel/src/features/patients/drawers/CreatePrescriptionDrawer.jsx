import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { OptionSelect, Check, PatientStrip, TextArea } from '../components/parts'
import { TextInput } from '../../../components/workspace/FormControls'
import { DURATIONS, FOOD_RELATIONS, FREQUENCIES, MEDICINES, ROUTES_OF_ADMIN } from '../data/catalog'
import { TODAY } from '../format'
import { bpStage, allergyConflicts, validateMedication, validatePrescription } from '../validation'
import { cn } from '../../../lib/cn'
import { clockTime } from '../selectors'

const BLANK_MED = { medicineId: '', strength: '', dose: '1', route: 'Oral', frequencyId: 'od', food: 'After food', durationDays: 5, instructions: '' }

// Composes a prescription: medication list, live allergy and condition checks, then authorization.
// `onAuthorize` receives the prescription record; the caller adds it to the store.
export default function CreatePrescriptionDrawer({ open, onClose, patient, encounter, allergies, diagnoses, latestVitals, onAuthorize }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [med, setMed] = useState(BLANK_MED)
  const [medSubmitted, setMedSubmitted] = useState(false)
  const [precautionAck, setPrecautionAck] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const medicine = MEDICINES.find((entry) => entry.id === med.medicineId)
  const medErrors = medSubmitted ? validateMedication(med) : {}
  const conflicts = medicine ? allergyConflicts(medicine.drugClass, allergies) : []
  const hypertensive = latestVitals && bpStage(latestVitals.bp.sys, latestVitals.bp.dia).startsWith('Stage')
  const nsaids = items.filter((item) => item.drugClass === 'nsaid')
  const needsPrecautionAck = hypertensive && nsaids.length > 0
  const errors = submitted ? { ...validatePrescription({ items }), ...(needsPrecautionAck && !precautionAck ? { precaution: 'Acknowledge the drug–condition precaution to continue.' } : {}) } : {}

  const reset = () => {
    setItems([])
    setAdding(false)
    setMed(BLANK_MED)
    setMedSubmitted(false)
    setPrecautionAck(false)
    setSubmitted(false)
  }
  const finish = () => {
    reset()
    onClose()
  }
  const updateMed = (event) => setMed((current) => ({ ...current, [event.target.name]: event.target.value }))
  const pickMedicine = (event) => {
    const next = MEDICINES.find((entry) => entry.id === event.target.value)
    setMed((current) => ({ ...current, medicineId: event.target.value, strength: next?.strengths[0] ?? '' }))
  }

  const addMedication = () => {
    setMedSubmitted(true)
    if (Object.keys(validateMedication(med)).length || conflicts.length) return
    const frequency = FREQUENCIES.find((entry) => entry.id === med.frequencyId)
    const days = Number(med.durationDays)
    setItems((current) => [
      ...current,
      {
        id: `i${current.length + 1}`, name: medicine.name, strength: med.strength, form: medicine.form, route: med.route, drugClass: medicine.drugClass,
        dose: `${med.dose} ${medicine.form}`, frequency: frequency.label, frequencyNote: med.food, durationDays: days, quantity: Number(med.dose) * frequency.perDay * days, refills: 0,
        instructions: med.instructions.trim(), indication: diagnoses[0]?.name ?? 'Clinician indication', dispensing: { state: 'Awaiting', note: 'Pending pharmacy acknowledgement' },
      },
    ])
    setMed(BLANK_MED)
    setMedSubmitted(false)
    setAdding(false)
  }

  const authorize = () => {
    setSubmitted(true)
    if (Object.keys(validatePrescription({ items })).length || (needsPrecautionAck && !precautionAck)) return
    onAuthorize({ date: TODAY, time: clockTime(), items, indication: diagnoses.map((entry) => entry.name).join('; ') || 'Clinician indication', precautionAcknowledged: precautionAck })
    finish()
  }

  const duplicates = items.filter((item, index) => items.findIndex((other) => other.name === item.name) !== index)

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={encounter ? `Encounter ${encounter.id}` : 'Standalone prescription'}
      title="Create Prescription (Rx)"
      description="Draft v1.0 (Unsigned) · Authoritative medication order and e-prescription."
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <ActionButton variant="primary" onClick={authorize}>Review &amp; Authorize Prescription</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <PatientStrip patient={patient} />

        <section>
          <h3 className="mb-2 text-sm font-semibold">1. Patient clinical &amp; safety context</h3>
          {allergies.length ? (
            <InfoNote tone="danger" icon={AlertTriangle}><strong>Documented allergies:</strong> {allergies.map((allergy) => `${allergy.name} (${allergy.severity})`).join(' · ')}. Matching medications are blocked.</InfoNote>
          ) : (
            <InfoNote tone="brand" icon={CheckCircle2}><strong>No known drug allergies (NKDA) documented.</strong> Confirm with the patient before prescribing.</InfoNote>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {diagnoses.length ? diagnoses.map((diagnosis) => (
              <div key={diagnosis.id} className="rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">{diagnosis.name}</p><p className="font-mono text-[11px] text-on-surface-variant">ICD-10: {diagnosis.icd}</p></div>
            )) : <p className="text-xs text-on-surface-variant">No diagnoses are linked to this encounter yet.</p>}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">2. Prescribed medications ({items.length})</h3>
            <ActionButton size="sm" variant="brand" icon={Plus} onClick={() => setAdding(true)} disabled={adding}>Add Medication</ActionButton>
          </div>

          {adding && (
            <div className="mb-3 rounded-md border-2 border-brand p-4">
              <p className="mb-3 text-sm font-semibold">Add new medication <span className="ml-2 text-[11px] font-normal text-outline">Catalogue: CDSCO National Formulary Live</span></p>
              <div className="grid gap-4 sm:grid-cols-2">
                <OptionSelect label="Drug name & strength selection" required value={med.medicineId} onChange={pickMedicine} placeholder="Search formulary" error={medErrors.medicineId} options={MEDICINES.map((entry) => ({ value: entry.id, label: entry.name }))} />
                <OptionSelect label="Strength" required value={med.strength} name="strength" onChange={updateMed} error={medErrors.strength} placeholder="Select" options={(medicine?.strengths ?? []).map((entry) => ({ value: entry, label: entry }))} />
                <TextInput label="Dose" name="dose" type="number" min="1" value={med.dose} onChange={updateMed} error={medErrors.dose} hint={medicine ? medicine.form : undefined} />
                <OptionSelect label="Route of administration" name="route" value={med.route} onChange={updateMed} options={ROUTES_OF_ADMIN.map((entry) => ({ value: entry, label: entry }))} />
                <OptionSelect label="Frequency & regimen" name="frequencyId" value={med.frequencyId} onChange={updateMed} error={medErrors.frequencyId} options={FREQUENCIES.map((entry) => ({ value: entry.id, label: entry.label }))} />
                <OptionSelect label="Food relationship" name="food" value={med.food} onChange={updateMed} options={FOOD_RELATIONS.map((entry) => ({ value: entry, label: entry }))} />
                <OptionSelect label="Duration of therapy" name="durationDays" value={String(med.durationDays)} onChange={updateMed} error={medErrors.durationDays} options={DURATIONS.map((days) => ({ value: String(days), label: `${days} days` }))} />
              </div>
              <div className="mt-4"><TextArea label="Clinical instructions / special advice" rows={2} name="instructions" value={med.instructions} onChange={updateMed} /></div>
              {conflicts.length > 0 && (
                <InfoNote tone="danger" icon={AlertTriangle} className="mt-3"><strong>Contraindicated:</strong> {medicine.name} conflicts with the documented {conflicts[0].name} allergy ({conflicts[0].reaction}). Choose a different medication.</InfoNote>
              )}
              {medicine && !conflicts.length && <InfoNote tone="brand" icon={CheckCircle2} className="mt-3"><strong>Live check:</strong> no allergy cross-reactivity found for {medicine.name}.</InfoNote>}
              <div className="mt-4 flex justify-end gap-2">
                <ActionButton onClick={() => { setAdding(false); setMed(BLANK_MED); setMedSubmitted(false) }}>Cancel / Clear</ActionButton>
                <ActionButton variant="brand" onClick={addMedication}>Add to Prescription</ActionButton>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li key={item.id} className="rounded-md border border-slate-200 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{index + 1}. {item.name} <span className="font-normal text-on-surface-variant">{item.strength} {item.form}</span></p>
                  <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="text-outline hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button>
                </div>
                <p className="mt-1 text-on-surface-variant">{item.route} · {item.frequency} · {item.frequencyNote} · {item.durationDays} days · Total {item.quantity}</p>
                {item.instructions && <p className="mt-1 rounded bg-surface-low p-2 italic">&ldquo;{item.instructions}&rdquo;</p>}
              </li>
            ))}
          </ul>
          {errors.items && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.items}</p>}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">3. Real-time safety engine &amp; clinical guardrails</h3>
          <div className="flex flex-col gap-2">
            {needsPrecautionAck && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
                <p className="font-semibold">Drug–condition precaution: NSAID ({nsaids[0].name}) with {bpStage(latestVitals.bp.sys, latestVitals.bp.dia)}</p>
                <p className="mt-1 text-on-surface-variant">Latest BP {latestVitals.bp.sys}/{latestVitals.bp.dia} mmHg. NSAIDs may raise blood pressure and reduce renal perfusion; prefer a short course with monitoring.</p>
                <div className="mt-2"><Check checked={precautionAck} onChange={(event) => setPrecautionAck(event.target.checked)} label="I acknowledge this precaution and accept clinical responsibility for the short course." /></div>
                {errors.precaution && <p role="alert" className="mt-1 text-rose-600">{errors.precaution}</p>}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs"><strong>Allergy cross-check: PASSED</strong><br />{allergies.length ? 'No listed medication conflicts with documented allergies.' : 'No cross-reactivity with NKDA profile.'}</p>
              <p className={cn('rounded-md border p-3 text-xs', duplicates.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50/60')}><strong>Duplicate ingredient: {duplicates.length ? 'REVIEW' : 'PASSED'}</strong><br />{duplicates.length ? `${duplicates[0].name} is listed more than once.` : 'No overlapping ingredients detected.'}</p>
            </div>
          </div>
        </section>

        <InfoNote>
          <strong>Statutory guardrail &amp; governance boundary:</strong> prescription authorization generates a formal medication request. Physical stock, dispensing, batch assignment and invoice generation occur strictly upon pharmacist verification in the Pharmacy module.
        </InfoNote>
      </div>
    </Drawer>
  )
}
