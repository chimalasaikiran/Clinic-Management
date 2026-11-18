import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import type { ItemInput, LocationInput, SupplierInput } from './inventory.schemas'
import { StockLedger } from './stock-ledger'

// The item master, stock locations and suppliers.
@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedger,
    private readonly audit: AuditService,
  ) {}

  async createItem(access: AccessContext, actorUserId: string, input: ItemInput, client: ClientInfo) {
    await this.checkSuppliers(access.orgId, input)
    const { supplierIds, ...columns } = input
    return this.unique('ITEM_CODE_TAKEN', 'This item code is already used.', () =>
      this.prisma.transaction(async (tx) => {
        const item = await tx.stockItem.create({ data: { orgId: access.orgId, ...columns, suppliers: { create: supplierIds.map((supplierId) => ({ supplierId })) } }, select: { id: true } })
        await this.ledger.event(tx, access.orgId, 'item', item.id, 'Item created', actorUserId)
        await this.audit.record({ action: 'inventory.item.created', entityType: 'stock_item', entityId: item.id, orgId: access.orgId, actorUserId, details: { code: input.code } }, client, tx)
        return { id: item.id }
      }))
  }

  async updateItem(access: AccessContext, id: string, actorUserId: string, version: number, input: ItemInput, client: ClientInfo) {
    await this.checkSuppliers(access.orgId, input)
    const { supplierIds, ...columns } = input
    return this.unique('ITEM_CODE_TAKEN', 'This item code is already used.', () =>
      this.prisma.transaction(async (tx) => {
        const updated = await tx.stockItem.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...columns, version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('STALE_RECORD', 'This item was changed by someone else. Reload it and try again.')
        await tx.stockItemSupplier.deleteMany({ where: { itemId: id } })
        if (supplierIds.length) await tx.stockItemSupplier.createMany({ data: supplierIds.map((supplierId) => ({ itemId: id, supplierId })) })
        await this.ledger.event(tx, access.orgId, 'item', id, 'Item updated', actorUserId)
        await this.audit.record({ action: 'inventory.item.updated', entityType: 'stock_item', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
        return { id }
      }))
  }

  async createLocation(access: AccessContext, actorUserId: string, input: LocationInput, client: ClientInfo) {
    const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, orgId: access.orgId, status: 'active' }, select: { id: true } })
    if (!branch) throw unprocessable('BRANCH_INVALID', 'Choose an active branch of this organisation.')
    return this.unique('LOCATION_CODE_TAKEN', 'This location code is already used.', () =>
      this.prisma.transaction(async (tx) => {
        const location = await tx.stockLocation.create({ data: { orgId: access.orgId, ...input }, select: { id: true } })
        await this.ledger.event(tx, access.orgId, 'location', location.id, 'Location created', actorUserId)
        await this.audit.record({ action: 'inventory.location.created', entityType: 'stock_location', entityId: location.id, orgId: access.orgId, actorUserId, details: { code: input.code } }, client, tx)
        return { id: location.id }
      }))
  }

  async setLocationActive(access: AccessContext, id: string, actorUserId: string, active: boolean, client: ClientInfo) {
    const location = await this.prisma.stockLocation.findFirst({ where: { id, orgId: access.orgId }, include: { batches: { where: { posted: { gt: 0 } }, select: { id: true }, take: 1 } } })
    if (!location) throw notFound('Stock location not found.')
    if (!active && location.batches.length) throw conflict('LOCATION_HAS_STOCK', 'Move or adjust the stock held here before closing this location.')
    await this.prisma.transaction(async (tx) => {
      await tx.stockLocation.update({ where: { id }, data: { active } })
      await this.ledger.event(tx, access.orgId, 'location', id, active ? 'Location reopened' : 'Location closed', actorUserId)
      await this.audit.record({ action: `inventory.location.${active ? 'reopened' : 'closed'}`, entityType: 'stock_location', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  async createSupplier(access: AccessContext, actorUserId: string, input: SupplierInput, client: ClientInfo) {
    return this.unique('SUPPLIER_TAKEN', 'A supplier with this name already exists.', () =>
      this.prisma.transaction(async (tx) => {
        const supplier = await tx.supplier.create({ data: { orgId: access.orgId, ...input }, select: { id: true } })
        await this.ledger.event(tx, access.orgId, 'supplier', supplier.id, `Supplier record created · Status: ${input.active ? 'Active' : 'Inactive'}`, actorUserId)
        await this.audit.record({ action: 'inventory.supplier.created', entityType: 'supplier', entityId: supplier.id, orgId: access.orgId, actorUserId }, client, tx)
        return { id: supplier.id }
      }))
  }

  async updateSupplier(access: AccessContext, id: string, actorUserId: string, version: number, input: SupplierInput, client: ClientInfo) {
    const before = await this.prisma.supplier.findFirst({ where: { id, orgId: access.orgId } })
    if (!before) throw notFound('Supplier not found.')
    const changed = (Object.keys(input) as Array<keyof SupplierInput>).filter((key) => JSON.stringify(input[key]) !== JSON.stringify(before[key]))
    return this.unique('SUPPLIER_TAKEN', 'A supplier with this name already exists.', () =>
      this.prisma.transaction(async (tx) => {
        const updated = await tx.supplier.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...input, version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('STALE_RECORD', 'This supplier was changed by someone else. Reload it and try again.')
        await this.ledger.event(tx, access.orgId, 'supplier', id, changed.length ? `Updated ${changed.join(', ')}` : 'Saved without changes', actorUserId)
        await this.audit.record({ action: 'inventory.supplier.updated', entityType: 'supplier', entityId: id, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
        return { id }
      }))
  }

  async setSupplierActive(access: AccessContext, id: string, actorUserId: string, input: { active: boolean; reason: string; version: number }, client: ClientInfo) {
    if (!input.active && input.reason.length < 3) throw unprocessable('REASON_REQUIRED', 'Give the reason for deactivating this supplier.')
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.supplier.updateMany({ where: { id, orgId: access.orgId, version: input.version }, data: { active: input.active, version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This supplier was changed by someone else. Reload it and try again.')
      await this.ledger.event(tx, access.orgId, 'supplier', id, `Supplier ${input.active ? 'reactivated' : 'deactivated'}`, actorUserId, input.reason)
      await this.audit.record({ action: `inventory.supplier.${input.active ? 'reactivated' : 'deactivated'}`, entityType: 'supplier', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return { id }
  }

  private async checkSuppliers(orgId: string, input: ItemInput) {
    const ids = [...new Set([...input.supplierIds, ...(input.preferredSupplierId ? [input.preferredSupplierId] : [])])]
    if (ids.length && (await this.prisma.supplier.count({ where: { orgId, id: { in: ids } } })) !== ids.length) throw unprocessable('SUPPLIER_INVALID', 'Choose suppliers of this organisation.')
  }

  private async unique<T>(code: string, message: string, work: () => Promise<T>) {
    try {
      return await work()
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict(code, message)
      throw error
    }
  }
}
