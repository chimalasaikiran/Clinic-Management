import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import { batchLabel, fefoPlan } from './fefo'
import type { CaseInput, DispenseInput } from './inventory.schemas'
import { StockLedger } from './stock-ledger'

const isoDay = (value: Date) => value.toISOString().slice(0, 10)
const key = (code: string | null, strength: string | null) => `${(code ?? '').toLowerCase()}|${(strength ?? '').trim().toLowerCase()}`

// How long a completed or discontinued prescription stays in the pharmacy queue's history.
const HISTORY_DAYS = 30

// The dispensing queue (signed prescriptions), dispensing against stock, and returns / discrepancy cases.
@Injectable()
export class PharmacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedger,
    private readonly audit: AuditService,
  ) {}

  // Prescriptions in the caller's branches: every active one, and those closed in the last 30 days.
  async queue(access: AccessContext) {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000)
    const scope = access.branchScope === 'all' ? {} : { branchId: { in: [...access.branchScope] } }
    const [prescriptions, items] = await Promise.all([
      this.prisma.prescription.findMany({
        where: { orgId: access.orgId, ...scope, OR: [{ status: 'active' }, { createdAt: { gte: since } }] },
        include: {
          items: { orderBy: { position: 'asc' } },
          encounter: { select: { reference: true } },
          branch: { select: { id: true, name: true } },
          patient: { select: { id: true, mrn: true, fullName: true, dateOfBirth: true, gender: true, abhaNumber: true, allergies: { where: { active: true }, select: { substance: true, drugClass: true } } } },
          dispenses: { include: { lines: true, dispensedBy: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockItem.findMany({ where: { orgId: access.orgId, active: true, medicineCode: { not: null } }, select: { id: true, code: true, medicineCode: true, strength: true, schedule: true, unitPlural: true } }),
    ])
    const stocked = new Map(items.map((item) => [key(item.medicineCode, item.strength), item]))
    return prescriptions.map((rx) => {
      const lines = rx.items.map((entry) => {
        const item = stocked.get(key(entry.medicineCode, entry.strength)) ?? null
        const dispensed = rx.dispenses.flatMap((dispense) => dispense.lines).filter((line) => line.prescriptionItemId === entry.id).reduce((sum, line) => sum + line.qty, 0)
        return {
          id: entry.id, itemId: item?.id ?? null, itemCode: item?.code ?? null, schedule: item?.schedule ?? null, name: `${entry.name} ${entry.strength}`, qty: entry.quantity, unit: item?.unitPlural ?? entry.form.toLowerCase(),
          timing: `${entry.frequency} · ${entry.food}${entry.instructions ? ` · ${entry.instructions}` : ''}`, drugClass: entry.drugClass, dispensed,
        }
      })
      return {
        id: rx.id, reference: rx.reference, status: rx.status, created: this.ledger.stamp(rx.createdAt), branch: rx.branch, encounterReference: rx.encounter?.reference ?? null,
        prescriber: rx.prescriberName, registration: rx.registration, department: rx.department, indication: rx.indication,
        patient: { id: rx.patient.id, mrn: rx.patient.mrn, name: rx.patient.fullName, dateOfBirth: isoDay(rx.patient.dateOfBirth), gender: rx.patient.gender, abha: rx.patient.abhaNumber, allergies: rx.patient.allergies },
        lines,
        dispenses: rx.dispenses.map((dispense) => ({
          id: dispense.id, reference: dispense.reference, at: this.ledger.stamp(dispense.createdAt), by: dispense.dispensedBy.fullName,
          lines: dispense.lines.map((line) => ({ prescriptionItemId: line.prescriptionItemId, itemId: line.itemId, batchNo: line.batchNo, expiry: isoDay(line.expiry), bin: line.bin, qty: line.qty, unitPrice: Number(line.unitPrice) })),
        })),
      }
    })
  }

  // Dispenses the quantities asked for, earliest expiry first at the pharmacy. Refused for a drug-allergy conflict,
  // for a Schedule H1 medicine without the register entry and patient consent, and beyond what is still to dispense.
  async dispense(access: AccessContext, prescriptionId: string, actorUserId: string, input: DispenseInput, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const location = await this.ledger.location(tx, access, input.locationId)
      if (location.kind !== 'pharmacy') throw unprocessable('LOCATION_NOT_PHARMACY', 'Dispense from a pharmacy location.')
      const rx = (await this.queueEntry(tx, access, prescriptionId))
      if (rx.status !== 'active') throw conflict('PRESCRIPTION_CLOSED', 'This prescription is no longer active.')

      const wanted = rx.lines.map((line) => ({ line, qty: input.quantities[line.id] ?? 0 })).filter((entry) => entry.qty > 0)
      if (!wanted.length) throw unprocessable('NOTHING_TO_DISPENSE', 'Enter a quantity to dispense for at least one medicine.')
      for (const { line, qty } of wanted) {
        if (!line.itemId) throw unprocessable('ITEM_NOT_STOCKED', `${line.name} is not linked to a stocked item.`)
        if (qty > line.qty - line.dispensed) throw unprocessable('DISPENSE_EXCEEDS_PRESCRIPTION', `${line.name}: only ${line.qty - line.dispensed} remain to be dispensed.`)
        const allergy = rx.allergies.find((entry) => line.drugClass && entry.drugClass === line.drugClass)
        if (allergy) throw unprocessable('ALLERGY_CONFLICT', `${line.name} conflicts with the recorded ${allergy.substance} allergy.`)
      }
      if (wanted.some(({ line }) => line.schedule === 'H1') && !(input.registerConfirmed && input.consentConfirmed)) {
        throw unprocessable('SCHEDULE_H1_UNCONFIRMED', 'Record the Schedule H1 register entry and the patient consent before dispensing.')
      }

      const reference = await this.ledger.reference(tx, access.orgId, 'dispense_reference', 'DSP-')
      const dispense = await tx.dispense.create({ data: { orgId: access.orgId, reference, prescriptionId, locationId: location.id, registerConfirmed: input.registerConfirmed, consentConfirmed: input.consentConfirmed, dispensedById: actorUserId }, select: { id: true } })
      const today = this.ledger.today()
      for (const { line, qty } of wanted) {
        await this.ledger.lock(tx, line.itemId!, location.id)
        const plan = fefoPlan(await this.ledger.batches(tx, line.itemId!, location.id), qty, today)
        if (plan.short > 0) throw unprocessable('STOCK_SHORT', `${line.name}: only ${qty - plan.short} ${line.unit} in stock at ${location.name}.`)
        await this.ledger.consume(tx, plan.picks)
        const item = await tx.stockItem.findUniqueOrThrow({ where: { id: line.itemId! }, select: { unitPrice: true } })
        await tx.dispenseLine.createMany({ data: plan.picks.map((pick) => ({ dispenseId: dispense.id, prescriptionItemId: line.id, itemId: line.itemId!, batchId: pick.batchId, batchNo: pick.batchNo, expiry: new Date(`${pick.expiry}T00:00:00Z`), bin: pick.bin, qty: pick.qty, unitPrice: item.unitPrice })) })
        await this.ledger.movement(tx, access.orgId, { itemId: line.itemId!, locationId: location.id, kind: 'Dispense', reference, batchLabel: batchLabel(plan.picks), delta: -qty, reason: `Prescription ${rx.reference} · ${rx.patientName}`, actorId: actorUserId })
      }
      const complete = rx.lines.every((line) => line.qty - line.dispensed - (input.quantities[line.id] ?? 0) <= 0)
      if (complete) await tx.prescription.update({ where: { id: prescriptionId }, data: { status: 'completed', version: { increment: 1 } } })
      await tx.prescriptionEvent.create({ data: { prescriptionId, action: complete ? 'dispensed' : 'partially_dispensed', actorId: actorUserId, note: `${reference} · ${location.name}` } })
      await this.audit.record({ action: 'pharmacy.dispensed', entityType: 'dispense', entityId: dispense.id, orgId: access.orgId, actorUserId, details: { reference, prescription: rx.reference, complete } }, client, tx)
      return { id: dispense.id, reference, complete }
    })
  }

  async createCase(access: AccessContext, actorUserId: string, input: CaseInput, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const item = await tx.stockItem.findFirst({ where: { id: input.itemId, orgId: access.orgId } })
      if (!item) throw notFound('Item not found.')
      if (input.batchId && !(await tx.stockBatch.findFirst({ where: { id: input.batchId, itemId: item.id } }))) throw unprocessable('BATCH_INVALID', 'Choose a batch of this item.')
      if (input.assigneeId && !(await tx.membership.findFirst({ where: { orgId: access.orgId, userId: input.assigneeId, status: 'active' } }))) throw unprocessable('ASSIGNEE_INVALID', 'Choose an active member of this organisation.')
      const reference = await this.ledger.reference(tx, access.orgId, input.type === 'Return' ? 'return_case_reference' : 'discrepancy_case_reference', input.type === 'Return' ? 'RET-' : 'DIS-')
      const { draft, ...fields } = input
      const created = await tx.pharmacyCase.create({
        data: { orgId: access.orgId, reference, ...fields, status: draft ? 'draft' : 'awaiting_review', statusNote: draft ? 'Not submitted' : 'Reported · not yet reviewed', reportedById: actorUserId },
        select: { id: true },
      })
      await this.ledger.event(tx, access.orgId, 'case', created.id, draft ? 'Draft saved' : `${input.type} reported`, actorUserId, `${input.qty} ${item.unitPlural} · ${input.reason}`)
      await this.audit.record({ action: 'pharmacy.case.created', entityType: 'pharmacy_case', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference } }, client, tx)
      return { id: created.id, reference }
    })
  }

  // Reviews a case. A return can be restocked (its units posted back to the chosen location) or rejected;
  // a discrepancy is resolved, optionally correcting the batch by the variance found.
  async decideCase(access: AccessContext, id: string, actorUserId: string, input: { decision: 'restock' | 'reject' | 'resolve'; note: string; adjust: boolean; locationId: string | null; version: number }, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const entry = await tx.pharmacyCase.findFirst({ where: { id, orgId: access.orgId } })
      if (!entry) throw notFound('Case not found.')
      if (!['awaiting_review', 'draft'].includes(entry.status) || entry.version !== input.version) throw conflict('CASE_STATE_CHANGED', 'This case was changed by someone else or is already decided.')
      if (input.decision === 'restock' && entry.type !== 'Return') throw unprocessable('DECISION_INVALID', 'Only a return can be restocked.')
      if (input.decision === 'resolve' && entry.type !== 'Discrepancy') throw unprocessable('DECISION_INVALID', 'Only a discrepancy is resolved.')
      const batch = entry.batchId ? await tx.stockBatch.findUnique({ where: { id: entry.batchId } }) : null
      let statusNote = input.decision === 'reject' ? 'Rejected · not restocked' : 'Resolved'

      if (input.decision === 'restock') {
        if (!batch || !input.locationId) throw unprocessable('RESTOCK_NEEDS_BATCH', 'A restock needs the batch and the location to return it to.')
        const location = await this.ledger.location(tx, access, input.locationId)
        await this.ledger.lock(tx, entry.itemId, location.id)
        const batchId = await this.ledger.post(tx, access.orgId, { itemId: entry.itemId, locationId: location.id, batchNo: batch.batchNo, expiry: isoDay(batch.expiry), qty: entry.qty, bin: batch.bin })
        await this.ledger.movement(tx, access.orgId, { itemId: entry.itemId, locationId: location.id, batchId, kind: 'Return', reference: entry.reference, batchLabel: batch.batchNo, delta: entry.qty, reason: `Return restocked after review: ${input.note}`, actorId: actorUserId })
        statusNote = `Restocked at ${location.name}`
      }
      if (input.decision === 'resolve' && input.adjust) {
        if (!batch || entry.expected === null || entry.observed === null) throw unprocessable('ADJUST_NEEDS_COUNT', 'Correcting stock needs the batch and both counts.')
        const delta = entry.observed - entry.expected
        await this.ledger.location(tx, access, batch.locationId)
        await this.ledger.lock(tx, entry.itemId, batch.locationId)
        await this.ledger.adjust(tx, batch.id, batch.batchNo, delta)
        await this.ledger.movement(tx, access.orgId, { itemId: entry.itemId, locationId: batch.locationId, batchId: batch.id, kind: 'Adjustment', reference: entry.reference, batchLabel: batch.batchNo, delta, reason: `Discrepancy resolved: ${input.note}`, actorId: actorUserId })
        statusNote = `Resolved · stock corrected by ${delta > 0 ? '+' : ''}${delta}`
      }
      await tx.pharmacyCase.update({ where: { id }, data: { status: input.decision === 'reject' ? 'rejected' : 'resolved', statusNote, version: { increment: 1 } } })
      await this.ledger.event(tx, access.orgId, 'case', id, statusNote, actorUserId, input.note)
      await this.audit.record({ action: `pharmacy.case.${input.decision}`, entityType: 'pharmacy_case', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return { id }
    })
  }

  // Locks the prescription first, so two pharmacists cannot dispense the same remaining quantity.
  private async queueEntry(tx: Tx, access: AccessContext, prescriptionId: string) {
    await tx.$queryRaw`select id from prescriptions where id = ${prescriptionId}::uuid and org_id = ${access.orgId}::uuid for update`
    const rx = await tx.prescription.findFirst({
      where: { id: prescriptionId, orgId: access.orgId },
      include: { items: true, patient: { select: { fullName: true, allergies: { where: { active: true }, select: { substance: true, drugClass: true } } } }, dispenses: { include: { lines: true } } },
    })
    if (!rx || (access.branchScope !== 'all' && !access.branchScope.includes(rx.branchId))) throw notFound('Prescription not found.')
    const items = await tx.stockItem.findMany({ where: { orgId: access.orgId, active: true, medicineCode: { in: rx.items.map((entry) => entry.medicineCode) } }, select: { id: true, medicineCode: true, strength: true, schedule: true, unitPlural: true } })
    const stocked = new Map(items.map((item) => [key(item.medicineCode, item.strength), item]))
    return {
      reference: rx.reference, status: rx.status, patientName: rx.patient.fullName, allergies: rx.patient.allergies,
      lines: rx.items.map((entry) => {
        const item = stocked.get(key(entry.medicineCode, entry.strength))
        return {
          id: entry.id, name: `${entry.name} ${entry.strength}`, qty: entry.quantity, drugClass: entry.drugClass, itemId: item?.id ?? null, schedule: item?.schedule ?? null, unit: item?.unitPlural ?? 'units',
          dispensed: rx.dispenses.flatMap((dispense) => dispense.lines).filter((line) => line.prescriptionItemId === entry.id).reduce((sum, line) => sum + line.qty, 0),
        }
      }),
    }
  }
}
