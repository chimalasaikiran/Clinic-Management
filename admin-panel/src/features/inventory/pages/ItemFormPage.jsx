import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { MEDICINES } from '../../patients/data/catalog'
import { Check, OptionSelect } from '../../patients/components/parts'
import DetailFrame, { MissingRecord } from '../components/DetailFrame'
import { Section } from '../components/shared'
import { ITEM_CATEGORIES } from '../constants'
import { useStock } from '../context/useStock'
import { itemRequest, validateItem } from '../validation'

const BLANK = { code: '', name: '', category: '', unit: '', unitPlural: '', dosageForm: '', brand: '', pack: '', storage: '', schedule: '', medicineCode: '', strength: '', unitPrice: '', safetyLevel: '0', reorderLevel: '0', targetLevel: '0', supplierIds: [], preferredSupplierId: '', active: true }
const fromItem = (item) => ({
  ...BLANK, code: item.id, name: item.name, category: item.category, unit: item.unit, unitPlural: item.unitPlural, dosageForm: item.dose ?? '', brand: item.brand ?? '', pack: item.pack ?? '', storage: item.storage ?? '',
  schedule: item.scheduleCode ?? '', medicineCode: item.medicineCode ?? '', strength: item.strength ?? '', unitPrice: String(item.price), safetyLevel: String(item.safety), reorderLevel: String(item.reorder), targetLevel: String(item.target),
  supplierIds: item.suppliers, preferredSupplierId: item.preferred ?? '', active: item.active,
})

