import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote, RadioCard, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { CARDIOLOGY_CONSULT } from '../data/services'
import { validatePrice } from '../validation'

export function AddServiceLocationsDrawer({ open, onClose }) {
  const { addLocationOptions, alreadyAdded } = CARDIOLOGY_CONSULT
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const needle = query.trim().toLowerCase()
  const visible = addLocationOptions.filter((option) => !needle || `${option.name} ${option.code} ${option.detail}`.toLowerCase().includes(needle))
  const count = selectedIds.length

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const finish = () => {
    setQuery('')
    setSelectedIds([])
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      title="Add Locations"
      description="Select existing clinic locations to authorize and schedule Cardiology Consultation."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            <strong className="text-on-surface">{count} {count === 1 ? 'location' : 'locations'} selected</strong>
            <span className="block text-[11px] text-outline">Staged for deployment</span>
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={Plus} disabled={count === 0} onClick={finish}>Add selected {count === 1 ? 'location' : 'locations'}</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search locations by name, code or city…" />
        <ul className="flex flex-col gap-2">
          {visible.map((option) => (
            <li key={option.id}>
              <CheckRow checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} label={option.name}>
                <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-on-surface">
                  {option.name}
                  <span className="font-mono text-[11px] font-normal text-outline">{option.code}</span>
                </p>
                <p className="text-xs text-on-surface-variant">{option.detail}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <StatusPill tone="success">{option.hours}</StatusPill>
                  <StatusPill>{option.wing}</StatusPill>
                </p>
                {option.note && selectedIds.includes(option.id) && (
                  <InfoNote tone="warning" className="mt-2"><strong>Note:</strong> {option.note}</InfoNote>
                )}
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">No locations match your search.</li>}
        </ul>
        <p className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs">
          <span className="text-on-surface-variant">{alreadyAdded}</span>
          <StatusPill>Already added</StatusPill>
        </p>
      </div>
    </Drawer>
  )
}

export function SetBranchPriceDrawer({ open, onClose }) {
  const branches = CARDIOLOGY_CONSULT.addLocationOptions
  const [branchId, setBranchId] = useState(branches[0].id)
  const [values, setValues] = useState({ price: '', effectiveFrom: '', status: 'active' })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validatePrice(values) : {}

  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const finish = () => {
    setValues({ price: '', effectiveFrom: '', status: 'active' })
    setBranchId(branches[0].id)
    setSubmitted(false)
    onClose()
  }
  const submit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validatePrice(values)).length === 0) finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      title="Set Branch Price"
      description="Configure a localized tariff for this facility."
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <ActionButton variant="brand" icon={Check} type="submit" form="branch-price-form">
            Apply Price{values.price && ` (₹${values.price})`}
          </ActionButton>
        </div>
      }
    >
      <form id="branch-price-form" onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Branch</legend>
          <div className="flex flex-col gap-2">
            {branches.map((branch) => (
              <label key={branch.id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', branchId === branch.id ? 'border-brand bg-teal-50/60' : 'border-slate-200')}>
                <input type="radio" name="branch" checked={branchId === branch.id} onChange={() => setBranchId(branch.id)} className="mt-1 accent-[#006a61]" />
                <span>
                  <span className="block text-[13px] font-semibold text-on-surface">{branch.name} <span className="font-mono text-[11px] font-normal text-outline">{branch.code}</span></span>
                  <span className="block text-xs text-on-surface-variant">{branch.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <InfoNote tone="brand"><strong className="text-brand">Local Branch Tariff.</strong> Overrides the base tariff for this branch only. Staff-level modification is configured under Facility Architecture and role controls.</InfoNote>

        <TextInput label="Service price (INR)" name="price" required inputMode="decimal" prefix="₹" value={values.price} onChange={update} error={errors.price} placeholder="900" />
        <TextInput label="Effective from" name="effectiveFrom" type="date" required value={values.effectiveFrom} onChange={update} error={errors.effectiveFrom} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Pricing activation status</legend>
          <div className="grid grid-cols-2 gap-2">
            <RadioCard name="status" value="active" checked={values.status === 'active'} onChange={update} title="Active" detail="Immediately billing" />
            <RadioCard name="status" value="inactive" checked={values.status === 'inactive'} onChange={update} title="Inactive" detail="Not billing" />
          </div>
        </fieldset>
        <InfoNote><strong className="text-on-surface">Financial audit guarantee:</strong> Setting this price creates a forward-looking tariff rule. Existing appointments and billed invoices prior to this effective date, generated invoices, and GST reconciliations remain unchanged.</InfoNote>
      </form>
    </Drawer>
  )
}
