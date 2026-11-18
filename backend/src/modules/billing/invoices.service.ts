import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import type { CreateInvoiceInput } from './billing.schemas'
import { ChargesService } from './charges.service'
import { FinanceSupport } from './finance.support'
import { invoiceTotals, lineTotals, rupees, toPaise } from './money'
import { PaymentsService } from './payments.service'

// Invoices are issued from confirmed (unbilled) charges and catalogue services. Lines and totals are fixed at issue.
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ChargesService,
    private readonly payments: PaymentsService,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  async create(access: AccessContext, actorUserId: string, input: CreateInvoiceInput, client: ClientInfo) {
    const patient = await this.support.patient(access.orgId, input.patientId)
    const encounter = input.encounterId ? await this.support.encounterOf(access.orgId, patient.id, input.encounterId) : null
    const branchId = encounter?.branchId ?? patient.homeBranchId

    const charges = input.chargeIds.length
      ? await this.prisma.charge.findMany({ where: { orgId: access.orgId, patientId: patient.id, id: { in: input.chargeIds } }, orderBy: { createdAt: 'asc' } })
      : []
    if (charges.length !== input.chargeIds.length) throw unprocessable('CHARGE_INVALID', 'Choose charges of this patient.')
    const notReady = charges.find((charge) => charge.status !== 'unbilled')
    if (notReady) throw conflict('CHARGE_NOT_BILLABLE', notReady.status === 'invoiced' ? `${notReady.reference} is already invoiced.` : `${notReady.reference} is a draft; confirm it before invoicing.`)

    const services = await Promise.all(input.items.map((item) => this.charges.priced(access.orgId, item.serviceId, branchId)))
    const incomplete = services.find((service) => service.issues.length)
    if (incomplete) throw unprocessable('SERVICE_INCOMPLETE', `${incomplete.name} cannot be invoiced: ${incomplete.issues.join(' and ').toLowerCase()}.`)

    const discountFor = (own: number) => input.discountPct ?? own
    const lines = [
      ...charges.map((charge) => ({ chargeId: charge.id, serviceId: charge.serviceId, code: charge.code, name: charge.name, note: charge.category, quantity: charge.quantity, unitPrice: toPaise(charge.unitPrice), discountPct: discountFor(Number(charge.discountPct)), gstPct: Number(charge.gstPct) })),
      ...input.items.map((item, index) => {
        const service = services[index]!
        return { chargeId: null, serviceId: service.id, code: service.code, name: service.name, note: service.category, quantity: item.quantity, unitPrice: service.unitPrice, discountPct: discountFor(0), gstPct: service.gstPct }
      }),
    ]
    const totals = invoiceTotals(lines)
    const title = lines.length > 1 ? `${lines[0]!.name} + ${lines.length - 1} more` : lines[0]!.name

    return this.prisma.transaction(async (tx) => {
      const reference = await this.support.reference(tx, access.orgId, 'invoice_reference', 'INV-')
      const invoice = await tx.invoice.create({
        data: {
          orgId: access.orgId, reference, patientId: patient.id, branchId, encounterId: encounter?.id ?? null, payer: input.payer, model: input.model,
          invoiceDate: new Date(`${input.invoiceDate}T00:00:00Z`), dueDate: new Date(`${input.dueDate}T00:00:00Z`), title: title.slice(0, 240), publicNote: input.publicNote, internalNote: input.internalNote,
          gross: rupees(totals.gross), discount: rupees(totals.discount), tax: rupees(totals.tax), total: rupees(totals.total), createdById: actorUserId,
          lines: { create: lines.map((line, position) => ({ ...line, position, unitPrice: rupees(line.unitPrice), total: rupees(lineTotals(line).total) })) },
        },
        select: { id: true },
      })
      if (charges.length) {
        // Only still-unbilled charges move; a charge invoiced meanwhile by someone else makes the count fall short.
        const moved = await tx.charge.updateMany({ where: { id: { in: input.chargeIds }, orgId: access.orgId, status: 'unbilled' }, data: { status: 'invoiced', invoiceId: invoice.id, version: { increment: 1 } } })
        if (moved.count !== charges.length) throw conflict('CHARGE_NOT_BILLABLE', 'One of the selected charges was invoiced by someone else. Reload and try again.')
        for (const charge of charges) await this.support.event(tx, access.orgId, 'charge', charge.id, `Invoiced in ${reference}`, actorUserId)
      }
      await this.audit.record({ action: 'billing.invoice.issued', entityType: 'invoice', entityId: invoice.id, orgId: access.orgId, actorUserId, details: { reference, total: rupees(totals.total), lines: lines.length } }, client, tx)
      await this.payments.applyCredit(tx, access.orgId, actorUserId, patient.id, invoice.id, client)
      return { id: invoice.id, reference }
    })
  }
}
