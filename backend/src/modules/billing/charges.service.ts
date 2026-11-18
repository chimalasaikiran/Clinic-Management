import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import type { CreateChargeInput, UpdateChargeInput } from './billing.schemas'
import { FinanceSupport } from './finance.support'
import { lineTotals, rupees, toPaise } from './money'

export interface PricedService {
  id: string
  code: string
  name: string
  category: string
  department: string | null
  unitPrice: number // paise
  gstPct: number
  // What stops the service from being confirmed on a charge or invoice; empty when it is ready.
  issues: string[]
}

// Charges: an amount owed for one service, priced from the catalogue at the patient's branch.
@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  // The catalogue entry as it applies at a branch: its override or default price and its GST rate.
  async priced(orgId: string, serviceId: string, branchId: string): Promise<PricedService> {
    const service = await this.prisma.billingService.findFirst({
      where: { id: serviceId, orgId },
      include: { prices: { where: { branchId } } },
    })
    if (!service) throw notFound('Service not found.')
    if (service.status !== 'active') throw unprocessable('SERVICE_INACTIVE', `${service.name} is inactive and cannot be selected for new records.`)
    const offer = service.prices[0]
    if (!offer) throw unprocessable('SERVICE_NOT_OFFERED', `${service.name} is not offered at this patient’s branch.`)
    const unitPrice = toPaise(offer.price ?? service.price)
    const issues = [!(unitPrice > 0) && 'Price missing', service.taxTreatment === 'not_configured' && 'Tax treatment missing'].filter(Boolean) as string[]
    return { id: service.id, code: service.code, name: service.name, category: service.category, department: service.department, unitPrice, gstPct: Number(service.gstRate), issues }
  }

  async create(access: AccessContext, actorUserId: string, input: CreateChargeInput, client: ClientInfo) {
    const patient = await this.support.patient(access.orgId, input.patientId)
    const encounter = input.encounterId ? await this.support.encounterOf(access.orgId, patient.id, input.encounterId) : null
    const branchId = encounter?.branchId ?? patient.homeBranchId
    const columns = await this.columns(access.orgId, branchId, input)
    return this.prisma.transaction(async (tx) => {
      const reference = await this.support.reference(tx, access.orgId, 'charge_reference', 'CHG-')
      const charge = await tx.charge.create({
        data: { orgId: access.orgId, reference, patientId: patient.id, branchId, encounterId: encounter?.id ?? null, chargeDate: new Date(`${this.support.today()}T00:00:00Z`), createdById: actorUserId, ...columns },
        select: { id: true },
      })
      await this.support.event(tx, access.orgId, 'charge', charge.id, columns.status === 'unbilled' ? 'Charge confirmed' : 'Draft saved', actorUserId)
      await this.audit.record({ action: 'billing.charge.created', entityType: 'charge', entityId: charge.id, orgId: access.orgId, actorUserId, details: { reference, status: columns.status } }, client, tx)
      return { id: charge.id, reference }
    })
  }

  // Only drafts change. Confirming re-prices the draft from the catalogue as it stands now.
  async update(access: AccessContext, id: string, actorUserId: string, input: UpdateChargeInput, client: ClientInfo) {
    const current = await this.prisma.charge.findFirst({ where: { id, orgId: access.orgId }, select: { id: true, status: true, patientId: true, branchId: true, encounterId: true } })
    if (!current) throw notFound('Charge not found.')
    if (current.status !== 'draft') throw conflict('CHARGE_FINAL', 'Confirmed charges are read-only. Corrections need a separate record.')
    const encounter = input.encounterId ? await this.support.encounterOf(access.orgId, current.patientId, input.encounterId) : null
    const branchId = encounter?.branchId ?? current.branchId
    const columns = await this.columns(access.orgId, branchId, input)
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.charge.updateMany({ where: { id, orgId: access.orgId, status: 'draft', version: input.version }, data: { ...columns, branchId, encounterId: encounter?.id ?? null, version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This charge was changed by someone else. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'charge', id, columns.status === 'unbilled' ? 'Charge confirmed' : 'Draft updated', actorUserId)
      await this.audit.record({ action: columns.status === 'unbilled' ? 'billing.charge.confirmed' : 'billing.charge.updated', entityType: 'charge', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return id
  }

  private async columns(orgId: string, branchId: string, input: CreateChargeInput | UpdateChargeInput) {
    const service = await this.priced(orgId, input.serviceId, branchId)
    if (input.confirm && service.issues.length) throw unprocessable('SERVICE_INCOMPLETE', `${service.name} cannot be confirmed: ${service.issues.join(' and ').toLowerCase()}. Save a draft or complete the service in Services & Pricing.`)
    const line = { quantity: input.quantity, unitPrice: service.unitPrice, discountPct: input.discountPct, gstPct: service.gstPct }
    return {
      serviceId: service.id, payer: input.payer, model: input.model, note: input.note, status: input.confirm ? ('unbilled' as const) : ('draft' as const),
      code: service.code, name: service.name, category: service.category, department: service.department,
      quantity: input.quantity, unitPrice: rupees(service.unitPrice), discountPct: input.discountPct, gstPct: service.gstPct, total: rupees(lineTotals(line).total),
    }
  }
}
