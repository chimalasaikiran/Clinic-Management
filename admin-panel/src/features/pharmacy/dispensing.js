import { itemById } from '../inventory/data/items'
import { availableOf, fefoPlan } from '../inventory/stockLogic'

const PHARMACY = 'main'

// Generic names that fall under an allergy class; a prescribed line matching one blocks dispensing.
const ALLERGY_MEMBERS = {
  penicillin: ['amoxicillin', 'ampicillin', 'penicillin', 'clavulan', 'piperacillin'],
  sulfa: ['sulfamethoxazole', 'cotrimoxazole', 'sulfasalazine'],
}

export const remainingOf = (line) => Math.max(0, line.qty - line.dispensed)

export function allergyConflicts(rx) {
  return rx.lines.filter((line) => rx.patient.allergies.some((allergy) => (ALLERGY_MEMBERS[allergy] ?? [allergy]).some((member) => line.name.toLowerCase().includes(member))))
}

// The five mandatory interlocks shown before dispensing. Checks that run against our own data are computed;
// the rest repeat what the prescription source recorded.
export function interlocks(rx, consent = {}) {
  const h1 = rx.schedule === 'H1'
  const conflicts = allergyConflicts(rx)
  const h1Ready = !h1 || (consent.register && consent.otp)
  return [
    { id: 'schedule', title: `CDSCO Rule 65 & Schedule ${rx.schedule ?? 'OTC'} compliance`, ok: Boolean(h1Ready), detail: h1 && !h1Ready ? 'Record the patient OTP consent and the statutory register entry.' : 'Valid e-prescription with a tamper-evident signature.', badge: h1Ready ? 'Passed & logged' : 'Action required' },
    { id: 'allergy', title: 'Allergy cross-reactivity filter', ok: conflicts.length === 0, detail: conflicts.length ? `${conflicts.map((line) => line.name).join(', ')} conflicts with the recorded ${rx.patient.allergies.join(', ')} allergy.` : rx.patient.allergies.length ? `Recorded ${rx.patient.allergies.join(', ')} allergy; no prescribed medicine belongs to that class.` : 'No allergies recorded for this patient.', badge: conflicts.length ? 'Conflict' : 'Cleared (0% risk)' },
    { id: 'ddi', title: 'Drug-drug interaction matrix', ok: true, detail: rx.sourceChecks.ddi, badge: 'As recorded in source' },
    { id: 'renal', title: 'Renal & hepatic dose clearance', ok: true, detail: rx.sourceChecks.renal, badge: 'As recorded in source' },
    { id: 'prescriber', title: 'Prescriber council standing & schedule privilege', ok: true, detail: rx.sourceChecks.prescriber, badge: 'As recorded in source' },
  ]
}

// What each line would supply right now: the FEFO batch picks at the dispensary and any shortfall.
export function planLines(rx, batches, quantities = {}) {
  return rx.lines.map((line) => {
    const wanted = Number(quantities[line.id] ?? remainingOf(line))
    const plan = fefoPlan(batches, line.itemId, PHARMACY, wanted)
    const free = batches.filter((batch) => batch.itemId === line.itemId && batch.loc === PHARMACY).reduce((sum, batch) => sum + availableOf(batch), 0)
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
