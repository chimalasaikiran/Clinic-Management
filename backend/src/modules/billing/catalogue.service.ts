import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import { TAX_CONFIGS } from './billing.constants'
import type { ServiceInput, SettingsInput } from './billing.schemas'
import { FinanceSupport } from './finance.support'

const FIELD_LABELS: Record<string, string> = {
  code: 'code', name: 'name', category: 'category', department: 'department', description: 'description', unit: 'unit',
  status: 'status', price: 'price', taxTreatment: 'tax treatment', taxConfig: 'tax configuration', prices: 'locations & prices',
}

const SETTING_LABELS: Record<string, string> = {
  billingModel: 'billing model', cashEnabled: 'cash', bankEnabled: 'bank transfer', upiEnabled: 'UPI / card', advancePolicy: 'advance handling',
  partialPolicy: 'partial payments', allocationPolicy: 'allocation', invoiceDocument: 'invoice document', receiptDocument: 'receipt document',
}

const gstRateOf = (input: Pick<ServiceInput, 'taxTreatment' | 'taxConfig'>) =>
  input.taxTreatment === 'taxable' && input.taxConfig ? TAX_CONFIGS.taxable[input.taxConfig] ?? 0 : 0

// The service catalogue and the organisation's billing defaults. Neither changes an existing financial record.
@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  async createService(access: AccessContext, actorUserId: string, input: ServiceInput, client: ClientInfo) {
    await this.checkBranches(access.orgId, input.prices.map((entry) => entry.branchId))
    try {
      return await this.prisma.transaction(async (tx) => {
        const service = await tx.billingService.create({
          data: { orgId: access.orgId, ...this.columns(input), createdById: actorUserId, prices: { create: input.prices.map((entry) => ({ branchId: entry.branchId, price: entry.price })) } },
          select: { id: true },
        })
        await this.support.event(tx, access.orgId, 'service', service.id, 'Service created', actorUserId)
        await this.audit.record({ action: 'billing.service.created', entityType: 'billing_service', entityId: service.id, orgId: access.orgId, actorUserId, details: { code: input.code } }, client, tx)
        return service.id
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('SERVICE_CODE_TAKEN', 'This service code is already used in your organisation.')
      throw error
    }
  }

  async updateService(access: AccessContext, id: string, actorUserId: string, version: number, input: ServiceInput, client: ClientInfo) {
    const current = await this.prisma.billingService.findFirst({ where: { id, orgId: access.orgId }, include: { prices: true } })
    if (!current) throw notFound('Service not found.')
    await this.checkBranches(access.orgId, input.prices.map((entry) => entry.branchId))
    const changed = this.changedFields(current, input)
    try {
      await this.prisma.transaction(async (tx) => {
        const updated = await tx.billingService.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...this.columns(input), version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('STALE_RECORD', 'This service was changed by someone else. Reload it and try again.')
        await tx.billingServicePrice.deleteMany({ where: { serviceId: id } })
        if (input.prices.length) await tx.billingServicePrice.createMany({ data: input.prices.map((entry) => ({ serviceId: id, branchId: entry.branchId, price: entry.price })) })
        if (changed.length) await this.support.event(tx, access.orgId, 'service', id, 'Service updated', actorUserId, changed.join(', '))
        await this.audit.record({ action: 'billing.service.updated', entityType: 'billing_service', entityId: id, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('SERVICE_CODE_TAKEN', 'This service code is already used in your organisation.')
      throw error
    }
    return id
  }

  // Activation re-runs the checks the form applies; deactivation keeps the reason in the history.
  async setServiceStatus(access: AccessContext, id: string, actorUserId: string, input: { status: 'active' | 'inactive'; reason: string; version: number }, client: ClientInfo) {
    const current = await this.prisma.billingService.findFirst({ where: { id, orgId: access.orgId }, select: { status: true, taxTreatment: true, _count: { select: { prices: true } } } })
    if (!current) throw notFound('Service not found.')
    if (input.status === 'active' && current.taxTreatment === 'not_configured') throw unprocessable('SERVICE_INCOMPLETE', 'Choose a tax treatment before activating this service.')
    if (input.status === 'active' && current._count.prices === 0) throw unprocessable('SERVICE_INCOMPLETE', 'Select at least one location before activating this service.')
    if (input.status === 'inactive' && input.reason.length < 3) throw unprocessable('REASON_REQUIRED', 'Enter a reason for the audit trail.')
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.billingService.updateMany({ where: { id, orgId: access.orgId, version: input.version }, data: { status: input.status, version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This service was changed by someone else. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'service', id, input.status === 'active' ? 'Activated' : 'Deactivated', actorUserId, input.reason)
      await this.audit.record({ action: `billing.service.${input.status === 'active' ? 'activated' : 'deactivated'}`, entityType: 'billing_service', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return id
  }

  async saveSettings(access: AccessContext, actorUserId: string, input: SettingsInput, client: ClientInfo) {
    const { version, ...values } = input
    const current = await this.prisma.billingSettings.findUnique({ where: { orgId: access.orgId } })
    const changed = (current ? Object.keys(values).filter((key) => current[key as keyof typeof values] !== values[key as keyof typeof values]) : Object.keys(values)).map((key) => SETTING_LABELS[key] ?? key)
    await this.prisma.transaction(async (tx) => {
      if (!current) {
        if (version !== null) throw conflict('STALE_RECORD', 'The billing configuration was changed by someone else. Reload it and try again.')
        await tx.billingSettings.create({ data: { orgId: access.orgId, ...values, updatedById: actorUserId } })
      } else {
        const updated = await tx.billingSettings.updateMany({ where: { orgId: access.orgId, version: version ?? -1 }, data: { ...values, updatedById: actorUserId, updatedAt: new Date(), version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('STALE_RECORD', 'The billing configuration was changed by someone else. Reload it and try again.')
      }
      await this.support.event(tx, access.orgId, 'settings', access.orgId, 'Configuration updated', actorUserId, changed.join(', '))
      await this.audit.record({ action: 'billing.settings.updated', entityType: 'billing_settings', entityId: access.orgId, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
    })
  }

  // The settings in force, with the defaults an organisation starts from before anyone saves them.
  async settings(orgId: string, db: PrismaService | Tx = this.prisma) {
    return (await db.billingSettings.findUnique({ where: { orgId } })) ?? { orgId, billingModel: 'Pay-as-you-go', cashEnabled: true, bankEnabled: true, upiEnabled: true, advancePolicy: '', partialPolicy: '', allocationPolicy: '', invoiceDocument: '', receiptDocument: '', updatedById: null, updatedAt: null, version: null }
  }

  private columns(input: ServiceInput) {
    const { prices: _prices, ...rest } = input
    const configured = input.taxTreatment === 'exempt' || input.taxTreatment === 'taxable'
    return { ...rest, taxConfig: configured ? input.taxConfig : null, gstRate: gstRateOf(input) }
  }

  private changedFields(current: { prices: Array<{ branchId: string; price: unknown }> } & Record<string, unknown>, input: ServiceInput) {
    const next = this.columns(input) as Record<string, unknown>
    // Decimals arrive as objects; compare them as numbers.
    const scalar = (value: unknown) => (value === null || value === undefined ? null : typeof value === 'object' ? String(Number(value)) : String(value))
    const changed = Object.keys(FIELD_LABELS).filter((key) => key !== 'prices' && key in next && scalar(current[key]) !== scalar(next[key]))
    const priceKey = (rows: Array<{ branchId: string; price: unknown }>) => JSON.stringify(rows.map((row) => [row.branchId, row.price === null ? null : Number(row.price)]).sort())
    if (priceKey(current.prices) !== priceKey(input.prices)) changed.push('prices')
    return changed.map((key) => FIELD_LABELS[key]!)
  }

  private async checkBranches(orgId: string, branchIds: string[]) {
    if (!branchIds.length) return
    const found = await this.prisma.branch.count({ where: { orgId, id: { in: branchIds }, status: 'active' } })
    if (found !== branchIds.length) throw unprocessable('BRANCH_INVALID', 'Choose active branches of this organisation.')
  }
}
