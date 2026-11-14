import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, RadioCard } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import ConfigPage from '../components/ConfigPage'
import { validateDepartment } from '../validation'

const TYPES = [
  { value: 'clinical', title: 'Clinical', detail: 'Direct patient consultations, OPD or procedure care.' },
  { value: 'diagnostic', title: 'Diagnostic', detail: 'Pathology, labs, imaging and tests ordered by clinicians.' },
  { value: 'administrative', title: 'Administrative', detail: 'Billing, reception and operational support units.' },
]

const LOCATIONS = [
  { id: 'main', name: 'Main Surgical Pavilion (HQ)', detail: 'Jubilee Hills Rd. 36, Hyderabad · 6 OPD Suites · 2 Surgical Cath Labs', tag: 'Primary Hub' },
  { id: 'kondapur', name: 'Kondapur Clinic (Active OPD Hub)', detail: 'Capsule Cyber Gateway, Hitec City Corridor · 4 Consultation Suites, Diagnostic', tag: 'High-Density OPD' },
  { id: 'banjara', name: 'Banjara Hills Specialty Outpost', detail: 'Road No. 2, Banjara Hills, Hyderabad', tag: 'Satellite Outpost', unavailable: true },
]

const LIFECYCLE = [
  ['Department Master', 'Establishes core identity, specialties, classification and clinical governance.'],
  ['Linked Services & Tariffs', 'Map CPT/HSN codes, clinical definitions and baseline fee schedules.'],
  ['Rostered Practitioners', 'Assign doctors and care staff to this department.'],
  ['Proposal Consultation Suites', 'Allocate rooms, chambers and OPD slots per branch.'],
]

const INITIAL_VALUES = { name: '', code: '', type: 'clinical', scope: '', status: 'active' }

export default function CreateDepartmentPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields(INITIAL_VALUES)
  const [locationIds, setLocationIds] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateDepartment({ ...values, locationCount: locationIds.length }) : {}

  const toggleLocation = (id) => setLocationIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const cancel = () => navigate(ROUTES.departments)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateDepartment({ ...values, locationCount: locationIds.length })).length === 0) navigate(ROUTES.departments)
  }

  return (
    <ConfigPage>
      <form onSubmit={handleSubmit} noValidate>
        <PageIntro
          eyebrow={<span className="text-on-surface-variant">Department taxonomy · Master builder</span>}
          title="Create department"
          description="Create a reusable department master that can be deployed across your organization's clinic locations. Services, doctors, and consultation suites are linked in subsequent steps."
          actions={
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              <ActionButton variant="primary" type="submit">Create department</ActionButton>
            </>
          }
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="1 · Department information" subtitle="Required fields *" bodyClassName="flex flex-col gap-5">
              <TextInput label="Department name" name="name" required value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Cardiology" />
              <TextInput label="Department code" name="code" required hint="ABDM / SNOMED-CT mapping" value={values.code} onChange={handleChange} error={errors.code} placeholder="e.g. DEP-CARD" />
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Department classification type</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TYPES.map((type) => (
                    <RadioCard key={type.value} name="type" value={type.value} checked={values.type === type.value} onChange={handleChange} title={type.title} detail={type.detail} />
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-slate-800">Operational clinical scope / description <span className="font-normal text-outline">(optional)</span></span>
                <textarea name="scope" rows={3} value={values.scope} onChange={handleChange} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
            </Panel>

            <Panel title="2 · Available at" subtitle="Select the clinic locations where this department operates." action={<StatusPill>{locationIds.length} of 3 branches selected</StatusPill>} bodyClassName="flex flex-col gap-2">
              {LOCATIONS.map((location) => (
                <CheckRow key={location.id} checked={locationIds.includes(location.id)} disabled={location.unavailable} onChange={() => toggleLocation(location.id)} label={location.name}>
                  <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                    {location.name}
                    <StatusPill>{location.tag}</StatusPill>
                  </p>
                  <p className="text-xs text-on-surface-variant">{location.detail}</p>
                </CheckRow>
              ))}
              {errors.locations && <p role="alert" className="text-xs text-rose-600">{errors.locations}</p>}
            </Panel>

            <Panel title="3 · Local tariff information" subtitle="Configured by branch after creation." action={<StatusPill>Configurable by branch</StatusPill>}>
              <p className="text-xs leading-5 text-on-surface-variant">
                Services and prices follow the pipeline: Department Master → Branch Association → Local Tariff Context → Services & Pricing. Tariffs are assigned per branch once services are linked.
              </p>
            </Panel>

            <Panel title="4 · Master department status" action={<StatusPill tone="success">Ready for master activation</StatusPill>}>
              <div className="grid gap-2 sm:grid-cols-2">
                <RadioCard name="status" value="active" checked={values.status === 'active'} onChange={handleChange} title="Active (Default)" detail="Immediately available for branch associations, roster allocation and OPD configuration." />
                <RadioCard name="status" value="draft" checked={values.status === 'draft'} onChange={handleChange} title="Inactive (Draft)" detail="Hidden from branch lists. Master records remain preserved for later activation." />
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3">
              <p className="text-xs text-on-surface-variant">Department is created at the organization level and linked to the selected branches.</p>
              <div className="flex gap-2">
                <ActionButton onClick={cancel}>Discard changes</ActionButton>
                <ActionButton variant="primary" type="submit">Create department</ActionButton>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Panel title="Master department lifecycle" action={<StatusPill tone="brand">Current</StatusPill>}>
              <ol className="space-y-3">
                {LIFECYCLE.map(([title, detail], index) => (
                  <li key={title} className="flex gap-3 text-xs">
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${index === 0 ? 'bg-brand text-white' : 'bg-surface-high text-on-surface-variant'}`}>{index + 1}</span>
                    <span>
                      <span className="block text-[13px] font-semibold text-on-surface">{title}</span>
                      <span className="text-on-surface-variant">{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Preventing taxonomy duplication">
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
                <strong>Anti-pattern (avoid):</strong> Do not create separate departments per branch, e.g. “Cardiology – Main” and “Cardiology – Kondapur”.
              </p>
              <p className="mt-3 rounded-md border border-teal-200 bg-teal-50/60 p-3 text-xs leading-5 text-on-surface-variant">
                <strong className="text-brand">The ClinicOS way:</strong> Create one master department, then check off the branches it operates in.
              </p>
            </Panel>

            <Panel title="Registry pre-flight check" action={<StatusPill tone="success">Valid</StatusPill>}>
              <ul className="space-y-1.5 text-xs text-on-surface-variant">
                <li className="flex justify-between"><span>Duplicate identifier</span><span className="font-medium text-brand">Clear (Unique)</span></li>
                <li className="flex justify-between"><span>ABDM master registry</span><span className="font-medium text-brand">Open, Synced</span></li>
                <li className="flex justify-between"><span>Clinic type</span><span className="font-medium text-on-surface">Multi-Specialty</span></li>
              </ul>
            </Panel>
          </div>
        </div>
      </form>
    </ConfigPage>
  )
}
