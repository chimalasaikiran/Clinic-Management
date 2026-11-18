import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { PayrollCycle, Prisma } from '../../generated/prisma/client'
import { paid, PayLine, PayrollCalculator } from './payroll.calculator'
import { attendanceSummary, firstDay, lastDay, payDateFor, UNIT_LABELS } from './payroll.logic'
import type { EntryInput, ScopeInput } from './payroll.schemas'
import { PayrollSupport } from './payroll.support'

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`
const sum = (lines: PayLine[], pick: (line: PayLine) => number) => lines.reduce((total, line) => total + pick(line), 0)

// A monthly payroll run: draft → approved → processed, then each payment's bank reference is recorded.
// While the run is open every figure is worked out again from the records; processing fixes the payslips.
@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PayrollSupport,
    private readonly calculator: PayrollCalculator,
    private readonly audit: AuditService,
  ) {}

  async start(access: AccessContext, actorUserId: string, month: string, client: ClientInfo) {
    if (month > this.support.today().slice(0, 7)) throw unprocessable('MONTH_IN_FUTURE', 'A payroll run can only be started for the current month or an earlier one.')
    const rules = await this.support.rules(access.orgId)
    try {
      return await this.prisma.transaction(async (tx) => {
        const open = await this.support.lockOpenCycle(tx, access.orgId)
        if (open) throw conflict('CYCLE_OPEN', `The ${open.month} run is still open. Process it before starting another.`)
        const cycle = await tx.payrollCycle.create({
          data: { orgId: access.orgId, month, reference: `PAY-${month}`, payDate: new Date(payDateFor(month, rules.payDay)), createdById: actorUserId },
          select: { id: true },
        })
        const staff = await tx.staffMember.findMany({ where: { orgId: access.orgId, status: 'active', payProfile: { is: { active: true } } }, select: { id: true, payProfile: { select: { model: true } } } })
        const monthly = staff.filter((row) => row.payProfile!.model === 'monthly').map((row) => row.id)
        const attendance = monthly.length
          ? await tx.attendanceRecord.findMany({ where: { staffId: { in: monthly }, date: { gte: new Date(firstDay(month)), lte: new Date(lastDay(month)) } }, select: { staffId: true, date: true, status: true } })
          : []
        // Lines start ready unless something needs a person's eye: leave or absences to confirm, or units to enter.
        await tx.payrollEntry.createMany({
          data: staff.map((row) => {
            const model = row.payProfile!.model
            if (model === 'shift' || model === 'hourly') return { cycleId: cycle.id, staffId: row.id, status: 'needs_review' as const, statusNote: `Enter the ${UNIT_LABELS[model]} worked` }
            if (model === 'monthly') {
              const summary = attendanceSummary(month, attendance.filter((record) => record.staffId === row.id).map((record) => ({ date: record.date.toISOString().slice(0, 10), status: record.status })))
              const toConfirm = [summary.leave && `${summary.leave} days leave`, summary.absent && `${summary.absent} days absent`].filter(Boolean)
              if (toConfirm.length) return { cycleId: cycle.id, staffId: row.id, status: 'needs_review' as const, statusNote: `Confirm ${toConfirm.join(' and ')}` }
            }
            return { cycleId: cycle.id, staffId: row.id }
          }),
        })
        await this.support.event(tx, access.orgId, 'cycle', cycle.id, 'Payroll run started', actorUserId, `${month} · ${staff.length} staff with a pay profile`)
        await this.audit.record({ action: 'payroll.cycle.started', entityType: 'payroll_cycle', entityId: cycle.id, orgId: access.orgId, actorUserId, details: { month } }, client, tx)
        return cycle.id
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('CYCLE_EXISTS', `A payroll run for ${month} already exists.`)
      throw error
    }
  }

  async setScope(access: AccessContext, id: string, actorUserId: string, input: ScopeInput, client: ClientInfo) {
    if (input.branchIds.length) {
      const found = await this.prisma.branch.count({ where: { orgId: access.orgId, id: { in: input.branchIds } } })
      if (found !== new Set(input.branchIds).size) throw notFound('One of the branches was not found.')
    }
    await this.prisma.transaction(async (tx) => {
      const cycle = await this.support.lockCycle(tx, access.orgId, id)
      this.support.editable(cycle)
      if (cycle.version !== input.version) throw conflict('STALE_RECORD', 'This payroll run was changed by someone else. Reload it and try again.')
      await tx.payrollCycle.update({ where: { id }, data: { scopeBranchIds: input.branchIds, scopeEmployment: input.employment, ...this.backToDraft(cycle), version: { increment: 1 } } })
      await this.support.event(tx, access.orgId, 'cycle', id, 'Run scope changed', actorUserId, `${input.branchIds.length || 'All'} branches · ${input.employment.length ? input.employment.join(', ').replaceAll('_', ' ') : 'all employment types'}`)
      await this.audit.record({ action: 'payroll.cycle.scoped', entityType: 'payroll_cycle', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
  }

  async updateEntry(access: AccessContext, id: string, actorUserId: string, input: EntryInput, client: ClientInfo) {
    const entry = await this.prisma.payrollEntry.findFirst({ where: { id, cycle: { orgId: access.orgId } }, include: { staff: { select: { fullName: true, payProfile: { select: { model: true } } } } } })
    if (!entry) throw notFound('Payroll line not found.')
    const model = entry.staff.payProfile?.model
    const data: Prisma.PayrollEntryUpdateInput = {}
    const notes: string[] = []
    if (input.entered !== undefined) {
      const reason = input.enteredReason?.trim() ?? ''
      // A figure from the records is only replaced with a reason; shifts and hours have no record to replace.
      if (input.entered !== null && (model === 'monthly' || model === 'visit') && reason.length < 3) throw unprocessable('REASON_REQUIRED', 'Give the reason for changing the figure from the records.')
      data.entered = input.entered
      data.enteredReason = input.entered === null ? null : reason || null
      notes.push(input.entered === null ? 'Figure from the records restored' : `${input.entered} ${model ? UNIT_LABELS[model] : 'units'} entered${reason ? ` · ${reason}` : ''}`)
    }
    if (input.status !== undefined) {
      data.status = input.status
      data.statusNote = input.statusNote ?? (input.status === 'ready' ? '' : entry.statusNote)
      notes.push(`Marked ${input.status.replace('_', ' ')}${input.statusNote ? ` · ${input.statusNote}` : ''}`)
    } else if (input.statusNote !== undefined) data.statusNote = input.statusNote
    await this.prisma.transaction(async (tx) => {
      const cycle = await this.support.lockCycle(tx, access.orgId, entry.cycleId)
      this.support.editable(cycle)
      const updated = await tx.payrollEntry.updateMany({ where: { id, version: input.version }, data: { ...(data as Prisma.PayrollEntryUpdateManyMutationInput), version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', `${entry.staff.fullName}'s line was changed by someone else. Reload it and try again.`)
      if (cycle.status === 'approved') await this.withdraw(tx, cycle, actorUserId, `${entry.staff.fullName}'s line changed`)
      await this.support.event(tx, access.orgId, 'entry', id, 'Payroll line updated', actorUserId, `${entry.staff.fullName} · ${notes.join(' · ')}`)
      await this.audit.record({ action: 'payroll.entry.updated', entityType: 'payroll_entry', entityId: id, orgId: access.orgId, actorUserId, details: { fields: Object.keys(data) } }, client, tx)
    })
  }

  async include(access: AccessContext, id: string, actorUserId: string, entryIds: string[], included: boolean, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const cycle = await this.support.lockCycle(tx, access.orgId, id)
      this.support.editable(cycle)
      const updated = await tx.payrollEntry.updateMany({ where: { cycleId: id, id: { in: entryIds } }, data: { included, version: { increment: 1 } } })
      if (updated.count !== new Set(entryIds).size) throw notFound('One of the payroll lines was not found in this run.')
      if (cycle.status === 'approved') await this.withdraw(tx, cycle, actorUserId, 'Staff included or excluded')
      await this.support.event(tx, access.orgId, 'cycle', id, `${updated.count} staff ${included ? 'included in' : 'excluded from'} the run`, actorUserId)
      await this.audit.record({ action: 'payroll.cycle.included', entityType: 'payroll_cycle', entityId: id, orgId: access.orgId, actorUserId, details: { count: updated.count, included } }, client, tx)
    })
  }

  // What must be resolved before the run can be approved, worked out from the records as they are now.
  async blockers(db: PrismaService | Tx, cycle: PayrollCycle, lines: PayLine[]) {
    const payable = paid(lines)
    const blockers = payable.filter((line) => line.issues.length).length
      ? [...new Set(payable.flatMap((line) => line.issues))].map((issue) => `${payable.filter((line) => line.issues.includes(issue)).length} included staff · ${issue.toLowerCase()}`)
      : []
    const pending = await db.payrollAdjustment.count({ where: { orgId: cycle.orgId, status: 'pending', month: { lte: cycle.month }, staffId: { in: payable.map((line) => line.staffId) } } })
    if (pending) blockers.push(`${pending} adjustment${pending === 1 ? '' : 's'} awaiting approval`)
    if (!payable.length) blockers.push('No staff are included in this run')
    return blockers
  }

  async approve(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const cycle = await this.support.lockCycle(tx, access.orgId, id)
      if (cycle.status !== 'draft') throw conflict('CYCLE_NOT_DRAFT', cycle.status === 'approved' ? 'This run is already approved.' : 'This run has been processed.')
      if (cycle.version !== version) throw conflict('STALE_RECORD', 'This payroll run was changed by someone else. Reload it and try again.')
      const lines = paid(await this.calculator.lines(tx, cycle, await this.support.rules(access.orgId, tx)))
      const blockers = await this.blockers(tx, cycle, lines)
      if (blockers.length) throw conflict('RUN_BLOCKED', 'Resolve these before approving the run.', blockers.map((issue) => ({ issue })))
      // The approved figures are kept, so processing can tell whether the records changed in between.
      await tx.payrollCycle.update({ where: { id }, data: { status: 'approved', approvedById: actorUserId, approvedAt: new Date(), gross: sum(lines, (line) => line.gross), net: sum(lines, (line) => line.net), staffCount: lines.length, version: { increment: 1 } } })
      await this.support.event(tx, access.orgId, 'cycle', id, 'Payroll run approved', actorUserId, `${lines.length} staff · net ${inr(sum(lines, (line) => line.net))}`)
      await this.audit.record({ action: 'payroll.cycle.approved', entityType: 'payroll_cycle', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
  }

  async process(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    const outcome = await this.prisma.transaction(async (tx) => {
      const cycle = await this.support.lockCycle(tx, access.orgId, id)
      if (cycle.status !== 'approved') throw conflict('CYCLE_NOT_APPROVED', cycle.status === 'processed' ? 'This run has already been processed.' : 'Approve the run before processing it.')
      if (cycle.version !== version) throw conflict('STALE_RECORD', 'This payroll run was changed by someone else. Reload it and try again.')
      const lines = paid(await this.calculator.lines(tx, cycle, await this.support.rules(access.orgId, tx)))
      const blockers = await this.blockers(tx, cycle, lines)
      const net = sum(lines, (line) => line.net)
      if (blockers.length || lines.length !== cycle.staffCount || net !== cycle.net || sum(lines, (line) => line.gross) !== cycle.gross) {
        // The withdrawal is kept (the transaction commits) and the error is raised afterwards.
        await this.withdraw(tx, cycle, actorUserId, 'The records changed after approval')
        return { changed: true as const }
      }

      const references = await this.support.references(tx, access.orgId, 'payslip_reference', 'PSL-', lines.length)
      for (const [index, line] of lines.entries()) {
        await tx.payrollEntry.update({
          where: { id: line.entryId },
          data: {
            payslipRef: references[index], branchId: line.branchId, employment: line.employment, model: line.model, rate: line.rate,
            quantity: line.quantity, quantityNote: line.quantityNote.slice(0, 300), gross: line.gross, additions: line.additions, deductions: line.deductions,
            statutory: line.statutory as unknown as Prisma.InputJsonValue, advance: line.advance, net: line.net, version: { increment: 1 },
          },
        })
        if (line.adjustmentIds.length) await tx.payrollAdjustment.updateMany({ where: { id: { in: line.adjustmentIds }, status: 'approved', cycleId: null }, data: { cycleId: id } })
        for (const recovery of line.advanceLines) {
          await tx.advanceRecovery.create({ data: { advanceId: recovery.advanceId, cycleId: id, entryId: line.entryId, number: recovery.number, amount: recovery.amount } })
          const advance = await tx.payrollAdvance.findUniqueOrThrow({ where: { id: recovery.advanceId }, select: { installments: true, reference: true } })
          if (recovery.number === advance.installments) {
            await tx.payrollAdvance.update({ where: { id: recovery.advanceId }, data: { status: 'settled', version: { increment: 1 } } })
            await this.support.event(tx, access.orgId, 'advance', recovery.advanceId, 'Advance settled', null, `Last instalment recovered in ${cycle.month}`)
          }
        }
      }
      const totals = {
        staffCount: lines.length, gross: sum(lines, (line) => line.gross), additions: sum(lines, (line) => line.additions), deductions: sum(lines, (line) => line.deductions),
        statutory: sum(lines, (line) => line.statutoryTotal), advances: sum(lines, (line) => line.advance), net,
      }
      await tx.payrollCycle.update({ where: { id }, data: { status: 'processed', processedById: actorUserId, processedAt: new Date(), ...totals, version: { increment: 1 } } })
      await this.support.event(tx, access.orgId, 'cycle', id, 'Payroll run processed', actorUserId, `${lines.length} payslips · net ${inr(net)}`)
      await this.audit.record({ action: 'payroll.cycle.processed', entityType: 'payroll_cycle', entityId: id, orgId: access.orgId, actorUserId, details: totals }, client, tx)
      return { changed: false as const, payslips: lines.length }
    })
    if (outcome.changed) throw conflict('RUN_CHANGED', 'Attendance, appointments or adjustments changed after the run was approved. Review the figures and approve it again.')
    return { payslips: outcome.payslips }
  }

  async recordPayment(access: AccessContext, entryId: string, actorUserId: string, input: { reference: string; version: number }, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const entry = await tx.payrollEntry.findFirst({ where: { id: entryId, cycle: { orgId: access.orgId } }, include: { cycle: { select: { status: true } }, staff: { select: { fullName: true } } } })
      if (!entry) throw notFound('Payslip not found.')
      if (entry.cycle.status !== 'processed' || !entry.payslipRef) throw conflict('NOT_A_PAYSLIP', 'Payments are recorded against payslips of a processed run.')
      if (entry.paymentRef) throw conflict('PAYMENT_RECORDED', `A payment is already recorded for ${entry.staff.fullName}: ${entry.paymentRef}.`)
      const updated = await tx.payrollEntry.updateMany({ where: { id: entryId, version: input.version, paymentRef: null }, data: { paymentRef: input.reference, paidAt: new Date(), paidById: actorUserId, version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This payslip was changed by someone else. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'entry', entryId, 'Salary payment recorded', actorUserId, `${entry.staff.fullName} · ${entry.payslipRef} · ${input.reference}`)
      await this.audit.record({ action: 'payroll.payment.recorded', entityType: 'payroll_entry', entityId: entryId, orgId: access.orgId, actorUserId, details: { reference: input.reference } }, client, tx)
    })
  }

  private backToDraft(cycle: PayrollCycle) {
    return cycle.status === 'approved' ? { status: 'draft' as const, approvedById: null, approvedAt: null } : {}
  }

  private async withdraw(tx: Tx, cycle: PayrollCycle, actorUserId: string, why: string) {
    await tx.payrollCycle.update({ where: { id: cycle.id }, data: { status: 'draft', approvedById: null, approvedAt: null, version: { increment: 1 } } })
    await this.support.event(tx, cycle.orgId, 'cycle', cycle.id, 'Approval withdrawn', actorUserId, why)
  }
}
