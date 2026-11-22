import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, RadioCard } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useFormFields } from '../../../hooks/useFormFields'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, branchAddress } from '../configView'
import { validateDepartment } from '../validation'

const TYPES = [
  { value: 'Clinical', title: 'Clinical', detail: 'Direct patient consultations, OPD or procedure care.' },
  { value: 'Diagnostic', title: 'Diagnostic', detail: 'Pathology, labs, imaging and tests ordered by clinicians.' },
  { value: 'Therapy', title: 'Therapy', detail: 'Physiotherapy, rehabilitation and other allied therapy.' },
  { value: 'Support', title: 'Support', detail: 'Nursing, pharmacy and other care support units.' },
  { value: 'Administrative', title: 'Administrative', detail: 'Billing, reception and operational support units.' },
]

const LIFECYCLE = [
  ['Department Master', 'Establishes core identity, specialties, classification and clinical governance.'],
  ['Linked services & prices', 'Services in the billing catalogue name this department; prices are set per branch.'],
  ['Staff & doctors', 'Staff and doctor records choose this department from the list.'],
  ['Availability', 'Doctors’ sessions at each branch, within the branch’s hours.'],
]

const INITIAL_VALUES = { name: '', code: '', type: 'Clinical', scope: '', status: 'active' }

export default function CreateDepartmentPage() {
  const navigate = useNavigate()
  const branches = useApiResource(() => configApi.branches(), 'config-branches').data ?? []
  const [values, handleChange] = useFormFields(INITIAL_VALUES)
  const [locationIds, setLocationIds] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const errors = { ...(submitted ? validateDepartment({ ...values, locationCount: locationIds.length }) : {}), ...serverErrors }
  const usable = branches.filter((branch) => branch.status !== 'inactive')

  const toggleLocation = (id) => setLocationIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const cancel = () => navigate(ROUTES.departments)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setServerErrors({})
    setFailure('')
    if (Object.keys(validateDepartment({ ...values, locationCount: locationIds.length })).length) return
    setPending(true)
    try {
      const department = await configApi.createDepartment({ name: values.name.trim(), code: values.code.trim(), type: values.type, description: values.scope.trim(), status: values.status, branchIds: locationIds })
      navigate(pathFor(ROUTES.department, { departmentId: department.id }))
    } catch (error) {
      const fields = error.fieldErrors?.() ?? {}
      setServerErrors({ ...fields, ...(fields.branchIds ? { locations: fields.branchIds } : {}), ...(error.code === 'DEPARTMENT_EXISTS' ? { name: error.message } : {}) })
      setFailure(error.message)
      setPending(false)
    }
  }

  const submitButton = <ActionButton variant="primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create department'}</ActionButton>

  return (
    <ConfigPage>
      <form onSubmit={handleSubmit} noValidate>
        <PageIntro
          eyebrow={<span className="text-on-surface-variant">Department taxonomy · Master builder</span>}
          title="Create department"
          description="Create a reusable department master that can be deployed across your organization's clinic locations. Services, doctors, and staff then choose it from the list."
          actions={
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              {submitButton}
            </>
          }
        />

        {failure && <Banner tone="danger" title="Department not created" className="mb-5">{failure}</Banner>}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="1 · Department information" subtitle="Required fields *" bodyClassName="flex flex-col gap-5">
              <TextInput label="Department name" name="name" required value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Cardiology" />
              <TextInput label="Department code" name="code" required hint="Short code, e.g. CARD" value={values.code} onChange={handleChange} error={errors.code} placeholder="e.g. CARD" />
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

            <Panel title="2 · Available at" subtitle="Select the clinic locations where this department operates." action={<StatusPill>{locationIds.length} of {usable.length} branches selected</StatusPill>} bodyClassName="flex flex-col gap-2">
              {usable.map((location) => (
                <CheckRow key={location.id} checked={locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} label={location.name}>
                  <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                    {location.name}
                    <StatusPill tone={BRANCH_STATUS[location.status][1]}>{location.isPrimary ? 'Primary' : BRANCH_STATUS[location.status][0]}</StatusPill>
                  </p>
                  <p className="text-xs text-on-surface-variant">{branchAddress(location) || location.code}</p>
                </CheckRow>
              ))}
              {usable.length > 1 && (
                <button type="button" onClick={() => setLocationIds(locationIds.length === usable.length ? [] : usable.map((branch) => branch.id))} className="self-start text-xs font-semibold text-brand hover:underline">
                  {locationIds.length === usable.length ? 'Clear all' : 'Select all branches'}
                </button>
              )}
              {errors.locations && <p role="alert" className="text-xs text-rose-600">{errors.locations}</p>}
            </Panel>

            <Panel title="3 · Services & prices" subtitle="Set in the billing catalogue after creation." action={<StatusPill>Configurable by branch</StatusPill>}>
              <p className="text-xs leading-5 text-on-surface-variant">
                Services in the billing catalogue choose this department. Each service has a standard price and can have its own price at each branch.
              </p>
            </Panel>

            <Panel title="4 · Master department status">
              <div className="grid gap-2 sm:grid-cols-2">
                <RadioCard name="status" value="active" checked={values.status === 'active'} onChange={handleChange} title="Active (Default)" detail="Offered at once on staff, doctor and service forms." />
                <RadioCard name="status" value="inactive" checked={values.status === 'inactive'} onChange={handleChange} title="Inactive" detail="Not offered on staff, doctor or service forms until you activate it." />
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3">
              <p className="text-xs text-on-surface-variant">Department is created at the organization level and linked to the selected branches.</p>
              <div className="flex gap-2">
                <ActionButton onClick={cancel}>Discard changes</ActionButton>
                {submitButton}
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
          </div>
        </div>
      </form>
    </ConfigPage>
  )
}
