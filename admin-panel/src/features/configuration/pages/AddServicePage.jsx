import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { cn } from '../../../lib/cn'
import ConfigPage from '../components/ConfigPage'
import { AUTHORIZABLE_BRANCHES, DELIVERY_MODALITIES, SERVICE_DEPARTMENTS, SERVICE_TYPE_CHOICES, SLOT_DURATIONS } from '../data/services'
import { validateService } from '../validation'

const INITIAL_VALUES = { name: '', type: 'Consultation', department: '', duration: 30, description: '' }

function ChipGroup({ legend, options, value, onChange, render = String }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn('rounded-md border px-3 py-1.5 text-xs font-medium', value === option ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-lowest')}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export default function AddServicePage() {
  const navigate = useNavigate()
  const [values, handleChange, setValues] = useFormFields(INITIAL_VALUES)
  const [modalities, setModalities] = useState(() => DELIVERY_MODALITIES.filter((entry) => entry.defaultOn).map((entry) => entry.id))
  const [branchIds, setBranchIds] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateService({ ...values, locationCount: branchIds.length }) : {}

  const toggle = (setter) => (id) => setter((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const setField = (name) => (value) => setValues((current) => ({ ...current, [name]: value }))
  const cancel = () => navigate(ROUTES.services)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateService({ ...values, locationCount: branchIds.length })).length === 0) navigate(ROUTES.services)
  }

  const authorized = AUTHORIZABLE_BRANCHES.filter((branch) => branchIds.includes(branch.id))

  return (
    <ConfigPage>
      <form onSubmit={handleSubmit} noValidate>
        <PageIntro
          title="Add Service"
          description="Create a reusable service master for St. Jude Surgical Health System. Availability windows, chamber rosters, and branch-specific tariffs are strictly decoupled and configured after creation."
          actions={
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              <ActionButton variant="brand" type="submit">Create Service</ActionButton>
            </>
          }
        />

        <div className="flex flex-col gap-5">
          <Panel title="1 · Service information (reusable master)" subtitle="Core clinical definition immutable across facilities." action={<StatusPill tone="success">Master ready</StatusPill>} bodyClassName="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInput label="Service name" name="name" required hint="Public-facing and EMR encounter title" value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Cardiology Consultation" />
              <TextInput label="Master clinical code" value="Auto-generated" readOnly hint="Unique tenant-wide alphanumeric key" />
            </div>
            <ChipGroup legend="Clinical service type" options={SERVICE_TYPE_CHOICES} value={values.type} onChange={setField('type')} />
            <SelectInput label="Primary department" name="department" required placeholder="Choose a department" options={SERVICE_DEPARTMENTS} value={values.department} onChange={handleChange} error={errors.department} />
            <ChipGroup legend="Clinical slot duration" options={SLOT_DURATIONS} value={values.duration} onChange={setField('duration')} render={(minutes) => `${minutes} min`} />
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Authorized delivery modalities</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {DELIVERY_MODALITIES.map((modality) => (
                  <CheckRow key={modality.id} checked={modalities.includes(modality.id)} onChange={() => toggle(setModalities)(modality.id)} label={modality.title}>
                    <p className="text-[13px] font-semibold text-on-surface">{modality.title}</p>
                    <p className="text-[11px] text-on-surface-variant">{modality.detail}</p>
                  </CheckRow>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-800">Clinical scope / description</span>
              <textarea name="description" rows={3} maxLength={500} value={values.description} onChange={handleChange} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
              <span className="text-right text-[11px] text-outline">{values.description.length} / 500 chars</span>
            </label>
          </Panel>

          <Panel title="2 · Authorized branch locations" subtitle="Select clinic locations where this service will be scheduled and delivered." action={<StatusPill tone="success">{branchIds.length} locations selected for authorization</StatusPill>} bodyClassName="flex flex-col gap-2">
            {AUTHORIZABLE_BRANCHES.map((branch) => (
              <CheckRow key={branch.id} checked={branchIds.includes(branch.id)} onChange={() => toggle(setBranchIds)(branch.id)} label={branch.name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-on-surface">{branch.name}</p>
                    <p className="text-xs text-on-surface-variant">{branch.detail}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono text-outline">{branch.code}</span>
                    <StatusPill>{branch.infrastructure}</StatusPill>
                    <StatusPill tone={branch.tone}>{branch.state}</StatusPill>
                  </div>
                </div>
              </CheckRow>
            ))}
            {errors.locations && <p role="alert" className="text-xs text-rose-600">{errors.locations}</p>}
          </Panel>

          <Panel title="3 · Initial branch pricing (optional)" subtitle="Set localized tariffs for each selected location. You can leave prices unconfigured and set them later.">
            <InfoNote tone="brand"><strong className="text-brand">Decoupled billing logic:</strong> Service creation is never blocked by unconfigured prices. Missing branch tariffs will be safely marked as pre-tax until finalised.</InfoNote>
            {authorized.length === 0 ? (
              <p className="mt-3 text-xs text-on-surface-variant">Authorize at least one location above to set its initial tariff.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {authorized.map((branch) => (
                  <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                    <p className="text-[13px] font-semibold text-on-surface">{branch.name} <span className="font-mono text-[11px] font-normal text-outline">{branch.code}</span></p>
                    <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                      Consultation fee (INR ₹)
                      <input type="number" min="0" aria-label={`Fee at ${branch.name}`} className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-[13px] outline-none focus:border-brand" />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Configuration review">
            <dl className="grid gap-3 text-xs sm:grid-cols-4">
              {[
                ['Service master', values.name || '—'],
                ['Primary department', values.department || '—'],
                ['Locations authorized', `${branchIds.length} ${branchIds.length === 1 ? 'branch' : 'branches'}`],
                ['Slot duration', `${values.duration} min`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-outline">{label}</dt>
                  <dd className="font-semibold text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>
            <InfoNote className="mt-4"><strong className="text-on-surface">Historical safety guarantee:</strong> Creating this record establishes the initial service master and forward-looking branch schedules without altering past clinical encounters, legacy invoices, or archived consultation reports.</InfoNote>
            <div className="mt-4 flex justify-end gap-2">
              <ActionButton onClick={cancel}>Cancel & Exit</ActionButton>
              <ActionButton variant="primary" type="submit">Create Service & View Detail →</ActionButton>
            </div>
          </Panel>
        </div>
      </form>
    </ConfigPage>
  )
}
