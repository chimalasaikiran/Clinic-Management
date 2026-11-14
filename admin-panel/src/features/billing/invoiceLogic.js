import { invoiceTotals } from '../patients/billing'
import { nextId } from '../patients/format'

export const PAYERS = ['Patient Direct (Self)', 'Insurance / TPA', 'Corporate Account']

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

// The lines an invoice would carry, with the invoice-level discount applied to each.
export function linesFor(charges, chargeIds, discount) {
  const pct = Number(discount) || 0
  return charges.filter((charge) => chargeIds.includes(charge.id)).flatMap((charge) => charge.lines.map((line) => ({ ...line, discountPct: pct })))
}

export const draftTotals = (charges, chargeIds, discount) => invoiceTotals(linesFor(charges, chargeIds, discount))

export function buildInvoice(values, { charges, invoices, patient }) {
  const lines = linesFor(charges, values.chargeIds, values.discount)
  return {
    id: nextId('INV-2026-', invoices.map((entry) => entry.id), 3), patientId: patient.id, date: values.date, time: values.time, title: lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0].name,
    encounterId: '—', provider: 'Attending clinician', location: patient.branch, branch: patient.branch, payer: values.payer, kind: 'GST Invoice (B2C)', status: 'Issued', cashier: 'Billing desk',
    publicNote: '', internalNote: `Billing model: ${values.model}`, dueDate: values.dueDate, lines,
  }
}
