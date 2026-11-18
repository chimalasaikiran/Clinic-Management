import { Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import { CyclesService } from './cycles.service'
import { PayrollCalculator, type PayLine } from './payroll.calculator'
import type { PtSlab, StatutoryLine } from './payroll.logic'
import { PayrollSupport } from './payroll.support'

const rupees = (paise: number | null) => (paise === null ? null : paise / 100)
const isoDay = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null)
const name = { select: { fullName: true } } as const
const ACTIVITY_LIMIT = 40

const lineView = (line: PayLine) => ({
  ...line,
  rate: rupees(line.rate), gross: rupees(line.gross), additions: rupees(line.additions), deductions: rupees(line.deductions), statutoryTotal: rupees(line.statutoryTotal),
  advance: rupees(line.advance), net: rupees(line.net),
  statutory: line.statutory.map((entry) => ({ ...entry, amount: rupees(entry.amount) })),
  advanceLines: line.advanceLines.map((entry) => ({ ...entry, amount: rupees(entry.amount) })),
})

// Payroll as one read: rules, staff and their pay profiles, the open run with every line worked out from the
// records, processed runs with their payslips, adjustments, advances and recent activity. Amounts are rupees.
@Injectable()
export class PayrollStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PayrollSupport,
    private readonly calculator: PayrollCalculator,
    private readonly cycles: CyclesService,
  ) {}

  async state(access: AccessContext) {
    const orgId = access.orgId
    const [rules, branches, staff, open, processed, adjustments, advances, events] = await Promise.all([
      this.support.rules(orgId),
      this.prisma.branch.findMany({ where: { orgId, status: 'active' }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
      this.prisma.staffMember.findMany({
        where: { orgId, status: { not: 'draft' } },
        select: { id: true, staffCode: true, fullName: true, designation: true, department: true, status: true, branches: { select: { branchId: true, isPrimary: true } }, payProfile: { include: { bankVerifiedBy: name } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.payrollCycle.findFirst({ where: { orgId, status: { not: 'processed' } }, include: { createdBy: name, approvedBy: name } }),
      this.prisma.payrollCycle.findMany({ where: { orgId, status: 'processed' }, include: { approvedBy: name, processedBy: name, entries: { where: { payslipRef: { not: null } }, include: { staff: { select: { fullName: true, staffCode: true } }, paidBy: name } } }, orderBy: { month: 'desc' } }),
      this.prisma.payrollAdjustment.findMany({ where: { orgId }, include: { requestedBy: name, decidedBy: name, cycle: { select: { month: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payrollAdvance.findMany({ where: { orgId }, include: { createdBy: name, approvedBy: name, recoveries: { include: { cycle: { select: { month: true } } }, orderBy: { number: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payrollEvent.findMany({ where: { orgId }, include: { actor: name }, orderBy: { createdAt: 'desc' }, take: ACTIVITY_LIMIT }),
    ])

    let cycle = null
    if (open) {
      const lines = await this.calculator.lines(this.prisma, open, rules)
      cycle = {
        id: open.id, reference: open.reference, month: open.month, status: open.status, payDate: isoDay(open.payDate), version: open.version,
        scope: { branchIds: open.scopeBranchIds, employment: open.scopeEmployment },
        createdBy: open.createdBy.fullName, created: this.support.stamp(open.createdAt),
        approvedBy: open.approvedBy?.fullName ?? null, approved: open.approvedAt ? this.support.stamp(open.approvedAt) : null,
        lines: lines.map(lineView),
        blockers: open.status === 'draft' ? await this.cycles.blockers(this.prisma, open, lines) : [],
      }
    }

    return {
      today: this.support.today(),
      settings: {
        epfEnabled: rules.epfEnabled, epfRate: rules.epfRateBp / 100, epfCap: rupees(rules.epfCap), esicEnabled: rules.esicEnabled, esicRate: rules.esicRateBp / 100, esicCeiling: rupees(rules.esicCeiling),
        ptEnabled: rules.ptEnabled, ptState: rules.ptState, ptSlabs: rules.ptSlabs.map((slab: PtSlab) => ({ above: rupees(slab.above), amount: rupees(slab.amount) })),
        tdsEnabled: rules.tdsEnabled, tdsRate: rules.tdsRateBp / 100, payDay: rules.payDay, version: rules.version,
      },
      branches,
      staff: staff.map((row) => ({
        id: row.id, staffCode: row.staffCode, name: row.fullName, designation: row.designation, department: row.department, status: row.status,
        branchId: (row.branches.find((link) => link.isPrimary) ?? row.branches[0])?.branchId ?? null,
        profile: row.payProfile && {
          id: row.payProfile.id, employment: row.payProfile.employment, model: row.payProfile.model, rate: rupees(row.payProfile.rate), bankName: row.payProfile.bankName, ifsc: row.payProfile.ifsc,
          accountLast4: row.payProfile.accountLast4, bankVerified: row.payProfile.bankVerified, bankVerifiedBy: row.payProfile.bankVerifiedBy?.fullName ?? null,
          active: row.payProfile.active, version: row.payProfile.version,
        },
      })),
      cycle,
      history: processed.map((row) => ({
        id: row.id, reference: row.reference, month: row.month, payDate: isoDay(row.payDate),
        approvedBy: row.approvedBy?.fullName ?? null, approved: row.approvedAt ? this.support.stamp(row.approvedAt) : null,
        processedBy: row.processedBy?.fullName ?? null, processed: this.support.stamp(row.processedAt!),
        staff: row.staffCount, gross: rupees(row.gross), additions: rupees(row.additions), deductions: rupees(row.deductions), statutory: rupees(row.statutory), advances: rupees(row.advances), net: rupees(row.net),
        payslips: row.entries.map((entry) => ({
          entryId: entry.id, payslipRef: entry.payslipRef, staffId: entry.staffId, name: entry.staff.fullName, staffCode: entry.staff.staffCode, branchId: entry.branchId,
          employment: entry.employment, model: entry.model, rate: rupees(entry.rate), quantity: entry.quantity, quantityNote: entry.quantityNote,
          gross: rupees(entry.gross), additions: rupees(entry.additions), deductions: rupees(entry.deductions),
          statutory: ((entry.statutory ?? []) as unknown as StatutoryLine[]).map((line) => ({ ...line, amount: line.amount / 100 })), advance: rupees(entry.advance), net: rupees(entry.net),
          paymentRef: entry.paymentRef, paid: entry.paidAt ? this.support.stamp(entry.paidAt) : null, paidBy: entry.paidBy?.fullName ?? null, version: entry.version,
        })),
      })),
      adjustments: adjustments.map((row) => ({
        id: row.id, reference: row.reference, staffId: row.staffId, month: row.month, direction: row.direction, category: row.category, label: row.label, amount: rupees(row.amount), reason: row.reason,
        documentRef: row.documentRef, status: row.status, requestedBy: row.requestedBy.fullName, requested: this.support.stamp(row.createdAt), decidedBy: row.decidedBy?.fullName ?? null,
        decided: row.decidedAt ? this.support.stamp(row.decidedAt) : null, comment: row.comment, appliedIn: row.cycle?.month ?? null, version: row.version,
      })),
      advances: advances.map((row) => {
        const recovered = row.recoveries.reduce((total, entry) => total + entry.amount, 0)
        return {
          id: row.id, reference: row.reference, staffId: row.staffId, principal: rupees(row.principal), installments: row.installments, startMonth: row.startMonth, source: row.source, category: row.category,
          method: row.method, disbursalDate: isoDay(row.disbursalDate), notes: row.notes, status: row.status, decisionNote: row.decisionNote,
          createdBy: row.createdBy.fullName, created: this.support.stamp(row.createdAt), approvedBy: row.approvedBy?.fullName ?? null,
          disbursed: row.disbursedAt ? this.support.stamp(row.disbursedAt) : null, acknowledged: row.acknowledgedAt ? this.support.stamp(row.acknowledgedAt) : null,
          recoveries: row.recoveries.map((entry) => ({ number: entry.number, amount: rupees(entry.amount), month: entry.cycle.month })),
          recovered: rupees(recovered), outstanding: rupees(row.status === 'rejected' ? 0 : row.principal - recovered), version: row.version,
        }
      }),
      activity: events.map((row) => ({ id: row.id, action: row.action, note: row.note, actor: row.actor?.fullName ?? 'System', at: this.support.stamp(row.createdAt) })),
    }
  }
}
