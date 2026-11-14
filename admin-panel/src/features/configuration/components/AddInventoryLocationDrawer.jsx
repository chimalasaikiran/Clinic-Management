import { useState } from 'react'
import { Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { useFormFields } from '../../../hooks/useFormFields'
import { LOCATION_TYPES } from '../data/inventory'
import { validateInventoryLocation } from '../validation'

const INITIAL_VALUES = { name: '', code: '', type: LOCATION_TYPES[0], status: 'active', description: '' }

// `onCreate` receives the validated location so the page can add it to its list.
export default function AddInventoryLocationDrawer({ open, onClose, onCreate }) {
  const [values, handleChange, setValues] = useFormFields(INITIAL_VALUES)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateInventoryLocation(values) : {}

  const finish = () => {
    setValues(INITIAL_VALUES)
    setSubmitted(false)
    onClose()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateInventoryLocation(values)).length) return
    onCreate({
      id: `custom-${Date.now()}`,
      name: values.name.trim(),
      detail: values.description.trim() || 'Main Clinic · Inventory location',
      type: values.type.split(' (')[0],
      status: values.status === 'active' ? 'Active' : 'Inactive',
      protocol: 'Enabled (Default Governance)',
      protocolNote: 'Inherits branch stock handling rules',
    })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Facility storage provisioning"
      title="Add inventory location"
      description="Create a location for storing and organizing inventory at Main Clinic."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-outline">Node validation passed</p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={Plus} type="submit" form="inventory-location-form">
              Create location
            </ActionButton>
          </div>
        </div>
      }
    >
      <form id="inventory-location-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        <InfoNote>Main Clinic (HYD-HQ-01) · Facility node · Inventory-enabled · Clinical storage domain</InfoNote>
        <TextInput label="Location name" name="name" required value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Trauma & Minor OT Store" />
        <TextInput label="Location code" name="code" required hint="Auto-generated; editable" value={values.code} onChange={handleChange} error={errors.code} placeholder="e.g. ST-TRAUMA-01" />
        <SelectInput label="Location type" name="type" required options={LOCATION_TYPES} value={values.type} onChange={handleChange} />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Location status</legend>
          <div className="flex flex-col gap-2">
            <RadioCard name="status" value="active" checked={values.status === 'active'} onChange={handleChange} title="Active" detail="Operational and available for stock allocation, receiving, and picking." />
            <RadioCard name="status" value="inactive" checked={values.status === 'inactive'} onChange={handleChange} title="Inactive" detail="Unavailable for new operational movements. Historical logs remain preserved and audit-ready." />
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">
            Description <span className="font-normal text-outline">(optional)</span>
          </span>
          <textarea
            name="description"
            rows={3}
            value={values.description}
            onChange={handleChange}
            className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <InfoNote tone="brand">
          <strong className="text-on-surface">Data boundary notice:</strong> Creating this location defines a storage node for Main Clinic. It does not create stock items, purchase orders, or alter central ERP data.
        </InfoNote>
      </form>
    </Drawer>
  )
}
