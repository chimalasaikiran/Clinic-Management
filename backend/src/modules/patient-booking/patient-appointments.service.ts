import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import { LiveEvent, LiveService } from '../../common/realtime/live.service'
import type { ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { violatedConstraint } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { canTransition, transition } from '../appointments/lifecycle'
import { NotificationsService } from '../notifications/notifications.service'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { addDays, localDate, localMinute, minuteToTime, timeToMinute, zonedInstant } from '../scheduling/clinic-time'
import { OPEN_STATUSES } from '../scheduling/scheduling.constants'
import { AvailabilityService, BookablePractitioner } from './availability.service'
import { assignmentOrder } from './booking.logic'
import type { BookInput, ClinicSlotsQuery, MoveInput, PatientAppointmentsQuery, SlotRange } from './booking.schemas'
import { ClinicDirectoryService } from './clinic-directory.service'
import { PatientRecordService } from './patient-record.service'

// Upcoming visits one account may hold through the app, so it cannot fill a clinic's diary.
export const MAX_OPEN_APP_BOOKINGS = 10

const PRACTITIONER_OVERLAP = 'appointments_practitioner_no_overlap'
const PATIENT_OVERLAP = 'appointments_patient_no_overlap'

// What a patient may see of their appointment. Desk notes and staff names on history entries are never selected.
const appointmentSelect = {
  id: true,
  orgId: true,
  reference: true,
  status: true,
  type: true,
  startsAt: true,
  endsAt: true,
  waitingQueue: true,
  reason: true,
  queueToken: true,
  closedReason: true,
  quotedFee: true,
  bookedByAccountId: true,
  serviceId: true,
  createdAt: true,
  patient: { select: { id: true, fullName: true, mrn: true } },
  practitioner: { select: { id: true, displayName: true, credentials: true, specialty: true, department: true, room: true, onlineBooking: true, status: true } },
  service: { select: { name: true, department: true, patientBookable: true, status: true } },
  branch: { select: { id: true, name: true, addressLine1: true, addressLine2: true, city: true, state: true, pinCode: true, phone: true, latitude: true, longitude: true, listedInPatientApp: true, status: true } },
  organisation: { select: { displayName: true } },
} as const satisfies Prisma.AppointmentSelect

type Row = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>

@Injectable()
export class PatientAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsRepository,
    private readonly counters: CountersRepository,
    private readonly availability: AvailabilityService,
    private readonly directory: ClinicDirectoryService,
    private readonly records: PatientRecordService,
    private readonly links: PatientLinksService,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get zone() {
    return this.env.CLINIC_TIMEZONE
  }

  private stamp(instant: Date) {
    return { date: localDate(instant, this.zone), time: minuteToTime(localMinute(instant, this.zone)) }
  }

  // ── Slots ──

  async clinicSlots(branchId: string, query: ClinicSlotsQuery) {
    const branch = await this.directory.find(branchId)
    const service = await this.bookableService(branch.orgId, branchId, query.serviceId)
    const practitioners = await this.availability.practitioners({ orgId: branch.orgId, branchId, department: service.department })
    return this.slotView(await this.availability.days(practitioners, branchId, query.from, query.days))
  }

  async moveSlots(accountId: string, id: string, query: SlotRange) {
    const row = await this.owned(accountId, id)
    const practitioners = await this.movePool(row)
    return this.slotView(await this.availability.days(practitioners, row.branch.id, query.from, query.days, new Date(), id))
  }

  // Patients see which times are open, never which therapist is or is not free.
  private slotView(days: Awaited<ReturnType<AvailabilityService['days']>>) {
    return {
      timezone: this.zone,
      days: days.map(({ date, closed, slots }) => ({ date, ...(closed !== undefined && { closed }), slots: slots.map((slot) => ({ time: slot.time, available: slot.free.length > 0 })) })),
    }
  }

  // ── Reading ──

  async list(accountId: string, query: PatientAppointmentsQuery, now = new Date()) {
    const mine = await this.mine(accountId)
    const upcoming: Prisma.AppointmentWhereInput = { status: { in: [...OPEN_STATUSES] }, endsAt: { gte: startOfClinicDay(now, this.zone) } }
    const where: Prisma.AppointmentWhereInput = { AND: [mine, query.scope === 'upcoming' ? upcoming : { NOT: upcoming }] }
    const order = query.scope === 'upcoming' ? 'asc' : 'desc'
    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, orderBy: [{ startsAt: order }, { id: order }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: appointmentSelect }),
    ])
    return { items: rows.map((row) => this.view(row, now)), page: query.page, pageSize: query.pageSize, total }
  }

  async get(accountId: string, id: string, now = new Date()) {
    const row = await this.owned(accountId, id)
    const events = await this.prisma.appointmentEvent.findMany({
      where: { appointmentId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, fromStartsAt: true, toStartsAt: true, toStatus: true, actorAccountId: true, createdAt: true },
    })
    return {
      ...this.view(row, now),
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        status: event.toStatus,
        by: event.actorAccountId === accountId ? ('you' as const) : ('clinic' as const),
        from: event.fromStartsAt ? this.stamp(event.fromStartsAt) : null,
        to: event.toStartsAt ? this.stamp(event.toStartsAt) : null,
        at: event.createdAt.toISOString(),
      })),
    }
  }

  // ── Changing ──

  async book(accountId: string, input: BookInput, client: ClientInfo, now = new Date()) {
    const branch = await this.directory.find(input.branchId)
    const orgId = branch.orgId
    const service = await this.bookableService(orgId, input.branchId, input.serviceId)
    await this.assertBelowLimit(accountId, now)
    await this.records.matchExisting(accountId, client)

    const practitioners = await this.availability.practitioners({ orgId, branchId: input.branchId, department: service.department })
    const free = await this.freeAt(practitioners, input.branchId, input.date, input.time, now)
    const startsAt = zonedInstant(input.date, timeToMinute(input.time), this.zone)

    const booked = await this.firstFree(free, async (practitioner) => {
      return this.prisma.transaction(async (tx) => {
        const { patientId, created } = await this.records.forBooking(tx, accountId, orgId, input.branchId, client)
        await this.assertBookable(tx, orgId, patientId, service.id, input.date)
        const reference = formatNumber('APT-', await this.counters.next(tx, orgId, 'appointment_reference'))
        const account = await tx.patientAccount.findUniqueOrThrow({
          where: { id: accountId },
          select: { consents: { where: { purpose: 'visit_alerts' }, orderBy: { createdAt: 'desc' }, take: 1, select: { granted: true } } },
        })
        const alerts = account.consents[0]?.granted ?? false
        const appointment = await this.appointments.create(tx, {
          orgId,
          reference,
          patientId,
          practitionerId: practitioner.id,
          branchId: input.branchId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + practitioner.slotMinutes * 60_000),
          type: 'consultation',
          status: 'confirmed',
          channel: 'portal',
          waitingQueue: false,
          reason: input.reason ?? service.name,
          internalNote: null,
          notifyWhatsapp: alerts,
          notifySms: alerts,
          queueToken: null,
          arrivedAt: null,
          bookedByAccountId: accountId,
          serviceId: service.id,
          quotedFee: service.fee,
        })
        await this.appointments.addEvent(tx, { appointmentId: appointment.id, action: 'booked', fromStatus: null, toStatus: 'confirmed', toStartsAt: startsAt, actorAccountId: accountId })
        await this.audit.record({ action: 'appointment.booked', entityType: 'appointment', entityId: appointment.id, orgId, details: { reference, accountId, source: 'patient_app' } }, client, tx)
        const events = await this.notifications.appointmentChanged(tx, { appointmentId: appointment.id, notice: 'booked', by: 'patient' })
        if (created) events.unshift({ topic: 'app_access', orgId, entityId: patientId, accountId })
        return { id: appointment.id, events }
      })
    })
    await this.live.publish(booked.events)
    return this.get(accountId, booked.id)
  }

  async move(accountId: string, id: string, input: MoveInput, client: ClientInfo, now = new Date()) {
    const row = await this.owned(accountId, id)
    this.assertCanChange(row, 'reschedule', now)
    const practitioners = await this.movePool(row)
    const startsAt = zonedInstant(input.date, timeToMinute(input.time), this.zone)
    if (startsAt.getTime() === row.startsAt.getTime()) throw unprocessable('SAME_SLOT', 'Choose a different time from the current one.')
    // The therapist already booked keeps the visit if they are free at the new time.
    const free = await this.freeAt(practitioners, row.branch.id, input.date, input.time, now, id, row.practitioner.id)

    const events = await this.firstFree(free, async (practitioner) => {
      return this.prisma.transaction(async (tx) => {
        const current = await this.locked(tx, row.orgId, id)
        this.assertCanChange(current, 'reschedule', now)
        await this.assertBookable(tx, row.orgId, row.patient.id, current.serviceId, input.date, id)
        // A booking the desk has not confirmed yet stays unconfirmed after the patient moves it.
        const status = current.status === 'pending' ? 'pending' : transition('reschedule', current.status)
        await this.appointments.update(tx, id, { practitionerId: practitioner.id, startsAt, endsAt: new Date(startsAt.getTime() + practitioner.slotMinutes * 60_000), status })
        await this.appointments.addEvent(tx, { appointmentId: id, action: 'reschedule', fromStatus: current.status, toStatus: status, fromStartsAt: current.startsAt, toStartsAt: startsAt, reason: 'Moved by the patient', actorAccountId: accountId })
        await this.audit.record({ action: 'appointment.reschedule', entityType: 'appointment', entityId: id, orgId: row.orgId, details: { accountId, source: 'patient_app' } }, client, tx)
        return this.notifications.appointmentChanged(tx, {
          appointmentId: id,
          notice: 'rescheduled',
          by: 'patient',
          ...(practitioner.id !== current.practitioner.id && { previousPractitionerId: current.practitioner.id }),
        })
      })
    })
    await this.live.publish(events)
    return this.get(accountId, id)
  }

  async cancel(accountId: string, id: string, reason: string, client: ClientInfo, now = new Date()) {
    const row = await this.owned(accountId, id)
    const events: LiveEvent[] = await this.prisma.transaction(async (tx) => {
      const current = await this.locked(tx, row.orgId, id)
      this.assertCanChange(current, 'cancel', now)
      const status = transition('cancel', current.status)
      await this.appointments.update(tx, id, { status, closedReason: reason })
      await this.appointments.addEvent(tx, { appointmentId: id, action: 'cancel', fromStatus: current.status, toStatus: status, reason, actorAccountId: accountId })
      await this.audit.record({ action: 'appointment.cancel', entityType: 'appointment', entityId: id, orgId: row.orgId, details: { accountId, source: 'patient_app' } }, client, tx)
      return this.notifications.appointmentChanged(tx, { appointmentId: id, notice: 'cancelled', by: 'patient' })
    })
    await this.live.publish(events)
    return this.get(accountId, id)
  }

  // ── Rules ──

  // Every patient read and change is limited to the records linked to the account.
  private async mine(accountId: string): Promise<Prisma.AppointmentWhereInput> {
    const links = await this.links.active(accountId)
    return { patientId: { in: links.map((link) => link.patientId) } }
  }

  private async owned(accountId: string, id: string) {
    const row = await this.prisma.appointment.findFirst({ where: { AND: [await this.mine(accountId), { id }] }, select: appointmentSelect })
    if (!row) throw notFound('Appointment not found.')
    return row
  }

  private async locked(tx: Tx, orgId: string, id: string) {
    await this.appointments.lock(tx, orgId, id)
    return tx.appointment.findUniqueOrThrow({ where: { id }, select: appointmentSelect })
  }

  private canChange(row: Row, action: 'reschedule' | 'cancel', now: Date) {
    return canTransition(action, row.status) && row.startsAt.getTime() > now.getTime()
  }

  private assertCanChange(row: Row, action: 'reschedule' | 'cancel', now: Date) {
    if (!this.canChange(row, action, now)) {
      throw conflict('CHANGE_NOT_ALLOWED', `This appointment can no longer be ${action === 'cancel' ? 'cancelled' : 'moved'} in the app. Call the clinic if you need help.`)
    }
  }

  private movableOnline(row: Row) {
    const serviceOpen = !!row.service && row.service.patientBookable && row.service.status === 'active' && !!row.service.department
    const therapistOpen = row.practitioner.onlineBooking && row.practitioner.status === 'active'
    return !row.waitingQueue && row.branch.listedInPatientApp && row.branch.status === 'active' && (serviceOpen || therapistOpen)
  }

  // Who may take the appointment at its new time: anyone who takes the service, or for a visit the desk booked,
  // the same therapist.
  private async movePool(row: Row) {
    const byService = row.service?.patientBookable && row.service.status === 'active' && row.service.department
    const practitioners = this.movableOnline(row)
      ? await this.availability.practitioners({ orgId: row.orgId, branchId: row.branch.id, ...(byService ? { department: row.service!.department! } : { id: row.practitioner.id }) })
      : []
    if (!practitioners.length) throw unprocessable('NOT_MOVABLE_ONLINE', 'This appointment cannot be moved in the app. Call the clinic to change it.')
    return practitioners
  }

  private async bookableService(orgId: string, branchId: string, serviceId: string) {
    const service = (await this.availability.services(orgId, branchId)).find((entry) => entry.id === serviceId)
    if (!service) throw unprocessable('SERVICE_NOT_BOOKABLE', 'This service cannot be booked in the app at this clinic.')
    return service
  }

  private async freeAt(practitioners: BookablePractitioner[], branchId: string, date: string, time: string, now: Date, excludeId?: string, preferred?: string) {
    const [day] = await this.availability.days(practitioners, branchId, date, 1, now, excludeId)
    if (day?.closed !== undefined) throw unprocessable('BRANCH_CLOSED', `The clinic is closed that day (${day.closed}). Choose another date.`)
    const slot = day?.slots.find((entry) => entry.time === time)
    if (!slot) throw unprocessable('SLOT_NOT_AVAILABLE', 'That time is not open for booking. Choose one of the listed times.')
    if (!slot.free.length) throw slotTaken()

    const counts = await this.prisma.appointment.groupBy({
      by: ['practitionerId'],
      where: { practitionerId: { in: slot.free }, status: { in: [...OPEN_STATUSES] }, startsAt: { gte: zonedInstant(date, 0, this.zone), lt: zonedInstant(addDays(date, 1), 0, this.zone) } },
      _count: { _all: true },
    })
    const order = assignmentOrder(slot.free, new Map(counts.map((entry) => [entry.practitionerId, entry._count._all])), preferred)
    return order.map((id) => practitioners.find((practitioner) => practitioner.id === id)!)
  }

  // Tries each free therapist in turn: the database refuses a slot someone else took a moment earlier.
  private async firstFree<T>(candidates: BookablePractitioner[], attempt: (practitioner: BookablePractitioner) => Promise<T>): Promise<T> {
    for (const practitioner of candidates) {
      try {
        return await attempt(practitioner)
      } catch (error) {
        const constraint = violatedConstraint(error, [PRACTITIONER_OVERLAP, PATIENT_OVERLAP])
        if (constraint === PATIENT_OVERLAP) throw conflict('PATIENT_DOUBLE_BOOKED', 'You already have another appointment at that time.')
        if (constraint !== PRACTITIONER_OVERLAP) throw error
      }
    }
    throw slotTaken()
  }

  private async assertBelowLimit(accountId: string, now: Date) {
    const open = await this.prisma.appointment.count({ where: { bookedByAccountId: accountId, status: { in: [...OPEN_STATUSES] }, startsAt: { gt: now } } })
    if (open >= MAX_OPEN_APP_BOOKINGS) {
      throw unprocessable('TOO_MANY_BOOKINGS', `You already have ${MAX_OPEN_APP_BOOKINGS} upcoming appointments booked in the app. Cancel one before booking another.`)
    }
  }

  private async assertBookable(tx: Tx, orgId: string, patientId: string, serviceId: string | null, date: string, excludeId?: string) {
    const status = await this.appointments.lockPatient(tx, orgId, patientId)
    if (status !== 'active') throw unprocessable('PATIENT_INACTIVE', 'This clinic record is not active. Call the clinic to book.')
    if (!serviceId) return
    const duplicate = await tx.appointment.findFirst({
      where: {
        patientId,
        serviceId,
        status: { in: [...OPEN_STATUSES] },
        startsAt: { gte: zonedInstant(date, 0, this.zone), lt: zonedInstant(addDays(date, 1), 0, this.zone) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { startsAt: true },
    })
    if (duplicate) throw conflict('DUPLICATE_BOOKING', `You already have this service booked at ${this.stamp(duplicate.startsAt).time} that day.`)
  }

  private view(row: Row, now: Date) {
    const start = this.stamp(row.startsAt)
    const { latitude, longitude, listedInPatientApp: _listed, status: _status, ...branch } = row.branch
    const { onlineBooking: _online, status: _therapistStatus, id: _therapistId, ...practitioner } = row.practitioner
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      type: row.type,
      date: start.date,
      time: start.time,
      endTime: this.stamp(row.endsAt).time,
      startsAt: row.startsAt.toISOString(),
      clinicName: row.organisation.displayName,
      branch: { ...branch, latitude: latitude === null ? null : Number(latitude), longitude: longitude === null ? null : Number(longitude), listed: row.branch.listedInPatientApp },
      practitioner,
      serviceName: row.service?.name ?? null,
      fee: row.quotedFee === null ? null : Number(row.quotedFee),
      reason: row.reason,
      patientName: row.patient.fullName,
      mrn: row.patient.mrn,
      queueToken: row.queueToken,
      cancelReason: row.status === 'cancelled' ? row.closedReason : null,
      bookedInApp: row.bookedByAccountId !== null,
      canCancel: this.canChange(row, 'cancel', now),
      canReschedule: this.canChange(row, 'reschedule', now) && this.movableOnline(row),
    }
  }
}

const slotTaken = () => conflict('SLOT_TAKEN', 'That time has just been booked. Choose another.')

const startOfClinicDay = (now: Date, zone: string) => zonedInstant(localDate(now, zone), 0, zone)
