import { invoiceTotals } from '../patients/billing'
import { PAYERS } from './constants'

export { PAYERS }

// Unbilled charges are the only ones an invoice may draw from; invoiced ones are never offered again.
export const eligibleCharges = (charges, patientId) => charges.filter((charge) => charge.patientId === patientId && charge.status === 'Unbilled')

export function validateInvoiceDraft(values, { review = false } = {}) {
  const errors = {}
  if (!values.patientId) errors.patientId = 'Choose the patient being invoiced.'
  if (!values.payer) errors.payer = 'Choose the invoice recipient / payer.'
  if (!values.date) errors.date = 'Choose the invoice date.'
  if (!values.dueDate) errors.dueDate = 'Set the due date.'
  else if (values.date && values.dueDate < values.date) errors.dueDate = 'The due date cannot be before the invoice date.'
  if (!values.model) errors.model = 'Choose the billing model explicitly; none is assumed.'
  const discount = Number(values.discount)
  if (values.discount !== '' && (!Number.isFinite(discount) || discount < 0 || discount > 100)) errors.discount = 'Enter a discount between 0 and 100 percent.'
  if (review && values.chargeIds.length === 0) errors.charges = 'Select at least one eligible charge.'
  return errors
}

// The lines an invoice would carry. An invoice-level discount, when entered, replaces each charge's own discount.
export function linesFor(charges, chargeIds, discount) {
  const pct = discount === '' || discount === undefined ? null : Number(discount) || 0
  return charges.filter((charge) => chargeIds.includes(charge.id)).flatMap((charge) => charge.lines.map((line) => ({ ...line, discountPct: pct ?? line.discountPct })))
}

export const draftTotals = (charges, chargeIds, discount) => invoiceTotals(linesFor(charges, chargeIds, discount))

// The request body for issuing an invoice from the selected charges.
export function invoiceRequest(values, charges) {
  return {
    patientId: values.patientId, payer: values.payer, model: values.model, invoiceDate: values.date, dueDate: values.dueDate,
    discountPct: values.discount === '' ? null : Number(values.discount), chargeIds: charges.filter((charge) => values.chargeIds.includes(charge.id)).map((charge) => charge.uuid),
  }
}
