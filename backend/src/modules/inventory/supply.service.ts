import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import { batchLabel, fefoPlan } from './fefo'
import type { RequestInput, TransferInput } from './inventory.schemas'
import { StockLedger } from './stock-ledger'

const isoDay = (value: Date) => value.toISOString().slice(0, 10)
const dateOrNull = (value: string | null) => (value ? new Date(`${value}T00:00:00Z`) : null)

// Pharmacy stock requests and the transfers that fulfil them (or move stock between any two locations).
@Injectable()
export class SupplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedger,
    private readonly audit: AuditService,
  ) {}

  // ── stock requests ─────────────────────────────────────────────────────────

  async createRequest(access: AccessContext, actorUserId: string, input: RequestInput, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      await this.requestingLocation(tx, access, input)
      const reference = await this.ledger.reference(tx, access.orgId, 'stock_request_reference', 'SR-')
      const request = await tx.stockRequest.create({
        data: {
          orgId: access.orgId, reference, locationId: input.locationId, priority: input.priority, requiredBy: dateOrNull(input.requiredBy), reason: input.reason, notes: input.notes,
          status: input.submit ? 'submitted' : 'draft', requestedById: actorUserId, lines: { create: input.lines.map((line) => ({ itemId: line.itemId, requested: line.requested })) },
        },
        select: { id: true },
      })
      await this.ledger.event(tx, access.orgId, 'request', request.id, input.submit ? 'Submitted' : 'Draft saved', actorUserId, `${input.lines.length} line${input.lines.length === 1 ? '' : 's'}`)
      await this.audit.record({ action: 'inventory.request.created', entityType: 'stock_request', entityId: request.id, orgId: access.orgId, actorUserId, details: { reference, submitted: input.submit } }, client, tx)
      return { id: request.id, reference }
    })
  }

  // Only a draft changes; submitting it sends it to the store for review.
  async updateRequest(access: AccessContext, id: string, actorUserId: string, input: RequestInput & { version: number }, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      await this.requestingLocation(tx, access, input)
      const updated = await tx.stockRequest.updateMany({
        where: { id, orgId: access.orgId, status: 'draft', version: input.version },
        data: { locationId: input.locationId, priority: input.priority, requiredBy: dateOrNull(input.requiredBy), reason: input.reason, notes: input.notes, status: input.submit ? 'submitted' : 'draft', version: { increment: 1 } },
      })
      if (updated.count === 0) throw conflict('REQUEST_NOT_DRAFT', 'Only a draft request can be changed. Reload it and try again.')
      await tx.stockRequestLine.deleteMany({ where: { requestId: id } })
      await tx.stockRequestLine.createMany({ data: input.lines.map((line) => ({ requestId: id, itemId: line.itemId, requested: line.requested })) })
      await this.ledger.event(tx, access.orgId, 'request', id, input.submit ? 'Submitted' : 'Draft updated', actorUserId)
      await this.audit.record({ action: 'inventory.request.updated', entityType: 'stock_request', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return { id }
    })
  }

  // Approving reserves stock at the central store, earliest expiry first; a line short of stock stays unapproved.
  async reviewRequest(access: AccessContext, id: string, actorUserId: string, input: { decision: 'approve' | 'reject'; approve: Record<string, number>; reason: string; version: number }, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const request = await tx.stockRequest.findFirst({ where: { id, orgId: access.orgId }, include: { lines: true, location: true } })
      if (!request) throw notFound('Stock request not found.')
      if (!['submitted', 'partially_approved'].includes(request.status) || request.version !== input.version) throw conflict('REQUEST_STATE_CHANGED', 'This request is not awaiting review. Reload it and try again.')
      if (input.decision === 'reject') {
        await tx.stockRequest.update({ where: { id }, data: { status: 'rejected', decision: 'Reject request', decisionNote: input.reason, version: { increment: 1 } } })
        await this.ledger.event(tx, access.orgId, 'request', id, 'Rejected', actorUserId, input.reason)
        await this.audit.record({ action: 'inventory.request.rejected', entityType: 'stock_request', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
        return { id }
      }
      const store = await this.sourceStore(tx, access, request.location.branchId)
      const today = this.ledger.today()
      let approvedAny = false
      for (const line of request.lines) {
        const qty = input.approve[line.itemId] ?? 0
        if (!qty) continue
        if (qty > line.requested - line.approved) throw unprocessable('APPROVAL_EXCEEDS_REQUEST', 'Approve no more than was requested.')
        await this.ledger.lock(tx, line.itemId, store.id)
        const plan = fefoPlan(await this.ledger.batches(tx, line.itemId, store.id), qty, today)
        if (plan.short > 0) throw unprocessable('STOCK_SHORT', `Only ${qty - plan.short} of the requested units are available at ${store.name}.`)
        await this.ledger.reserve(tx, plan.picks)
        await tx.stockReservation.createMany({ data: plan.picks.map((pick) => ({ requestLineId: line.id, batchId: pick.batchId, qty: pick.qty })) })
        await tx.stockRequestLine.update({ where: { id: line.id }, data: { approved: { increment: qty } } })
        await this.ledger.movement(tx, access.orgId, { itemId: line.itemId, locationId: store.id, kind: 'Reservation created', reference: request.reference, batchLabel: batchLabel(plan.picks), delta: 0, reason: `${qty.toLocaleString('en-IN')} reserved for ${request.reference}. Posted stock unchanged.`, actorId: actorUserId })
        approvedAny = true
      }
      if (!approvedAny) throw unprocessable('NOTHING_APPROVED', 'Enter a quantity to approve for at least one line.')
      const lines = await tx.stockRequestLine.findMany({ where: { requestId: id } })
      const complete = lines.every((line) => line.approved >= line.requested)
      await tx.stockRequest.update({ where: { id }, data: { status: complete ? 'approved' : 'partially_approved', decision: complete ? 'Approve in full' : 'Approve partially', decisionNote: input.reason, version: { increment: 1 } } })
      await this.ledger.event(tx, access.orgId, 'request', id, complete ? 'Approved in full' : 'Approved partially', actorUserId, input.reason)
      await this.audit.record({ action: 'inventory.request.approved', entityType: 'stock_request', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return { id }
    })
  }

  async cancelRequest(access: AccessContext, id: string, actorUserId: string, input: { reason: string; version: number }, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.stockRequest.updateMany({ where: { id, orgId: access.orgId, status: { in: ['draft', 'submitted'] }, version: input.version }, data: { status: 'cancelled', version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('REQUEST_STATE_CHANGED', 'Only a draft or submitted request can be cancelled.')
      await this.ledger.event(tx, access.orgId, 'request', id, 'Cancelled by requester', actorUserId, input.reason || 'No stock movement')
      await this.audit.record({ action: 'inventory.request.cancelled', entityType: 'stock_request', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  // Puts the approved, not yet transferred reservations of a request onto a transfer ready for dispatch.
  async transferForRequest(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const request = await tx.stockRequest.findFirst({ where: { id, orgId: access.orgId }, include: { lines: { include: { reservations: { where: { transferId: null }, include: { batch: true } } } } } })
      if (!request) throw notFound('Stock request not found.')
      const reservations = request.lines.flatMap((line) => line.reservations.map((reservation) => ({ ...reservation, itemId: line.itemId })))
      if (!reservations.length) throw conflict('NOTHING_TO_TRANSFER', 'Every approved quantity is already on a transfer.')
      const fromLocationId = reservations[0]!.batch.locationId
      const reference = await this.ledger.reference(tx, access.orgId, 'transfer_reference', 'TR-')
      const transfer = await tx.stockTransfer.create({
        data: {
          orgId: access.orgId, reference, requestId: id, fromLocationId, toLocationId: request.locationId, status: 'ready', reason: request.reason, notes: `Fulfils ${request.reference}`, createdById: actorUserId,
          lines: { create: reservations.map((reservation) => ({ itemId: reservation.itemId, batchId: reservation.batchId, batchNo: reservation.batch.batchNo, expiry: reservation.batch.expiry, qty: reservation.qty })) },
        },
        select: { id: true },
      })
      await tx.stockReservation.updateMany({ where: { id: { in: reservations.map((reservation) => reservation.id) } }, data: { transferId: transfer.id } })
      await this.ledger.event(tx, access.orgId, 'transfer', transfer.id, 'Created & reserved', actorUserId, `Approved stock for ${request.reference}`)
      await this.ledger.event(tx, access.orgId, 'request', id, `Transfer ${reference} created`, actorUserId)
      await this.audit.record({ action: 'inventory.transfer.created', entityType: 'stock_transfer', entityId: transfer.id, orgId: access.orgId, actorUserId, details: { reference, request: request.reference } }, client, tx)
      return { id: transfer.id, reference }
    })
  }

  // ── transfers ──────────────────────────────────────────────────────────────

  async createTransfer(access: AccessContext, actorUserId: string, input: TransferInput, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const lines = await this.transferLines(tx, access, input)
      const reference = await this.ledger.reference(tx, access.orgId, 'transfer_reference', 'TR-')
      const transfer = await tx.stockTransfer.create({
        data: {
          orgId: access.orgId, reference, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, status: input.mode === 'create' ? 'ready' : 'draft', reason: input.reason, notes: input.notes,
          plannedOn: dateOrNull(input.plannedOn), createdById: actorUserId, lines: { create: lines },
        },
        select: { id: true },
      })
      if (input.mode === 'create') await this.reserveLines(tx, access.orgId, actorUserId, reference, input.fromLocationId, lines)
      await this.ledger.event(tx, access.orgId, 'transfer', transfer.id, input.mode === 'create' ? 'Created & reserved' : 'Draft saved', actorUserId, input.mode === 'create' ? 'Quantity reserved at the source store' : 'No stock reserved')
      await this.audit.record({ action: 'inventory.transfer.created', entityType: 'stock_transfer', entityId: transfer.id, orgId: access.orgId, actorUserId, details: { reference } }, client, tx)
      return { id: transfer.id, reference }
    })
  }

  async updateTransfer(access: AccessContext, id: string, actorUserId: string, input: TransferInput & { version: number }, client: ClientInfo) {
    return this.prisma.transaction(async (tx) => {
      const current = await tx.stockTransfer.findFirst({ where: { id, orgId: access.orgId } })
      if (!current) throw notFound('Transfer not found.')
      if (current.status !== 'draft' || current.version !== input.version) throw conflict('TRANSFER_STATE_CHANGED', 'Only a draft transfer can be changed. Reload it and try again.')
      const lines = await this.transferLines(tx, access, input)
      await tx.stockTransferLine.deleteMany({ where: { transferId: id } })
      await tx.stockTransfer.update({
        where: { id },
        data: { fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, status: input.mode === 'create' ? 'ready' : 'draft', reason: input.reason, notes: input.notes, plannedOn: dateOrNull(input.plannedOn), version: { increment: 1 }, lines: { create: lines } },
      })
      if (input.mode === 'create') await this.reserveLines(tx, access.orgId, actorUserId, current.reference, input.fromLocationId, lines)
      await this.ledger.event(tx, access.orgId, 'transfer', id, input.mode === 'create' ? 'Created & reserved' : 'Draft saved', actorUserId)
      await this.audit.record({ action: 'inventory.transfer.updated', entityType: 'stock_transfer', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return { id }
    })
  }

  async dispatch(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const transfer = await this.transfer(tx, access, id, 'ready', version)
      await this.ledger.location(tx, access, transfer.fromLocationId)
      for (const line of transfer.lines) await this.ledger.lock(tx, line.itemId, transfer.fromLocationId)
      await this.ledger.issueReserved(tx, transfer.lines)
      for (const line of transfer.lines) {
        await this.ledger.movement(tx, access.orgId, { itemId: line.itemId, locationId: transfer.fromLocationId, batchId: line.batchId, kind: 'Issue', reference: transfer.reference, batchLabel: line.batchNo, delta: -line.qty, reason: `${line.qty} dispatched to ${transfer.to.name}; receipt pending.`, actorId: actorUserId })
      }
      await tx.stockTransfer.update({ where: { id }, data: { status: 'in_transit', dispatchedAt: new Date(), version: { increment: 1 } } })
      if (transfer.requestId) {
        for (const line of transfer.lines) await tx.stockRequestLine.updateMany({ where: { requestId: transfer.requestId, itemId: line.itemId }, data: { issued: { increment: line.qty } } })
        await tx.stockRequest.update({ where: { id: transfer.requestId }, data: { status: 'dispatched', version: { increment: 1 } } })
        await this.ledger.event(tx, access.orgId, 'request', transfer.requestId, `Dispatched on ${transfer.reference}`, actorUserId, transfer.from.name)
      }
      await this.ledger.event(tx, access.orgId, 'transfer', id, 'Dispatched', actorUserId, `Stock left ${transfer.from.name}`)
      await this.audit.record({ action: 'inventory.transfer.dispatched', entityType: 'stock_transfer', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  // Accepted units are posted at the destination; anything not received stays recorded as a shortage.
  async receive(access: AccessContext, id: string, actorUserId: string, input: { received: number[]; version: number }, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const transfer = await this.transfer(tx, access, id, 'in_transit', input.version)
      await this.ledger.location(tx, access, transfer.toLocationId)
      let short = false
      for (const [index, line] of transfer.lines.entries()) {
        const qty = input.received[index] ?? line.qty
        if (qty > line.qty) throw unprocessable('RECEIPT_EXCEEDS_DISPATCH', `More ${line.batchNo} units were entered than were dispatched.`)
        short ||= qty < line.qty
        await tx.stockTransferLine.update({ where: { id: line.id }, data: { received: qty } })
        if (qty > 0) {
          await this.ledger.lock(tx, line.itemId, transfer.toLocationId)
          const batchId = await this.ledger.post(tx, access.orgId, { itemId: line.itemId, locationId: transfer.toLocationId, batchNo: line.batchNo, expiry: isoDay(line.expiry), qty, bin: '' })
          await this.ledger.movement(tx, access.orgId, { itemId: line.itemId, locationId: transfer.toLocationId, batchId, kind: 'Receipt', reference: transfer.reference, batchLabel: line.batchNo, delta: qty, reason: `Received from ${transfer.from.name}; ${qty} of ${line.qty} accepted and posted.`, actorId: actorUserId })
        }
        if (transfer.requestId) await tx.stockRequestLine.updateMany({ where: { requestId: transfer.requestId, itemId: line.itemId }, data: { received: { increment: qty } } })
      }
      await tx.stockTransfer.update({ where: { id }, data: { status: 'received', receivedAt: new Date(), version: { increment: 1 } } })
      if (transfer.requestId) {
        const lines = await tx.stockRequestLine.findMany({ where: { requestId: transfer.requestId } })
        const fulfilled = lines.every((line) => line.received >= line.requested)
        await tx.stockRequest.update({ where: { id: transfer.requestId }, data: { status: fulfilled ? 'fulfilled' : 'partially_fulfilled', version: { increment: 1 } } })
        await this.ledger.event(tx, access.orgId, 'request', transfer.requestId, 'Branch receipt posted', actorUserId, transfer.to.name)
      }
      await this.ledger.event(tx, access.orgId, 'transfer', id, short ? 'Received with shortage' : 'Received', actorUserId, short ? 'Shortage remains a traceable exception' : 'Accepted quantity posted')
      await this.audit.record({ action: 'inventory.transfer.received', entityType: 'stock_transfer', entityId: id, orgId: access.orgId, actorUserId, details: { short } }, client, tx)
    })
    return { id }
  }

  // A cancelled transfer gives its stock back: a request's reservation returns to the request, any other is released.
  async cancelTransfer(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({ where: { id, orgId: access.orgId }, include: { lines: true } })
      if (!transfer) throw notFound('Transfer not found.')
      if (!['draft', 'ready'].includes(transfer.status) || transfer.version !== version) throw conflict('TRANSFER_STATE_CHANGED', 'Only a transfer that has not left the store can be cancelled.')
      if (transfer.status === 'ready') {
        if (transfer.requestId) await tx.stockReservation.updateMany({ where: { transferId: id }, data: { transferId: null } })
        else await this.ledger.release(tx, transfer.lines)
      }
      await tx.stockTransfer.update({ where: { id }, data: { status: 'cancelled', version: { increment: 1 } } })
      await this.ledger.event(tx, access.orgId, 'transfer', id, 'Cancelled', actorUserId, transfer.status === 'ready' ? (transfer.requestId ? 'Reservation returned to the request' : 'Reservation released') : 'No stock was reserved')
      await this.audit.record({ action: 'inventory.transfer.cancelled', entityType: 'stock_transfer', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  private async transfer(tx: Tx, access: AccessContext, id: string, status: 'ready' | 'in_transit', version: number) {
    const transfer = await tx.stockTransfer.findFirst({ where: { id, orgId: access.orgId }, include: { lines: true, from: true, to: true } })
    if (!transfer) throw notFound('Transfer not found.')
    if (transfer.status !== status || transfer.version !== version) throw conflict('TRANSFER_STATE_CHANGED', 'This transfer was changed by someone else. Reload it and try again.')
    return transfer
  }

  private async transferLines(tx: Tx, access: AccessContext, input: TransferInput) {
    await this.ledger.location(tx, access, input.fromLocationId)
    const to = await tx.stockLocation.findFirst({ where: { id: input.toLocationId, orgId: access.orgId, active: true } })
    if (!to) throw notFound('Destination location not found.')
    const batches = await tx.stockBatch.findMany({ where: { id: { in: input.lines.map((line) => line.batchId) }, locationId: input.fromLocationId } })
    return input.lines.map((line) => {
      const batch = batches.find((entry) => entry.id === line.batchId)
      if (!batch) throw unprocessable('BATCH_INVALID', 'Choose batches held at the source location.')
      return { itemId: batch.itemId, batchId: batch.id, batchNo: batch.batchNo, expiry: batch.expiry, qty: line.qty }
    })
  }

  private async reserveLines(tx: Tx, orgId: string, actorUserId: string, reference: string, locationId: string, lines: Array<{ itemId: string; batchId: string; batchNo: string; expiry: Date; qty: number }>) {
    for (const line of lines) await this.ledger.lock(tx, line.itemId, locationId)
    await this.ledger.reserve(tx, lines.map((line) => ({ batchId: line.batchId, batchNo: line.batchNo, expiry: isoDay(line.expiry), bin: '', qty: line.qty })))
    for (const line of lines) {
      await this.ledger.movement(tx, orgId, { itemId: line.itemId, locationId, batchId: line.batchId, kind: 'Reservation created', reference, batchLabel: line.batchNo, delta: 0, reason: `${line.qty} reserved for transfer ${reference}. Posted stock unchanged.`, actorId: actorUserId })
    }
  }

  private async requestingLocation(tx: Tx, access: AccessContext, input: RequestInput) {
    const location = await this.ledger.location(tx, access, input.locationId)
    if (location.kind !== 'pharmacy') throw unprocessable('LOCATION_NOT_PHARMACY', 'Stock requests are raised by a pharmacy location.')
    const items = await tx.stockItem.count({ where: { orgId: access.orgId, active: true, id: { in: input.lines.map((line) => line.itemId) } } })
    if (items !== input.lines.length) throw unprocessable('ITEM_INVALID', 'Choose active items of this organisation.')
  }

  // The central store a pharmacy is supplied from: a store at its own branch when there is one, otherwise any store.
  private async sourceStore(tx: Tx, access: AccessContext, branchId: string) {
    const stores = await tx.stockLocation.findMany({ where: { orgId: access.orgId, kind: 'store', active: true }, orderBy: { createdAt: 'asc' } })
    const store = stores.find((entry) => entry.branchId === branchId) ?? stores[0]
    if (!store) throw unprocessable('NO_STORE', 'Add a store location before approving requests.')
    return this.ledger.location(tx, access, store.id)
  }
}
