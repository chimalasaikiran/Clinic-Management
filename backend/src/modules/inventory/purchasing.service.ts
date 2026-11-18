import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import type { Prisma } from '../../generated/prisma/client'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { AdjustmentInput, OrderInput, ReceiptInput } from './inventory.schemas'
import { StockLedger } from './stock-ledger'

type ReceiptBatch = { batchNo: string; expiry: string; qty: number; bin: string }
const dateOrNull = (value: string | null) => (value ? new Date(`${value}T00:00:00Z`) : null)

// Purchase orders, goods receipts (GRNs) with their discrepancies, and stock adjustments.
@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedger,
    private readonly audit: AuditService,
  ) {}

  async createOrder(access: AccessContext, actorUserId: string, input: OrderInput, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      await this.store(tx, access, input.storeId)
      await this.supplier(tx, access.orgId, input.supplierId)
      await this.items(tx, access.orgId, input.lines.map((line) => line.itemId))
      const reference = await this.ledger.reference(tx, access.orgId, 'purchase_order_reference', 'PO-')
      const order = await tx.purchaseOrder.create({
        data: {
          orgId: access.orgId, reference, supplierId: input.supplierId, storeId: input.storeId, orderedOn: new Date(`${this.ledger.today()}T00:00:00Z`), expectedOn: dateOrNull(input.expectedOn),
          supplierRef: input.supplierRef, terms: input.terms, notes: input.notes, draft: input.draft, createdById: actorUserId, lines: { create: input.lines },
        },
        select: { id: true },
      })
      await this.ledger.event(tx, access.orgId, 'order', order.id, input.draft ? 'Draft saved' : 'Order raised', actorUserId)
      await this.audit.record({ action: 'inventory.order.created', entityType: 'purchase_order', entityId: order.id, orgId: access.orgId, actorUserId, details: { reference } }, client, tx)
      return { id: order.id, reference }
    })
  }

  // Records a delivery. Accepted batches reach stock only when it is posted, which needs every discrepancy resolved.
  async saveReceipt(access: AccessContext, actorUserId: string, input: ReceiptInput, client: ClientInfo, id?: string) {
    return this.prisma.transaction(async (tx) => {
      await this.store(tx, access, input.storeId)
      await this.supplier(tx, access.orgId, input.supplierId)
      await this.items(tx, access.orgId, input.lines.map((line) => line.itemId))
      if (input.orderId) {
        const order = await tx.purchaseOrder.findFirst({ where: { id: input.orderId, orgId: access.orgId, supplierId: input.supplierId } })
        if (!order) throw unprocessable('ORDER_INVALID', 'The purchase order is not from this supplier.')
      }
      const unresolved = input.discrepancies.some((entry) => entry.state === 'Unresolved')
      const status = input.mode === 'draft' ? 'draft' : unresolved ? 'reconciliation_required' : 'ready_to_post'
      const lines = input.lines.map((line) => ({ itemId: line.itemId, ordered: line.ordered, received: line.received, rejected: line.rejected, batches: line.batches as unknown as Prisma.InputJsonValue }))
      let receiptId = id
      let reference: string
      if (id) {
        const current = await tx.goodsReceipt.findFirst({ where: { id, orgId: access.orgId } })
        if (!current) throw notFound('Receipt not found.')
        if (current.status !== 'draft') throw conflict('RECEIPT_NOT_DRAFT', 'Only a draft receipt can be changed.')
        reference = current.reference
        await tx.goodsReceiptLine.deleteMany({ where: { receiptId: id } })
        await tx.receiptDiscrepancy.deleteMany({ where: { receiptId: id } })
        await tx.goodsReceipt.update({ where: { id }, data: { orderId: input.orderId, supplierId: input.supplierId, storeId: input.storeId, challan: input.challan, invoice: input.invoice, bay: input.bay, verified: input.verified, attachments: input.attachments, status, version: { increment: 1 }, lines: { create: lines } } })
      } else {
        reference = await this.ledger.reference(tx, access.orgId, 'goods_receipt_reference', 'GRN-')
        const created = await tx.goodsReceipt.create({
          data: { orgId: access.orgId, reference, orderId: input.orderId, supplierId: input.supplierId, storeId: input.storeId, challan: input.challan, invoice: input.invoice, bay: input.bay, verified: input.verified, attachments: input.attachments, status, receivedById: actorUserId, lines: { create: lines } },
          select: { id: true },
        })
        receiptId = created.id
      }
      for (const entry of input.discrepancies) {
        const discrepancyRef = await this.ledger.reference(tx, access.orgId, 'receipt_discrepancy_reference', 'DSC-')
        await tx.receiptDiscrepancy.create({ data: { receiptId: receiptId!, reference: discrepancyRef, kind: entry.kind, qty: entry.qty, state: entry.state, note: entry.note, resolution: entry.resolution } })
      }
      const counted = input.lines.reduce((sum, line) => sum + line.received, 0)
      await this.ledger.event(tx, access.orgId, 'receipt', receiptId!, input.mode === 'draft' ? 'Draft saved' : 'Receipt recorded', actorUserId, `${counted} counted`)
      await this.audit.record({ action: 'inventory.receipt.saved', entityType: 'goods_receipt', entityId: receiptId!, orgId: access.orgId, actorUserId, details: { reference, status } }, client, tx)
      if (input.mode === 'post' && !unresolved) await this.post(tx, access, receiptId!, actorUserId, client)
      return { id: receiptId!, reference }
    })
  }

  async resolveDiscrepancy(access: AccessContext, id: string, actorUserId: string, input: { discrepancyId: string; disposition: string; note: string }, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findFirst({ where: { id, orgId: access.orgId }, include: { discrepancies: true } })
      if (!receipt) throw notFound('Receipt not found.')
      if (receipt.status === 'posted') throw conflict('RECEIPT_POSTED', 'This receipt is already posted.')
      const entry = receipt.discrepancies.find((item) => item.id === input.discrepancyId)
      if (!entry || entry.state !== 'Unresolved') throw conflict('DISCREPANCY_RESOLVED', 'This discrepancy is already resolved.')
      await tx.receiptDiscrepancy.update({ where: { id: entry.id }, data: { state: 'Resolved', resolution: input.disposition, note: input.note } })
      const open = receipt.discrepancies.some((item) => item.id !== entry.id && item.state === 'Unresolved')
      await tx.goodsReceipt.update({ where: { id }, data: { status: open ? 'reconciliation_required' : 'ready_to_post', version: { increment: 1 } } })
      await this.ledger.event(tx, access.orgId, 'receipt', id, 'Supplier response recorded', actorUserId, `${entry.reference} · ${input.disposition}`)
      await this.audit.record({ action: 'inventory.receipt.discrepancy_resolved', entityType: 'goods_receipt', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  async postReceipt(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    await this.prisma.transaction((tx) => this.post(tx, access, id, actorUserId, client))
    return { id }
  }

  // Adds the accepted batches to stock. "Close PO as short", or a fully delivered order, closes the purchase order.
  private async post(tx: Tx, access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    const receipt = await tx.goodsReceipt.findFirst({ where: { id, orgId: access.orgId }, include: { lines: true, discrepancies: true } })
    if (!receipt) throw notFound('Receipt not found.')
    const updated = await tx.goodsReceipt.updateMany({ where: { id, status: 'ready_to_post' }, data: { status: 'posted', postedAt: new Date(), version: { increment: 1 } } })
    if (updated.count === 0) throw conflict('RECEIPT_NOT_READY', receipt.status === 'posted' ? 'This receipt is already posted.' : 'Resolve every discrepancy before posting.')
    await this.store(tx, access, receipt.storeId)
    for (const line of receipt.lines) {
      await this.ledger.lock(tx, line.itemId, receipt.storeId)
      for (const batch of line.batches as unknown as ReceiptBatch[]) {
        const batchId = await this.ledger.post(tx, access.orgId, { itemId: line.itemId, locationId: receipt.storeId, batchNo: batch.batchNo, expiry: batch.expiry, qty: batch.qty, bin: batch.bin })
        await this.ledger.movement(tx, access.orgId, { itemId: line.itemId, locationId: receipt.storeId, batchId, kind: 'Receipt', reference: receipt.reference, batchLabel: batch.batchNo, delta: batch.qty, reason: `${batch.qty.toLocaleString('en-IN')} accepted, reconciled and posted.`, actorId: actorUserId })
      }
    }
    if (receipt.orderId) {
      const closes = receipt.discrepancies.some((entry) => entry.resolution === 'Close PO as short')
      const order = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: receipt.orderId }, include: { lines: true, receipts: { where: { status: 'posted' }, include: { lines: true } } } })
      const accepted = (itemId: string) => order.receipts.flatMap((entry) => entry.lines).filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.received - entry.rejected, 0)
      if (closes || order.lines.every((entry) => accepted(entry.itemId) >= entry.ordered)) await tx.purchaseOrder.update({ where: { id: order.id }, data: { closed: true } })
    }
    await this.ledger.event(tx, access.orgId, 'receipt', id, 'Receipt posted', actorUserId, 'Accepted batches added to stock')
    await this.audit.record({ action: 'inventory.receipt.posted', entityType: 'goods_receipt', entityId: id, orgId: access.orgId, actorUserId, details: { reference: receipt.reference } }, client, tx)
  }

  // A draft is recorded for review; posting changes stock immediately, rejecting closes it without a change.
  async saveAdjustment(access: AccessContext, actorUserId: string, input: AdjustmentInput, client: ClientInfo, id?: string) {
    return this.prisma.transaction(async (tx) => {
      const batch = await tx.stockBatch.findFirst({ where: { id: input.batchId, orgId: access.orgId } })
      if (!batch) throw notFound('Batch not found.')
      await this.ledger.location(tx, access, batch.locationId)
      const decided = input.mode !== 'draft'
      const data = { itemId: batch.itemId, batchId: batch.id, proposed: input.proposed, reason: input.reason, evidence: input.evidence, status: ({ draft: 'draft', post: 'posted', reject: 'rejected' } as const)[input.mode], decidedById: decided ? actorUserId : null, decidedAt: decided ? new Date() : null }
      let adjustmentId = id
      let reference: string
      if (id) {
        const current = await tx.stockAdjustment.findFirst({ where: { id, orgId: access.orgId } })
        if (!current) throw notFound('Adjustment not found.')
        const updated = await tx.stockAdjustment.updateMany({ where: { id, status: 'draft' }, data: { ...data, version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('ADJUSTMENT_DECIDED', 'This adjustment is already posted or rejected.')
        reference = current.reference
      } else {
        reference = await this.ledger.reference(tx, access.orgId, 'adjustment_reference', 'ADJ-')
        adjustmentId = (await tx.stockAdjustment.create({ data: { orgId: access.orgId, reference, recordedById: actorUserId, ...data }, select: { id: true } })).id
      }
      if (input.mode === 'post') {
        await this.ledger.lock(tx, batch.itemId, batch.locationId)
        await this.ledger.adjust(tx, batch.id, batch.batchNo, input.proposed)
        await this.ledger.movement(tx, access.orgId, { itemId: batch.itemId, locationId: batch.locationId, batchId: batch.id, kind: 'Adjustment', reference, batchLabel: batch.batchNo, delta: input.proposed, reason: `${input.reason}. Evidence ${input.evidence}.`, actorId: actorUserId })
      }
      await this.ledger.event(tx, access.orgId, 'adjustment', adjustmentId!, { draft: 'Draft saved', post: 'Adjustment posted', reject: 'Adjustment rejected' }[input.mode], actorUserId, input.reason)
      await this.audit.record({ action: `inventory.adjustment.${input.mode}`, entityType: 'stock_adjustment', entityId: adjustmentId!, orgId: access.orgId, actorUserId, details: { reference, proposed: input.proposed } }, client, tx)
      return { id: adjustmentId!, reference }
    })
  }

  private async store(tx: Tx, access: AccessContext, storeId: string) {
    return this.ledger.location(tx, access, storeId)
  }

  private async supplier(tx: Tx, orgId: string, supplierId: string) {
    const supplier = await tx.supplier.findFirst({ where: { id: supplierId, orgId } })
    if (!supplier) throw notFound('Supplier not found.')
    if (!supplier.active) throw unprocessable('SUPPLIER_INACTIVE', `${supplier.name} is inactive.`)
  }

  private async items(tx: Tx, orgId: string, itemIds: string[]) {
    const unique = [...new Set(itemIds)]
    if ((await tx.stockItem.count({ where: { orgId, id: { in: unique } } })) !== unique.length) throw unprocessable('ITEM_INVALID', 'Choose items of this organisation.')
  }
}
