import { Inject, Injectable } from '@nestjs/common'
import { badRequest } from '../../common/errors/app-error'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { addDays, localDate, localMinute, weekdayOf, zonedInstant } from '../scheduling/clinic-time'
import { BOOKING_HORIZON_DAYS, OPEN_STATUSES } from '../scheduling/scheduling.constants'
import { blockedRanges, daySlots, LeaveBlock } from '../scheduling/slots'
import { PooledSlot, poolSlots } from './booking.logic'

const practitionerSelect = {
  id: true,
  displayName: true,
  department: true,
  slotMinutes: true,
  availability: { select: { branchId: true, weekday: true, startMinute: true, endMinute: true } },
} as const

export interface BookablePractitioner {
  id: string
  displayName: string
  department: string
  slotMinutes: number
  availability: Array<{ branchId: string; weekday: number; startMinute: number; endMinute: number }>
}

export interface PooledDay {
  date: string
  // The reason, when the branch is closed that day.
  closed?: string
  slots: PooledSlot[]
}

// Which services patients may book at a branch, and which times are free, across all the therapists who take them.
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Therapists patients may be booked with at these branches.
  practitioners(where: { orgId: string; branchId: string; department?: string; id?: string }): Promise<BookablePractitioner[]> {
    return this.prisma.practitioner.findMany({
      where: {
        orgId: where.orgId,
        id: where.id,
        department: where.department,
        status: 'active',
        onlineBooking: true,
        membership: { status: 'active' },
        availability: { some: { branchId: where.branchId } },
      },
      orderBy: { displayName: 'asc' },
      select: practitionerSelect,
    })
  }

  // The services open to patients at a branch: offered there, and with at least one therapist to take them.
  async services(orgId: string, branchId: string) {
    const [rows, practitioners] = await Promise.all([
      this.prisma.billingService.findMany({
        where: { orgId, status: 'active', patientBookable: true, department: { not: null }, prices: { some: { branchId } } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, category: true, department: true, price: true, gstRate: true, prices: { where: { branchId }, select: { price: true } } },
      }),
      this.practitioners({ orgId, branchId }),
    ])
    const departments = new Set(practitioners.map((practitioner) => practitioner.department))
    return rows
      .filter((row) => departments.has(row.department!))
      .map(({ prices, price, gstRate, ...row }) => ({
        ...row,
        department: row.department!,
        // The branch's own price where it has one, otherwise the standard price.
        fee: Number(prices[0]?.price ?? price),
        gstRate: Number(gstRate),
        slotMinutes: Math.min(...practitioners.filter((practitioner) => practitioner.department === row.department).map((practitioner) => practitioner.slotMinutes)),
      }))
  }

  async days(practitioners: BookablePractitioner[], branchId: string, from: string, count: number, now = new Date(), excludeAppointmentId?: string): Promise<PooledDay[]> {
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(now, zone)
    const last = addDays(today, BOOKING_HORIZON_DAYS)
    if (from > last) throw badRequest('DATE_OUT_OF_RANGE', `Appointments can be booked up to ${BOOKING_HORIZON_DAYS} days ahead.`)
    const dates = Array.from({ length: count }, (_, index) => addDays(from, index)).filter((date) => date <= last)
    const first = dates[0]!
    const final = dates.at(-1)!
    const ids = practitioners.map((practitioner) => practitioner.id)

    const [busy, leaves, closures] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          practitionerId: { in: ids },
          status: { in: [...OPEN_STATUSES] },
          waitingQueue: false,
          startsAt: { lt: zonedInstant(addDays(final, 1), 0, zone) },
          endsAt: { gt: zonedInstant(first, 0, zone) },
          ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        },
        select: { practitionerId: true, startsAt: true, endsAt: true },
      }),
      this.leaves(ids, first, final),
      this.prisma.branchClosure.findMany({
        where: { branchId, kind: 'closed', date: { gte: new Date(`${first}T00:00:00Z`), lte: new Date(`${final}T00:00:00Z`) } },
        select: { date: true, reason: true },
      }),
    ])
    const closedOn = new Map(closures.map((closure) => [closure.date.toISOString().slice(0, 10), closure.reason]))
    const nowMinute = localMinute(now, zone)

    return dates.map((date) => {
      if (date < today) return { date, slots: [] }
      const closed = closedOn.get(date)
      if (closed !== undefined) return { date, closed, slots: [] }
      const weekday = weekdayOf(date)
      const dayStart = zonedInstant(date, 0, zone).getTime()
      return {
        date,
        slots: poolSlots(
          practitioners.map((practitioner) => {
            const windows = practitioner.availability.filter((window) => window.branchId === branchId && window.weekday === weekday)
            const taken = busy
              .filter((entry) => entry.practitionerId === practitioner.id && entry.startsAt.getTime() < dayStart + 86_400_000 && entry.endsAt.getTime() > dayStart)
              .map((entry) => ({ startMinute: Math.round((entry.startsAt.getTime() - dayStart) / 60_000), endMinute: Math.round((entry.endsAt.getTime() - dayStart) / 60_000) }))
            // The slot that starts this very minute is already too late to book online.
            const slots = daySlots(windows, practitioner.slotMinutes, taken, date === today ? nowMinute + 1 : null, blockedRanges(leaves.get(practitioner.id) ?? [], date, branchId))
            return { practitionerId: practitioner.id, slots }
          }),
        ),
      }
    })
  }

  private async leaves(practitionerIds: string[], from: string, to: string) {
    const rows = await this.prisma.staffLeave.findMany({
      where: {
        status: 'scheduled',
        startDate: { lte: new Date(`${to}T00:00:00Z`) },
        endDate: { gte: new Date(`${from}T00:00:00Z`) },
        staff: { membership: { practitioner: { id: { in: practitionerIds } } } },
      },
      select: { startDate: true, endDate: true, startMinute: true, endMinute: true, branchId: true, staff: { select: { membership: { select: { practitioner: { select: { id: true } } } } } } },
    })
    const byPractitioner = new Map<string, LeaveBlock[]>()
    for (const { staff, startDate, endDate, ...leave } of rows) {
      const id = staff.membership?.practitioner?.id
      if (!id) continue
      byPractitioner.set(id, [...(byPractitioner.get(id) ?? []), { ...leave, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10) }])
    }
    return byPractitioner
  }
}
