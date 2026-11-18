import { Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import { PharmacyService } from './pharmacy.service'
import { StockLedger } from './stock-ledger'

const isoDay = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null)
const actor = { select: { fullName: true } } as const

// The newest stock movements returned; the full ledger stays in the database.
const MOVEMENT_LIMIT = 1000

// Inventory and pharmacy as one read: master data, stock, the supply workflows, the dispensing queue and cases.
// The web app derives its registers and figures from this; every change is checked again on the server.
@Injectable()
export class InventoryStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pharmacy: PharmacyService,
    private readonly ledger: StockLedger,
  ) {}

  async state(access: AccessContext) {
    const orgId = access.orgId
    const canPharmacy = ['pharmacy.view', 'pharmacy.dispense'].some((permission) => access.permissions.has(permission))
    const [branches, locations, items, suppliers, batches, movements, requests, transfers, orders, receipts, adjustments, cases, members, rxQueue] = await Promise.all([
      this.prisma.branch.findMany({ where: { orgId, status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.stockLocation.findMany({ where: { orgId }, include: { branch: { select: { id: true, name: true } } }, orderBy: [{ kind: 'desc' }, { name: 'asc' }] }),
      this.prisma.stockItem.findMany({ where: { orgId }, include: { suppliers: { select: { supplierId: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.supplier.findMany({ where: { orgId }, orderBy: { name: 'asc' } }),
      this.prisma.stockBatch.findMany({ where: { orgId }, orderBy: { expiry: 'asc' } }),
      this.prisma.stockMovement.findMany({ where: { orgId }, include: { actor }, orderBy: { createdAt: 'desc' }, take: MOVEMENT_LIMIT }),
      this.prisma.stockRequest.findMany({ where: { orgId }, include: { lines: { include: { reservations: { include: { batch: true } } } }, requestedBy: actor, transfers: { select: { id: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.stockTransfer.findMany({ where: { orgId }, include: { lines: true, createdBy: actor }, orderBy: { createdAt: 'desc' } }),
      this.prisma.purchaseOrder.findMany({ where: { orgId }, include: { lines: true, createdBy: actor }, orderBy: { createdAt: 'desc' } }),
      this.prisma.goodsReceipt.findMany({ where: { orgId }, include: { lines: true, discrepancies: true, receivedBy: actor }, orderBy: { createdAt: 'desc' } }),
      this.prisma.stockAdjustment.findMany({ where: { orgId }, include: { recordedBy: actor, decidedBy: actor }, orderBy: { createdAt: 'desc' } }),
      this.prisma.pharmacyCase.findMany({ where: { orgId }, include: { assignee: actor, reportedBy: actor }, orderBy: { createdAt: 'desc' } }),
      this.prisma.membership.findMany({ where: { orgId, status: 'active' }, select: { userId: true, user: { select: { fullName: true } }, roles: { select: { role: { select: { name: true } } } } } }),
      canPharmacy ? this.pharmacy.queue(access) : Promise.resolve([]),
    ])

    const entityIds = [...suppliers, ...requests, ...transfers, ...orders, ...receipts, ...adjustments, ...cases].map((row) => row.id)
    const events = await this.prisma.inventoryEvent.findMany({ where: { orgId, entityId: { in: entityIds } }, include: { actor }, orderBy: { createdAt: 'asc' } })
    const history = new Map<string, Array<{ action: string; note: string; actor: string | null; at: ReturnType<StockLedger['stamp']> }>>()
    for (const event of events) {
      const list = history.get(event.entityId) ?? []
      list.push({ action: event.action, note: event.note, actor: event.actor?.fullName ?? null, at: this.ledger.stamp(event.createdAt) })
      history.set(event.entityId, list)
    }
    const eventsOf = (id: string) => history.get(id) ?? []

    return {
      today: this.ledger.today(),
      branches,
      locations: locations.map((row) => ({ id: row.id, code: row.code, name: row.name, detail: row.detail, kind: row.kind, active: row.active, branch: row.branch })),
      items: items.map(({ suppliers: links, ...row }) => ({ ...row, unitPrice: Number(row.unitPrice), supplierIds: links.map((link) => link.supplierId), createdAt: undefined, updatedAt: undefined, orgId: undefined })),
      suppliers: suppliers.map((row) => ({ ...row, orgId: undefined, created: this.ledger.stamp(row.createdAt), createdAt: undefined, events: eventsOf(row.id) })),
      batches: batches.map((row) => ({ id: row.id, itemId: row.itemId, locationId: row.locationId, batchNo: row.batchNo, expiry: isoDay(row.expiry), posted: row.posted, reserved: row.reserved, quarantine: row.quarantine, bin: row.bin })),
      movements: movements.map((row) => ({ id: row.id, itemId: row.itemId, locationId: row.locationId, kind: row.kind, reference: row.reference, batchLabel: row.batchLabel, delta: row.delta, availableAfter: row.availableAfter, reason: row.reason, actor: row.actor?.fullName ?? 'System', at: this.ledger.stamp(row.createdAt) })),
      requests: requests.map((row) => ({
        id: row.id, reference: row.reference, locationId: row.locationId, priority: row.priority, requiredBy: isoDay(row.requiredBy), reason: row.reason, notes: row.notes, status: row.status, decision: row.decision,
        decisionNote: row.decisionNote, requestedBy: row.requestedBy.fullName, created: this.ledger.stamp(row.createdAt), version: row.version, transferIds: row.transfers.map((entry) => entry.id),
        lines: row.lines.map((line) => ({
          itemId: line.itemId, requested: line.requested, approved: line.approved, issued: line.issued, received: line.received,
          // The batches reserved for the line at the store, and the transfer each was moved onto.
          allocations: line.reservations.map((entry) => ({ batchId: entry.batchId, batchNo: entry.batch.batchNo, expiry: isoDay(entry.batch.expiry), bin: entry.batch.bin, qty: entry.qty, transferId: entry.transferId })),
        })),
        events: eventsOf(row.id),
      })),
      transfers: transfers.map((row) => ({
        id: row.id, reference: row.reference, requestId: row.requestId, fromLocationId: row.fromLocationId, toLocationId: row.toLocationId, status: row.status, reason: row.reason, notes: row.notes, plannedOn: isoDay(row.plannedOn),
        createdBy: row.createdBy.fullName, created: this.ledger.stamp(row.createdAt), dispatched: row.dispatchedAt ? this.ledger.stamp(row.dispatchedAt) : null, received: row.receivedAt ? this.ledger.stamp(row.receivedAt) : null, version: row.version,
        lines: row.lines.map((line) => ({ itemId: line.itemId, batchId: line.batchId, batchNo: line.batchNo, expiry: isoDay(line.expiry), qty: line.qty, received: line.received })), events: eventsOf(row.id),
      })),
      orders: orders.map((row) => ({
        id: row.id, reference: row.reference, supplierId: row.supplierId, storeId: row.storeId, orderedOn: isoDay(row.orderedOn), expectedOn: isoDay(row.expectedOn), supplierRef: row.supplierRef, terms: row.terms, notes: row.notes,
        draft: row.draft, closed: row.closed, createdBy: row.createdBy.fullName, lines: row.lines.map((line) => ({ itemId: line.itemId, ordered: line.ordered, rate: Number(line.rate) })), events: eventsOf(row.id),
      })),
      receipts: receipts.map((row) => ({
        id: row.id, reference: row.reference, orderId: row.orderId, supplierId: row.supplierId, storeId: row.storeId, challan: row.challan, invoice: row.invoice, bay: row.bay, verified: row.verified, attachments: row.attachments,
        status: row.status, receivedBy: row.receivedBy.fullName, created: this.ledger.stamp(row.createdAt), version: row.version,
        lines: row.lines.map((line) => ({ itemId: line.itemId, ordered: line.ordered, received: line.received, rejected: line.rejected, batches: line.batches })),
        discrepancies: row.discrepancies.map((entry) => ({ id: entry.id, reference: entry.reference, kind: entry.kind, qty: entry.qty, state: entry.state, note: entry.note, resolution: entry.resolution })),
        events: eventsOf(row.id),
      })),
      adjustments: adjustments.map((row) => ({
        id: row.id, reference: row.reference, itemId: row.itemId, batchId: row.batchId, proposed: row.proposed, reason: row.reason, evidence: row.evidence, status: row.status, recordedBy: row.recordedBy.fullName,
        decidedBy: row.decidedBy?.fullName ?? null, decided: row.decidedAt ? this.ledger.stamp(row.decidedAt) : null, created: this.ledger.stamp(row.createdAt), version: row.version,
      })),
      cases: cases.map((row) => ({
        ...row, orgId: undefined, assignee: row.assignee?.fullName ?? null, reportedBy: row.reportedBy.fullName, created: this.ledger.stamp(row.createdAt), createdAt: undefined, reportedById: undefined, events: eventsOf(row.id),
      })),
      members: members.map((row) => ({ userId: row.userId, name: row.user.fullName, roles: row.roles.map((entry) => entry.role.name) })),
      rxQueue,
    }
  }
}
