import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import { LiveService } from '../../common/realtime/live.service'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { violatedConstraint } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { AppointmentStatus, Prisma } from '../../generated/prisma/client'
import type { AppointmentNotice } from '../notifications/notification.logic'
import { NotificationsService } from '../notifications/notifications.service'
import { branchAllowed, CareScope, CareScopeService } from '../scheduling/care-scope.service'
import { addDays, localDate, localMinute, minuteToTime, timeToMinute, weekdayOf, zonedInstant } from '../scheduling/clinic-time'
import { BOOKING_HORIZON_DAYS } from '../scheduling/scheduling.constants'
import { PractitionersRepository } from '../scheduling/practitioners.repository'
import { blockedRanges, isSlotStart } from '../scheduling/slots'
import { AppointmentRow, AppointmentsRepository, EventRow } from './appointments.repository'
import type { CloseInput, CreateAppointmentInput, ListAppointmentsQuery, RescheduleInput } from './appointments.schemas'
import { AppointmentAction, transition } from './lifecycle'

const PRACTITIONER_OVERLAP = 'appointments_practitioner_no_overlap'
const PATIENT_OVERLAP = 'appointments_patient_no_overlap'

type Practitioner = NonNullable<Awaited<ReturnType<AppointmentsRepository['practitioner']>>>

// What each staff action is worth telling the patient; the others only refresh the screens that show the queue.
const NOTICES: Partial<Record<AppointmentAction, AppointmentNotice>> = { confirm: 'confirmed', reschedule: 'rescheduled', checkIn: 'checked_in', cancel: 'cancelled' }

interface Change {
  data?: Prisma.AppointmentUncheckedUpdateInput
  event?: { reason?: string | null; note?: string | null; toStartsAt?: Date | null }
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsRepository,
    private readonly counters: CountersRepository,
    private readonly careScope: CareScopeService,
    private readonly practitionerRecords: PractitionersRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get zone() {
    return this.env.CLINIC_TIMEZONE
  }

  private stamp(instant: Date) {
    return { date: localDate(instant, this.zone), time: minuteToTime(localMinute(instant, this.zone)) }
  }

