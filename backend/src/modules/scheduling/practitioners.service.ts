import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { DepartmentsService } from '../configuration/departments.service'
import { outsideBranchHours } from '../configuration/configuration.logic'
import { badRequest, conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { isUniqueViolation, violatedConstraint } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import { addDays, localDate, localMinute, minuteToTime, timeToMinute, weekdayOf, zonedInstant } from './clinic-time'
import { PractitionersRepository } from './practitioners.repository'
import type { AvailabilityInput, CreatePractitionerInput, SlotsQuery, UpdatePractitionerInput } from './practitioners.schemas'
import { BOOKING_HORIZON_DAYS } from './scheduling.constants'
import { blockedRanges, daySlots, overlappingWindows } from './slots'

type PractitionerRow = NonNullable<Awaited<ReturnType<PractitionersRepository['find']>>>

export function practitionerView(row: PractitionerRow) {
  return {
    id: row.id,
    membershipId: row.membershipId,
    userId: row.membership.userId,
    memberName: row.membership.user.fullName,
    displayName: row.displayName,
    credentials: row.credentials,
    specialty: row.specialty,
    department: row.department,
    room: row.room,
    slotMinutes: row.slotMinutes,
    onlineBooking: row.onlineBooking,
    status: row.status,
    version: row.version,
    availability: row.availability.map((window) => ({
      branchId: window.branchId,
      branchName: window.branch.name,
      weekday: window.weekday,
      start: minuteToTime(window.startMinute),
      end: minuteToTime(window.endMinute),
    })),
  }
}

@Injectable()
export class PractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practitioners: PractitionersRepository,
    private readonly audit: AuditService,
    private readonly departments: DepartmentsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(orgId: string, filter: { status?: 'active' | 'inactive'; branchId?: string }) {
    return (await this.practitioners.list(orgId, filter)).map(practitionerView)
  }

  // With warnings for any session outside its branch's opening hours (Configuration › Operating hours).
  async get(orgId: string, id: string) {
    const view = practitionerView(await this.find(orgId, id))
    const branchIds = [...new Set(view.availability.map((window) => window.branchId))]
    const hours = branchIds.length ? await this.prisma.branchHours.findMany({ where: { branchId: { in: branchIds } }, select: { branchId: true, weekday: true, start: true, end: true } }) : []
    const byBranch = new Map<string, typeof hours>()
    for (const session of hours) byBranch.set(session.branchId, [...(byBranch.get(session.branchId) ?? []), session])
    return { ...view, hoursWarnings: outsideBranchHours(view.availability, byBranch) }
  }

  async candidates(orgId: string) {
    const rows = await this.practitioners.candidates(orgId)
    return rows.map((row) => ({ membershipId: row.id, fullName: row.user.fullName, email: row.user.email }))
  }

  async create(orgId: string, actorUserId: string, input: CreatePractitionerInput, client: ClientInfo) {
    if (!(await this.practitioners.activeMembership(orgId, input.membershipId))) {
      throw unprocessable('MEMBER_UNKNOWN', 'Choose an active member of this organisation.')
    }
    const { membershipId, ...rest } = input
    const profile = { ...rest, department: (await this.departments.resolve(this.prisma, orgId, rest.department))! }
    try {
      const { id } = await this.practitioners.create(orgId, membershipId, profile)
      await this.audit.record({ action: 'practitioner.created', entityType: 'practitioner', entityId: id, orgId, actorUserId }, client)
      return this.get(orgId, id)
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('PRACTITIONER_EXISTS', 'This member already has a therapist profile.')
      throw error
    }
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdatePractitionerInput, client: ClientInfo) {
    input = { ...input, department: (await this.departments.resolve(this.prisma, orgId, input.department))! }
    if ((await this.practitioners.update(orgId, id, input)) === 0) throw notFound('Therapist not found.')
    await this.audit.record({ action: 'practitioner.updated', entityType: 'practitioner', entityId: id, orgId, actorUserId }, client)
    return this.get(orgId, id)
  }

  // Replaces the weekly schedule. Existing bookings keep their times; only new slot generation changes.
  async setAvailability(orgId: string, id: string, actorUserId: string, input: AvailabilityInput, client: ClientInfo) {
    await this.find(orgId, id)
    const rows = input.windows.map((window) => ({ branchId: window.branchId, weekday: window.weekday, startMinute: timeToMinute(window.start), endMinute: timeToMinute(window.end) }))
    if (overlappingWindows(rows)) throw unprocessable('AVAILABILITY_OVERLAP', 'Two sessions on the same day overlap. Adjust the times so they do not.')

    const branchIds = [...new Set(rows.map((row) => row.branchId))]
    if ((await this.practitioners.activeBranchIds(orgId, branchIds)).length !== branchIds.length) {
      throw unprocessable('BRANCH_UNKNOWN', 'One or more branches do not exist or are not active.')
    }

    try {
      await this.prisma.transaction(async (tx) => {
        await this.practitioners.replaceAvailability(tx, id, rows)
        await this.audit.record({ action: 'practitioner.availability_changed', entityType: 'practitioner', entityId: id, orgId, actorUserId, details: { sessions: rows.length } }, client, tx)
      })
    } catch (error) {
      if (violatedConstraint(error, ['practitioner_availability_no_overlap'])) {
        throw unprocessable('AVAILABILITY_OVERLAP', 'Two sessions on the same day overlap. Adjust the times so they do not.')
      }
      throw error
    }
    return this.get(orgId, id)
  }

  // Slots for each day in the range at one branch, with booked and past slots marked.
  async slots(orgId: string, id: string, query: SlotsQuery, now = new Date()) {
    const practitioner = await this.find(orgId, id)
    const zone = this.env.CLINIC_TIMEZONE
    const today = localDate(now, zone)
    const last = addDays(today, BOOKING_HORIZON_DAYS)
    if (query.from > last) throw badRequest('DATE_OUT_OF_RANGE', `Appointments can be booked up to ${BOOKING_HORIZON_DAYS} days ahead.`)

    const dates = Array.from({ length: query.days }, (_, index) => addDays(query.from, index)).filter((date) => date <= last)
    const windows = practitioner.availability.filter((window) => window.branchId === query.branchId)
    const rangeStart = zonedInstant(dates[0]!, 0, zone)
    const rangeEnd = zonedInstant(addDays(dates.at(-1)!, 1), 0, zone)
    const busy = await this.practitioners.busy(id, rangeStart, rangeEnd, query.excludeAppointmentId)
    const leaves = await this.practitioners.leaves(id, dates[0]!, dates.at(-1)!)
    const closures = await this.prisma.branchClosure.findMany({ where: { branchId: query.branchId, kind: 'closed', date: { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${dates.at(-1)}T00:00:00Z`) } }, select: { date: true, reason: true } })
    const closedOn = new Map(closures.map((closure) => [closure.date.toISOString().slice(0, 10), closure.reason]))
    const nowMinute = localMinute(now, zone)

    return {
      practitionerId: id,
      branchId: query.branchId,
      slotMinutes: practitioner.slotMinutes,
      timezone: zone,
      days: dates.map((date) => {
        if (practitioner.status !== 'active' || date < today) return { date, slots: [] }
        if (closedOn.has(date)) return { date, slots: [], closed: closedOn.get(date) }
        const weekday = weekdayOf(date)
        const dayWindows = windows.filter((window) => window.weekday === weekday)
        const dayStart = zonedInstant(date, 0, zone).getTime()
        const busyToday = busy
          .filter((entry) => entry.startsAt.getTime() < dayStart + 86_400_000 && entry.endsAt.getTime() > dayStart)
          .map((entry) => ({ startMinute: Math.round((entry.startsAt.getTime() - dayStart) / 60_000), endMinute: Math.round((entry.endsAt.getTime() - dayStart) / 60_000) }))
        const slots = daySlots(dayWindows, practitioner.slotMinutes, busyToday, date === today ? nowMinute : null, blockedRanges(leaves, date, query.branchId))
        return { date, slots: slots.map(({ time, state }) => ({ time, state })) }
      }),
    }
  }

  private async find(orgId: string, id: string) {
    const row = await this.practitioners.find(orgId, id)
    if (!row) throw notFound('Therapist not found.')
    return row
  }
}