// Adds an item to the item master or edits one. Linking a medicine to the prescribing catalogue (with its
// strength) is what lets the pharmacy dispense prescriptions for it.
export default function ItemFormPage() {
  const { itemId } = useParams()
  const { items, state, run } = useStock()
  const navigate = useNavigate()
  const editing = itemId ? items.find((entry) => entry.id === itemId) : null
  const [values, setValues] = useState(() => (editing ? fromItem(editing) : BLANK))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  if (itemId && !editing) return <MissingRecord what="item" backTo={ROUTES.inventory} backLabel="Back to Inventory" />

  const errors = submitted ? validateItem(values, items, editing?.id) : {}
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const medicine = MEDICINES.find((entry) => entry.id === values.medicineCode)
  const suppliers = state.suppliers.filter((supplier) => supplier.active || values.supplierIds.includes(supplier.id))
  const toggleSupplier = (id) => set('supplierIds', values.supplierIds.includes(id) ? values.supplierIds.filter((entry) => entry !== id) : [...values.supplierIds, id])
  const back = editing ? pathFor(ROUTES.inventoryItem, { itemId: editing.id }) : ROUTES.inventorySetup

  const save = async () => {
    setSubmitted(true)
    if (Object.keys(validateItem(values, items, editing?.id)).length) return
    setSaving(true)
    const outcome = await run('item/save', { id: editing?.id, ...itemRequest(values) })
    setSaving(false)
    if (outcome.error) return
    navigate(pathFor(ROUTES.inventoryItem, { itemId: values.code.trim().toUpperCase() }))
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Setup', to: ROUTES.inventorySetup }, { label: editing ? editing.name : 'Add item' }]}
      title={editing ? 'Edit Item' : 'Add Item'}
      subtitle={editing ? `${editing.name} · ${editing.id}. Stock, batches and history are not changed by editing the record.` : 'Add a medicine, consumable or supply to the item master.'}
    >
      <InfoNote tone="brand" className="mb-5">
        <p className="text-sm font-semibold text-on-surface">Medicines dispensed against prescriptions</p>
        <p className="mt-1">Choose the prescribing catalogue medicine and its strength. A prescription line is dispensed from the item with the same medicine and strength.</p>
      </InfoNote>
      <div className="flex flex-col gap-5">
        <Section title="Item details" aside="* Required fields">
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput label="Item code" name="code" required value={values.code} onChange={update} error={errors.code} hint="Unique in your organisation, e.g. MED-00124." />
            <TextInput label="Item name" name="name" required value={values.name} onChange={update} error={errors.name} placeholder="e.g. Paracetamol 500mg" />
            <OptionSelect label="Category" name="category" required placeholder="Select category" value={values.category} onChange={update} error={errors.category} options={ITEM_CATEGORIES.map((entry) => ({ value: entry, label: entry }))} />
            <TextInput label="Unit" name="unit" required value={values.unit} onChange={update} error={errors.unit} placeholder="tablet" />
            <TextInput label="Unit (plural)" name="unitPlural" required value={values.unitPlural} onChange={update} error={errors.unitPlural} placeholder="tablets" />
            <TextInput label="Dosage form (optional)" name="dosageForm" value={values.dosageForm} onChange={update} placeholder="Tablet · Oral" />
            <TextInput label="Brand (optional)" name="brand" value={values.brand} onChange={update} />
            <TextInput label="Pack (optional)" name="pack" value={values.pack} onChange={update} placeholder="10 tablets" />
            <TextInput label="Storage (optional)" name="storage" value={values.storage} onChange={update} placeholder="Ambient, below 25°C" />
          </div>
        </Section>

        <Section title="Prescribing link & schedule" aside="Medicines only">
          <div className="grid gap-4 md:grid-cols-3">
            <OptionSelect label="Prescribing catalogue medicine" name="medicineCode" placeholder="Not a prescribed medicine" value={values.medicineCode} onChange={(event) => setValues((current) => ({ ...current, medicineCode: event.target.value, strength: '' }))} options={MEDICINES.map((entry) => ({ value: entry.id, label: entry.name }))} />
            <OptionSelect label="Strength" name="strength" placeholder={medicine ? 'Select strength' : 'Choose the medicine first'} disabled={!medicine} value={values.strength} onChange={update} error={errors.strength} options={(medicine?.strengths ?? []).map((entry) => ({ value: entry, label: entry }))} />
            <OptionSelect label="Drug schedule" name="schedule" placeholder="Not scheduled" value={values.schedule} onChange={update} options={[['H', 'Schedule H'], ['H1', 'Schedule H1 · register entry needed'], ['X', 'Schedule X']].map(([value, label]) => ({ value, label }))} />
          </div>
        </Section>

        <Section title="Price & replenishment levels" aside="Quantities in base units">
          <div className="grid gap-4 md:grid-cols-4">
            <TextInput label="Unit price (INR)" name="unitPrice" required inputMode="decimal" prefix="₹" value={values.unitPrice} onChange={update} error={errors.unitPrice} />
            <TextInput label="Pharmacy safety level" name="safetyLevel" required inputMode="numeric" value={values.safetyLevel} onChange={update} error={errors.safetyLevel} hint="Below this a pharmacy shows Low stock." />
            <TextInput label="Store reorder level" name="reorderLevel" required inputMode="numeric" value={values.reorderLevel} onChange={update} error={errors.reorderLevel} />
            <TextInput label="Store target level" name="targetLevel" required inputMode="numeric" value={values.targetLevel} onChange={update} error={errors.targetLevel} />
          </div>
        </Section>

        <Section title="Suppliers" aside={`${values.supplierIds.length} selected`}>
          {suppliers.length === 0 ? <p className="text-xs text-on-surface-variant">No suppliers yet. Add suppliers under Inventory → Suppliers.</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">{suppliers.map((supplier) => <Check key={supplier.id} checked={values.supplierIds.includes(supplier.id)} onChange={() => toggleSupplier(supplier.id)} label={supplier.name} />)}</div>
              <OptionSelect label="Preferred supplier" name="preferredSupplierId" placeholder="None" value={values.preferredSupplierId} onChange={update} options={suppliers.filter((supplier) => values.supplierIds.includes(supplier.id)).map((supplier) => ({ value: supplier.id, label: supplier.name }))} />
            </div>
          )}
          <div className="mt-4"><Check checked={values.active} onChange={(event) => set('active', event.target.checked)} label="Active · can be ordered, requested and dispensed" /></div>
        </Section>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <ActionButton to={back}>Cancel</ActionButton>
        <ActionButton variant="primary" disabled={saving} onClick={save}>{editing ? 'Save changes' : 'Add item'}</ActionButton>
      </div>
    </DetailFrame>
  )
}
