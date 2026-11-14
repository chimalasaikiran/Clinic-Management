import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { RadioCard } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { useStaffDirectory } from '../context/useStaffDirectory'
import { DEPARTMENTS, ENGAGEMENT_TYPES, MEDICAL_COUNCILS } from '../data/directory'
import { validatePerson } from '../validation'

const INITIAL_VALUES = {
  classification: 'doctor',
  fullName: '',
  mobile: '',
  email: '',
  masterStatus: 'active',
  department: '',
  designation: '',
  council: '',
  councilNumber: '',
  engagement: 'full-time',
}

const NEXT_ACTIONS = [
  ['Step 1 · Next action', 'Branch assignment', 'Assign this person to Main Surgical Pavilion or Kondapur Clinic chambers.', 'Triggerable directly upon submit'],
  ['Step 2 · Decoupled', 'Login & credentials', 'Generate ClinicOS portal login or role-based RBAC access only if system access is required.', 'Managed in Configuration › RBAC'],
  ['Step 3 · Decoupled', 'OPD schedule & tariff', 'Define consultation slot duration, OT block privileges, and specialty pricing slabs.', 'Managed in Services & Pricing'],
]

function QualificationInput({ items, onChange, error }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const value = draft.trim().replace(/,$/, '')
    if (value && !items.includes(value)) onChange([...items, value])
    setDraft('')
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Qualifications & medical degrees</p>
      <div className={`flex flex-wrap items-center gap-2 rounded-md border bg-white px-2 py-1.5 ${error ? 'border-rose-400' : 'border-slate-200'}`}>
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded bg-surface-high px-2 py-1 text-xs font-medium text-on-surface">
            {item}
            <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((entry) => entry !== item))} className="text-outline hover:text-danger">
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          aria-label="Add qualification"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="+ Add degree (e.g. FRCS, FSCAI)…"
          className="min-w-40 flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-outline"
        />
      </div>
      <p className="mt-1 text-[11px] text-outline">Press Enter or comma to append medical credentials.</p>
      {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

export default function AddPersonPage() {
  const navigate = useNavigate()
  const { addPerson } = useStaffDirectory()
  const [values, handleChange] = useFormFields(INITIAL_VALUES)
  const [qualifications, setQualifications] = useState([])
  const [proceed, setProceed] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  const payload = { ...values, qualifications }
  const errors = submitted ? validatePerson(payload) : {}
  const isDoctor = values.classification === 'doctor'

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validatePerson(payload)).length) return
    const person = addPerson(payload)
    navigate(proceed ? pathFor(ROUTES.staffBranches, { staffId: person.id }) : ROUTES.staffDirectory)
  }

  const saveDraft = () => {
    setSubmitted(true)
    if (!values.fullName.trim()) return
    addPerson({ ...payload, masterStatus: 'draft', designation: values.designation || 'Draft profile', department: values.department || 'Unassigned' })
    navigate(ROUTES.staffDirectory)
  }

  return (
    <WorkspacePage>
      <form onSubmit={handleSubmit} noValidate className="pb-20">
        <PageIntro
          eyebrow={<StatusPill>Master Registry v2.4 · ABDM HPR compatible</StatusPill>}
          title="Add a person"
          description="Create a staff or doctor master record for your organization. This establishes their central profile, credentials, and identity across all branches."
          actions={<StatusPill tone="success">0 duplicate records found in 42 active files</StatusPill>}
        />

        <div className="flex flex-col gap-5">
          <Panel title="1 · Person classification" subtitle="Classification determines credential requirements and council registration fields. Master records are permanently distinct." action={<span className="text-[10px] text-outline">Immutable profile category</span>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <RadioCard name="classification" value="doctor" checked={isDoctor} onChange={handleChange} title="Doctor" badge={<StatusPill tone="brand">CLINICAL REGISTRY</StatusPill>} detail="Specialist, Consultant, General Physician, Surgeon — requires clinical credentials, degrees, and council registration." />
              <RadioCard name="classification" value="staff" checked={!isDoctor} onChange={handleChange} title="Staff" badge={<StatusPill>OPERATIONS & CARE</StatusPill>} detail="Nursing, Pharmacy, Front Office, Administrative, Technician — operational, administrative, and clinical care support." />
            </div>
          </Panel>

          <Panel title="2 · Basic information" subtitle="Canonical demographic and identity data shared across St. Jude medical facilities." action={<StatusPill>Shared profile data</StatusPill>} bodyClassName="flex flex-col gap-5">
            <TextInput label="Full name" name="fullName" required hint="Include title/salutation for verified prescription headers" value={values.fullName} onChange={handleChange} error={errors.fullName} placeholder="e.g. Dr. Sarita V. Nambiar" />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInput label="Mobile number" name="mobile" type="tel" prefix="+91" hint="Recommended for 2FA" value={values.mobile} onChange={handleChange} error={errors.mobile} />
              <TextInput label="Work email" name="email" type="email" hint="Optional" value={values.email} onChange={handleChange} error={errors.email} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Master status <span className="text-rose-500">*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <RadioCard name="masterStatus" value="active" checked={values.masterStatus === 'active'} onChange={handleChange} title="Active" detail="Eligible for facility deployment & credential verification" />
                <RadioCard name="masterStatus" value="draft" checked={values.masterStatus === 'draft'} onChange={handleChange} title="Draft / Pending verification" detail="Holds record in sandbox" />
              </div>
            </fieldset>
          </Panel>

          <Panel title="3 · Professional credentials & council registration" subtitle="ABDM Healthcare Professionals Registry (HPR) compliant statutory clinical record." action={<StatusPill tone="success">{isDoctor ? 'Active for Doctor' : 'Optional for Staff'}</StatusPill>} bodyClassName="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectInput label="Primary department" name="department" required placeholder="Choose a department" options={DEPARTMENTS} value={values.department} onChange={handleChange} error={errors.department} />
              <TextInput label="Professional title / designation" name="designation" required value={values.designation} onChange={handleChange} error={errors.designation} placeholder="e.g. Senior Consultant Interventional Cardiologist" />
              <SelectInput label="Medical council" name="council" required={isDoctor} placeholder="Choose a council" options={MEDICAL_COUNCILS} value={values.council} onChange={handleChange} error={errors.council} />
              <TextInput label="Council registration number" name="councilNumber" required={isDoctor} value={values.councilNumber} onChange={handleChange} error={errors.councilNumber} placeholder="e.g. NMC-TS-2016-89412" />
            </div>
            <QualificationInput items={qualifications} onChange={setQualifications} error={errors.qualifications} />
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Practice engagement type</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {ENGAGEMENT_TYPES.map((type) => (
                  <RadioCard key={type.value} name="engagement" value={type.value} checked={values.engagement === type.value} onChange={handleChange} title={type.title} detail={type.detail} />
                ))}
              </div>
            </fieldset>
          </Panel>

          <Panel title="4 · Downstream decoupling & next actions" subtitle="To preserve organizational security and clinical data segregation, creation of this master record is decoupled from operational configurations." action={<StatusPill>Architecture guardrail</StatusPill>}>
            <ol className="grid gap-3 md:grid-cols-3">
              {NEXT_ACTIONS.map(([step, title, detail, foot], index) => (
                <li key={title} className={`rounded-md border p-4 ${index === 0 ? 'border-brand bg-teal-50/50' : 'border-slate-200 bg-surface-lowest'}`}>
                  <p className="text-[10px] font-bold tracking-wide text-outline uppercase">{step}</p>
                  <p className="text-[13px] font-semibold text-on-surface">{title}</p>
                  <p className="mt-1 text-xs leading-4 text-on-surface-variant">{detail}</p>
                  <p className={`mt-2 text-[11px] ${index === 0 ? 'font-semibold text-brand' : 'text-outline'}`}>{foot}</p>
                </li>
              ))}
            </ol>
            <label className="mt-4 flex items-center gap-2 rounded-md border border-slate-200 p-3 text-xs text-on-surface-variant">
              <input type="checkbox" checked={proceed} onChange={(event) => setProceed(event.target.checked)} className="accent-[#006a61]" />
              Proceed directly to Branch Assignment after creating this record (Recommended)
            </label>
          </Panel>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
          <ActionButton onClick={() => navigate(ROUTES.staffDirectory)}>Cancel</ActionButton>
          <div className="flex gap-2">
            <ActionButton onClick={saveDraft}>Save as Draft</ActionButton>
            <ActionButton variant="primary" type="submit">
              {proceed ? 'Create person & assign branches' : 'Create person'} <ArrowRight className="size-3.5" aria-hidden="true" />
            </ActionButton>
          </div>
        </div>
      </form>
    </WorkspacePage>
  )
}
