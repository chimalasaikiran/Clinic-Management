import { Injectable } from '@nestjs/common'
import { notFound } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import { AdjustmentsService } from './adjustments.service'
import type { StatutoryLine } from './payroll.logic'
import { PayrollSupport } from './payroll.support'

const rupees = (paise: number | null) => (paise ?? 0) / 100
const isoDay = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null)

// What a person may see of their own pay: payslips from processed runs only (an open run can still change), the
// bank account it is paid into, and their salary advances. Amounts are rupees.
@Injectable()
export class MyPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PayrollSupport,
    private readonly adjustments: AdjustmentsService,
  ) {}

  private staffOf(access: AccessContext) {
    return this.prisma.staffMember.findFirst({ where: { orgId: access.orgId, membershipId: access.membershipId }, select: { id: true } })
  }

  async pay(access: AccessContext) {
    const staff = await this.staffOf(access)
    if (!staff) return { profile: null, payslips: [], advances: [] }
    const [profile, entries, adjustments, advances] = await Promise.all([
      this.prisma.payProfile.findUnique({ where: { staffId: staff.id }, select: { employment: true, model: true, rate: true, bankName: true, accountLast4: true, bankVerified: true, active: true } }),
      this.prisma.payrollEntry.findMany({
        where: { staffId: staff.id, payslipRef: { not: null }, cycle: { orgId: access.orgId, status: 'processed' } },
        include: { cycle: { select: { id: true, month: true, payDate: true, processedAt: true } }, branch: { select: { name: true } } },
        orderBy: { cycle: { month: 'desc' } },
      }),
      this.prisma.payrollAdjustment.findMany({ where: { orgId: access.orgId, staffId: staff.id, cycleId: { not: null } }, select: { id: true, cycleId: true, direction: true, label: true, amount: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.payrollAdvance.findMany({
        where: { orgId: access.orgId, staffId: staff.id },
        include: { recoveries: { include: { cycle: { select: { month: true } } }, orderBy: { number: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return {
      profile: profile && { ...profile, rate: rupees(profile.rate) },
      payslips: entries.map((entry) => ({
        id: entry.id,
        reference: entry.payslipRef!,
        month: entry.cycle.month,
        payDate: isoDay(entry.cycle.payDate),
        branch: entry.branch?.name ?? null,
        quantity: entry.quantity,
        quantityNote: entry.quantityNote,
        gross: rupees(entry.gross),
        additions: rupees(entry.additions),
        deductions: rupees(entry.deductions),
        statutory: ((entry.statutory ?? []) as unknown as StatutoryLine[]).map((line) => ({ code: line.code, label: line.label, amount: line.amount / 100 })),
        advance: rupees(entry.advance),
        net: rupees(entry.net),
        // The additions and deductions that were approved into this run.
        adjustments: adjustments.filter((row) => row.cycleId === entry.cycle.id).map((row) => ({ id: row.id, direction: row.direction, label: row.label, amount: rupees(row.amount) })),
        paid: entry.paidAt ? { date: this.support.stamp(entry.paidAt).date, reference: entry.paymentRef } : null,
      })),
      // The administrator's internal notes are not included; the reason is shown only for a refusal.
      advances: advances.map((row) => {
        const recovered = row.recoveries.reduce((total, item) => total + item.amount, 0)
        return {
          id: row.id,
          reference: row.reference,
          category: row.category,
          principal: rupees(row.principal),
          installments: row.installments,
          startMonth: row.startMonth,
          status: row.status,
          method: row.method,
          disbursalDate: isoDay(row.disbursalDate),
          rejectionReason: row.status === 'rejected' ? row.decisionNote : null,
          requested: this.support.stamp(row.createdAt).date,
          approved: row.approvedAt ? this.support.stamp(row.approvedAt).date : null,
          disbursed: row.disbursedAt ? this.support.stamp(row.disbursedAt).date : null,
          acknowledged: row.acknowledgedAt ? this.support.stamp(row.acknowledgedAt).date : null,
          recoveries: row.recoveries.map((item) => ({ number: item.number, amount: rupees(item.amount), month: item.cycle.month })),
          recovered: rupees(recovered),
          outstanding: rupees(row.status === 'rejected' ? 0 : row.principal - recovered),
          version: row.version,
        }
      }),
    }
  }

  // The employee confirms they received an advance, which starts its recovery from pay. Only their own.
  async acknowledge(access: AccessContext, advanceId: string, actorUserId: string, version: number, client: ClientInfo) {
    const staff = await this.staffOf(access)
    const own = staff && (await this.prisma.payrollAdvance.findFirst({ where: { id: advanceId, orgId: access.orgId, staffId: staff.id }, select: { id: true } }))
    if (!own) throw notFound('Advance not found.')
    await this.adjustments.advanceAction(access, advanceId, actorUserId, { action: 'acknowledge', note: '', version }, client)
    return this.pay(access)
  }
}
