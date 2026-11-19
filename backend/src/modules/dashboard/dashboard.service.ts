import { Inject, Injectable } from '@nestjs/common'
import { badRequest, forbidden, notFound } from '../../common/errors/app-error'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { PAYMENT_CHANNELS } from '../billing/billing.constants'
import { rupees, toPaise } from '../billing/money'
import { addDays, localDate, localMinute, zonedInstant } from '../scheduling/clinic-time'
import {
  change, collections, meanWait, noShowRate, notRebooked, outstanding, lowStock, presenceOf, sessions, setupSteps, tally, team,
  type DayAppointment, type Presence, type TeamMember,
} from './dashboard.logic'

// How far back the dashboard can be opened. Older days belong to the reports.
export const DASHBOARD_DAYS = 7

// Audit actions shown under Recent activity. Sign-ins, settings and role changes stay in the audit log only.
export const ACTIVITY_ACTIONS = [
  'billing.payment.recorded', 'billing.refund.processed', 'appointment.booked', 'appointment.checkIn', 'appointment.complete',
  'appointment.cancel', 'appointment.noShow', 'patient.registered', 'pharmacy.dispensed', 'prescription.signed', 'order.resulted',
  'order.reviewed', 'encounter.signed', 'staff.attendance_recorded', 'inventory.receipt.posted', 'payroll.cycle.processed',
]
const ACTIVITY_LIMIT = 8

const ATTENDANCE_RANK: Presence[] = ['present', 'late', 'absent', 'leave', 'unavailable']

