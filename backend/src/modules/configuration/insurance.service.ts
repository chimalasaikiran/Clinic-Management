import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { localDate } from '../scheduling/clinic-time'
import type { AgreementInput, UpdateAgreementInput } from './configuration.schemas'

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

const agreementSelect = {
  id: true, code: true, reference: true, startDate: true, endDate: true, status: true, methods: true, coverage: true, notes: true, version: true, activatedAt: true, createdAt: true, updatedAt: true,
  insurer: { select: { id: true, name: true, type: true } },
  tpa: { select: { id: true, name: true, type: true } },
  document: { select: { id: true, fileName: true, size: true } },
  branches: { select: { branch: { select: { id: true, name: true } } } },
  createdBy: { select: { fullName: true } },
  activatedBy: { select: { fullName: true } },
} as const satisfies Prisma.InsuranceAgreementSelect

type AgreementRow = Prisma.InsuranceAgreementGetPayload<{ select: typeof agreementSelect }>

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const asDate = (day: string) => new Date(`${day}T00:00:00Z`)

// Whether the clinic accepts insurance, the insurers and TPAs it works with, and its agreements with them. Billing
// keeps its "Insurance / TPA" payer; claims are not part of this.
@Injectable()
export class InsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view(row: AgreementRow) {
    const { branches, createdBy, activatedBy, startDate, endDate, ...rest } = row
    return { ...rest, startDate: isoDay(startDate), endDate: isoDay(endDate), branches: branches.map((entry) => entry.branch), createdBy: createdBy.fullName, activatedBy: activatedBy?.fullName ?? null }
  }

  async overview(orgId: string) {
    const [organisation, partners, agreements] = await Promise.all([
      this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId }, select: { acceptsInsurance: true } }),
      this.prisma.insurancePartner.findMany({ where: { orgId }, orderBy: [{ type: 'asc' }, { name: 'asc' }], select: { id: true, name: true, type: true, listed: true, active: true } }),
      this.prisma.insuranceAgreement.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, select: agreementSelect }),
    ])
    return { acceptsInsurance: organisation.acceptsInsurance, partners, agreements: agreements.map((row) => this.view(row)) }
  }

  async setAcceptance(access: AccessContext, accepts: boolean, actorUserId: string, client: ClientInfo) {
    await this.prisma.organisation.update({ where: { id: access.orgId }, data: { acceptsInsurance: accepts } })
    await this.audit.record({ action: 'insurance.acceptance_set', entityType: 'organisation', entityId: access.orgId, orgId: access.orgId, actorUserId, details: { accepts } }, client)
    return this.overview(access.orgId)
  }

  async addPartner(access: AccessContext, input: { name: string; type: 'insurer' | 'tpa'; listed: boolean }, actorUserId: string, client: ClientInfo) {
    const existing = await this.prisma.insurancePartner.findFirst({ where: { orgId: access.orgId, type: input.type, name: { equals: input.name, mode: 'insensitive' } }, select: { id: true, active: true } })
    if (existing) {
      // Adding a partner again turns it back on rather than creating a second record.
      if (!existing.active) await this.prisma.insurancePartner.update({ where: { id: existing.id }, data: { active: true } })
    } else {
      await this.prisma.insurancePartner.create({ data: { orgId: access.orgId, ...input } })
      await this.audit.record({ action: 'insurance.partner_added', entityType: 'insurance_partner', entityId: null, orgId: access.orgId, actorUserId, details: { name: input.name, type: input.type } }, client)
    }
    return this.overview(access.orgId)
  }

  async setPartnerActive(access: AccessContext, id: string, active: boolean, actorUserId: string, client: ClientInfo) {
    const partner = await this.prisma.insurancePartner.findFirst({ where: { id, orgId: access.orgId }, select: { id: true } })
    if (!partner) throw notFound('Partner not found.')
    if (!active && (await this.prisma.insuranceAgreement.count({ where: { status: 'active', OR: [{ insurerId: id }, { tpaId: id }] } }))) {
      throw conflict('PARTNER_IN_USE', 'End this partner’s active agreements before turning it off.')
    }
    await this.prisma.insurancePartner.update({ where: { id }, data: { active } })
    await this.audit.record({ action: 'insurance.partner_updated', entityType: 'insurance_partner', entityId: id, orgId: access.orgId, actorUserId, details: { active } }, client)
    return this.overview(access.orgId)
  }

  async uploadDocument(access: AccessContext, bytes: Buffer, fileName: string, actorUserId: string) {
    if (!bytes.length) throw unprocessable('DOCUMENT_EMPTY', 'Choose the agreement PDF.')
    if (bytes.length > MAX_DOCUMENT_BYTES) throw unprocessable('DOCUMENT_TOO_LARGE', 'Use a PDF of at most 10 MB.')
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw unprocessable('DOCUMENT_TYPE', 'Upload the agreement as a PDF.')
    return this.prisma.insuranceDocument.create({
      data: { orgId: access.orgId, fileName: fileName.replace(/[^\w.\- ]/g, '_').slice(0, 200) || 'agreement.pdf', size: bytes.length, data: new Uint8Array(bytes), createdById: actorUserId },
      select: { id: true, fileName: true, size: true, createdAt: true },
    })
  }

  async document(orgId: string, id: string) {
    const row = await this.prisma.insuranceDocument.findFirst({ where: { id, orgId }, select: { fileName: true, data: true } })
    if (!row) throw notFound('Document not found.')
    return { fileName: row.fileName, data: Buffer.from(row.data) }
  }

  async createAgreement(access: AccessContext, input: AgreementInput, actorUserId: string, client: ClientInfo) {
    await this.assertReferences(access.orgId, input)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('AGR-', await this.counters.next(tx, access.orgId, 'insurance_agreement'), 4)
      const created = await tx.insuranceAgreement.create({ data: { orgId: access.orgId, code, ...this.fields(input), createdById: actorUserId }, select: { id: true } })
      await tx.insuranceAgreementBranch.createMany({ data: input.branchIds.map((branchId) => ({ agreementId: created.id, branchId })) })
      await this.audit.record({ action: 'insurance.agreement_created', entityType: 'insurance_agreement', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return this.agreement(access.orgId, id)
  }

  // Only a draft is edited; an active agreement is ended and a new one drafted.
  async updateAgreement(access: AccessContext, id: string, input: UpdateAgreementInput, actorUserId: string, client: ClientInfo) {
    const current = await this.agreement(access.orgId, id)
    if (current.status !== 'draft') throw conflict('AGREEMENT_LOCKED', 'Only a draft agreement can be edited. End it and draft a new one.')
    await this.assertReferences(access.orgId, input, id)
    await this.prisma.transaction(async (tx) => {
      const { count } = await tx.insuranceAgreement.updateMany({ where: { id, orgId: access.orgId, version: input.version, status: 'draft' }, data: { ...this.fields(input), version: { increment: 1 } } })
      if (count === 0) throw this.changed()
      await tx.insuranceAgreementBranch.deleteMany({ where: { agreementId: id } })
      await tx.insuranceAgreementBranch.createMany({ data: input.branchIds.map((branchId) => ({ agreementId: id, branchId })) })
      await this.audit.record({ action: 'insurance.agreement_updated', entityType: 'insurance_agreement', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
    return this.agreement(access.orgId, id)
  }

  async activate(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.agreement(access.orgId, id)
    if (current.status !== 'draft') throw conflict('AGREEMENT_NOT_DRAFT', 'Only a draft agreement can be activated.')
    if (current.endDate < localDate(new Date(), this.env.CLINIC_TIMEZONE)) throw unprocessable('AGREEMENT_EXPIRED', 'This agreement’s end date has passed.')
    if (!current.insurer || !(await this.prisma.insurancePartner.count({ where: { id: current.insurer.id, active: true } }))) throw unprocessable('PARTNER_INACTIVE', 'The insurer is turned off.')
    const { count } = await this.prisma.insuranceAgreement.updateMany({ where: { id, orgId: access.orgId, version, status: 'draft' }, data: { status: 'active', activatedAt: new Date(), activatedById: actorUserId, version: { increment: 1 } } })
    if (count === 0) throw this.changed()
    await this.prisma.organisation.update({ where: { id: access.orgId }, data: { acceptsInsurance: true } })
    await this.audit.record({ action: 'insurance.agreement_activated', entityType: 'insurance_agreement', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.agreement(access.orgId, id)
  }

  async end(access: AccessContext, id: string, version: number, actorUserId: string, client: ClientInfo) {
    const current = await this.agreement(access.orgId, id)
    if (current.status !== 'active') throw conflict('AGREEMENT_NOT_ACTIVE', 'Only an active agreement can be ended.')
    const { count } = await this.prisma.insuranceAgreement.updateMany({ where: { id, orgId: access.orgId, version, status: 'active' }, data: { status: 'ended', version: { increment: 1 } } })
    if (count === 0) throw this.changed()
    await this.audit.record({ action: 'insurance.agreement_ended', entityType: 'insurance_agreement', entityId: id, orgId: access.orgId, actorUserId }, client)
    return this.agreement(access.orgId, id)
  }

  async agreement(orgId: string, id: string) {
    const row = await this.prisma.insuranceAgreement.findFirst({ where: { id, orgId }, select: agreementSelect })
    if (!row) throw notFound('Agreement not found.')
    return this.view(row)
  }

  private fields(input: AgreementInput) {
    return { insurerId: input.insurerId, tpaId: input.tpaId, reference: input.reference, startDate: asDate(input.startDate), endDate: asDate(input.endDate), documentId: input.documentId, methods: input.methods, coverage: input.coverage, notes: input.notes }
  }

  private async assertReferences(orgId: string, input: AgreementInput, excludeId?: string) {
    const [insurer, tpa, branches, document, duplicate] = await Promise.all([
      this.prisma.insurancePartner.findFirst({ where: { id: input.insurerId, orgId, type: 'insurer' }, select: { id: true } }),
      input.tpaId ? this.prisma.insurancePartner.findFirst({ where: { id: input.tpaId, orgId, type: 'tpa' }, select: { id: true } }) : Promise.resolve({ id: '' }),
      this.prisma.branch.count({ where: { id: { in: input.branchIds }, orgId } }),
      input.documentId ? this.prisma.insuranceDocument.count({ where: { id: input.documentId, orgId } }) : Promise.resolve(1),
      this.prisma.insuranceAgreement.findFirst({ where: { orgId, reference: input.reference, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { code: true } }),
    ])
    if (!insurer) throw unprocessable('INSURER_UNKNOWN', 'Choose an insurer added for this organisation.')
    if (!tpa) throw unprocessable('TPA_UNKNOWN', 'Choose a TPA added for this organisation.')
    if (branches !== new Set(input.branchIds).size) throw unprocessable('BRANCH_UNKNOWN', 'Choose branches of this organisation.')
    if (!document) throw unprocessable('DOCUMENT_UNKNOWN', 'Upload the agreement document again.')
    if (duplicate) throw conflict('REFERENCE_TAKEN', `Agreement ${duplicate.code} already uses this reference.`)
  }

  private changed() {
    return conflict('AGREEMENT_CHANGED', 'Someone else changed this agreement. Reload it and try again.')
  }
}
