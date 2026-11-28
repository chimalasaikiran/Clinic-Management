import { Injectable } from '@nestjs/common'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { AppointmentStatus, Prisma } from '../../generated/prisma/client'
import type { CareScope } from '../scheduling/care-scope.service'
import { OPEN_STATUSES } from '../scheduling/scheduling.constants'

export const appointmentSelect = {
  id: true,
  reference: true,
  status: true,
  type: true,
  channel: true,
  waitingQueue: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  internalNote: true,
  notifyWhatsapp: true,
  notifySms: true,
  queueToken: true,
  arrivedAt: true,
  closedReason: true,
  version: true,
  createdAt: true,
  patient: { select: { id: true, mrn: true, fullName: true, mobile: true, dateOfBirth: true, gender: true, status: true } },
  practitioner: { select: { id: true, displayName: true, credentials: true, specialty: true, department: true, room: true, slotMinutes: true } },
  branch: { select: { id: true, name: true, city: true } },
  bookedBy: { select: { fullName: true } },
  service: { select: { name: true } },
} as const satisfies Prisma.AppointmentSelect

export const eventSelect = {
  id: true,
  action: true,
  fromStatus: true,
  toStatus: true,
  fromStartsAt: true,
  toStartsAt: true,
  reason: true,
  note: true,
  createdAt: true,
  actor: { select: { fullName: true } },
} as const satisfies Prisma.AppointmentEventSelect

export type AppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>
export type EventRow = Prisma.AppointmentEventGetPayload<{ select: typeof eventSelect }>

export interface NewAppointment {
  orgId: string
  reference: string
  patientId: string
  practitionerId: string
  branchId: string
  startsAt: Date
  endsAt: Date
  type: Prisma.AppointmentCreateManyInput['type']
  status: AppointmentStatus
  channel: Prisma.AppointmentCreateManyInput['channel']
  waitingQueue: boolean
  reason: string
  internalNote: string | null
  notifyWhatsapp: boolean
  notifySms: boolean
  queueToken: string | null
  arrivedAt: Date | null
  // Staff bookings name the user; bookings made in the patient app name the account instead.
  bookedById?: string
  bookedByAccountId?: string
  serviceId?: string
  quotedFee?: number
}

export interface NewEvent {
  appointmentId: string
  action: string
  fromStatus: AppointmentStatus | null
  toStatus: AppointmentStatus
  fromStartsAt?: Date | null
  toStartsAt?: Date | null
  reason?: string | null
  note?: string | null
  actorUserId?: string
  actorAccountId?: string
}

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Organisation, branch scope and care scope: every read and every change goes through this filter.
  scoped(orgId: string, scope: CareScope): Prisma.AppointmentWhereInput {
    if (scope.appointments === 'none') return { orgId, id: { in: [] } }
    return {
      orgId,
      ...(scope.branches === 'all' ? {} : { branchId: { in: [...scope.branches] } }),
      ...(scope.appointments === 'all' ? {} : { practitionerId: scope.appointments.practitionerId }),
    }
  }

  async list(where: Prisma.AppointmentWhereInput, page: number, pageSize: number, order: 'asc' | 'desc') {
    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({ where, orderBy: [{ startsAt: order }, { id: order }], skip: (page - 1) * pageSize, take: pageSize, select: appointmentSelect }),
    ])
    return { total, rows }
  }

  find(where: Prisma.AppointmentWhereInput, db: Tx | PrismaService = this.prisma) {
    return db.appointment.findFirst({ where, select: appointmentSelect })
  }

  events(appointmentId: string) {
    return this.prisma.appointmentEvent.findMany({ where: { appointmentId }, orderBy: { createdAt: 'desc' }, select: eventSelect })
  }

  // Row lock for the rest of the transaction: two desks acting on one appointment take turns.
  async lock(tx: Tx, orgId: string, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`select id from appointments where id = ${id}::uuid and org_id = ${orgId}::uuid for update`
    return rows.length > 0
  }

  // Serialises bookings for one patient, so the same-day duplicate check cannot race.
  async lockPatient(tx: Tx, orgId: string, patientId: string) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`select status::text from patients where id = ${patientId}::uuid and org_id = ${orgId}::uuid for update`
    return rows[0]?.status ?? null
  }

  // An open appointment for the patient with the same practitioner within [from, to), other than `excludeId`.
  openWithPractitioner(tx: Tx, patientId: string, practitionerId: string, from: Date, to: Date, excludeId?: string) {
    return tx.appointment.findFirst({
      where: { patientId, practitionerId, status: { in: [...OPEN_STATUSES] }, startsAt: { gte: from, lt: to }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { reference: true, startsAt: true },
    })
  }

  create(tx: Tx, data: NewAppointment) {
    return tx.appointment.create({ data, select: { id: true } })
  }

  update(tx: Tx, id: string, data: Prisma.AppointmentUncheckedUpdateInput) {
    return tx.appointment.update({ where: { id }, data: { ...data, version: { increment: 1 } }, select: { id: true } })
  }

  addEvent(tx: Tx, event: NewEvent) {
    return tx.appointmentEvent.create({ data: event, select: { id: true } })
  }

  practitioner(orgId: string, id: string) {
    return this.prisma.practitioner.findFirst({
      where: { id, orgId },
      select: { id: true, status: true, slotMinutes: true, availability: { select: { branchId: true, weekday: true, startMinute: true, endMinute: true } } },
    })
  }

  activeBranch(orgId: string, id: string) {
    return this.prisma.branch.findFirst({ where: { id, orgId, status: 'active' }, select: { id: true } })
  }
}
