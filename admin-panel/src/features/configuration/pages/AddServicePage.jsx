import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { toServiceRequest } from '../../billing/adapters'
import { billingApi } from '../../billing/api'
import { SERVICE_CATEGORIES, TAX_CONFIGS, TAX_TREATMENTS } from '../../billing/constants'
import { blankService, buildService, offeredBranches, validateService } from '../../billing/serviceLogic'
import LoadingState from '../../patients/components/LoadingState'
import ConfigPage from '../components/ConfigPage'
import { BRANCH_STATUS, branchAddress } from '../configView'
import { useCatalogue } from '../useCatalogue'
import { useDepartmentNames } from '../useDepartments'

const UNITS = ['15 min', '30 min', '45 min', '60 min', 'Per test', 'Per session', 'Per item']

function ChipGroup({ legend, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? '' : option)}
            className={cn('rounded-md border px-3 py-1.5 text-xs font-medium', value === option ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-lowest')}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ServiceForm({ services, branches }) {
  const navigate = useNavigate()
  const departments = useDepartmentNames().names
  const usable = branches.filter((branch) => branch.status !== 'inactive')
  const [values, setValues] = useState(() => blankService(usable))
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState('')
  const [serverErrors, setServerErrors] = useState({})
  const [pending, setPending] = useState(false)
  const errors = { ...(submitted ? validateService(values, services, null, usable) : {}), ...serverErrors }

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const change = (event) => set(event.target.name, event.target.value)
  const setBranch = (id, patch) => setValues((current) => ({ ...current, branches: { ...current.branches, [id]: { ...current.branches[id], ...patch } } }))
  const cancel = () => navigate(ROUTES.services)
  const offered = offeredBranches(values, usable)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    setServerErrors({})
    if (Object.keys(validateService(values, services, null, usable)).length) return
    setPending(true)
    try {
      const { id } = await billingApi.createService(toServiceRequest(buildService(values, usable)))
      navigate(pathFor(ROUTES.service, { serviceId: id }))
    } catch (error) {
      setServerErrors(error.fieldErrors?.() ?? {})
      setFailure(error.message)
      setPending(false)
    }
  }

  const submit = (label) => <ActionButton variant="brand" type="submit" disabled={pending}>{pending ? 'Creating…' : label}</ActionButton>

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PageIntro
        title="Add Service"
        description="Create a reusable service in the organization catalogue. Billing charges, invoices and insurance claims all use this one record."
        actions={
          <>
            <ActionButton onClick={cancel}>Cancel</ActionButton>
            {submit('Create Service')}
          </>
        }
      />
      {failure && <Banner tone="danger" title="Service not created" className="mb-5">{failure}</Banner>}

      <div className="flex flex-col gap-5">
        <Panel title="1 · Service information (reusable master)" subtitle="Core definition shared across facilities." bodyClassName="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput label="Service name" name="name" required hint="Shown on charges and invoices" value={values.name} onChange={change} error={errors.name} placeholder="e.g. Cardiology Consultation" />
            <TextInput label="Service code" name="code" required hint="Unique in your organisation, e.g. SRV-CARD-01" value={values.code} onChange={change} error={errors.code} />
          </div>
          <ChipGroup legend="Service category *" options={SERVICE_CATEGORIES} value={values.category} onChange={(value) => set('category', value)} />
          {errors.category && <p role="alert" className="-mt-3 text-xs text-rose-600">{errors.category}</p>}
          <SelectInput label="Primary department" name="department" placeholder={departments.length ? 'Unassigned' : 'No departments yet'} options={departments} value={values.department} onChange={change} error={errors.department} hint="From Configuration › Departments" />
          <ChipGroup legend="Unit / duration" options={UNITS} value={values.unit} onChange={(value) => set('unit', value)} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-800">Clinical scope / description</span>
            <textarea name="description" rows={3} maxLength={2000} value={values.description} onChange={change} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            <span className="text-right text-[11px] text-outline">{values.description.length} / 2000 chars</span>
          </label>
        </Panel>

        <Panel title="2 · Price & tax" bodyClassName="grid gap-5 sm:grid-cols-3">
          <TextInput label="Default price (INR ₹)" name="price" type="number" min="0" required value={values.price} onChange={change} error={errors.price} />
          <SelectInput label="Tax treatment" name="tax" value={values.tax} onChange={(event) => setValues((current) => ({ ...current, tax: event.target.value, taxConfig: '' }))} options={TAX_TREATMENTS.map(([, label]) => label)} error={errors.tax} />
          {TAX_CONFIGS[values.tax] && <SelectInput label="Tax configuration" name="taxConfig" placeholder="Choose…" value={values.taxConfig} onChange={change} options={TAX_CONFIGS[values.tax]} error={errors.taxConfig} />}
        </Panel>

        <Panel title="3 · Authorized branch locations" subtitle="Where this service can be charged. Leave the price blank to use the default." action={<StatusPill tone="success">{offered.length} locations selected</StatusPill>} bodyClassName="flex flex-col gap-2">
          {usable.map((branch) => {
            const entry = values.branches[branch.id]
            return (
              <CheckRow key={branch.id} checked={entry.offered} onChange={() => setBranch(branch.id, { offered: !entry.offered })} label={branch.name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-on-surface">{branch.name}</p>
                    <p className="text-xs text-on-surface-variant">{branchAddress(branch) || branch.code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono text-outline">{branch.code}</span>
                    <StatusPill tone={BRANCH_STATUS[branch.status][1]}>{BRANCH_STATUS[branch.status][0]}</StatusPill>
                  </div>
                </div>
              </CheckRow>
            )
          })}
          {offered.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {offered.map((branch) => {
                const entry = values.branches[branch.id]
                return (
                  <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                    <p className="text-[13px] font-semibold text-on-surface">{branch.name} <span className="font-mono text-[11px] font-normal text-outline">{branch.code}</span></p>
                    <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                      Branch price (INR ₹)
                      <input type="number" min="0" aria-label={`Price at ${branch.name}`} placeholder="Default" value={entry.price} onChange={(event) => setBranch(branch.id, { price: event.target.value, mode: event.target.value === '' ? 'default' : 'custom' })} className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-[13px] outline-none focus:border-brand" />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {errors.branches && <p role="alert" className="text-xs text-rose-600">{errors.branches}</p>}
        </Panel>

        <Panel title="Configuration review">
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Status</legend>
            <div className="flex gap-2">
              {['Inactive', 'Active'].map((status) => (
                <label key={status} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs', values.status === status ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>
                  <input type="radio" name="status" value={status} checked={values.status === status} onChange={change} className="accent-brand" />
                  {status === 'Active' ? 'Active — can be charged now' : 'Inactive — save as a draft'}
                </label>
              ))}
            </div>
          </fieldset>
          <dl className="grid gap-3 text-xs sm:grid-cols-4">
            {[
              ['Service master', values.name || '—'],
              ['Primary department', values.department || '—'],
              ['Locations authorized', `${offered.length} ${offered.length === 1 ? 'branch' : 'branches'}`],
              ['Unit', values.unit || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-outline">{label}</dt>
                <dd className="font-semibold text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          <InfoNote className="mt-4"><strong className="text-on-surface">Historical safety guarantee:</strong> Creating a service does not change past charges or invoices.</InfoNote>
          <div className="mt-4 flex justify-end gap-2">
            <ActionButton onClick={cancel}>Cancel & Exit</ActionButton>
            {submit('Create Service & View Detail →')}
          </div>
        </Panel>
      </div>
    </form>
  )
}

export default function AddServicePage() {
  const catalogue = useCatalogue()
  return (
    <ConfigPage>
      {catalogue.ready ? <ServiceForm services={catalogue.services} branches={catalogue.branches} /> : <><PageIntro title="Add Service" /><LoadingState label="Loading…" error={catalogue.error} onRetry={catalogue.reload} /></>}
    </ConfigPage>
  )
}
