import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import { pathFor, ROUTES } from '../../../config/routes'
import { OptionSelect } from '../../patients/components/parts'
import DetailFrame from '../components/DetailFrame'
import { Pill, Section } from '../components/shared'
import { useStock } from '../context/useStock'
import { validateLocation } from '../validation'

const BLANK = { branchId: '', code: '', name: '', detail: '', kind: 'pharmacy' }

// Where stock is held (stores and pharmacies at each branch) and the item master. Both are needed before stock
// can be received, requested or dispensed.
export default function InventorySetupPage() {
  const { items, locations, branches, state, run } = useStock()
  const [values, setValues] = useState({ ...BLANK, branchId: branches[0]?.id ?? '' })
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState('')
  const errors = submitted ? validateLocation(values, locations) : {}
  const update = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const held = (code) => state.batches.filter((batch) => batch.loc === code).reduce((sum, batch) => sum + batch.posted, 0)

  const addLocation = async () => {
    setSubmitted(true)
    if (Object.keys(validateLocation(values, locations)).length) return
    const outcome = await run('location/create', { ...values, code: values.code.trim().toUpperCase(), name: values.name.trim(), detail: values.detail.trim() })
    if (outcome.error) return
    setNotice(`${values.name.trim()} added.`)
    setValues({ ...BLANK, branchId: values.branchId })
    setSubmitted(false)
  }
  const toggle = async (location) => {
    const outcome = await run('location/active', { id: location.id, active: !location.active })
    if (!outcome.error) setNotice(`${location.name} ${location.active ? 'closed' : 'reopened'}.`)
  }

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Setup' }]}
      title="Inventory Setup"
      subtitle="Stock locations at your branches and the items you stock."
      actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.inventoryItemNew}>Add Item</ActionButton>}
    >
      {notice && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">{notice}</p>}
      {(locations.length === 0 || items.length === 0) && (
        <InfoNote tone="brand" className="mb-5">
          <p className="text-sm font-semibold text-on-surface">Getting started</p>
          <p className="mt-1">Add a store (where deliveries are received) and at least one pharmacy, then add the items you stock. Medicines linked to the prescribing catalogue can then be dispensed against prescriptions.</p>
        </InfoNote>
      )}
      <div className="flex flex-col gap-5">
        <Section title="Stock locations" aside={`${locations.length} location${locations.length === 1 ? '' : 's'}`}>
          {locations.length > 0 && (
            <div className="-mx-5 mb-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-outline uppercase"><tr>{['Location', 'Code', 'Kind', 'Branch', 'Units held', 'Status', ''].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
                <tbody>{locations.map((location) => (
                  <tr key={location.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-semibold">{location.name}</td>
                    <td className="px-5 py-3 font-mono">{location.id}</td>
                    <td className="px-5 py-3">{location.kind === 'store' ? 'Store' : 'Pharmacy'}</td>
                    <td className="px-5 py-3">{location.branch}</td>
                    <td className="px-5 py-3">{held(location.id).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3"><Pill tone={location.active ? 'success' : 'neutral'}>{location.active ? 'Open' : 'Closed'}</Pill></td>
                    <td className="px-5 py-3 text-right"><ActionButton size="sm" onClick={() => toggle(location)} aria-label={`${location.active ? 'Close' : 'Reopen'} ${location.name}`}>{location.active ? 'Close' : 'Reopen'}</ActionButton></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-5">
            <OptionSelect label="Branch" name="branchId" required value={values.branchId} onChange={update} error={errors.branchId} placeholder="Select branch" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            <OptionSelect label="Kind" name="kind" required value={values.kind} onChange={update} error={errors.kind} options={[{ value: 'store', label: 'Store (receives deliveries)' }, { value: 'pharmacy', label: 'Pharmacy (dispenses)' }]} />
            <TextInput label="Location name" name="name" required value={values.name} onChange={update} error={errors.name} placeholder="Main Pharmacy" />
            <TextInput label="Code" name="code" required value={values.code} onChange={update} error={errors.code} placeholder="MAIN-RX" />
            <TextInput label="Detail (optional)" name="detail" value={values.detail} onChange={update} placeholder="Ground floor, counter 2" />
          </div>
          <div className="mt-4 flex justify-end"><ActionButton variant="primary" onClick={addLocation}>Add location</ActionButton></div>
        </Section>

        <Section title="Item master" aside={`${items.length} item${items.length === 1 ? '' : 's'}`}>
          {items.length === 0 ? <p className="text-xs text-on-surface-variant">No items yet. Use Add Item to create the first one.</p> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-outline uppercase"><tr>{['Item', 'Code', 'Category', 'Prescribing link', 'Levels (safety / reorder)', 'Status'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
                <tbody>{items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-5 py-3"><Link to={pathFor(ROUTES.inventoryItemEdit, { itemId: item.id })} className="font-semibold text-brand hover:underline">{item.name}</Link>{item.schedule && <span className="ml-2 text-outline">{item.schedule}</span>}</td>
                    <td className="px-5 py-3 font-mono">{item.id}</td>
                    <td className="px-5 py-3">{item.category}</td>
                    <td className="px-5 py-3">{item.medicineCode ? `${item.medicineCode} · ${item.strength}` : '—'}</td>
                    <td className="px-5 py-3">{item.safety} / {item.reorder}</td>
                    <td className="px-5 py-3"><Pill tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Active' : 'Inactive'}</Pill></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </DetailFrame>
  )
}