  view(row: AppointmentRow, access: AccessContext, events?: EventRow[]) {
    // Internal desk notes are for booking staff and clinicians with the notes permission.
    const showNotes = access.permissions.has('bookings.notes') || access.permissions.has('bookings.create')
    const start = this.stamp(row.startsAt)
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      type: row.type,
      channel: row.channel,
      waitingQueue: row.waitingQueue,
      date: start.date,
      time: start.time,
      endTime: this.stamp(row.endsAt).time,
      durationMinutes: Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      patient: { ...row.patient, dateOfBirth: row.patient.dateOfBirth.toISOString().slice(0, 10) },
      practitioner: row.practitioner,
      branch: row.branch,
      reason: row.reason,
      internalNote: showNotes ? row.internalNote : null,
      notifyWhatsapp: row.notifyWhatsapp,
      notifySms: row.notifySms,
      queueToken: row.queueToken,
      arrivedAt: row.arrivedAt ? this.stamp(row.arrivedAt).time : null,
      closedReason: row.closedReason,
      bookedBy: row.bookedBy?.fullName ?? 'Patient app',
      service: row.service?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      version: row.version,
      ...(events && {
        events: events.map((event) => ({
          id: event.id,
          action: event.action,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          from: event.fromStartsAt ? this.stamp(event.fromStartsAt) : null,
          to: event.toStartsAt ? this.stamp(event.toStartsAt) : null,
          reason: event.reason,
          note: showNotes ? event.note : null,
          actor: event.actor?.fullName ?? 'Patient app',
          at: event.createdAt.toISOString(),
          ...this.stamp(event.createdAt),
        })),
      }),
    }
  }

  async list(access: AccessContext, query: ListAppointmentsQuery) {
    const scope = await this.careScope.resolve(access)
    const filters: Prisma.AppointmentWhereInput[] = [this.appointments.scoped(access.orgId, scope)]
    if (query.patientId) filters.push({ patientId: query.patientId })
    if (query.practitionerId) filters.push({ practitionerId: query.practitionerId })
    if (query.branchId) filters.push({ branchId: query.branchId })
    if (query.status) filters.push({ status: query.status })
    if (query.date) filters.push({ startsAt: { gte: zonedInstant(query.date, 0, this.zone), lt: zonedInstant(addDays(query.date, 1), 0, this.zone) } })

    // A single day reads like a schedule (earliest first); history reads newest first.
    const { total, rows } = await this.appointments.list({ AND: filters }, query.page, query.pageSize, query.date ? 'asc' : 'desc')
    return { items: rows.map((row) => this.view(row, access)), page: query.page, pageSize: query.pageSize, total }
  }

  async get(access: AccessContext, id: string) {
    const scope = await this.careScope.resolve(access)
    const row = await this.appointments.find({ AND: [this.appointments.scoped(access.orgId, scope), { id }] })
    if (!row) throw notFound('Appointment not found.')
    return this.view(row, access, await this.appointments.events(id))
  }

  async create(access: AccessContext, actorUserId: string, input: CreateAppointmentInput, client: ClientInfo, now = new Date()) {
    const scope = await this.careScope.resolve(access)
    if (!branchAllowed(scope, input.branchId)) throw notFound('Branch not found.')
    if (!(await this.appointments.activeBranch(access.orgId, input.branchId))) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch.')
    const practitioner = await this.activePractitioner(access.orgId, input.practitionerId)

    const today = localDate(now, this.zone)
    const walkIn = input.arrivedNow || input.waitingQueue
    if (walkIn && input.date !== today) throw unprocessable('WALK_IN_TODAY_ONLY', 'Walk-ins can only be added for today.')
    await this.assertBranchOpen(input.branchId, input.date)

    let startsAt: Date
    if (input.waitingQueue) {
      if (!practitioner.availability.some((window) => window.branchId === input.branchId && window.weekday === weekdayOf(today))) {
        throw unprocessable('NOT_CONSULTING', 'This therapist is not consulting at this branch today.')
      }
      startsAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
    } else {
      startsAt = this.slotStart(practitioner, input.branchId, input.date, input.time!, now, { allowCurrent: input.arrivedNow })
      await this.assertNotOnLeave(practitioner, input.branchId, input.date, input.time!)
    }
    const endsAt = new Date(startsAt.getTime() + practitioner.slotMinutes * 60_000)
    const status: AppointmentStatus = input.arrivedNow || input.waitingQueue ? 'arrived' : input.status

    try {
      const { id, events } = await this.prisma.transaction(async (tx) => {
        await this.assertBookablePatient(tx, access.orgId, input.patientId, input.practitionerId, input.date)
        const reference = formatNumber('APT-', await this.counters.next(tx, access.orgId, 'appointment_reference'))
        const queueToken = status === 'arrived' ? await this.nextToken(tx, access.orgId, input.branchId, today, input.waitingQueue ? 'W' : 'A') : null
        const created = await this.appointments.create(tx, {
          orgId: access.orgId,
          reference,
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          branchId: input.branchId,
          startsAt,
          endsAt,
          type: input.type,
          status,
          channel: input.channel,
          waitingQueue: input.waitingQueue,
          reason: input.reason,
          internalNote: input.internalNote,
          notifyWhatsapp: input.notifyWhatsapp,
          notifySms: input.notifySms,
          queueToken,
          arrivedAt: status === 'arrived' ? now : null,
          bookedById: actorUserId,
        })
        await this.appointments.addEvent(tx, { appointmentId: created.id, action: walkIn ? 'walk_in' : 'booked', fromStatus: null, toStatus: status, toStartsAt: startsAt, actorUserId })
        await this.audit.record({ action: 'appointment.booked', entityType: 'appointment', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference } }, client, tx)
        const events = await this.notifications.appointmentChanged(tx, { appointmentId: created.id, notice: status === 'arrived' ? 'checked_in' : 'booked', by: 'clinic' })
        return { id: created.id, events }
      })
      await this.live.publish(events)
      return this.get(access, id)
    } catch (error) {
      throw this.bookingConflict(error)
    }
  }

  confirm(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    return this.change(access, id, 'confirm', actorUserId, client, async () => ({}))
  }

  checkIn(access: AccessContext, id: string, actorUserId: string, note: string | null, client: ClientInfo, now = new Date()) {
    return this.change(access, id, 'checkIn', actorUserId, client, async (row, tx) => {
      const today = localDate(now, this.zone)
      if (localDate(row.startsAt, this.zone) !== today) throw unprocessable('NOT_TODAY', 'Patients can only be checked in on the day of their appointment.')
      const queueToken = row.queueToken ?? (await this.nextToken(tx, row.orgId, row.branch.id, today, 'A'))
      return { data: { queueToken, arrivedAt: now }, event: { note, reason: `Token ${queueToken}` } }
    })
  }

  start(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    return this.change(access, id, 'start', actorUserId, client, async () => ({}))
  }

  complete(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    return this.change(access, id, 'complete', actorUserId, client, async () => ({}))
  }

  cancel(access: AccessContext, id: string, actorUserId: string, input: CloseInput, client: ClientInfo) {
    return this.change(access, id, 'cancel', actorUserId, client, async () => ({ data: { closedReason: input.reason }, event: input }))
  }

  noShow(access: AccessContext, id: string, actorUserId: string, input: CloseInput, client: ClientInfo, now = new Date()) {
    return this.change(access, id, 'noShow', actorUserId, client, async (row) => {
      if (row.startsAt.getTime() > now.getTime()) throw unprocessable('NO_SHOW_TOO_EARLY', 'A patient can only be marked as a no-show once the appointment time has passed.')
      return { data: { closedReason: input.reason }, event: input }
    })
  }

  async reschedule(access: AccessContext, id: string, actorUserId: string, input: RescheduleInput, client: ClientInfo, now = new Date()) {
    try {
      return await this.change(access, id, 'reschedule', actorUserId, client, async (row, tx) => {
        if (row.waitingQueue) throw unprocessable('QUEUE_NOT_RESCHEDULABLE', 'A waiting-queue walk-in has no slot to move.')
        const practitioner = await this.activePractitioner(row.orgId, row.practitioner.id)
        const startsAt = this.slotStart(practitioner, row.branch.id, input.date, input.time, now, { allowCurrent: false })
        await this.assertBranchOpen(row.branch.id, input.date)
        await this.assertNotOnLeave(practitioner, row.branch.id, input.date, input.time)
        if (startsAt.getTime() === row.startsAt.getTime()) throw unprocessable('SAME_SLOT', 'Choose a different time from the current one.')
        await this.assertBookablePatient(tx, row.orgId, row.patient.id, row.practitioner.id, input.date, row.id)
        return {
          data: { startsAt, endsAt: new Date(startsAt.getTime() + practitioner.slotMinutes * 60_000) },
          event: { reason: input.reason, note: input.note, toStartsAt: startsAt },
        }
      })
    } catch (error) {
      throw this.bookingConflict(error)
    }
  }

  // Locks the appointment, checks the move is allowed from its current status, applies it and records history.
  private async change(
    access: AccessContext,
    id: string,
    action: AppointmentAction,
    actorUserId: string,
    client: ClientInfo,
    apply: (row: AppointmentRow & { orgId: string }, tx: Tx) => Promise<Change>,
  ) {
    const scope = await this.careScope.resolve(access)
    const events = await this.prisma.transaction(async (tx) => {
      if (!(await this.appointments.lock(tx, access.orgId, id))) throw notFound('Appointment not found.')
      const row = await this.appointments.find({ AND: [this.appointments.scoped(access.orgId, scope), { id }] }, tx)
      if (!row) throw notFound('Appointment not found.')
      const toStatus = transition(action, row.status)
      const change = await apply({ ...row, orgId: access.orgId }, tx)
      await this.appointments.update(tx, id, { ...change.data, status: toStatus })
      await this.appointments.addEvent(tx, {
        appointmentId: id,
        action,
        fromStatus: row.status,
        toStatus,
        fromStartsAt: change.event?.toStartsAt ? row.startsAt : null,
        toStartsAt: change.event?.toStartsAt ?? null,
        reason: change.event?.reason ?? null,
        note: change.event?.note ?? null,
        actorUserId,
      })
      await this.audit.record({ action: `appointment.${action}`, entityType: 'appointment', entityId: id, orgId: access.orgId, actorUserId, details: { from: row.status, to: toStatus } }, client, tx)
      return this.notifications.appointmentChanged(tx, { appointmentId: id, notice: NOTICES[action], by: 'clinic' })
    })
    await this.live.publish(events)
    return this.get(access, id)
  }

  private async activePractitioner(orgId: string, id: string): Promise<Practitioner> {
    const practitioner = await this.appointments.practitioner(orgId, id)
    if (!practitioner) throw notFound('Therapist not found.')
    if (practitioner.status !== 'active') throw unprocessable('PRACTITIONER_INACTIVE', 'This therapist is not taking appointments.')
    return practitioner
  }

  // The instant a booking at `date` `time` starts, after checking it is a real, future slot of the therapist.
  private slotStart(practitioner: Practitioner, branchId: string, date: string, time: string, now: Date, { allowCurrent }: { allowCurrent: boolean }) {
    const today = localDate(now, this.zone)
    if (date > addDays(today, BOOKING_HORIZON_DAYS)) throw unprocessable('DATE_OUT_OF_RANGE', `Appointments can be booked up to ${BOOKING_HORIZON_DAYS} days ahead.`)
    const minute = timeToMinute(time)
    const windows = practitioner.availability.filter((window) => window.branchId === branchId && window.weekday === weekdayOf(date))
    if (!isSlotStart(windows, practitioner.slotMinutes, minute)) {
      throw unprocessable('SLOT_NOT_AVAILABLE', 'The therapist does not consult at that time at this branch. Choose one of the listed slots.')
    }
    const startsAt = zonedInstant(date, minute, this.zone)
    // Walk-ins may take the slot that is running now; everything else must start in the future.
    const earliest = allowCurrent ? now.getTime() - practitioner.slotMinutes * 60_000 : now.getTime()
    if (startsAt.getTime() < earliest) throw unprocessable('SLOT_IN_PAST', 'That time has already passed. Choose a later slot.')
    return startsAt
  }

  // A day the branch is closed (Configuration › Operating hours) takes no new appointments.
  private async assertBranchOpen(branchId: string, date: string) {
    const closure = await this.prisma.branchClosure.findUnique({ where: { branchId_date: { branchId, date: new Date(`${date}T00:00:00Z`) } }, select: { kind: true, reason: true } })
    if (closure?.kind === 'closed') throw unprocessable('BRANCH_CLOSED', `The branch is closed that day (${closure.reason}). Choose another date.`)
  }

  // Leave and blocks recorded in the Staff module take the therapist out of the schedule.
  private async assertNotOnLeave(practitioner: Practitioner, branchId: string, date: string, time: string) {
    const start = timeToMinute(time)
    const end = start + practitioner.slotMinutes
    const blocked = blockedRanges(await this.practitionerRecords.leaves(practitioner.id, date, date), date, branchId)
    if (blocked.some((range) => range.startMinute < end && range.endMinute > start)) {
      throw unprocessable('THERAPIST_UNAVAILABLE', 'The therapist is on leave or blocked at that time. Choose another slot.')
    }
  }

  private async assertBookablePatient(tx: Tx, orgId: string, patientId: string, practitionerId: string, date: string, excludeId?: string) {
    const status = await this.appointments.lockPatient(tx, orgId, patientId)
    if (!status) throw notFound('Patient not found.')
    if (status !== 'active') throw unprocessable('PATIENT_INACTIVE', 'This patient is inactive. Reactivate the patient before booking.')
    const duplicate = await this.appointments.openWithPractitioner(tx, patientId, practitionerId, zonedInstant(date, 0, this.zone), zonedInstant(addDays(date, 1), 0, this.zone), excludeId)
    if (duplicate) {
      throw conflict('DUPLICATE_BOOKING', `This patient already has an open appointment (${duplicate.reference}) with this therapist at ${this.stamp(duplicate.startsAt).time} on that day.`)
    }
  }

  private async nextToken(tx: Tx, orgId: string, branchId: string, date: string, prefix: 'A' | 'W') {
    const value = await this.counters.next(tx, orgId, `queue:${branchId}:${date}:${prefix}`)
    return `${prefix}-${String(value).padStart(2, '0')}`
  }

  // The database refuses overlapping open appointments; turn that into a message staff can act on.
  private bookingConflict(error: unknown) {
    const constraint = violatedConstraint(error, [PRACTITIONER_OVERLAP, PATIENT_OVERLAP])
    if (constraint === PRACTITIONER_OVERLAP) return conflict('SLOT_TAKEN', 'That slot has just been booked by someone else. Choose another time.')
    if (constraint === PATIENT_OVERLAP) return conflict('PATIENT_DOUBLE_BOOKED', 'This patient already has another appointment at that time.')
    return error
  }
}

export type AppointmentView = ReturnType<AppointmentsService['view']>
export type { CareScope }
