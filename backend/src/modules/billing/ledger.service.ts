import { Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { CatalogueService } from './catalogue.service'
import { FinanceSupport } from './finance.support'

type Amount = { toString(): string }
const num = (value: Amount | null) => (value === null ? null : Number(value.toString()))
const isoDay = (value: Date) => value.toISOString().slice(0, 10)
const actorName = { select: { fullName: true } } as const

// The finance ledger as one read: catalogue, settings and every charge, invoice, payment, refund and statement
// line of the organisation (or of one patient). Balances are derived from these by the web app, which shows
// them across many screens; the API enforces the same rules again on every change.
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: CatalogueService,
    private readonly support: FinanceSupport,
  ) {}

  async ledger(access: AccessContext, patientId?: string) {
    const orgId = access.orgId
    if (patientId) await this.support.patient(orgId, patientId)
    const scoped = { orgId, ...(patientId ? { patientId } : {}) }
    const withReconciliation = !patientId

    const [branches, services, settings, charges, invoices, payments, refunds, imports, lines, exceptions] = await Promise.all([
      this.prisma.branch.findMany({ where: { orgId }, select: { id: true, code: true, name: true, status: true }, orderBy: { name: 'asc' } }),
      this.prisma.billingService.findMany({ where: { orgId }, include: { prices: { select: { branchId: true, price: true } } }, orderBy: { code: 'asc' } }),
      this.catalogue.settings(orgId),
      this.prisma.charge.findMany({
        where: scoped,
        include: { branch: { select: { id: true, name: true } }, encounter: { select: { reference: true } }, invoice: { select: { reference: true } }, createdBy: actorName },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.findMany({
        where: scoped,
        include: { branch: { select: { id: true, name: true } }, encounter: { select: { reference: true } }, createdBy: actorName, lines: { orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: scoped,
        include: {
          branch: { select: { id: true, name: true } },
          recordedBy: actorName,
          allocations: { include: { invoice: { select: { reference: true } }, createdBy: actorName }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.refund.findMany({ where: scoped, include: { payment: { select: { reference: true } }, requestedBy: actorName }, orderBy: { createdAt: 'desc' } }),
      withReconciliation ? this.prisma.statementImport.findMany({ where: { orgId }, include: { importedBy: actorName }, orderBy: { createdAt: 'desc' } }) : [],
      withReconciliation
        ? this.prisma.statementLine.findMany({ where: { orgId }, include: { import: { select: { reference: true } }, payment: { select: { reference: true } }, exception: { select: { id: true } } }, orderBy: [{ txnDate: 'desc' }, { txnTime: 'desc' }] })
        : [],
      withReconciliation ? this.prisma.reconException.findMany({ where: { orgId }, include: { owner: actorName }, orderBy: { createdAt: 'desc' } }) : [],
    ])

    const patientIds = [...new Set([patientId, ...charges.map((row) => row.patientId), ...invoices.map((row) => row.patientId), ...payments.map((row) => row.patientId), ...refunds.map((row) => row.patientId)].filter(Boolean) as string[])]
    const entityIds = [...services.map((row) => row.id), ...charges.map((row) => row.id), ...refunds.map((row) => row.id), ...exceptions.map((row) => row.id), orgId]
    const [patients, events] = await Promise.all([
      patientIds.length
        ? this.prisma.patient.findMany({ where: { orgId, id: { in: patientIds } }, select: { id: true, mrn: true, fullName: true, mobile: true, dateOfBirth: true, homeBranch: { select: { id: true, name: true } } } })
        : [],
      this.prisma.financeEvent.findMany({ where: { orgId, entityId: { in: entityIds } }, include: { actor: actorName }, orderBy: { createdAt: 'desc' } }),
    ])
    const history = new Map<string, Array<{ action: string; note: string; actor: string | null; at: ReturnType<FinanceSupport['stamp']> }>>()
    for (const event of events) {
      const list = history.get(event.entityId) ?? []
      list.push({ action: event.action, note: event.note, actor: event.actor?.fullName ?? null, at: this.support.stamp(event.createdAt) })
      history.set(event.entityId, list)
    }
    const eventsOf = (id: string) => history.get(id) ?? []

    return {
      branches,
      patients: patients.map((row) => ({ id: row.id, mrn: row.mrn, name: row.fullName, mobile: row.mobile, dateOfBirth: isoDay(row.dateOfBirth), branch: row.homeBranch })),
      services: services.map((row) => this.serviceView(row, eventsOf(row.id))),
      settings: { ...settings, updatedAt: settings.updatedAt?.toISOString() ?? null, events: eventsOf(orgId) },
      charges: charges.map((row) => ({
        id: row.id, reference: row.reference, patientId: row.patientId, branch: row.branch, encounterId: row.encounterId, encounterReference: row.encounter?.reference ?? null,
        serviceId: row.serviceId, payer: row.payer, model: row.model, date: isoDay(row.chargeDate), created: this.support.stamp(row.createdAt), status: row.status,
        invoiceId: row.invoiceId, invoiceReference: row.invoice?.reference ?? null, note: row.note, code: row.code, name: row.name, category: row.category, department: row.department,
        quantity: row.quantity, unitPrice: num(row.unitPrice), discountPct: num(row.discountPct), gstPct: num(row.gstPct), total: num(row.total), version: row.version,
        createdBy: row.createdBy.fullName, events: eventsOf(row.id),
      })),
      invoices: invoices.map((row) => ({
        id: row.id, reference: row.reference, patientId: row.patientId, branch: row.branch, encounterId: row.encounterId, encounterReference: row.encounter?.reference ?? null,
        payer: row.payer, model: row.model, date: isoDay(row.invoiceDate), dueDate: isoDay(row.dueDate), created: this.support.stamp(row.createdAt), title: row.title,
        publicNote: row.publicNote, internalNote: row.internalNote, gross: num(row.gross), discount: num(row.discount), tax: num(row.tax), total: num(row.total), createdBy: row.createdBy.fullName,
        lines: row.lines.map((line) => ({ id: line.id, chargeId: line.chargeId, serviceId: line.serviceId, code: line.code, name: line.name, note: line.note, quantity: line.quantity, unitPrice: num(line.unitPrice), discountPct: num(line.discountPct), gstPct: num(line.gstPct), total: num(line.total) })),
      })),
      payments: payments.map((row) => ({
        id: row.id, reference: row.reference, receiptNumber: row.receiptNumber, patientId: row.patientId, branch: row.branch, amount: num(row.amount), channel: row.channel, payer: row.payer,
        purpose: row.purpose, txnReference: row.txnReference, narration: row.narration, received: this.support.stamp(row.receivedAt), recordedBy: row.recordedBy.fullName,
        allocations: row.allocations.map((allocation) => ({ id: allocation.id, reference: allocation.reference, invoiceId: allocation.invoiceId, invoiceReference: allocation.invoice.reference, amount: num(allocation.amount), refundId: allocation.refundId, at: this.support.stamp(allocation.createdAt), by: allocation.createdBy.fullName })),
      })),
      refunds: refunds.map((row) => ({
        id: row.id, reference: row.reference, paymentId: row.paymentId, paymentReference: row.payment.reference, patientId: row.patientId, amount: num(row.amount), reason: row.reason, method: row.method,
        internalReference: row.internalReference, notes: row.notes, releasesAllocations: row.releasesAllocations, status: row.status, outcomeReference: row.outcomeReference, outcomeNote: row.outcomeNote,
        requested: this.support.stamp(row.createdAt), requestedBy: row.requestedBy.fullName, decidedAt: row.decidedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
        version: row.version, events: eventsOf(row.id),
      })),
      statementImports: imports.map((row) => ({ id: row.id, reference: row.reference, source: row.source, fileName: row.fileName, lineCount: row.lineCount, importedBy: row.importedBy.fullName, at: this.support.stamp(row.createdAt) })),
      statementLines: lines.map((row) => ({
        id: row.id, importReference: row.import.reference, source: row.source, reference: row.sourceReference, date: isoDay(row.txnDate), time: row.txnTime, amount: num(row.amount),
        narration: row.narration, paymentId: row.paymentId, paymentReference: row.payment?.reference ?? null, state: row.state, exceptionId: row.exception?.id ?? null,
      })),
      exceptions: exceptions.map((row) => ({
        id: row.id, reference: row.reference, lineId: row.lineId, kind: row.kind, reason: row.reason, status: row.status, owner: row.owner?.fullName ?? null, evidence: row.evidence,
        resolutionType: row.resolutionType, resolutionNote: row.resolutionNote, resolvedAt: row.resolvedAt?.toISOString() ?? null, created: this.support.stamp(row.createdAt), version: row.version, events: eventsOf(row.id),
      })),
    }
  }

  // The service catalogue on its own, with each service's history: what Configuration › Services reads.
  async services(access: AccessContext) {
    const orgId = access.orgId
    const services = await this.prisma.billingService.findMany({ where: { orgId }, include: { prices: { select: { branchId: true, price: true } } }, orderBy: { code: 'asc' } })
    const events = services.length ? await this.prisma.financeEvent.findMany({ where: { orgId, entityId: { in: services.map((row) => row.id) } }, include: { actor: actorName }, orderBy: { createdAt: 'desc' } }) : []
    return services.map((row) => this.serviceView(row, events.filter((event) => event.entityId === row.id).map((event) => ({ action: event.action, note: event.note, actor: event.actor?.fullName ?? null, at: this.support.stamp(event.createdAt) }))))
  }

  private serviceView(row: Prisma.BillingServiceGetPayload<{ include: { prices: { select: { branchId: true; price: true } } } }>, events: unknown[]) {
    return {
      id: row.id, code: row.code, name: row.name, category: row.category, department: row.department, description: row.description, unit: row.unit, status: row.status,
      patientBookable: row.patientBookable, price: num(row.price), taxTreatment: row.taxTreatment, taxConfig: row.taxConfig, gstRate: num(row.gstRate), prices: row.prices.map((entry) => ({ branchId: entry.branchId, price: num(entry.price) })),
      updated: this.support.stamp(row.updatedAt), version: row.version, events,
    }
  }
}
