import { useState } from 'react'
import { Info, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import { validateBranch } from '../validation'

const FACILITY_TYPES = ['Specialty & Surgical Hub', 'General OPD Clinic', 'Diagnostic Centre', 'Day-care Centre']

const STATUS_OPTIONS = [
  { value: 'active', title: 'Active (Licensed & Operational)', detail: 'Immediately open for patient scheduling, billing, and clinical encounters upon branch save.' },
  { value: 'inactive', title: 'Inactive / Pre-launch Setup', detail: 'Restricted mode. Remains hidden from public booking engines and calendar dispatchers until licensed.' },
]

const LIFECYCLE = [
  { title: 'Branch Master', detail: 'Physical identity, registry & geo-tagging (in progress)' },
  { title: 'Department & Suite Mapping', detail: 'Consultation chambers, OT units, lab triage areas' },
  { title: 'Rostered Doctors & Staff', detail: 'Assign clinical staff credentials and OPD time slots' },
  { title: 'Service & Pricing Catalog', detail: 'Branch-level overrides on baseline diagnostic packages' },
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

function BranchSidebar() {
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

      <Panel title="Multi-branch synchronization">
        <ul className="space-y-3 text-xs leading-5 text-on-surface-variant">
          <li>
            <p className="font-semibold text-on-surface">Universal UHID Registry</p>
            Centralized patient records automatically sync across all branches. A single unique Health ID follows the patient everywhere
            in your network.
          </li>
          <li>
            <p className="font-semibold text-on-surface">National Health Stack (ABDM)</p>
            Full M1, M2, and M3 milestone compatibility. Fast-tracks your Health Facility Registry (HFR) accreditation.
          </li>
        </ul>
        <div className="mt-4 flex items-end justify-between rounded-md bg-surface-lowest p-3">
          <div>
            <p className="text-[10px] tracking-wide text-outline uppercase">Patient identity pool</p>
            <p className="text-lg font-bold text-on-surface">148,920 UHIDs</p>
          </div>
          <StatusPill tone="success">Cross-Branch Active</StatusPill>
        </div>
      </Panel>

      <aside className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-on-surface-variant">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-on-surface">
          <Info className="size-3.5 text-amber-600" aria-hidden="true" />
          State protection safeguard
        </p>
        Unsaved modifications will be lost if you leave without creating the branch. Form drafts are held in local memory.
      </aside>
    </div>
  )
}

export default function CreateBranchPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields(INITIAL_VALUES)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateBranch(values) : {}

  const cancel = () => navigate(ROUTES.organisation)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateBranch(values)).length === 0) navigate(ROUTES.organisation)
  }

  return (
    <ConfigPage>
      <form onSubmit={handleSubmit} noValidate>
        <PageIntro
          eyebrow={
            <>
              <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-on-surface-variant">
                Branch master configuration · Organization node #CP-IND-4091
              </span>
              <StatusPill tone="success">ABDM HFR Registry Ready</StatusPill>
            </>
          }
          title="Create branch"
          description="Add a new clinic location to your organization. Foundational facility metadata, regional licensing, and address details. Downstream modules (practitioners, pricing, room schedules) are configured after branch creation."
          actions={
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              <ActionButton variant="primary" type="submit">
                Create branch
              </ActionButton>
            </>
          }
        />

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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
                <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <MapPin className="size-4 text-brand" aria-hidden="true" />
                  Spatial verification preview appears once the address is geo-tagged.
                </p>
                <ActionButton size="sm" disabled>
                  Adjust pin
                </ActionButton>
              </div>
            </StepPanel>

            <StepPanel step={3} title="Contact & communications" subtitle="Front-desk triage phone and patient SMS/WhatsApp delivery credentials.">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput label="Branch phone" name="phone" type="tel" required prefix="+91" hint="Primary patient inquiries & reception desk" value={values.phone} onChange={handleChange} error={errors.phone} />
                <TextInput label="Branch email" name="email" type="email" required hint="Receives billing summaries & regulatory notices" value={values.email} onChange={handleChange} error={errors.email} />
              </div>
            </StepPanel>

            <StepPanel step={4} title="Operating model & schedule" subtitle="Core operating framework inherited from CarePoint Health Network.">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Practice taxonomy', 'Multi-Speciality Clinic · Outpatient Care & Day Surgery', 'Default clinical encounter sheets are pre-loaded for Cardiology, ENT, and Orthopedics.'],
                  ['Central billing & tax', 'Standard Healthcare Services Exempt', 'GST 12% exemption on Consultation. Pharmacy maintains HSN-level tiered GST rates.'],
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
              <p className="rounded-md border border-teal-200 bg-teal-50/60 p-3 text-xs leading-5 text-on-surface-variant">
                <span className="font-semibold text-brand">Set operating hours & OPD shift schedules.</span> Configured post-creation inside the Branch Operations console.
              </p>
            </StepPanel>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3">
              <p className="text-xs text-on-surface-variant">Creation commits facility metadata to CarePoint organizational master.</p>
              <div className="flex gap-2">
                <ActionButton onClick={cancel}>Cancel</ActionButton>
                <ActionButton variant="primary" type="submit">
                  Create branch
                </ActionButton>
              </div>
            </div>
          </div>

          <BranchSidebar />
        </div>
      </form>
    </ConfigPage>
  )
}
