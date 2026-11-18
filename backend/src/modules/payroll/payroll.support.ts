import { Inject, Injectable } from '@nestjs/common'
import { conflict, notFound } from '../../common/errors/app-error'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import { localDate, localMinute, minuteToTime } from '../scheduling/clinic-time'
import { DEFAULT_PT_SLABS, type PtSlab, type StatutoryRules } from './payroll.logic'

export type PayrollEntity = 'settings' | 'profile' | 'cycle' | 'entry' | 'adjustment' | 'advance'
type Db = PrismaService | Tx

// What every payroll service needs: the clock, numbering, the activity log, the rules and the open cycle.
@Injectable()
export class PayrollSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get timeZone() {
    return this.env.CLINIC_TIMEZONE
  }

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

  async event(tx: Tx, orgId: string, entityType: PayrollEntity, entityId: string, action: string, actorId: string | null, note = '') {
    await tx.payrollEvent.create({ data: { orgId, entityType, entityId, action, note, actorId } })
  }

  // The organisation's statutory rules, or the defaults until someone saves them.
  async rules(orgId: string, db: Db = this.prisma): Promise<StatutoryRules & { payDay: number; version: number | null }> {
    const row = await db.payrollSettings.findUnique({ where: { orgId } })
    if (!row) {
      return {
        epfEnabled: true, epfRateBp: 1200, epfCap: 180_000, esicEnabled: true, esicRateBp: 75, esicCeiling: 2_100_000,
        ptEnabled: true, ptState: 'Telangana', ptSlabs: DEFAULT_PT_SLABS, tdsEnabled: true, tdsRateBp: 1000, payDay: 5, version: null,
      }
    }
    return { ...row, ptSlabs: row.ptSlabs as unknown as PtSlab[] }
  }

  // The run that is not yet processed, locked for the rest of the transaction.
  async lockOpenCycle(tx: Tx, orgId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`select id from payroll_cycles where org_id = ${orgId}::uuid and status <> 'processed' for update`
    if (!rows[0]) return null
    return tx.payrollCycle.findUniqueOrThrow({ where: { id: rows[0].id } })
  }

  async lockCycle(tx: Tx, orgId: string, id: string) {
    await tx.$queryRaw`select id from payroll_cycles where id = ${id}::uuid for update`
    const cycle = await tx.payrollCycle.findFirst({ where: { id, orgId } })
    if (!cycle) throw notFound('Payroll cycle not found.')
    return cycle
  }

  editable(cycle: { status: string }) {
    if (cycle.status === 'processed') throw conflict('CYCLE_PROCESSED', 'This payroll run has been processed and is read-only. Corrections go into the next cycle as adjustments.')
  }

  // Any change to what an approved run pays sends it back for approval.
  async reopen(tx: Tx, orgId: string, actorId: string, why: string) {
    const cycle = await this.lockOpenCycle(tx, orgId)
    if (cycle?.status !== 'approved') return
    await tx.payrollCycle.update({ where: { id: cycle.id }, data: { status: 'draft', approvedById: null, approvedAt: null, version: { increment: 1 } } })
    await this.event(tx, orgId, 'cycle', cycle.id, 'Approval withdrawn', actorId, why)
  }

  async staff(orgId: string, staffId: string, db: Db = this.prisma) {
    const staff = await db.staffMember.findFirst({ where: { id: staffId, orgId }, select: { id: true, fullName: true, status: true } })
    if (!staff) throw notFound('Staff member not found.')
    return staff
  }
}
