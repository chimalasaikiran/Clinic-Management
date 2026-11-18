import { isEmail } from '../../lib/validators'
import { availableOf } from './stockLogic'

const isWhole = (value) => /^\d+$/.test(String(value).trim()) && Number(value) > 0
const isSigned = (value) => /^-?\d+$/.test(String(value).trim()) && Number(value) !== 0

// Each validator returns { field: message }; an empty object means the form can be submitted.

export function validateAdjustment(values, batches, mode = 'post') {
  const errors = {}
  const batch = batches.find((entry) => entry.id === values.batchId)
  if (!values.itemId) errors.itemId = 'Choose an item.'
  if (!values.batchId) errors.batchId = 'Choose the batch being adjusted.'
  if (!isSigned(values.proposed)) errors.proposed = 'Enter the quantity change as a whole number other than 0 (negative to remove stock).'
  else if (batch && mode === 'post' && batch.posted + Number(values.proposed) < batch.reserved + batch.quarantine) {
    errors.proposed = `Only ${Math.max(0, batch.posted - batch.reserved - batch.quarantine)} units are free in this batch; the rest are reserved or in quarantine.`
  }
  if (!values.reason) errors.reason = 'Choose the reason for the adjustment.'
  if (mode === 'post' && !values.evidence?.trim()) errors.evidence = 'Reference the count sheet or evidence the change is based on.'
  return errors
}

