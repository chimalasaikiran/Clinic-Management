const isWhole = (value) => /^\d+$/.test(String(value).trim())

export const RETURN_SOURCES = ['Patient return', 'Unused ward stock']
export const RETURN_REASONS = ['Therapy changed', 'Dose changed', 'Adverse reaction', 'Wrong item dispensed', 'Unused ward stock']
export const PACKAGING_CONDITIONS = ['Unopened strips', 'Opened packaging', 'Seal compromised', 'Sealed · verified']
export const DISCREPANCY_CATEGORIES = ['Shortage', 'Damaged stock', 'Batch mismatch', 'Excess stock']

// What a patient-return prescription reference proves: the quantity of that medicine already dispensed on it.
export function dispensedOn(rxQueue, rxId, itemId) {
  const rx = rxQueue.find((entry) => entry.id.toLowerCase() === rxId.trim().toLowerCase())
  const line = rx?.lines.find((entry) => entry.itemId === itemId)
  return rx ? { rx, line, dispensed: line?.dispensed ?? 0 } : null
}

// Validates the create-return / report-discrepancy form. `draft` only needs a medicine so partial work can be saved.
export function validateCase(values, rxQueue, { draft = false } = {}) {
  const errors = {}
  if (!values.itemId) errors.itemId = 'Choose the medicine.'
  if (draft) return errors
  if (!values.batchId) errors.batchId = 'Choose the batch.'
  if (!values.assignee) errors.assignee = 'Choose who will review this case.'
  if (values.type === 'Return') {
    if (!values.source) errors.source = 'Choose the return source.'
    if (!values.receiving) errors.receiving = 'Choose the receiving location.'
    if (!values.reason) errors.reason = 'Choose the return reason.'
    if (!values.condition) errors.condition = 'Choose the packaging condition.'
    if (!isWhole(values.qty) || Number(values.qty) <= 0) errors.qty = 'Enter the returned quantity as a whole number of individual units.'
    if (!values.reference.trim()) errors.reference = values.source === 'Patient return' ? 'Enter the prescription reference.' : 'Enter the issue reference.'
    else if (values.source === 'Patient return' && values.itemId) {
      const match = dispensedOn(rxQueue, values.reference, values.itemId)
      if (!match) errors.reference = 'No prescription with this reference was found.'
      else if (match.dispensed === 0) errors.reference = 'This medicine was not dispensed on that prescription.'
      else if (!errors.qty && Number(values.qty) > match.dispensed) errors.qty = `Only ${match.dispensed} were dispensed on ${match.rx.id}.`
    }
    return errors
  }
  if (!values.location) errors.location = 'Choose the branch or location.'
  if (!values.category) errors.category = 'Choose the discrepancy category.'
  if (!isWhole(values.expected)) errors.expected = 'Enter the expected quantity.'
  if (!isWhole(values.observed)) errors.observed = 'Enter the observed quantity.'
  else if (isWhole(values.expected) && Number(values.expected) === Number(values.observed)) errors.observed = 'Expected and observed quantities match; there is no variance to report.'
  if (!values.explanation.trim()) errors.explanation = 'Explain what was found.'
  return errors
}
