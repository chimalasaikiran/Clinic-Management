import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import type { Tx } from '../../database/prisma.service'
import { paymentPosition, toPaise } from './money'

const paymentSelect = {
  id: true,
  reference: true,
  patientId: true,
  amount: true,
  receivedAt: true,
  allocations: { select: { invoiceId: true, amount: true, createdAt: true } },
  refunds: { select: { id: true, amount: true, status: true, releasesAllocations: true } },
} satisfies Prisma.PaymentSelect

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>

// Balances read inside a transaction, after the rows involved have been locked. All amounts are in paise.
@Injectable()
export class BalancesRepository {
  async invoices(tx: Tx, orgId: string, where: Prisma.InvoiceWhereInput) {
    const invoices = await tx.invoice.findMany({
      where: { ...where, orgId },
      select: { id: true, reference: true, patientId: true, total: true, allocations: { select: { amount: true } } },
      orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
    })
    return invoices.map(({ allocations, ...invoice }) => ({
      ...invoice,
      total: toPaise(invoice.total),
      balance: toPaise(invoice.total) - allocations.reduce((sum, row) => sum + toPaise(row.amount), 0),
    }))
  }

  // Invoices of a patient with something still to pay, oldest first.
  async openInvoices(tx: Tx, orgId: string, patientId: string) {
    return (await this.invoices(tx, orgId, { patientId })).filter((invoice) => invoice.balance > 0)
  }

  async payment(tx: Tx, orgId: string, paymentId: string, excludeRefundId?: string) {
    const row = await tx.payment.findFirst({ where: { id: paymentId, orgId }, select: paymentSelect })
    return row ? this.position(row, excludeRefundId) : null
  }

  // A patient's payments with credit not yet applied or held for a refund, oldest first.
  async creditPayments(tx: Tx, orgId: string, patientId: string) {
    const rows = await tx.payment.findMany({ where: { orgId, patientId }, select: paymentSelect, orderBy: { receivedAt: 'asc' } })
    return rows.map((row) => this.position(row)).filter((payment) => payment.position.available > 0)
  }

  private position(row: PaymentRow, excludeRefundId?: string) {
    const allocated = row.allocations.reduce((sum, allocation) => sum + toPaise(allocation.amount), 0)
    const refunds = row.refunds.filter((refund) => refund.id !== excludeRefundId).map((refund) => ({ ...refund, amount: toPaise(refund.amount) }))
    return { ...row, amount: toPaise(row.amount), position: paymentPosition(toPaise(row.amount), allocated, refunds) }
  }
}
