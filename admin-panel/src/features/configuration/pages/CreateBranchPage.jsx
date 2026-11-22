import { useState } from 'react'
import { Info, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useFormFields } from '../../../hooks/useFormFields'
import { cn } from '../../../lib/cn'
import { accessApi } from '../../auth/api'
import { CLINIC_CLASSIFICATIONS } from '../../onboarding/data/clinicOptions'
import { configApi } from '../api'
import ConfigPage from '../components/ConfigPage'
import { FACILITY_TYPES } from '../configView'
import { validateBranch } from '../validation'

const STATUS_OPTIONS = [
  { value: 'active', title: 'Active (Licensed & Operational)', detail: 'Immediately open for patient scheduling, billing, and clinical encounters upon branch save.' },
  { value: 'planned', title: 'Planned / Pre-launch Setup', detail: 'Not open for booking until you set it to Active on the branch page.' },
]

const LIFECYCLE = [
  { title: 'Branch Master', detail: 'Identity, address and contact (this page)' },
  { title: 'Operating hours & departments', detail: 'Weekly sessions, closures and the departments that work here' },
  { title: 'Staff & doctors', detail: 'Deploy staff to the branch and set doctors’ availability' },
  { title: 'Services & stock', detail: 'Branch prices on services, and stock locations' },
]

const INITIAL_VALUES = {
  name: '',
  code: '',
  facilityType: '',
  status: 'active',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pin: '',
  phone: '',
  email: '',
}

function StepPanel({ step, title, subtitle, children }) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-surface-low text-[11px] font-bold text-on-surface-variant">
            {step}
          </span>
          {title}
        </span>
      }
      subtitle={subtitle}
      bodyClassName="flex flex-col gap-5"
    >
      {children}
    </Panel>
  )
}

function StatusChoice({ option, checked, onChange }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
        checked ? 'border-brand bg-teal-50/60' : 'border-slate-200 bg-white hover:bg-surface-lowest',
      )}
    >
      <input type="radio" name="status" value={option.value} checked={checked} onChange={onChange} className="mt-1 accent-[#006a61]" />
      <span>
        <span className="block text-[13px] font-semibold text-on-surface">{option.title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-on-surface-variant">{option.detail}</span>
      </span>
    </label>
  )
}

