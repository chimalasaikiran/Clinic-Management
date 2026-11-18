import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import { BalancesRepository } from './balances.repository'
import { PAYMENT_CHANNELS } from './billing.constants'
import type { AllocateInput, CreatePaymentInput } from './billing.schemas'
import { CatalogueService } from './catalogue.service'
import { FinanceSupport } from './finance.support'
import { rupees, toPaise } from './money'

type Settings = Awaited<ReturnType<CatalogueService['settings']>>

const METHOD_LABEL = { cash: 'Cash', bank: 'Bank transfer', upi: 'UPI / Card' } as const
const inr = (paise: number) => `₹${rupees(paise).toLocaleString('en-IN')}`

// Payments and their allocations to invoices. A payment is never edited once recorded.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesRepository,
    private readonly catalogue: CatalogueService,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  async create(access: AccessContext, actorUserId: string, input: CreatePaymentInput, client: ClientInfo) {
    const settings = await this.catalogue.settings(access.orgId)
    const group = PAYMENT_CHANNELS[input.channel]
    if (!settings[`${group}Enabled`]) throw unprocessable('METHOD_DISABLED', `${METHOD_LABEL[group]} payments are switched off in the billing configuration.`)
    const patient = await this.support.patient(access.orgId, input.patientId)
    if (input.txnReference) {
      const duplicate = await this.prisma.payment.findFirst({ where: { orgId: access.orgId, channel: input.channel, txnReference: { equals: input.txnReference, mode: 'insensitive' } }, select: { reference: true } })
      if (duplicate) throw conflict('DUPLICATE_PAYMENT', `This transaction reference is already recorded on ${duplicate.reference}.`)
    }
    const total = toPaise(input.amount)
    const planned = input.allocations.reduce((sum, entry) => sum + toPaise(entry.amount), 0)
    if (planned > total) throw unprocessable('ALLOCATION_EXCEEDS_PAYMENT', 'The allocations add up to more than the amount received.')

    return this.prisma.transaction(async (tx) => {
      const reference = await this.support.reference(tx, access.orgId, 'payment_reference', 'PAY-')
      const receiptNumber = await this.support.reference(tx, access.orgId, 'receipt_number', 'REC-')
      const payment = await tx.payment.create({
        data: {
          orgId: access.orgId, reference, receiptNumber, patientId: patient.id, branchId: patient.homeBranchId, amount: input.amount, channel: input.channel, payer: input.payer,
          purpose: input.purpose, txnReference: input.txnReference, narration: input.narration, recordedById: actorUserId,
        },
        select: { id: true },
      })
      await this.audit.record({ action: 'billing.payment.recorded', entityType: 'payment', entityId: payment.id, orgId: access.orgId, actorUserId, details: { reference, receiptNumber, amount: input.amount, channel: input.channel } }, client, tx)

      let plan = input.allocations.map((entry) => ({ invoiceId: entry.invoiceId, amount: toPaise(entry.amount) }))
      // "Apply to the oldest invoice first": a payment against charges with no allocation chosen is applied for the cashier.
      if (!plan.length && input.purpose === 'charges' && settings.allocationPolicy === 'Apply to the oldest invoice first') {
        let left = total
        plan = (await this.balances.openInvoices(tx, access.orgId, patient.id)).flatMap((invoice) => {
          const take = Math.min(left, invoice.balance)
          left -= take
          return take > 0 ? [{ invoiceId: invoice.id, amount: take }] : []
        })
      }
      if (plan.length) {
        await this.support.lockInvoices(tx, plan.map((entry) => entry.invoiceId))
        for (const entry of plan) await this.allocate(tx, access.orgId, actorUserId, payment.id, entry.invoiceId, entry.amount, settings, client)
      }
      return { id: payment.id, reference }
    })
  }

  async allocateExisting(access: AccessContext, paymentId: string, actorUserId: string, input: AllocateInput, client: ClientInfo) {
    const settings = await this.catalogue.settings(access.orgId)
    await this.prisma.transaction(async (tx) => {
      await this.support.lockPayment(tx, paymentId)
      await this.support.lockInvoices(tx, [input.invoiceId])
      await this.allocate(tx, access.orgId, actorUserId, paymentId, input.invoiceId, toPaise(input.amount), settings, client)
    })
    return paymentId
  }

  // "Apply to the next invoice": spends a patient's unallocated credit on a newly issued invoice, oldest payment first.
  async applyCredit(tx: Tx, orgId: string, actorUserId: string, patientId: string, invoiceId: string, client: ClientInfo) {
    const settings = await this.catalogue.settings(orgId, tx)
    if (settings.advancePolicy !== 'Apply to the next invoice') return
    const credit = await this.balances.creditPayments(tx, orgId, patientId)
    for (const payment of credit) {
      await this.support.lockPayment(tx, payment.id)
      const [invoice] = await this.balances.invoices(tx, orgId, { id: invoiceId })
      const fresh = await this.balances.payment(tx, orgId, payment.id)
      const take = Math.min(invoice!.balance, fresh!.position.available)
      if (take <= 0) break
      await this.allocate(tx, orgId, actorUserId, payment.id, invoiceId, take, { ...settings, partialPolicy: '' }, client)
    }
  }

  // Applies part of a payment to an invoice of the same patient. Callers lock the payment and invoice rows first.
  private async allocate(tx: Tx, orgId: string, actorUserId: string, paymentId: string, invoiceId: string, amount: number, settings: Settings, client: ClientInfo) {
    const payment = await this.balances.payment(tx, orgId, paymentId)
    if (!payment) throw notFound('Payment not found.')
    const [invoice] = await this.balances.invoices(tx, orgId, { id: invoiceId })
    if (!invoice) throw notFound('Invoice not found.')
    if (invoice.patientId !== payment.patientId) throw unprocessable('ALLOCATION_PATIENT_MISMATCH', 'A payment can only be applied to invoices of the same patient.')
    if (amount <= 0) throw unprocessable('ALLOCATION_INVALID', 'Enter an amount greater than zero.')
    if (amount > payment.position.available) throw unprocessable('ALLOCATION_EXCEEDS_CREDIT', `Only ${inr(Math.max(payment.position.available, 0))} of ${payment.reference} is free to allocate.`)
    if (amount > invoice.balance) throw unprocessable('ALLOCATION_EXCEEDS_BALANCE', `${invoice.reference} has ${inr(Math.max(invoice.balance, 0))} outstanding.`)
    if (settings.partialPolicy === 'Require full payment' && amount !== invoice.balance) throw unprocessable('FULL_PAYMENT_REQUIRED', `The billing configuration requires ${invoice.reference} to be paid in full (${inr(invoice.balance)}).`)
    const reference = await this.support.reference(tx, orgId, 'allocation_reference', 'ALC-')
    await tx.paymentAllocation.create({ data: { orgId, reference, paymentId, invoiceId, amount: rupees(amount), createdById: actorUserId } })
    await this.audit.record({ action: 'billing.payment.allocated', entityType: 'payment', entityId: paymentId, orgId, actorUserId, details: { reference, invoice: invoice.reference, amount: rupees(amount) } }, client, tx)
  }
}
