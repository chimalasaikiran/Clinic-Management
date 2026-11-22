import { useState } from 'react'
import { Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { Banner } from '../../../components/workspace/RecordKit'
import { useFormFields } from '../../../hooks/useFormFields'
import { inventoryApi } from '../../inventory/api'
import { validateInventoryLocation } from '../validation'

const INITIAL_VALUES = { name: '', code: '', kind: 'store', description: '' }

export default function AddInventoryLocationDrawer({ open, onClose, branch, onCreated }) {
  const [values, handleChange, setValues] = useFormFields(INITIAL_VALUES)
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState('')
  const [serverErrors, setServerErrors] = useState({})
  const [pending, setPending] = useState(false)
  const errors = { ...(submitted ? validateInventoryLocation(values) : {}), ...serverErrors }

  const finish = () => {
    setValues(INITIAL_VALUES)
    setSubmitted(false)
    setFailure('')
    setServerErrors({})
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    setServerErrors({})
    if (Object.keys(validateInventoryLocation(values)).length) return
    setPending(true)
    try {
      await inventoryApi.createLocation({ branchId: branch.id, code: values.code.trim(), name: values.name.trim(), detail: values.description.trim(), kind: values.kind })
      onCreated(`${values.name.trim()} created.`)
      finish()
    } catch (error) {
      setServerErrors(error.fieldErrors?.() ?? {})
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Facility storage provisioning"
      title="Add inventory location"
      description={`Create a location for storing and organizing inventory at ${branch.name}.`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <ActionButton variant="primary" icon={Plus} type="submit" form="inventory-location-form" disabled={pending}>{pending ? 'Creating…' : 'Create location'}</ActionButton>
        </div>
      }
    >
      <form id="inventory-location-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-5">
        {failure && <Banner tone="danger" title="Location not created">{failure}</Banner>}
        <InfoNote>{branch.name} ({branch.code})</InfoNote>
        <TextInput label="Location name" name="name" required value={values.name} onChange={handleChange} error={errors.name} placeholder="e.g. Minor OT Store" />
        <TextInput label="Location code" name="code" required hint="Short and unique, e.g. MAIN-RX" value={values.code} onChange={handleChange} error={errors.code} placeholder="e.g. MAIN-OT" />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Location type</legend>
          <div className="flex flex-col gap-2">
            <RadioCard name="kind" value="store" checked={values.kind === 'store'} onChange={handleChange} title="Store" detail="Holds consumables and supplies; issues stock to the branch and transfers it on." />
            <RadioCard name="kind" value="pharmacy" checked={values.kind === 'pharmacy'} onChange={handleChange} title="Pharmacy" detail="Dispensing counter: dispenses prescriptions and sells medicines to patients." />
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-800">Description <span className="font-normal text-outline">(optional)</span></span>
          <textarea name="description" rows={3} maxLength={160} value={values.description} onChange={handleChange} className="rounded-md border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
        </label>
        <InfoNote tone="brand"><strong className="text-on-surface">Data boundary notice:</strong> Creating a location does not create stock items or purchase orders. Receive stock into it from Inventory.</InfoNote>
      </form>
    </Drawer>
  )
}
