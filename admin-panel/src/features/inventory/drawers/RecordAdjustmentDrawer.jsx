import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { OptionSelect } from '../../patients/components/parts'
import { ADJUSTMENT_REASONS, locationName } from '../constants'
import { ITEMS } from '../data/items'
import { qty } from '../format'
import { validateAdjustment } from '../validation'

const BLANK = { itemId: '', batchId: '', proposed: '', reason: '', evidence: '' }

// Records a stock adjustment against one batch. Posting changes stock and writes the movement ledger; a draft changes nothing.
export default function RecordAdjustmentDrawer({ open, onClose, batches, initial, onSave }) {
  const [values, setValues] = useState({ ...BLANK, ...initial })
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState('post')
  const errors = submitted ? validateAdjustment(values, batches, mode) : {}
  const candidates = batches.filter((batch) => batch.itemId === values.itemId)
  const batch = batches.find((entry) => entry.id === values.batchId)
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))

  const finish = () => {
    setValues({ ...BLANK, ...initial })
    setSubmitted(false)
    onClose()
  }

  const save = (nextMode) => {
    setMode(nextMode)
    setSubmitted(true)
    if (Object.keys(validateAdjustment(values, batches, nextMode)).length) return
    onSave({ ...values, mode: nextMode, proposed: Number(values.proposed), id: initial?.id })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Inventory · Stock adjustment"
      title="Record adjustment"
      description="Correct a counted difference against one batch. Every change keeps its reason, evidence, approver and timestamp."
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel</ActionButton>
          <div className="flex gap-2">
            <ActionButton onClick={() => save('draft')}>Save draft</ActionButton>
            <ActionButton variant="brand" onClick={() => save('post')}>Post adjustment</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <OptionSelect label="Item" required placeholder="Select an item" value={values.itemId} onChange={(event) => setValues((current) => ({ ...current, itemId: event.target.value, batchId: '' }))} error={errors.itemId} options={ITEMS.filter((item) => batches.some((entry) => entry.itemId === item.id)).map((item) => ({ value: item.id, label: item.name }))} />
        <OptionSelect label="Batch" required placeholder="Select a batch" value={values.batchId} onChange={(event) => set('batchId', event.target.value)} error={errors.batchId} options={candidates.map((entry) => ({ value: entry.id, label: `${entry.batchNo} · ${locationName(entry.loc)} · ${qty(entry.posted)} posted` }))} />
        {batch && <InfoNote>Posted {qty(batch.posted)} · reserved {qty(batch.reserved)} · quarantine {qty(batch.quarantine)}. Only unreserved, non-quarantined units can be removed.</InfoNote>}
        <TextInput label="Quantity change" required inputMode="numeric" value={values.proposed} onChange={(event) => set('proposed', event.target.value)} error={errors.proposed} hint="Negative to remove stock, positive to add" />
        <OptionSelect label="Reason" required placeholder="Select a reason" value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.reason} options={ADJUSTMENT_REASONS.map((entry) => ({ value: entry, label: entry }))} />
        <TextInput label="Evidence reference" value={values.evidence} onChange={(event) => set('evidence', event.target.value)} error={errors.evidence} hint="Count sheet or QA record, required to post" />
      </div>
    </Drawer>
  )
}
