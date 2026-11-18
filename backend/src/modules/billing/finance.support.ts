import { Inject, Injectable } from '@nestjs/common'
import { notFound } from '../../common/errors/app-error'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import { localDate, localMinute, minuteToTime } from '../scheduling/clinic-time'

export type FinanceEntity = 'service' | 'settings' | 'charge' | 'refund' | 'exception'

// Helpers every finance service needs: numbering, the activity log, row locks and the clinic's clock.
@Injectable()
export class FinanceSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  stamp(instant: Date) {
    return { date: localDate(instant, this.env.CLINIC_TIMEZONE), time: minuteToTime(localMinute(instant, this.env.CLINIC_TIMEZONE)), at: instant.toISOString() }
  }

  today() {
    return localDate(new Date(), this.env.CLINIC_TIMEZONE)
  }

  async reference(tx: Tx, orgId: string, counter: string, prefix: string) {
    return formatNumber(prefix, await this.counters.next(tx, orgId, counter))
  }

  async references(tx: Tx, orgId: string, counter: string, prefix: string, count: number) {
    if (count === 0) return []
    const first = await this.counters.reserve(tx, orgId, counter, count)
    return Array.from({ length: count }, (_, index) => formatNumber(prefix, first + index))
  }

  async event(tx: Tx, orgId: string, entityType: FinanceEntity, entityId: string, action: string, actorId: string | null, note = '') {
    await tx.financeEvent.create({ data: { orgId, entityType, entityId, action, note, actorId } })
  }

  // Finance roles are organisation-wide, so any patient of the organisation is in reach.
  async patient(orgId: string, patientId: string, db: PrismaService | Tx = this.prisma) {
    const patient = await db.patient.findFirst({ where: { id: patientId, orgId }, select: { id: true, homeBranchId: true, fullName: true } })
    if (!patient) throw notFound('Patient not found.')
    return patient
  }

  async encounterOf(orgId: string, patientId: string, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, orgId, patientId }, select: { id: true, branchId: true } })
    if (!encounter) throw notFound('Encounter not found for this patient.')
    return encounter
  }

  // Row locks taken before reading balances, so two cashiers cannot spend the same credit or balance twice.
  async lockPayment(tx: Tx, paymentId: string) {
    await tx.$queryRaw`select id from payments where id = ${paymentId}::uuid for update`
  }

  async lockInvoices(tx: Tx, invoiceIds: string[]) {
    if (invoiceIds.length) await tx.$queryRaw`select id from invoices where id = any(${invoiceIds}::uuid[]) order by id for update`
  }
}
