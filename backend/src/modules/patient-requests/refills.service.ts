import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import { LiveService } from '../../common/realtime/live.service'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { NotificationsService } from '../notifications/notifications.service'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { CareScopeService } from '../scheduling/care-scope.service'
import { refillMessages } from './requests.logic'
import type { RefillDecisionInput, RefillQueueQuery } from './requests.schemas'

const staffSelect = {
  id: true,
  status: true,
  note: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
  version: true,
  decidedBy: { select: { fullName: true } },
  branch: { select: { id: true, name: true } },
  patient: { select: { id: true, fullName: true, mrn: true, mobile: true } },
  prescription: {
    select: {
      id: true,
      reference: true,
      status: true,
      createdAt: true,
      prescriberName: true,
      indication: true,
      items: { orderBy: { position: 'asc' }, select: { name: true, strength: true, dose: true, frequency: true, durationDays: true, refills: true } },
      _count: { select: { refillRequests: { where: { status: 'approved' } } } },
    },
  },
} as const satisfies Prisma.RefillRequestSelect

type StaffRow = Prisma.RefillRequestGetPayload<{ select: typeof staffSelect }>

const pendingRefill = () => conflict('REFILL_PENDING', 'You already asked for a refill of this prescription. The clinic will reply in the app.')
const changed = () => conflict('REFILL_CHANGED', 'Someone else has already dealt with this request. Reload to see what was decided.')

