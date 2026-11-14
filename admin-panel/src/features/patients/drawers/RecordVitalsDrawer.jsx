import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { PatientStrip } from '../components/parts'
import { TODAY } from '../format'
import { clockTime } from '../selectors'
import { bmiClass, bmiOf, bpStage, validateVitals } from '../validation'

const BLANK = { systolic: '', diastolic: '', pulse: '', resp: '', temp: '', spo2: '', weight: '', height: '', rbs: '', pain: '', site: 'Right Arm, Upper Brachial', posture: 'Seated' }

// Records one set of vital signs against the open encounter. `onSave` receives the finished vitals record.
export default function RecordVitalsDrawer({ open, onClose, patient, encounter, onSave }) {
  const [values, setValues] = useState(BLANK)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateVitals(values) : {}
  const bmi = bmiOf(values.weight, values.height)
  const stage = values.systolic && values.diastolic ? bpStage(Number(values.systolic), Number(values.diastolic)) : null

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues(BLANK)
    setSubmitted(false)
    onClose()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateVitals(values)).length) return
    onSave({
      patientId: patient.id, encounterId: encounter.id, date: TODAY, time: clockTime(), by: 'Recorded at encounter', bp: { sys: Number(values.systolic), dia: Number(values.diastolic) },
      pulse: Number(values.pulse), resp: Number(values.resp), temp: Number(values.temp), spo2: Number(values.spo2), weight: Number(values.weight), height: Number(values.height),
      rbs: values.rbs ? Number(values.rbs) : null, pain: values.pain ? Number(values.pain) : null, site: values.site, posture: values.posture, device: 'Manual entry',
    })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={`${encounter?.id ?? ''} · Vitals capture`}
      title="Record Vitals"
      description="Capture physiological measurements for the open encounter."
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel / Discard</ActionButton>
          <ActionButton variant="primary" type="submit" form="vitals-form">Save vitals to encounter</ActionButton>
        </div>
      }
    >
      <form id="vitals-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        <PatientStrip patient={patient} />

        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Cardiorespiratory profile</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Systolic (mmHg)" name="systolic" type="number" required value={values.systolic} onChange={update} error={errors.systolic} />
            <TextInput label="Diastolic (mmHg)" name="diastolic" type="number" required value={values.diastolic} onChange={update} error={errors.diastolic} />
          </div>
          {stage && stage !== 'Normal' && (
            <InfoNote tone="warning" icon={AlertTriangle} className="mt-3"><strong>{stage} range detected.</strong> Verify cuff positioning and patient rest period (5 min). Measurement is flagged for the attending clinician.</InfoNote>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput label="Pulse rate (bpm)" name="pulse" type="number" required value={values.pulse} onChange={update} error={errors.pulse} hint="Ref: 60–100 bpm" />
            <TextInput label="Resp. rate (breaths/min)" name="resp" type="number" required value={values.resp} onChange={update} error={errors.resp} hint="Ref: 12–20" />
            <TextInput label="Temperature (°F)" name="temp" type="number" step="0.1" required value={values.temp} onChange={update} error={errors.temp} />
            <TextInput label="SpO₂ (%)" name="spo2" type="number" required value={values.spo2} onChange={update} error={errors.spo2} hint="Ref: ≥ 95%" />
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Anthropometry</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Weight (kg)" name="weight" type="number" step="0.1" required value={values.weight} onChange={update} error={errors.weight} />
            <TextInput label="Height (cm)" name="height" type="number" required value={values.height} onChange={update} error={errors.height} />
          </div>
          <p className="mt-3 rounded bg-surface-low p-3 text-xs">
            <strong className="text-base">{bmi ? `${bmi} kg/m²` : '—'}</strong> {bmi && <span className="ml-1 text-on-surface-variant">{bmiClass(bmi)}</span>}
            <span className="block text-[11px] text-outline">Calculated automatically from recorded weight and height. Read-only.</span>
          </p>
        </fieldset>

        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold">Additional clinical context</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Random blood sugar (mg/dL)" name="rbs" type="number" value={values.rbs} onChange={update} />
            <TextInput label="Pain score (0–10)" name="pain" type="number" min="0" max="10" value={values.pain} onChange={update} />
            <TextInput label="Measurement site" name="site" value={values.site} onChange={update} />
            <TextInput label="Patient posture" name="posture" value={values.posture} onChange={update} />
          </div>
        </fieldset>
      </form>
    </Drawer>
  )
}