function BranchSidebar({ organisation }) {
  const classification = CLINIC_CLASSIFICATIONS.find((option) => option.id === organisation?.classification)?.title
  return (
    <div className="flex flex-col gap-5">
      <Panel title="Lifecycle & downstream scope" action={<span className="text-[10px] text-outline">Stage 1 of 4</span>}>
        <p className="text-xs leading-5 text-on-surface-variant">
          Foundational facility metadata is established first. Once registered, subsequent specialized modules unlock sequentially.
        </p>
        <ol className="mt-4 space-y-4">
          {LIFECYCLE.map((stage, index) => (
            <li key={stage.title} className="flex gap-3">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  index === 0 ? 'bg-brand text-white' : 'bg-surface-high text-on-surface-variant',
                )}
              >
                {index + 1}
              </span>
              <div>
                <p className={cn('text-[13px] font-semibold', index === 0 ? 'text-brand' : 'text-on-surface')}>{stage.title}</p>
                <p className="text-xs leading-4 text-on-surface-variant">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-md bg-surface-lowest p-3 text-xs text-on-surface-variant italic">
          “Configure once. Work normally. The system takes care of the rest.”
        </p>
      </Panel>

      <Panel title="Multi-branch records">
        <ul className="space-y-3 text-xs leading-5 text-on-surface-variant">
          <li>
            <p className="font-semibold text-on-surface">One patient record</p>
            Patients are registered once for the organisation; their records follow them to every branch.
          </li>
          <li>
            <p className="font-semibold text-on-surface">Organisation-wide roles</p>
            Roles covering the whole organisation see the new branch at once. Branch-limited roles see it when you give it to them below.
          </li>
        </ul>
        <div className="mt-4 flex items-end justify-between rounded-md bg-surface-lowest p-3">
          <div>
            <p className="text-[10px] tracking-wide text-outline uppercase">Branches today</p>
            <p className="text-lg font-bold text-on-surface">{organisation ? organisation.counts.branches : '—'}</p>
          </div>
          <StatusPill tone="success">{classification ?? 'Organisation'}</StatusPill>
        </div>
      </Panel>

      <aside className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-on-surface">
          <Info className="size-3.5 text-amber-600" aria-hidden="true" />
          State protection safeguard
        </p>
        Unsaved changes are lost if you leave without creating the branch.
      </aside>
    </div>
  )
}

export default function CreateBranchPage() {
  const navigate = useNavigate()
  const organisation = useApiResource(() => configApi.organisation(), 'organisation').data
  const roles = (useApiResource(() => accessApi.roles(), 'roles').data ?? []).filter((role) => role.scope === 'branch' && role.status === 'active')
  const [values, handleChange] = useFormFields(INITIAL_VALUES)
  const [roleIds, setRoleIds] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const errors = { ...(submitted ? validateBranch(values) : {}), ...serverErrors }

  const cancel = () => navigate(ROUTES.organisation)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setServerErrors({})
    setFailure('')
    if (Object.keys(validateBranch(values)).length) return
    setPending(true)
    try {
      const branch = await configApi.createBranch({
        name: values.name.trim(), code: values.code.trim(), facilityType: values.facilityType, status: values.status, addressLine1: values.addressLine1.trim(), addressLine2: values.addressLine2.trim(),
        city: values.city.trim(), state: values.state.trim(), pinCode: values.pin.trim(), phone: values.phone.trim(), email: values.email.trim(), roleIds,
      })
      navigate(pathFor(ROUTES.branch, { branchId: branch.id }))
    } catch (error) {
      const fields = error.fieldErrors?.() ?? {}
      setServerErrors({ ...fields, ...(fields.pinCode ? { pin: fields.pinCode } : {}), ...(error.code === 'BRANCH_CODE_TAKEN' ? { code: error.message } : {}) })
      setFailure(error.message)
      setPending(false)
    }
  }

  return (
    <ConfigPage>
      <form onSubmit={handleSubmit} noValidate>
        <PageIntro
          eyebrow={
            <>
              <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">
                Branch master configuration · {organisation?.displayName ?? 'Organization'}
              </span>
            </>
          }
          title="Create branch"
          description="Add a new clinic location to your organization. Foundational facility metadata, regional licensing, and address details. Downstream modules (practitioners, pricing, room schedules) are configured after branch creation."
          actions={
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              <ActionButton variant="primary" type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create branch'}
              </ActionButton>
            </>
          }
        />

        {failure && <Banner tone="danger" title="Branch not created" className="mb-5">{failure}</Banner>}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <StepPanel step={1} title="Branch identity" subtitle="Physical facility identifier and internal system taxonomy.">
              <TextInput label="Branch name" name="name" required hint="Appears on patient invoices, OPD slips & SMS" value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Kondapur Specialty Clinic" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput label="Branch code" name="code" required hint="Used for rosters, ABDM node mapping and reporting" value={values.code} onChange={handleChange} error={errors.code} placeholder="e.g. KDP-01" />
                <SelectInput label="Facility type / category" name="facilityType" required placeholder="Select a type" options={FACILITY_TYPES} value={values.facilityType} onChange={handleChange} error={errors.facilityType} />
              </div>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Initial operational status</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STATUS_OPTIONS.map((option) => (
                    <StatusChoice key={option.value} option={option} checked={values.status === option.value} onChange={handleChange} />
                  ))}
                </div>
              </fieldset>
            </StepPanel>

            <StepPanel step={2} title="Location & physical address" subtitle="Physical clinic premises for patient appointments, regulatory geo-tagging, and ABDM registration.">
              <TextInput label="Address line 1" name="addressLine1" required value={values.addressLine1} onChange={handleChange} error={errors.addressLine1} />
              <TextInput label="Address line 2" name="addressLine2" value={values.addressLine2} onChange={handleChange} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput label="City" name="city" required value={values.city} onChange={handleChange} error={errors.city} />
                <TextInput label="State" name="state" required value={values.state} onChange={handleChange} error={errors.state} />
                <TextInput label="PIN code" name="pin" required inputMode="numeric" maxLength={6} value={values.pin} onChange={handleChange} error={errors.pin} />
                <TextInput label="Country" value="India (IN / +91)" readOnly />
              </div>
              <p className="flex items-center gap-2 rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs text-on-surface-variant">
                <MapPin className="size-4 text-brand" aria-hidden="true" />
                The address appears on invoices, appointment messages and the branch’s public profile.
              </p>
            </StepPanel>

            <StepPanel step={3} title="Contact & communications" subtitle="Front-desk triage phone and patient SMS/WhatsApp delivery credentials.">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput label="Branch phone" name="phone" type="tel" required prefix="+91" hint="Primary patient inquiries & reception desk" value={values.phone} onChange={handleChange} error={errors.phone} />
                <TextInput label="Branch email" name="email" type="email" required hint="Receives billing summaries & regulatory notices" value={values.email} onChange={handleChange} error={errors.email} />
              </div>
            </StepPanel>

            <StepPanel step={4} title="Operating model & access" subtitle={`Inherited from ${organisation?.displayName ?? 'the organisation'}.`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Practice taxonomy', CLINIC_CLASSIFICATIONS.find((option) => option.id === organisation?.classification)?.title ?? 'Not set', organisation?.specialties.length ? organisation.specialties.join(' · ') : 'Specialties are set during onboarding.'],
                  ['Billing & tax', 'Organisation billing settings', 'Services, prices and tax treatment come from the billing catalogue; set this branch’s prices there.'],
                ].map(([label, title, detail]) => (
                  <div key={label} className="rounded-md border border-slate-200 bg-surface-lowest p-4">
                    <p className="flex items-center justify-between text-[10px] tracking-wide text-outline uppercase">
                      {label}
                      <StatusPill tone="success">Inherited</StatusPill>
                    </p>
                    <p className="mt-2 text-[13px] font-semibold text-on-surface">{title}</p>
                    <p className="mt-1 text-xs leading-4 text-on-surface-variant">{detail}</p>
                  </div>
                ))}
              </div>
              {roles.length > 0 && (
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Give this branch to branch-limited roles</legend>
                  <div className="flex flex-wrap gap-2">{roles.map((role) => <label key={role.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', roleIds.includes(role.id) ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => setRoleIds((current) => (current.includes(role.id) ? current.filter((id) => id !== role.id) : [...current, role.id]))} className="accent-[#006a61]" />{role.name}</label>)}</div>
                </fieldset>
              )}
              <p className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-xs leading-5 text-on-surface-variant">
                <span className="font-semibold text-brand">Set operating hours & OPD sessions</span> on the branch page after creating it.
              </p>
            </StepPanel>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3">
              <p className="text-xs text-on-surface-variant">Creation commits facility metadata to CarePoint organizational master.</p>
              <div className="flex gap-2">
                <ActionButton onClick={cancel}>Cancel</ActionButton>
                <ActionButton variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Creating…' : 'Create branch'}
                </ActionButton>
              </div>
            </div>
          </div>

          <BranchSidebar organisation={organisation} />
        </div>
      </form>
    </ConfigPage>
  )
}