@Injectable()
export class RefillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: PatientLinksService,
    private readonly careScope: CareScopeService,
    private readonly notifications: NotificationsService,
    private readonly live: LiveService,
    private readonly audit: AuditService,
  ) {}

  // ── Patient ──

  async request(accountId: string, prescriptionId: string, note: string | null, client: ClientInfo) {
    const patientIds = (await this.links.active(accountId)).map((link) => link.patientId)
    const rx = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId: { in: patientIds } },
      select: { id: true, orgId: true, branchId: true, patientId: true, reference: true, status: true, patient: { select: { fullName: true } } },
    })
    if (!rx) throw notFound('Prescription not found.')
    if (rx.status !== 'active') throw unprocessable('PRESCRIPTION_CLOSED', 'This prescription is no longer active. Book a visit to get a new one.')
    try {
      const { id, events } = await this.prisma.transaction(async (tx) => {
        const created = await tx.refillRequest.create({
          data: { orgId: rx.orgId, branchId: rx.branchId, patientId: rx.patientId, prescriptionId: rx.id, accountId, note },
          select: { id: true },
        })
        await this.audit.record({ action: 'refill.requested', entityType: 'refill_request', entityId: created.id, orgId: rx.orgId, details: { accountId, prescription: rx.reference } }, client, tx)
        const events = await this.notifications.requestChanged(tx, {
          orgId: rx.orgId, branchId: rx.branchId, patientId: rx.patientId, kind: 'refill', entityId: created.id,
          notify: { to: 'staff', notice: 'refill_requested', message: refillMessages.requested(rx.patient.fullName, rx.reference) },
        })
        return { id: created.id, events }
      })
      await this.live.publish(events)
      return this.forPatient(accountId, id)
    } catch (error) {
      if (isUniqueViolation(error)) throw pendingRefill()
      throw error
    }
  }

  async cancel(accountId: string, id: string, client: ClientInfo) {
    const row = await this.ownRequest(accountId, id)
    const events = await this.prisma.transaction(async (tx) => {
      const { count } = await tx.refillRequest.updateMany({ where: { id, status: 'requested' }, data: { status: 'cancelled', version: { increment: 1 } } })
      if (!count) throw conflict('REFILL_DECIDED', 'The clinic has already answered this request.')
      await this.audit.record({ action: 'refill.cancelled', entityType: 'refill_request', entityId: id, orgId: row.orgId, details: { accountId } }, client, tx)
      return this.notifications.requestChanged(tx, { orgId: row.orgId, branchId: row.branchId, patientId: row.patientId, kind: 'refill', entityId: id })
    })
    await this.live.publish(events)
    return this.forPatient(accountId, id)
  }

  async forPatient(accountId: string, id: string) {
    const row = await this.ownRequest(accountId, id)
    return { id: row.id, prescriptionId: row.prescriptionId, status: row.status, note: row.note, decisionNote: row.decisionNote, createdAt: row.createdAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null }
  }

  private async ownRequest(accountId: string, id: string) {
    const patientIds = (await this.links.active(accountId)).map((link) => link.patientId)
    const row = await this.prisma.refillRequest.findFirst({ where: { id, patientId: { in: patientIds } } })
    if (!row) throw notFound('Refill request not found.')
    return row
  }

  // ── Clinic queue ──

  // Organisation, branch scope and care scope: a therapist who only sees their own patients sees only their refills.
  private async scoped(access: AccessContext): Promise<Prisma.RefillRequestWhereInput> {
    const scope = await this.careScope.resolve(access)
    return {
      orgId: access.orgId,
      ...(scope.branches === 'all' ? {} : { branchId: { in: [...scope.branches] } }),
      ...(scope.patients === 'all' ? {} : { patient: { appointments: { some: { practitionerId: scope.patients.practitionerId } } } }),
    }
  }

  private view(row: StaffRow) {
    const { _count, createdAt, ...prescription } = row.prescription
    return {
      id: row.id,
      status: row.status,
      note: row.note,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy?.fullName ?? null,
      version: row.version,
      branch: row.branch,
      patient: row.patient,
      prescription: { ...prescription, issuedAt: createdAt.toISOString(), approvedRefills: _count.refillRequests, allowedRefills: Math.max(0, ...prescription.items.map((item) => item.refills)) },
    }
  }

  async queue(access: AccessContext, query: RefillQueueQuery) {
    const where: Prisma.RefillRequestWhereInput = {
      AND: [await this.scoped(access), query.status === 'all' ? {} : { status: query.status }, query.branchId ? { branchId: query.branchId } : {}],
    }
    const [total, rows, waiting] = await Promise.all([
      this.prisma.refillRequest.count({ where }),
      this.prisma.refillRequest.findMany({
        where,
        // Waiting requests oldest first, so nobody is left behind; decided ones newest first.
        orderBy: query.status === 'requested' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: staffSelect,
      }),
      this.prisma.refillRequest.count({ where: { AND: [await this.scoped(access), { status: 'requested' }] } }),
    ])
    return { items: rows.map((row) => this.view(row)), page: query.page, pageSize: query.pageSize, total, waiting }
  }

  async decide(access: AccessContext, id: string, actorUserId: string, input: RefillDecisionInput, client: ClientInfo) {
    const row = await this.prisma.refillRequest.findFirst({
      where: { AND: [await this.scoped(access), { id }] },
      select: { id: true, branchId: true, patientId: true, status: true, prescriptionId: true, prescription: { select: { reference: true, status: true } }, branch: { select: { name: true, organisation: { select: { displayName: true } } } } },
    })
    if (!row) throw notFound('Refill request not found.')
    if (input.decision === 'approve' && row.prescription.status !== 'active') {
      throw unprocessable('PRESCRIPTION_CLOSED', 'This prescription has been stopped or completed. Decline the request, or issue a new prescription.')
    }
    const approved = input.decision === 'approve'
    const place = `${row.branch.organisation.displayName}, ${row.branch.name}`
    const events = await this.prisma.transaction(async (tx) => {
      const { count } = await tx.refillRequest.updateMany({
        where: { id, status: 'requested', version: input.version },
        data: { status: approved ? 'approved' : 'declined', decisionNote: input.note, decidedById: actorUserId, decidedAt: new Date(), version: { increment: 1 } },
      })
      if (!count) throw changed()
      await this.audit.record({ action: `refill.${approved ? 'approved' : 'declined'}`, entityType: 'refill_request', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
      return this.notifications.requestChanged(tx, {
        orgId: access.orgId, branchId: row.branchId, patientId: row.patientId, kind: 'refill', entityId: id,
        notify: {
          to: 'patient',
          notice: approved ? 'refill_approved' : 'refill_declined',
          message: (approved ? refillMessages.approved : refillMessages.declined)(place, row.prescription.reference),
          // The patient reads the outcome on the prescription itself.
          opens: { entityType: 'prescription', entityId: row.prescriptionId },
        },
      })
    })
    await this.live.publish(events)
    const updated = await this.prisma.refillRequest.findUniqueOrThrow({ where: { id }, select: staffSelect })
    return this.view(updated)
  }
}