export function validateSupplier(values, suppliers, editingId) {
  const errors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Enter the supplier name.'
  else if (suppliers.some((entry) => entry.id !== editingId && entry.name.toLowerCase() === name.toLowerCase())) errors.name = 'A supplier with this name already exists. Reuse the existing record.'
  const code = values.code.trim()
  if (code && suppliers.some((entry) => entry.id !== editingId && entry.code.toLowerCase() === code.toLowerCase())) errors.code = 'This supplier code is already in use.'
  if (values.email.trim() && !isEmail(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (values.phone.trim() && !/^\+?[\d\s()-]{7,18}$/.test(values.phone.trim())) errors.phone = 'Enter a valid phone number, with the country code if applicable.'
  if (values.gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(values.gstin.trim().toUpperCase())) errors.gstin = 'Enter a valid 15-character GSTIN (for example 29AABCT1332L1ZV).'
  if (values.postal.trim() && !/^\d{6}$/.test(values.postal.trim())) errors.postal = 'Enter a 6-digit postal code.'
  return errors
}

export function validateOrder(values) {
  const errors = {}
  if (!values.supplierId) errors.supplierId = 'Select a supplier.'
  if (!values.date) errors.date = 'Choose the order date.'
  if (!values.expected) errors.expected = 'Choose the expected delivery date.'
  else if (values.date && values.expected < values.date) errors.expected = 'Delivery cannot be expected before the order date.'
  const lines = values.lines.filter((line) => line.itemId)
  if (!lines.length) errors.lines = 'Add at least one item to the order.'
  else if (lines.some((line) => !isWhole(line.ordered) || !(Number(line.rate) >= 0) || String(line.rate).trim() === '')) errors.lines = 'Every line needs a whole-number quantity and a rate.'
  return errors
}

export function validateRequest(values) {
  const errors = {}
  if (!values.pharmacy) errors.pharmacy = 'Choose the requesting pharmacy.'
  if (!values.required) errors.required = 'Choose the date the stock is required by.'
  const lines = values.lines.filter((line) => line.itemId)
  if (!lines.length) errors.lines = 'Add at least one medicine to request.'
  else if (lines.some((line) => !isWhole(line.requested))) errors.lines = 'Enter a whole-number quantity for every medicine.'
  if (!values.reason) errors.reason = 'Choose the reason for the request.'
  return errors
}

// Review decision for a stock request: quantities per line plus a reason for partial approval or rejection.
export function validateReview(values, lines, availability) {
  const errors = {}
  if (!values.decision) {
    errors.decision = 'Choose how to decide this request.'
    return errors
  }
  if (values.decision !== 'Approve in full' && !values.reason.trim()) errors.reason = 'A decision reason is required for a partial approval or rejection.'
  if (values.decision === 'Reject request') return errors
  const quantities = lines.map((line) => Number(values.approveNow[line.itemId] ?? 0))
  if (quantities.some((value) => !Number.isInteger(value) || value < 0)) errors.quantities = 'Approved quantities must be whole numbers.'
  else if (lines.some((line, index) => quantities[index] > availability[line.itemId])) errors.quantities = 'An approved quantity exceeds what is available at Central Stores.'
  else if (lines.some((line, index) => quantities[index] > line.requested - line.approved)) errors.quantities = 'An approved quantity exceeds what was requested.'
  else if (quantities.every((value) => value === 0)) errors.quantities = 'Approve a quantity for at least one item, or reject the request.'
  return errors
}

export function validateTransfer(values, batches) {
  const errors = {}
  if (!values.from) errors.from = 'Choose the source location.'
  if (!values.to) errors.to = 'Choose the destination location.'
  else if (values.to === values.from) errors.to = 'The destination must differ from the source.'
  if (!values.planned) errors.planned = 'Choose the planned dispatch date.'
  if (!values.reason) errors.reason = 'Choose the reason for the transfer.'
  if (!values.lines.length) errors.lines = 'Add at least one item to transfer.'
  else {
    const over = values.lines.find((line) => {
      const batch = batches.find((entry) => entry.id === line.batchId)
      return !isWhole(line.qty) || !batch || Number(line.qty) > availableOf(batch)
    })
    if (over) errors.lines = 'Every line needs a whole-number quantity within the batch’s available stock.'
  }
  return errors
}

export function validateReceipt(values) {
  const errors = {}
  if (!values.supplierId) errors.supplierId = 'Choose the supplier.'
  if (!values.orderId) errors.orderId = 'Choose the purchase order being received.'
  if (!values.challan.trim()) errors.challan = 'Enter the delivery note / challan number.'
  if (!values.receivedBy) errors.receivedBy = 'Choose who received the delivery.'
  values.lines.forEach((line, index) => {
    const received = Number(line.received)
    const rejected = Number(line.rejected)
    if (!Number.isInteger(received) || received < 0 || !Number.isInteger(rejected) || rejected < 0) errors[`line${index}`] = 'Counts must be whole numbers.'
    else if (rejected > received) errors[`line${index}`] = 'Rejected cannot exceed the quantity received.'
    else if (received > line.outstanding) errors[`line${index}`] = `Received exceeds the ${line.outstanding} still outstanding on the order.`
    else if (received - rejected !== line.batches.reduce((sum, batch) => sum + Number(batch.qty || 0), 0)) errors[`line${index}`] = 'Batch quantities must add up to the accepted quantity.'
    else if (line.batches.some((batch) => Number(batch.qty) > 0 && (!batch.batchNo.trim() || !batch.expiry))) errors[`line${index}`] = 'Every batch needs a batch number and expiry date.'
  })
  if (values.lines.every((line) => Number(line.received) === 0)) errors.lines = 'Record a received quantity for at least one item.'
  const short = values.lines.some((line) => Number(line.received) < line.outstanding)
  const rejects = values.lines.some((line) => Number(line.rejected) > 0)
  if ((short || rejects) && !values.reason) errors.reason = 'Choose the reason for the difference.'
  if ((short || rejects) && !values.resolution) errors.resolution = 'Choose how the difference will be resolved.'
  if (!values.verified) errors.verified = 'Confirm that the physical quantities, batches and expiry dates were verified.'
  return errors
}

export function validateResolution(values) {
  const errors = {}
  if (!values.disposition) errors.disposition = 'Choose the proposed disposition.'
  if (!values.note.trim()) errors.note = 'Record the supplier response and why this disposition is appropriate.'
  return errors
}

export function validateDeactivation(values) {
  return values.reason.trim() ? {} : { reason: 'Give a reason for deactivating this supplier.' }
}

const isCount = (value) => /^\d+$/.test(String(value).trim())
const isPrice = (value) => /^\d+(\.\d{1,2})?$/.test(String(value).trim())

// The item master form; the API checks the same rules and that the code is unique.
export function validateItem(values, items, editingId) {
  const errors = {}
  const code = values.code.trim().toUpperCase()
  if (!code) errors.code = 'Enter the item code.'
  else if (items.some((item) => item.id === code && item.id !== editingId)) errors.code = 'This item code is already used.'
  if (!values.name.trim()) errors.name = 'Enter the item name.'
  if (!values.category) errors.category = 'Choose the category.'
  if (!values.unit.trim()) errors.unit = 'Enter the unit, e.g. tablet.'
  if (!values.unitPlural.trim()) errors.unitPlural = 'Enter the plural unit, e.g. tablets.'
  if (values.medicineCode && !values.strength) errors.strength = 'Choose the strength of the linked medicine.'
  if (!isPrice(values.unitPrice)) errors.unitPrice = 'Enter the unit price, e.g. 1.20.'
  for (const field of ['safetyLevel', 'reorderLevel', 'targetLevel']) if (!isCount(values[field])) errors[field] = 'Enter a whole number.'
  if (!errors.targetLevel && Number(values.targetLevel) > 0 && Number(values.targetLevel) < Number(values.reorderLevel)) errors.targetLevel = 'The target level cannot be below the reorder level.'
  return errors
}

export const itemRequest = (values) => ({
  code: values.code.trim().toUpperCase(), name: values.name.trim(), category: values.category, unit: values.unit.trim(), unitPlural: values.unitPlural.trim(), dosageForm: values.dosageForm.trim() || null,
  brand: values.brand.trim() || null, pack: values.pack.trim() || null, storage: values.storage.trim() || null, schedule: values.schedule || null, medicineCode: values.medicineCode || null, strength: values.strength || null,
  unitPrice: Number(values.unitPrice), safetyLevel: Number(values.safetyLevel), reorderLevel: Number(values.reorderLevel), targetLevel: Number(values.targetLevel), supplierIds: values.supplierIds,
  preferredSupplierId: values.preferredSupplierId || null, active: values.active,
})

export function validateLocation(values, locations) {
  const errors = {}
  if (!values.branchId) errors.branchId = 'Choose the branch.'
  if (!values.code.trim()) errors.code = 'Enter a short code, e.g. MAIN-RX.'
  else if (locations.some((location) => location.id === values.code.trim().toUpperCase())) errors.code = 'This location code is already used.'
  if (!values.name.trim()) errors.name = 'Enter the location name.'
  if (!values.kind) errors.kind = 'Choose store or pharmacy.'
  return errors
}