// The owner dashboard: one clinic-local day across the branches the person's roles cover. Each section is
// included only when the person holds the permission for the records behind it, otherwise it is null.
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async overview(access: AccessContext, query: { date?: string; branchId?: string }) {
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(new Date(), zone)
    const date = query.date ?? today
    if (date > today) throw badRequest('DATE_IN_FUTURE', 'The dashboard shows today or an earlier day.')
    if (date < addDays(today, -(DASHBOARD_DAYS - 1))) throw badRequest('DATE_TOO_OLD', `The dashboard covers the last ${DASHBOARD_DAYS} days. Use the reports for earlier days.`)

    const { permitted, branchIds } = await this.scope(access, query.branchId)
    const can = (permission: string) => access.permissions.has(permission)
    const orgWide = access.branchScope === 'all'
    const isToday = date === today
    const window = { gte: zonedInstant(date, 0, zone), lt: zonedInstant(addDays(date, 1), 0, zone) }

    const [appointments, payments, invoices, orders, stock, people, approvals, reconciliation, activity, setup] = await Promise.all([
      can('bookings.view') ? this.appointments(access.orgId, branchIds, window, zone) : null,
      can('accounting.payments') ? this.payments(access.orgId, branchIds, date, zone) : null,
      can('accounting.invoices') ? this.invoices(access.orgId, branchIds) : null,
      can('clinical.read') ? this.orders(access.orgId, branchIds) : null,
      can('inventory.view') ? this.stock(access.orgId, branchIds, today) : null,
      can('staff.view') || can('staff.attendance') ? this.people(access.orgId, branchIds, date) : null,
      this.approvals(access),
      orgWide && can('accounting.settlements') ? this.reconciliation(access.orgId) : null,
      orgWide ? this.activity(access.orgId) : null,
      can('settings.organisation') ? this.setup(access.orgId) : null,
    ])

    const visits = appointments?.rows ?? []
    const counts = appointments ? tally(visits) : null
    const unmarked = people && can('staff.attendance') ? people.filter((member) => presenceOf(member) === 'not_marked') : null
    const lowItems = stock ? [...new Map(stock.map((entry) => [entry.itemId, entry])).values()] : null

    return {
      date,
      today,
      timeZone: zone,
      generatedAt: new Date().toISOString(),
      branchId: query.branchId ?? null,
      branches: permitted,
      orgWide,
      appointments: counts && {
        ...counts,
        noShowRate: noShowRate(counts),
        wait: meanWait(visits),
        notRebooked: notRebooked(visits, appointments!.bookings),
        sessions: sessions(visits, isToday ? localMinute(new Date(), zone) : null),
      },
      collections: payments && {
        ...payments.today,
        amount: rupees(payments.today.amount),
        previous: { date: payments.previousDate, amount: rupees(payments.previous.amount) },
        change: change(payments.today.amount, payments.previous.amount),
      },
      refunds: payments && { processed: payments.refunds.count, amount: rupees(payments.refunds.amount), pending: payments.pendingRefunds },
      outstanding: invoices && { ...invoices, amount: rupees(invoices.amount) },
      reconciliation,
      orders,
      lowStock: lowItems && { count: lowItems.length, items: lowItems.slice(0, 5).map(({ itemId, name, location, available, level }) => ({ itemId, name, location, available, level })) },
      approvals: { ...approvals, attendanceUnmarked: unmarked?.length ?? null },
      team: people && can('staff.view') ? team(people) : null,
      locations: (query.branchId ? permitted.filter((branch) => branch.id === query.branchId) : permitted).map((branch) => ({
        id: branch.id,
        appointments: appointments ? tally(visits.filter((row) => row.branchId === branch.id)).total : null,
        collections: payments ? rupees(payments.byBranch.get(branch.id) ?? 0) : null,
        // Items needing attention that belong to this branch: results to review, stock below its level, attendance not yet marked.
        exceptions: orders || stock || unmarked
          ? (orders?.byBranch[branch.id] ?? 0) + (stock?.filter((entry) => entry.branchId === branch.id).length ?? 0) + (unmarked?.filter((member) => member.branchIds.includes(branch.id)).length ?? 0)
          : null,
      })),
      activity,
      setup,
    }
  }

  // Open items the person can act on, for the header's alerts: each needs the same permission as the matching
  // dashboard section, and only items with something outstanding are listed.
  async alerts(access: AccessContext, query: { branchId?: string }) {
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(new Date(), zone)
    const { orgId } = access
    const { branchIds } = await this.scope(access, query.branchId)
    const can = (permission: string) => access.permissions.has(permission)
    const window = { gte: zonedInstant(today, 0, zone), lt: zonedInstant(addDays(today, 1), 0, zone) }

    const [waiting, orders, stock, people, approvals, refunds, reconciliation] = await Promise.all([
      can('bookings.view') ? this.prisma.appointment.count({ where: { orgId, branchId: { in: branchIds }, startsAt: window, status: 'arrived' } }) : 0,
      can('clinical.read') ? this.orders(orgId, branchIds) : null,
      can('inventory.view') ? this.stock(orgId, branchIds, today) : [],
      can('staff.attendance') ? this.people(orgId, branchIds, today) : [],
      this.approvals(access),
      can('accounting.payments') ? this.prisma.refund.count({ where: { orgId, status: 'pending', payment: { branchId: { in: branchIds } } } }) : 0,
      access.branchScope === 'all' && can('accounting.settlements') ? this.reconciliation(orgId) : null,
    ])

    const items = [
      { id: 'waiting', count: waiting },
      { id: 'results', count: orders?.awaitingReview ?? 0, urgent: orders?.urgent ?? 0 },
      { id: 'low_stock', count: new Set(stock.map((entry) => entry.itemId)).size },
      { id: 'reconciliation', count: reconciliation ? reconciliation.candidates + reconciliation.exceptions : 0 },
      { id: 'refunds', count: refunds },
      { id: 'attendance', count: people.filter((member) => presenceOf(member) === 'not_marked').length },
      { id: 'payroll', count: (approvals.payrollAdjustments ?? 0) + (approvals.advances ?? 0) },
    ]
    return { generatedAt: new Date().toISOString(), branchId: query.branchId ?? null, items: items.filter((item) => item.count > 0) }
  }

  // The branches the person's roles cover, and the ones a request reads: the chosen branch, or all of those.
  private async scope(access: AccessContext, branchId?: string) {
    const orgBranches = await this.prisma.branch.findMany({
      where: { orgId: access.orgId },
      select: { id: true, code: true, name: true, city: true, state: true, status: true },
      orderBy: [{ code: 'asc' }],
    })
    const permitted = orgBranches.filter((branch) => access.branchScope === 'all' || access.branchScope.includes(branch.id))
    if (branchId) {
      if (!orgBranches.some((branch) => branch.id === branchId)) throw notFound('Branch not found.')
      if (!permitted.some((branch) => branch.id === branchId)) throw forbidden('BRANCH_OUT_OF_SCOPE', 'That branch is outside your role.')
    }
    return { permitted, branchIds: branchId ? [branchId] : permitted.map((branch) => branch.id) }
  }

  private async appointments(orgId: string, branchIds: string[], window: { gte: Date; lt: Date }, zone: string) {
    const rows = await this.prisma.appointment.findMany({
      where: { orgId, branchId: { in: branchIds }, startsAt: window },
      select: {
        id: true, patientId: true, branchId: true, startsAt: true, endsAt: true, status: true, arrivedAt: true,
        events: { where: { action: { in: ['start', 'noShow'] } }, select: { action: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    })
    const at = (row: (typeof rows)[number], action: string) => row.events.findLast((event) => event.action === action)?.createdAt.getTime() ?? null
    const visits: DayAppointment[] = rows.map((row) => ({
      id: row.id, patientId: row.patientId, branchId: row.branchId, status: row.status,
      startMinute: localMinute(row.startsAt, zone),
      endMinute: localMinute(row.startsAt, zone) + Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
      arrivedAt: row.arrivedAt?.getTime() ?? null, startedAt: at(row, 'start'), closedAt: row.status === 'no_show' ? at(row, 'noShow') : null,
    }))
    const missed = [...new Set(visits.filter((row) => row.status === 'no_show').map((row) => row.patientId))]
    const bookings = missed.length
      ? await this.prisma.appointment.findMany({ where: { orgId, patientId: { in: missed }, createdAt: { gte: window.gte }, status: { not: 'cancelled' } }, select: { patientId: true, createdAt: true } })
      : []
    return { rows: visits, bookings: bookings.map((row) => ({ patientId: row.patientId, createdAt: row.createdAt.getTime() })) }
  }

  // Money received on the day and on the same weekday a week earlier, with refunds paid out on the day.
  private async payments(orgId: string, branchIds: string[], date: string, zone: string) {
    const previousDate = addDays(date, -7)
    const span = (day: string) => ({ gte: zonedInstant(day, 0, zone), lt: zonedInstant(addDays(day, 1), 0, zone) })
    const select = { amount: true, channel: true, branchId: true } as const
    const [today, previous, refunds, pendingRefunds] = await Promise.all([
      this.prisma.payment.findMany({ where: { orgId, branchId: { in: branchIds }, receivedAt: span(date) }, select }),
      this.prisma.payment.findMany({ where: { orgId, branchId: { in: branchIds }, receivedAt: span(previousDate) }, select }),
      this.prisma.refund.findMany({ where: { orgId, status: 'processed', completedAt: span(date), payment: { branchId: { in: branchIds } } }, select: { amount: true } }),
      this.prisma.refund.count({ where: { orgId, status: 'pending', payment: { branchId: { in: branchIds } } } }),
    ])
    const rows = (list: typeof today) => list.map((row) => ({ amount: toPaise(row.amount), group: PAYMENT_CHANNELS[row.channel as keyof typeof PAYMENT_CHANNELS] ?? null }))
    const byBranch = new Map<string, number>()
    for (const row of today) byBranch.set(row.branchId, (byBranch.get(row.branchId) ?? 0) + toPaise(row.amount))
    return {
      today: collections(rows(today)),
      previous: collections(rows(previous)),
      previousDate,
      byBranch,
      refunds: { count: refunds.length, amount: refunds.reduce((sum, row) => sum + toPaise(row.amount), 0) },
      pendingRefunds,
    }
  }

  // Invoice balances as they stand now: the total less everything allocated to it.
  private async invoices(orgId: string, branchIds: string[]) {
    const rows = await this.prisma.invoice.findMany({
      where: { orgId, branchId: { in: branchIds } },
      select: { total: true, payer: true, allocations: { select: { amount: true } } },
    })
    return outstanding(rows.map((row) => ({ total: toPaise(row.total), payer: row.payer, allocated: row.allocations.reduce((sum, allocation) => sum + toPaise(allocation.amount), 0) })))
  }

  private async orders(orgId: string, branchIds: string[]) {
    const rows = await this.prisma.diagnosticOrder.findMany({
      where: { orgId, branchId: { in: branchIds }, status: 'awaiting_review' },
      select: { branchId: true, urgent: true, resultFlag: true },
    })
    const byBranch: Record<string, number> = {}
    for (const row of rows) byBranch[row.branchId] = (byBranch[row.branchId] ?? 0) + 1
    return {
      awaitingReview: rows.length,
      urgent: rows.filter((row) => row.urgent).length,
      flagged: rows.filter((row) => row.resultFlag === 'abnormal' || row.resultFlag === 'critical').length,
      byBranch,
    }
  }

  private async stock(orgId: string, branchIds: string[], today: string) {
    const locations = await this.prisma.stockLocation.findMany({ where: { orgId, branchId: { in: branchIds }, active: true }, select: { id: true, name: true, branchId: true, kind: true } })
    if (!locations.length) return []
    const [items, batches] = await Promise.all([
      this.prisma.stockItem.findMany({ where: { orgId, active: true }, select: { id: true, name: true, reorderLevel: true, safetyLevel: true } }),
      this.prisma.stockBatch.findMany({ where: { orgId, locationId: { in: locations.map((row) => row.id) } }, select: { itemId: true, locationId: true, expiry: true, posted: true, reserved: true, quarantine: true } }),
    ])
    return lowStock(items, locations, batches.map((row) => ({ ...row, expiry: row.expiry.toISOString().slice(0, 10) })), today)
  }

  // Active staff assigned to the branches, with the attendance marked for the day and any whole-day leave.
  private async people(orgId: string, branchIds: string[], date: string): Promise<TeamMember[]> {
    const day = new Date(date)
    const rows = await this.prisma.staffMember.findMany({
      where: { orgId, status: 'active', branches: { some: { branchId: { in: branchIds } } } },
      select: {
        id: true, type: true,
        branches: { where: { branchId: { in: branchIds } }, select: { branchId: true } },
        attendance: { where: { date: day, branchId: { in: branchIds } }, select: { status: true } },
        leaves: { where: { status: 'scheduled', startDate: { lte: day }, endDate: { gte: day }, startMinute: null }, select: { branchId: true } },
      },
    })
    return rows.map((row) => {
      const marked = row.attendance.map((entry) => entry.status as Presence).sort((a, b) => ATTENDANCE_RANK.indexOf(a) - ATTENDANCE_RANK.indexOf(b))
      return {
        id: row.id,
        type: row.type,
        branchIds: row.branches.map((entry) => entry.branchId),
        attendance: marked[0] ?? null,
        onLeave: row.leaves.some((leave) => leave.branchId === null || branchIds.includes(leave.branchId)),
      }
    })
  }

  // Requests waiting on a decision, for the people who can make it.
  private async approvals(access: AccessContext) {
    const payroll = access.permissions.has('staff.payroll')
    const [adjustments, advances] = await Promise.all([
      payroll ? this.prisma.payrollAdjustment.count({ where: { orgId: access.orgId, status: 'pending' } }) : null,
      payroll ? this.prisma.payrollAdvance.count({ where: { orgId: access.orgId, status: 'pending_approval' } }) : null,
    ])
    return { payrollAdjustments: adjustments, advances }
  }

  private async reconciliation(orgId: string) {
    const [candidates, exceptions] = await Promise.all([
      this.prisma.statementLine.count({ where: { orgId, state: 'candidate' } }),
      this.prisma.reconException.count({ where: { orgId, status: { in: ['open', 'in_review'] } } }),
    ])
    return { candidates, exceptions }
  }

  // The latest operational events from the audit log, with the names they refer to.
  private async activity(orgId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { orgId, action: { in: ACTIVITY_ACTIONS } },
      orderBy: { occurredAt: 'desc' },
      take: ACTIVITY_LIMIT,
      select: { id: true, action: true, entityType: true, entityId: true, actorUserId: true, details: true, occurredAt: true },
    })
    const ids = (type: string) => rows.filter((row) => row.entityType === type && row.entityId).map((row) => row.entityId!)
    const [actors, patients, appointments, payments, staff] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: rows.flatMap((row) => (row.actorUserId ? [row.actorUserId] : [])) } }, select: { id: true, fullName: true } }),
      this.prisma.patient.findMany({ where: { orgId, id: { in: ids('patient') } }, select: { id: true, fullName: true } }),
      this.prisma.appointment.findMany({ where: { orgId, id: { in: ids('appointment') } }, select: { id: true, startsAt: true, patient: { select: { fullName: true } }, practitioner: { select: { displayName: true } } } }),
      this.prisma.payment.findMany({ where: { orgId, id: { in: ids('payment') } }, select: { id: true, patient: { select: { fullName: true } } } }),
      this.prisma.staffMember.findMany({ where: { orgId, id: { in: ids('staff') } }, select: { id: true, fullName: true } }),
    ])
    const name = new Map<string, string>([
      ...patients.map((row) => [row.id, row.fullName] as const),
      ...payments.map((row) => [row.id, row.patient.fullName] as const),
      ...staff.map((row) => [row.id, row.fullName] as const),
    ])
    const appointment = new Map(appointments.map((row) => [row.id, row]))
    return rows.map((row) => {
      const visit = row.entityId ? appointment.get(row.entityId) : undefined
      return {
        id: row.id.toString(),
        action: row.action,
        at: row.occurredAt.toISOString(),
        actor: actors.find((actor) => actor.id === row.actorUserId)?.fullName ?? null,
        subject: visit?.patient.fullName ?? (row.entityId ? (name.get(row.entityId) ?? null) : null),
        practitioner: visit?.practitioner.displayName ?? null,
        startsAt: visit?.startsAt.toISOString() ?? null,
        details: row.details,
      }
    })
  }

  private async setup(orgId: string) {
    const [branches, services, staff, practitionersWithHours, billingSettings, stockItems, stockLocations, payrollSettings] = await Promise.all([
      this.prisma.branch.count({ where: { orgId } }),
      this.prisma.billingService.count({ where: { orgId, status: 'active' } }),
      this.prisma.staffMember.count({ where: { orgId, status: 'active' } }),
      this.prisma.practitioner.count({ where: { orgId, status: 'active', availability: { some: {} } } }),
      this.prisma.billingSettings.count({ where: { orgId } }),
      this.prisma.stockItem.count({ where: { orgId, active: true } }),
      this.prisma.stockLocation.count({ where: { orgId, active: true } }),
      this.prisma.payrollSettings.count({ where: { orgId } }),
    ])
    return setupSteps({ branches, services, staff, practitionersWithHours, billingSettings: billingSettings > 0, stockItems, stockLocations, payrollSettings: payrollSettings > 0 })
  }
}
