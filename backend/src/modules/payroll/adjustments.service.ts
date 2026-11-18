import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import { installmentAmount } from './payroll.logic'
import type { AdjustmentInput, AdvanceActionInput, AdvanceInput } from './payroll.schemas'
import { PayrollSupport } from './payroll.support'

// An advance may not exceed this multiple of monthly gross, and one instalment this share of it.
export const ADVANCE_LIMIT_MULTIPLE = 2
export const RECOVERY_CAP_BP = 3500

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

// The next step of an advance and the status it moves from.
const STEPS = {
  approve: { from: 'pending_approval', to: 'pending_disbursal', action: 'Advance approved' },
  reject: { from: 'pending_approval', to: 'rejected', action: 'Advance rejected' },
  disburse: { from: 'pending_disbursal', to: 'awaiting_acknowledgement', action: 'Advance disbursed' },
  acknowledge: { from: 'awaiting_acknowledgement', to: 'active', action: 'Advance acknowledged · recovery starts' },
} as const

// Payroll adjustments (approved before they are paid) and salary advances (recovered from payslips once active).
@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PayrollSupport,
    private readonly audit: AuditService,
  ) {}

  async createAdjustment(access: AccessContext, actorUserId: string, input: AdjustmentInput, client: ClientInfo) {
    const staff = await this.payable(access.orgId, input.staffId)
    return this.prisma.transaction(async (tx) => {
      const reference = await this.support.reference(tx, access.orgId, 'pay_adjustment_reference', 'PAD-')
      const row = await tx.payrollAdjustment.create({
        data: { orgId: access.orgId, reference, staffId: staff.id, month: input.month, direction: input.direction, category: input.category, label: input.label || input.category, amount: input.amount, reason: input.reason, documentRef: input.documentRef, requestedById: actorUserId },
        select: { id: true },
      })
      await this.support.event(tx, access.orgId, 'adjustment', row.id, `Adjustment logged (${input.direction === 'addition' ? '+' : '−'}${inr(input.amount)})`, actorUserId, `${reference} · ${staff.fullName} · ${input.month}`)
      await this.support.reopen(tx, access.orgId, actorUserId, `${reference} awaits approval`)
      await this.audit.record({ action: 'payroll.adjustment.created', entityType: 'payroll_adjustment', entityId: row.id, orgId: access.orgId, actorUserId, details: { reference, amount: input.amount } }, client, tx)
      return { id: row.id, reference }
    })
  }

  async decideAdjustments(access: AccessContext, actorUserId: string, input: { ids: string[]; decision: 'approved' | 'rejected'; comment: string }, client: ClientInfo) {
    const ids = [...new Set(input.ids)]
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.payrollAdjustment.updateMany({
        where: { orgId: access.orgId, id: { in: ids }, status: 'pending' },
        data: { status: input.decision, decidedById: actorUserId, decidedAt: new Date(), comment: input.comment || null, version: { increment: 1 } },
      })
      if (updated.count !== ids.length) throw conflict('ADJUSTMENT_DECIDED', 'One of these adjustments was already decided or not found. Reload and try again.')
      const rows = await tx.payrollAdjustment.findMany({ where: { id: { in: ids } }, select: { id: true, reference: true } })
      for (const row of rows) await this.support.event(tx, access.orgId, 'adjustment', row.id, `Adjustment ${input.decision}`, actorUserId, input.comment)
      await this.support.reopen(tx, access.orgId, actorUserId, `${ids.length} adjustment${ids.length === 1 ? '' : 's'} ${input.decision}`)
      await this.audit.record({ action: `payroll.adjustment.${input.decision}`, entityType: 'payroll_adjustment', entityId: ids[0]!, orgId: access.orgId, actorUserId, details: { references: rows.map((row) => row.reference) } }, client, tx)
    })
  }

  // The limit base: the contract rate for salaried staff, the latest processed gross for everyone else.
  async monthlyBase(orgId: string, staffId: string, db: PrismaService | Tx = this.prisma) {
    const profile = await db.payProfile.findFirst({ where: { orgId, staffId, active: true }, select: { model: true, rate: true } })
    if (!profile) return null
    if (profile.model === 'monthly') return profile.rate
    const last = await db.payrollEntry.findFirst({ where: { staffId, payslipRef: { not: null }, cycle: { orgId } }, orderBy: { cycle: { month: 'desc' } }, select: { gross: true } })
    return last?.gross ?? null
  }

  async createAdvance(access: AccessContext, actorUserId: string, input: AdvanceInput, client: ClientInfo) {
    const staff = await this.payable(access.orgId, input.staffId)
    const adminCreated = input.source === 'Admin created'
    if (adminCreated && (!input.method || !input.disbursalDate)) throw unprocessable('DISBURSAL_REQUIRED', 'Choose the disbursal method and date.')
    return this.prisma.transaction(async (tx) => {
      // Serialises advances for one person, so two cannot both pass the limit.
      await tx.$queryRaw`select id from pay_profiles where staff_id = ${staff.id}::uuid for update`
      const base = await this.monthlyBase(access.orgId, staff.id, tx)
      if (!base) throw unprocessable('NO_PAY_BASE', `${staff.fullName} has no processed payslip yet, so there is no monthly pay to set an advance limit against.`)
      const open = await tx.payrollAdvance.findMany({ where: { orgId: access.orgId, staffId: staff.id, status: { notIn: ['settled', 'rejected'] } }, include: { recoveries: { select: { amount: true } } } })
      const outstanding = open.reduce((total, row) => total + row.principal - row.recoveries.reduce((sum, entry) => sum + entry.amount, 0), 0)
      const available = Math.max(base * ADVANCE_LIMIT_MULTIPLE - outstanding, 0)
      if (input.principal > available) throw unprocessable('ADVANCE_OVER_LIMIT', `Exceeds the available limit of ${inr(available)}.`)
      if (installmentAmount(input.principal, input.installments, 1) > Math.round((base * RECOVERY_CAP_BP) / 10_000)) {
        throw unprocessable('INSTALMENT_OVER_CAP', `Each instalment must stay under ${RECOVERY_CAP_BP / 100}% of monthly gross. Spread it over more months.`)
      }
      const reference = await this.support.reference(tx, access.orgId, 'advance_reference', 'ADV-')
      const row = await tx.payrollAdvance.create({
        data: {
          orgId: access.orgId, reference, staffId: staff.id, principal: input.principal, installments: input.installments, startMonth: input.startMonth, source: input.source, category: input.category,
          method: input.method, disbursalDate: input.disbursalDate ? new Date(input.disbursalDate) : null, notes: input.notes, createdById: actorUserId,
          // An advance the administrator raises is approved by raising it; an employee's request waits for a decision.
          status: adminCreated ? 'pending_disbursal' : 'pending_approval', ...(adminCreated && { approvedById: actorUserId, approvedAt: new Date() }),
        },
        select: { id: true },
      })
      await this.support.event(tx, access.orgId, 'advance', row.id, adminCreated ? `Employee advance created (${inr(input.principal)})` : `Advance requested (${inr(input.principal)})`, actorUserId, `${reference} · ${staff.fullName} · ${input.installments} instalments from ${input.startMonth}`)
      await this.audit.record({ action: 'payroll.advance.created', entityType: 'payroll_advance', entityId: row.id, orgId: access.orgId, actorUserId, details: { reference, principal: input.principal } }, client, tx)
      return { id: row.id, reference }
    })
  }

  async advanceAction(access: AccessContext, id: string, actorUserId: string, input: AdvanceActionInput, client: ClientInfo) {
    const step = STEPS[input.action]
    await this.prisma.transaction(async (tx) => {
      const current = await tx.payrollAdvance.findFirst({ where: { id, orgId: access.orgId }, include: { staff: { select: { fullName: true } } } })
      if (!current) throw notFound('Advance not found.')
      if (current.status !== step.from) throw conflict('ADVANCE_STATUS', `This advance is ${current.status.replaceAll('_', ' ')}, so it cannot be ${input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : input.action === 'disburse' ? 'disbursed' : 'acknowledged'}.`)
      const updated = await tx.payrollAdvance.updateMany({
        where: { id, version: input.version, status: step.from },
        data: {
          status: step.to, version: { increment: 1 },
          ...(input.action === 'approve' && { approvedById: actorUserId, approvedAt: new Date(), decisionNote: input.note || null }),
          ...(input.action === 'reject' && { decisionNote: input.note }),
          ...(input.action === 'disburse' && { disbursedAt: new Date() }),
          ...(input.action === 'acknowledge' && { acknowledgedAt: new Date() }),
        },
      })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This advance was changed by someone else. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'advance', id, step.action, actorUserId, `${current.reference} · ${current.staff.fullName}${input.note ? ` · ${input.note}` : ''}`)
      // An advance that becomes active is recovered from the open run.
      if (input.action === 'acknowledge') await this.support.reopen(tx, access.orgId, actorUserId, `${current.reference} is now recovered from pay`)
      await this.audit.record({ action: `payroll.advance.${input.action}`, entityType: 'payroll_advance', entityId: id, orgId: access.orgId, actorUserId, details: { reference: current.reference } }, client, tx)
    })
  }

  private async payable(orgId: string, staffId: string) {
    const staff = await this.prisma.staffMember.findFirst({ where: { id: staffId, orgId }, select: { id: true, fullName: true, payProfile: { select: { active: true } } } })
    if (!staff) throw notFound('Staff member not found.')
    if (!staff.payProfile?.active) throw unprocessable('NO_PAY_PROFILE', `${staff.fullName} has no active pay profile.`)
    return staff
  }
}
