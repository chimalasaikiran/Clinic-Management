import { dispensaryId } from '../inventory/constants'
import { itemById } from '../inventory/data/items'
import { availableOf, fefoPlan } from '../inventory/stockLogic'



export const remainingOf = (line) => Math.max(0, line.qty - line.dispensed)

// Lines whose drug class matches one of the patient's recorded allergy classes; the API refuses to dispense them.
export function allergyConflicts(rx) {
  const classes = rx.patient.allergyClasses ?? []
  return rx.lines.filter((line) => line.drugClass && classes.includes(line.drugClass))
}

// The checks shown before dispensing. Schedule, allergy and prescriber are worked out from the records and are
// enforced by the API; interaction and dose checks are not automated, so the pharmacist confirms them.
export function interlocks(rx, consent = {}) {
  const h1 = rx.schedule === 'H1'
  const conflicts = allergyConflicts(rx)
  const h1Ready = !h1 || (consent.register && consent.otp)
  const allergies = rx.patient.allergies
  return [
    { id: 'schedule', title: `Schedule ${rx.schedule ?? 'OTC'} requirements`, ok: Boolean(h1Ready), detail: h1 && !h1Ready ? 'Record the Schedule H1 register entry and the patient consent.' : h1 ? 'Register entry and patient consent recorded.' : 'No statutory register entry is needed for these medicines.', badge: h1Ready ? 'Ready' : 'Action required' },
    { id: 'allergy', title: 'Allergy cross-check', ok: conflicts.length === 0, detail: conflicts.length ? `${conflicts.map((line) => line.name).join(', ')} conflicts with the recorded ${allergies.join(', ')} allergy.` : allergies.length ? `Recorded ${allergies.join(', ')} allergy; no prescribed medicine belongs to that class.` : 'No allergies recorded for this patient.', badge: conflicts.length ? 'Conflict' : 'Cleared' },
    { id: 'ddi', title: 'Drug-drug interactions', ok: true, detail: 'Not checked automatically. Review the patient’s other medicines before dispensing.', badge: 'Pharmacist to confirm' },
    { id: 'renal', title: 'Renal & hepatic dosing', ok: true, detail: 'Not checked automatically. Confirm the dose suits the patient’s renal and hepatic function.', badge: 'Pharmacist to confirm' },
    { id: 'prescriber', title: 'Prescriber registration', ok: true, detail: rx.registration ? `${rx.prescriber} · registration ${rx.registration} on the signed prescription.` : `${rx.prescriber} · no council registration is on file for the prescriber.`, badge: rx.registration ? 'On file' : 'Not on file' },
  ]
}

// What each line would supply right now: the FEFO batch picks at the dispensary and any shortfall.
export function planLines(rx, batches, quantities = {}) {
  return rx.lines.map((line) => {
    const wanted = Number(quantities[line.id] ?? remainingOf(line))
    const plan = fefoPlan(batches, line.itemId, dispensaryId(), wanted)
    const free = batches.filter((batch) => batch.itemId === line.itemId && batch.loc === dispensaryId()).reduce((sum, batch) => sum + availableOf(batch), 0)
    return { line, wanted, picks: plan.picks, short: plan.short, free }
  })
}

export function dispenseRx(rx, batches, quantities, consent) {
  const blocked = interlocks(rx, consent).find((entry) => !entry.ok)
  if (blocked) return { error: `${blocked.title}: ${blocked.detail}` }
  const plans = planLines(rx, batches, quantities)
  const over = plans.find((entry) => entry.wanted > remainingOf(entry.line) || entry.wanted < 0)
  if (over) return { error: `${over.line.name}: quantity exceeds what is still to be dispensed.` }
  const short = plans.find((entry) => entry.wanted > 0 && entry.short > 0)
  if (short) return { error: `${short.line.name}: only ${short.free} ${short.line.unit} in stock at the dispensary.` }
  if (plans.every((entry) => entry.wanted === 0)) return { error: 'Enter a quantity to dispense for at least one medicine.' }

  const picks = plans.flatMap((entry) => entry.picks)
  const lines = plans.flatMap((entry) => entry.picks.map((pick) => ({ lineId: entry.line.id, itemId: entry.line.itemId, name: entry.line.name, qty: pick.qty, batchNo: pick.batchNo, expiry: pick.expiry, bin: pick.bin })))
  const updated = rx.lines.map((line) => ({ ...line, dispensed: line.dispensed + (plans.find((entry) => entry.line.id === line.id)?.wanted ?? 0) }))
  const complete = updated.every((line) => remainingOf(line) === 0)
  return { picks, lines, rxChange: { lines: updated, status: complete ? 'Dispensed' : 'Partially dispensed', hold: null } }
}

export const dispensedValue = (record) => record.lines.reduce((sum, line) => sum + (itemById(line.itemId)?.price ?? 0) * line.qty, 0)

export const RX_TONE = { 'Awaiting dispensing': 'warning', 'Partially dispensed': 'warning', 'On hold': 'warning', Blocked: 'danger', Dispensed: 'success' }
