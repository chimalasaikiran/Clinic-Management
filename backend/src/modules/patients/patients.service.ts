import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import { CareScope, CareScopeService } from '../scheduling/care-scope.service'
import { localDate } from '../scheduling/clinic-time'
import { PatientRow, PatientsRepository } from './patients.repository'
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from './patients.schemas'

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsRepository,
    private readonly counters: CountersRepository,
    private readonly careScope: CareScopeService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: PatientRow) {
    const { appointments, dateOfBirth, homeBranch, ...rest } = row
    const last = appointments[0]
    return {
      ...rest,
      dateOfBirth: dateOfBirth.toISOString().slice(0, 10),
      homeBranch,
      lastVisit: last ? { date: localDate(last.startsAt, this.env.CLINIC_TIMEZONE), practitioner: last.practitioner.displayName, department: last.practitioner.department } : null,
    }
  }

  async list(access: AccessContext, query: ListPatientsQuery) {
    const scope = await this.careScope.resolve(access)
    const { total, rows } = await this.patients.search(access.orgId, scope, query)
    return { items: rows.map((row) => this.view(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async get(access: AccessContext, id: string) {
    return this.view(await this.findScoped(access.orgId, await this.careScope.resolve(access), id))
  }

  // Patients already registered with this mobile number, shown to staff before a new MRN is issued.
  async duplicates(orgId: string, mobile: string, excludeId?: string) {
    return (await this.patients.findByMobile(orgId, mobile, excludeId)).map((row) => this.view(row))
  }

  // `link` runs inside the registration transaction, so a record created from a lead is linked to it or not created.
  async create(access: AccessContext, actorUserId: string, input: CreatePatientInput, client: ClientInfo, link?: (tx: Tx, patient: { id: string; mrn: string }) => Promise<void>) {
    const { confirmedNotDuplicate, ...fields } = input
    await this.assertBranch(access.orgId, fields.homeBranchId)
    if (!confirmedNotDuplicate) {
      const matches = await this.patients.findByMobile(access.orgId, fields.mobile)
      if (matches.length) {
        throw conflict('POSSIBLE_DUPLICATE', 'A patient with this mobile number is already registered. Check the existing record or confirm this is a different person.', matches.map((match) => ({ field: 'mobile', issue: `${match.fullName} (${match.mrn})` })))
      }
    }

    const id = await this.prisma.transaction(async (tx) => {
      const mrn = formatNumber('PT-', await this.counters.next(tx, access.orgId, 'patient_mrn'))
      const created = await this.patients.create(tx, access.orgId, mrn, fields, actorUserId)
      await this.audit.record({ action: 'patient.registered', entityType: 'patient', entityId: created.id, orgId: access.orgId, actorUserId, details: { mrn } }, client, tx)
      if (link) await link(tx, { id: created.id, mrn })
      return created.id
    })
    return this.get(access, id)
  }

  async update(access: AccessContext, id: string, actorUserId: string, input: UpdatePatientInput, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    await this.findScoped(access.orgId, scope, id)
    const { version, ...fields } = input
    await this.assertBranch(access.orgId, fields.homeBranchId)
    if ((await this.patients.update(access.orgId, id, version, fields)) === 0) {
      throw conflict('PATIENT_CHANGED', 'Someone else changed this patient while you were editing. Reload to see the latest details, then make your change again.')
    }
    await this.audit.record({ action: 'patient.updated', entityType: 'patient', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  async setStatus(access: AccessContext, id: string, actorUserId: string, input: { status: 'active' | 'inactive'; note: string | null }, client: ClientInfo) {
    const scope = await this.careScope.resolve(access)
    await this.findScoped(access.orgId, scope, id)
    await this.patients.setStatus(access.orgId, id, input.status, input.note)
    await this.audit.record({ action: `patient.${input.status === 'active' ? 'reactivated' : 'deactivated'}`, entityType: 'patient', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.get(access, id)
  }

  private async findScoped(orgId: string, scope: CareScope, id: string) {
    const row = await this.patients.find(orgId, scope, id)
    // Out of scope and missing look the same, so record ids cannot be probed.
    if (!row) throw notFound('Patient not found.')
    return row
  }

  private async assertBranch(orgId: string, branchId: string) {
    if (!(await this.patients.activeBranch(orgId, branchId))) throw unprocessable('BRANCH_UNKNOWN', 'Choose an active branch of this organisation.')
  }
}
