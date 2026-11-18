import { ageFrom } from '../patients/format'

// Maps the API state (backend/src/modules/inventory/inventory-state.service.ts) onto the shapes the inventory and
// pharmacy screens use. Items and locations are known by their code (MED-00124, CENTRAL) and documents by their
// number (SR-000001); `uuid` keeps the API identifier for changes.

export const REQUEST_STATUS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', partially_approved: 'Partially approved', dispatched: 'Dispatched', partially_fulfilled: 'Partially fulfilled', fulfilled: 'Fulfilled', rejected: 'Rejected', cancelled: 'Cancelled' }
export const TRANSFER_STATUS = { draft: 'Draft', ready: 'Ready for dispatch', in_transit: 'In transit', received: 'Received', cancelled: 'Cancelled' }
export const RECEIPT_STATUS = { draft: 'Draft', reconciliation_required: 'Reconciliation required', ready_to_post: 'Ready to post', posted: 'Posted' }
export const ADJUSTMENT_STATUS = { draft: 'Draft', posted: 'Posted', rejected: 'Rejected' }
export const CASE_STATUS = { draft: 'Draft', awaiting_review: 'Awaiting review', resolved: 'Resolved', rejected: 'Rejected' }

const event = (entry) => ({ date: entry.at.date, time: entry.at.time, text: entry.actor ? `${entry.action} · ${entry.actor}` : entry.action, by: entry.note || entry.actor || 'System' })

