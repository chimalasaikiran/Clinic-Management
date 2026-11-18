import { Injectable } from '@nestjs/common'
import type { Db } from '../../database/prisma.service'
import type { PayrollCycle } from '../../generated/prisma/client'
import { addDays, zonedInstant } from '../scheduling/clinic-time'
import {
  attendanceNote, attendanceSummary, daysInMonth, dueInstalment, firstDay, lastDay, payslip, UNIT_LABELS,
  type Employment, type PayModel, type StatutoryLine, type StatutoryRules,
} from './payroll.logic'
import { PayrollSupport } from './payroll.support'

export interface PayLine {
  entryId: string
  staffId: string
  version: number
  included: boolean
  inScope: boolean
  status: 'ready' | 'needs_review' | 'on_hold'
  statusNote: string
  entered: number | null
  enteredReason: string | null
  branchId: string | null
  employment: Employment | null
  model: PayModel | null
  rate: number | null
  bankVerified: boolean
  // Paid days or units from the records (null when the model has no record source), and what is paid.
  derived: number | null
  quantity: number
  quantityNote: string
  gross: number
  additions: number
  deductions: number
  adjustmentIds: string[]
  statutory: StatutoryLine[]
  statutoryTotal: number
  advanceLines: Array<{ advanceId: string; number: number; amount: number }>
  advance: number
  net: number
  // What stops this line from being approved, when it is included in the run.
  issues: string[]
}

// Works out every line of an open cycle from the records as they are now: attendance for salaried staff,
// completed appointments for per-visit pay, the entered figure for shifts and hours, approved adjustments not yet
// paid, and the instalment due from each active advance.
@Injectable()
export class PayrollCalculator {
  constructor(private readonly support: PayrollSupport) {}

  async lines(db: Db, cycle: PayrollCycle, rules: StatutoryRules): Promise<PayLine[]> {
    const entries = await db.payrollEntry.findMany({
      where: { cycleId: cycle.id },
      include: { staff: { select: { id: true, membershipId: true, branches: { select: { branchId: true, isPrimary: true } }, payProfile: true } } },
      orderBy: { staff: { fullName: 'asc' } },
    })
    if (!entries.length) return []
    const staffIds = entries.map((entry) => entry.staffId)
    const from = firstDay(cycle.month)
    const to = lastDay(cycle.month)
    const membershipIds = entries.map((entry) => entry.staff.membershipId).filter((id): id is string => Boolean(id))

    const [attendance, practitioners, adjustments, advances] = await Promise.all([
      db.attendanceRecord.findMany({ where: { staffId: { in: staffIds }, date: { gte: new Date(from), lte: new Date(to) } }, select: { staffId: true, date: true, status: true } }),
      membershipIds.length ? db.practitioner.findMany({ where: { orgId: cycle.orgId, membershipId: { in: membershipIds } }, select: { id: true, membershipId: true } }) : Promise.resolve([]),
      db.payrollAdjustment.findMany({ where: { orgId: cycle.orgId, staffId: { in: staffIds }, status: 'approved', cycleId: null, month: { lte: cycle.month } }, orderBy: { createdAt: 'asc' } }),
      db.payrollAdvance.findMany({ where: { orgId: cycle.orgId, staffId: { in: staffIds }, status: 'active' }, include: { recoveries: { select: { number: true, amount: true } } }, orderBy: { createdAt: 'asc' } }),
    ])
    const visits = new Map<string, number>()
    if (practitioners.length) {
      const counts = await db.appointment.groupBy({
        by: ['practitionerId'],
        where: { orgId: cycle.orgId, practitionerId: { in: practitioners.map((row) => row.id) }, status: 'completed', startsAt: { gte: zonedInstant(from, 0, this.support.timeZone), lt: zonedInstant(addDays(to, 1), 0, this.support.timeZone) } },
        _count: { _all: true },
      })
      const membershipOf = new Map(practitioners.map((row) => [row.id, row.membershipId]))
      for (const row of counts) visits.set(membershipOf.get(row.practitionerId)!, row._count._all)
    }

    const days = daysInMonth(cycle.month)
    return entries.map((entry) => {
      const profile = entry.staff.payProfile?.active ? entry.staff.payProfile : null
      const branchId = (entry.staff.branches.find((link) => link.isPrimary) ?? entry.staff.branches[0])?.branchId ?? null
      let derived: number | null = null
      let note = ''
      if (profile?.model === 'monthly') {
        const summary = attendanceSummary(cycle.month, attendance.filter((row) => row.staffId === entry.staffId).map((row) => ({ date: row.date.toISOString().slice(0, 10), status: row.status })))
        derived = summary.paidDays
        note = attendanceNote(summary)
      } else if (profile?.model === 'visit') {
        derived = entry.staff.membershipId ? visits.get(entry.staff.membershipId) ?? 0 : 0
        note = entry.staff.membershipId ? `${derived} completed appointments` : 'No login linked, so no appointments to count'
      }
      const quantity = entry.entered ?? derived ?? 0
      const quantityNote = !profile ? 'No active pay profile'
        : entry.entered !== null ? `${entry.entered} ${UNIT_LABELS[profile.model]} entered${entry.enteredReason ? ` · ${entry.enteredReason}` : ''}${note ? ` (records: ${note})` : ''}`
          : profile.model === 'shift' || profile.model === 'hourly' ? `Enter the ${UNIT_LABELS[profile.model]} worked` : note

      const own = adjustments.filter((row) => row.staffId === entry.staffId)
      const advanceLines = advances.filter((row) => row.staffId === entry.staffId)
        .map((row) => dueInstalment({ id: row.id, status: row.status, principal: row.principal, installments: row.installments, startMonth: row.startMonth, recovered: row.recoveries }, cycle.month))
        .filter((line): line is NonNullable<typeof line> => line !== null)
      const slip = profile
        ? payslip({ model: profile.model, employment: profile.employment, rate: profile.rate, quantity, days, adjustments: own, advances: advanceLines, rules })
        : { gross: 0, additions: 0, deductions: 0, statutory: [], statutoryTotal: 0, advance: 0, net: 0 }
      const inScope = Boolean(profile)
        && (!cycle.scopeBranchIds.length || (branchId !== null && cycle.scopeBranchIds.includes(branchId)))
        && (!cycle.scopeEmployment.length || cycle.scopeEmployment.includes(profile!.employment))

      const issues: string[] = []
      if (!profile) issues.push('No active pay profile')
      else {
        if (!profile.bankVerified) issues.push('Bank details not verified')
        if ((profile.model === 'shift' || profile.model === 'hourly') && entry.entered === null) issues.push(`Enter the ${UNIT_LABELS[profile.model]} worked`)
        if (slip.net < 0) issues.push('Deductions are more than the pay')
      }
      if (entry.status !== 'ready') issues.push(entry.status === 'on_hold' ? 'On hold' : 'Not marked ready')

      return {
        entryId: entry.id, staffId: entry.staffId, version: entry.version, included: entry.included, inScope, status: entry.status, statusNote: entry.statusNote,
        entered: entry.entered, enteredReason: entry.enteredReason, branchId, employment: profile?.employment ?? null, model: profile?.model ?? null, rate: profile?.rate ?? null,
        bankVerified: profile?.bankVerified ?? false, derived, quantity, quantityNote, ...slip, adjustmentIds: own.map((row) => row.id), advanceLines, issues,
      }
    })
  }
}

// The lines a run pays: included and inside its branch and employment scope.
export const paid = (lines: PayLine[]) => lines.filter((line) => line.included && line.inScope)