export function toStockState(data) {
  const location = new Map(data.locations.map((entry) => [entry.id, entry.code]))
  const item = new Map(data.items.map((entry) => [entry.id, entry]))
  const code = (id) => item.get(id)?.code ?? id
  const requests = new Map(data.requests.map((entry) => [entry.id, entry.reference]))
  const transfers = new Map(data.transfers.map((entry) => [entry.id, entry.reference]))
  const orders = new Map(data.orders.map((entry) => [entry.id, entry.reference]))
  const batch = new Map(data.batches.map((entry) => [entry.id, entry]))

  const rxQueue = data.rxQueue.map((rx) => {
    const dispensed = rx.lines.reduce((sum, line) => sum + line.dispensed, 0)
    const h1 = rx.lines.some((line) => line.schedule === 'H1')
    const open = rx.status === 'active'
    const status = rx.status === 'completed' ? 'Dispensed' : rx.status === 'discontinued' ? 'Discontinued' : dispensed > 0 ? 'Partially dispensed' : h1 ? 'On hold' : 'Awaiting dispensing'
    return {
      id: rx.reference, uuid: rx.id, date: rx.created.date, time: rx.created.time, priority: h1 ? 'STATUTORY' : 'ROUTINE', status,
      hold: open && h1 ? 'Schedule H1 · record the register entry and patient consent' : null,
      patient: { name: rx.patient.name, age: ageFrom(rx.patient.dateOfBirth), gender: rx.patient.gender === 'female' ? 'F' : rx.patient.gender === 'male' ? 'M' : '', uhid: rx.patient.mrn, abha: rx.patient.abha ?? '', allergies: rx.patient.allergies.map((entry) => entry.substance.toLowerCase()), allergyClasses: rx.patient.allergies.map((entry) => entry.drugClass).filter(Boolean), payer: '' },
      prescriber: rx.prescriber, registration: rx.registration, department: rx.department ?? '', chamber: '', encounter: rx.encounterReference ?? '', followUp: '', branch: rx.branch.name,
      diagnoses: [], vitals: '', coverage: 'Not recorded on the prescription', schedule: h1 ? 'H1' : rx.lines.some((line) => line.schedule === 'H') ? 'H' : null, notes: rx.indication,
      lines: rx.lines.map((line) => ({ id: line.id, itemId: line.itemCode, name: line.name, qty: line.qty, unit: line.unit, timing: line.timing, dispensed: line.dispensed, drugClass: line.drugClass })),
    }
  })
  const dispenses = data.rxQueue.flatMap((rx) => rx.dispenses.map((dispense) => ({
    id: dispense.reference, rxId: rx.reference, date: dispense.at.date, time: dispense.at.time, by: dispense.by,
    lines: dispense.lines.map((line) => ({ lineId: line.prescriptionItemId, itemId: code(line.itemId), name: item.get(line.itemId)?.name ?? '', qty: line.qty, batchNo: line.batchNo, expiry: line.expiry, bin: line.bin, unitPrice: line.unitPrice })),
  }))).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

  return {
    today: data.today,
    branches: data.branches,
    locations: data.locations.map((entry) => ({ id: entry.code, uuid: entry.id, name: entry.name, detail: entry.detail || entry.branch.name, kind: entry.kind, active: entry.active, branch: entry.branch.name, branchId: entry.branch.id })),
    items: data.items.map((entry) => ({
      id: entry.code, uuid: entry.id, name: entry.name, category: entry.category, unit: entry.unit, unitPlural: entry.unitPlural, dose: entry.dosageForm ?? '', brand: entry.brand ?? undefined, pack: entry.pack ?? '',
      storage: entry.storage ?? '', schedule: entry.schedule ? `Schedule ${entry.schedule}` : undefined, scheduleCode: entry.schedule, medicineCode: entry.medicineCode, strength: entry.strength, price: entry.unitPrice,
      safety: entry.safetyLevel, reorder: entry.reorderLevel, target: entry.targetLevel, suppliers: entry.supplierIds, preferred: entry.preferredSupplierId, active: entry.active, version: entry.version,
    })),
    state: {
      batches: data.batches.map((entry) => ({ id: entry.id, itemId: code(entry.itemId), loc: location.get(entry.locationId), batchNo: entry.batchNo, expiry: entry.expiry, posted: entry.posted, reserved: entry.reserved, quarantine: entry.quarantine, bin: entry.bin })),
      movements: data.movements.map((entry) => ({ id: entry.id, date: entry.at.date, time: entry.at.time, actor: entry.actor, kind: entry.kind, ref: entry.reference, itemId: code(entry.itemId), loc: location.get(entry.locationId), batchLabel: entry.batchLabel, delta: entry.delta, availableAfter: entry.availableAfter, reason: entry.reason })),
      requests: data.requests.map((entry) => ({
        id: entry.reference, uuid: entry.id, version: entry.version, pharmacy: location.get(entry.locationId), requestedBy: entry.requestedBy, role: '', priority: entry.priority, required: entry.requiredBy ?? '',
        date: entry.created.date, time: entry.created.time, reason: entry.reason, notes: entry.notes, status: REQUEST_STATUS[entry.status], decision: entry.decision, decisionNote: entry.decisionNote ?? '',
        transferIds: entry.transferIds.map((id) => transfers.get(id) ?? id), lines: entry.lines.map((line) => ({ ...line, itemId: code(line.itemId) })), activity: [...entry.events].reverse().map(event),
      })),
      transfers: data.transfers.map((entry) => ({
        id: entry.reference, uuid: entry.id, version: entry.version, issueId: entry.dispatched ? entry.reference.replace('TR-', 'ISS-') : null, requestId: entry.requestId ? requests.get(entry.requestId) : null,
        from: location.get(entry.fromLocationId), to: location.get(entry.toLocationId), status: TRANSFER_STATUS[entry.status], created: entry.created.date, dispatched: entry.dispatched?.date ?? null, dispatchedTime: entry.dispatched?.time,
        received: entry.received?.date ?? null, receivedTime: entry.received?.time, reason: entry.reason, notes: entry.notes, planned: entry.plannedOn ?? '', createdBy: entry.createdBy,
        lines: entry.lines.map((line) => ({ ...line, itemId: code(line.itemId) })), history: entry.events.map(event),
      })),
      orders: data.orders.map((entry) => ({
        id: entry.reference, uuid: entry.id, supplierId: entry.supplierId, date: entry.orderedOn, store: location.get(entry.storeId), expected: entry.expectedOn ?? '', reference: entry.supplierRef, terms: entry.terms, notes: entry.notes,
        createdBy: entry.createdBy, closed: entry.closed, draft: entry.draft, lines: entry.lines.map((line) => ({ ...line, itemId: code(line.itemId) })),
      })),
      receipts: data.receipts.map((entry) => ({
        id: entry.reference, uuid: entry.id, version: entry.version, orderId: entry.orderId ? orders.get(entry.orderId) : '', supplierId: entry.supplierId, store: location.get(entry.storeId), date: entry.created.date, time: entry.created.time,
        receivedBy: entry.receivedBy, challan: entry.challan, invoice: entry.invoice, bay: entry.bay, status: RECEIPT_STATUS[entry.status], posted: entry.status === 'posted', verified: entry.verified, attachments: entry.attachments,
        lines: entry.lines.map((line) => {
          const accepted = line.received - line.rejected
          return { itemId: code(line.itemId), ordered: line.ordered, received: line.received, accepted, rejected: line.rejected, short: Math.max(0, line.ordered - line.received), batches: line.batches }
        }),
        discrepancies: entry.discrepancies.map((discrepancy) => ({ id: discrepancy.reference, uuid: discrepancy.id, kind: discrepancy.kind, qty: discrepancy.qty, state: discrepancy.state, note: discrepancy.note, resolution: discrepancy.resolution })),
        audit: entry.events.map(event),
      })),
      adjustments: data.adjustments.map((entry) => ({
        id: entry.reference, uuid: entry.id, date: entry.created.date, time: entry.created.time, recordedBy: entry.recordedBy, itemId: code(entry.itemId), batchId: entry.batchId, batchNo: batch.get(entry.batchId)?.batchNo ?? '',
        proposed: entry.proposed, posted: entry.status === 'posted' ? entry.proposed : 0, reason: entry.reason, evidence: entry.evidence, status: ADJUSTMENT_STATUS[entry.status], approvedBy: entry.decidedBy ?? '',
        approvedAt: entry.decided ? `${entry.decided.date} ${entry.decided.time}` : '',
      })),
      suppliers: data.suppliers.map((entry) => ({ ...entry, code: entry.code ?? '', audit: [...entry.events].reverse().map((item2) => ({ at: `${item2.at.date} ${item2.at.time}`, by: item2.actor ?? 'System', text: item2.note ? `${item2.action} · ${item2.note}` : item2.action })) })),
      rxQueue,
      dispenses,
      cases: data.cases.map((entry) => {
        const stocked = item.get(entry.itemId)
        const batchRow = entry.batchId ? batch.get(entry.batchId) : null
        return {
          id: entry.reference, uuid: entry.id, version: entry.version, type: entry.type, subtype: entry.subtype, date: entry.created.date, time: entry.created.time, medicine: stocked?.name ?? '', itemId: code(entry.itemId),
          batchId: entry.batchId, batchNo: batchRow?.batchNo ?? '—', expiry: batchRow?.expiry ?? null, qty: entry.qty, unit: stocked?.unitPlural ?? 'units', origin: entry.origin, originNote: entry.originNote, reason: entry.reason,
          reasonNote: entry.reasonNote, assignee: entry.assignee ?? 'Unassigned', assigneeRole: entry.assignee ? 'Reviewer' : 'Needs owner', status: CASE_STATUS[entry.status], statusNote: entry.statusNote, location: entry.location,
          stage: CASE_STATUS[entry.status], reference: entry.origin, expected: entry.expected, observed: entry.observed, notes: entry.notes, evidence: entry.evidence, reportedBy: entry.reportedBy,
          source: entry.subtype, receiving: entry.location, history: entry.events.map(event),
        }
      }),
    },
    members: data.members,
  }
}
