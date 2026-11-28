import { randomInt } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { badRequest, conflict, notFound } from '../../common/errors/app-error'
import { LiveService } from '../../common/realtime/live.service'
import { keyedHash } from '../../common/utils/crypto'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import { PatientsService } from '../patients/patients.service'

export const LINK_CODE_TTL_HOURS = 24
// No I, L, O, 0 or 1, which are easy to misread from a printed slip.
const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const invalidLinkCode = () => badRequest('LINK_CODE_INVALID', 'That code is incorrect or has expired. Ask the clinic desk for a new one.')
const alreadyLinked = () => conflict('RECORD_ALREADY_LINKED', 'This record is already connected to another app account. Ask the clinic desk for help.')

// Decides which clinic records a patient account may read. A phone number alone never opens a record, because
// families share numbers: the link needs the date of birth too, or a code handed over by the clinic.
@Injectable()
export class PatientLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly audit: AuditService,
    private readonly live: LiveService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The active links of an account: what every patient record query is scoped by.
  active(accountId: string) {
    return this.prisma.patientLink.findMany({
      where: { accountId, revokedAt: null, organisation: { status: { not: 'suspended' } } },
      select: { id: true, orgId: true, patientId: true },
    })
  }

  async list(accountId: string) {
    const rows = await this.prisma.patientLink.findMany({
      where: { accountId, revokedAt: null, organisation: { status: { not: 'suspended' } } },
      orderBy: { verifiedAt: 'asc' },
      select: {
        id: true,
        orgId: true,
        method: true,
        verifiedAt: true,
        organisation: { select: { displayName: true } },
        patient: { select: { fullName: true, mrn: true, homeBranch: { select: { id: true, name: true } } } },
      },
    })
    return rows.map(({ organisation, patient, ...link }) => ({
      ...link,
      clinicName: organisation.displayName,
      patientName: patient.fullName,
      mrn: patient.mrn,
      homeBranch: patient.homeBranch,
    }))
  }

  // Links the records whose mobile number and date of birth both match, only at clinics that opted in to the app,
  // and only where exactly one record matches. Anything ambiguous waits for a code from the clinic.
  async autoLink(accountId: string, client: ClientInfo) {
    const account = await this.prisma.patientAccount.findUnique({ where: { id: accountId }, select: { mobile: true, dateOfBirth: true } })
    if (!account?.mobile || !account.dateOfBirth) return 0

    const matches = await this.prisma.patient.findMany({
      where: {
        mobile: account.mobile,
        dateOfBirth: account.dateOfBirth,
        status: 'active',
        organisation: { status: { not: 'suspended' }, branches: { some: { listedInPatientApp: true, status: 'active' } } },
      },
      select: { id: true, orgId: true, appLinks: { select: { accountId: true, revokedAt: true } } },
    })
    const perOrg = new Map<string, typeof matches>()
    for (const match of matches) perOrg.set(match.orgId, [...(perOrg.get(match.orgId) ?? []), match])

    let linked = 0
    for (const [orgId, records] of perOrg) {
      const [record, ...others] = records
      if (!record || others.length) continue
      // A link this account had before (even a revoked one) is never restored automatically.
      if (record.appLinks.some((link) => link.accountId === accountId || !link.revokedAt)) continue
      try {
        await this.prisma.transaction(async (tx) => {
          await tx.patientLink.create({ data: { accountId, orgId, patientId: record.id, method: 'mobile_dob' } })
          await this.audit.record({ action: 'patient_app.linked', entityType: 'patient', entityId: record.id, orgId, details: { accountId, method: 'mobile_dob' } }, client, tx)
        })
        linked += 1
        await this.changed(accountId, orgId, record.id)
      } catch (error) {
        // Another account linked it a moment ago.
        if (!isUniqueViolation(error)) throw error
      }
    }
    return linked
  }

  async redeem(accountId: string, code: string, client: ClientInfo) {
    try {
      const record = await this.prisma.transaction(async (tx) => {
        const row = await tx.patientLinkCode.findUnique({ where: { codeHash: this.hash(code) } })
        if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) throw invalidLinkCode()
        const claimed = await tx.patientLinkCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
        if (claimed.count !== 1) throw invalidLinkCode()

        const holder = await tx.patientLink.findFirst({ where: { patientId: row.patientId, revokedAt: null }, select: { accountId: true } })
        if (holder && holder.accountId !== accountId) throw alreadyLinked()
        // A fresh code from the clinic may restore a link that was removed earlier.
        await tx.patientLink.upsert({
          where: { accountId_patientId: { accountId, patientId: row.patientId } },
          create: { accountId, orgId: row.orgId, patientId: row.patientId, method: 'clinic_code' },
          update: { revokedAt: null, revokedById: null, method: 'clinic_code', verifiedAt: new Date() },
        })
        await this.audit.record({ action: 'patient_app.linked', entityType: 'patient', entityId: row.patientId, orgId: row.orgId, details: { accountId, method: 'clinic_code' } }, client, tx)
        return { orgId: row.orgId, patientId: row.patientId }
      })
      await this.changed(accountId, record.orgId, record.patientId)
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyLinked()
      throw error
    }
    return this.list(accountId)
  }

  // The patient disconnects a clinic from their own account.
  async unlink(accountId: string, linkId: string, client: ClientInfo) {
    const link = await this.prisma.patientLink.findFirst({ where: { id: linkId, accountId, revokedAt: null }, select: { orgId: true, patientId: true } })
    if (!link) throw notFound('Connected clinic not found.')
    await this.prisma.patientLink.update({ where: { id: linkId }, data: { revokedAt: new Date(), revokedById: null } })
    await this.audit.record({ action: 'patient_app.unlinked', entityType: 'patient', entityId: link.patientId, orgId: link.orgId, details: { accountId } }, client)
    await this.changed(accountId, link.orgId, link.patientId)
  }

  // ── Clinic desk ──

  async forPatient(access: AccessContext, patientId: string) {
    // Applies the care scope: a record the member cannot see reads as missing.
    await this.patients.get(access, patientId)
    const [links, pending] = await Promise.all([
      this.prisma.patientLink.findMany({
        where: { orgId: access.orgId, patientId },
        orderBy: { verifiedAt: 'desc' },
        select: { id: true, method: true, verifiedAt: true, revokedAt: true, account: { select: { fullName: true, mobile: true } } },
      }),
      this.prisma.patientLinkCode.findFirst({
        where: { orgId: access.orgId, patientId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { expiresAt: true },
      }),
    ])
    return {
      links: links.map(({ account, ...link }) => ({ ...link, accountName: account.fullName, accountMobile: account.mobile })),
      pendingCodeExpiresAt: pending?.expiresAt ?? null,
    }
  }

  // Returns the code once; only its hash is kept. Issuing a new one cancels any unused earlier code.
  async issueCode(access: AccessContext, userId: string, patientId: string, client: ClientInfo) {
    await this.patients.get(access, patientId)
    const code = Array.from({ length: 8 }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join('')
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_HOURS * 3_600_000)
    await this.prisma.transaction(async (tx) => {
      await tx.patientLinkCode.updateMany({ where: { orgId: access.orgId, patientId, usedAt: null }, data: { usedAt: new Date() } })
      await tx.patientLinkCode.create({ data: { orgId: access.orgId, patientId, codeHash: this.hash(code), expiresAt, issuedById: userId } })
      await this.audit.record({ action: 'patient_app.code_issued', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId: userId }, client, tx)
    })
    return { code, expiresAt }
  }

  async revoke(access: AccessContext, userId: string, patientId: string, linkId: string, client: ClientInfo) {
    await this.patients.get(access, patientId)
    const [revoked] = await this.prisma.patientLink.updateManyAndReturn({
      where: { id: linkId, orgId: access.orgId, patientId, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: userId },
      select: { accountId: true },
    })
    if (!revoked) throw notFound('App access not found.')
    await this.audit.record({ action: 'patient_app.access_revoked', entityType: 'patient', entityId: patientId, orgId: access.orgId, actorUserId: userId }, client)
    await this.changed(revoked.accountId, access.orgId, patientId)
  }

  private changed(accountId: string, orgId: string, patientId: string) {
    return this.live.publish([{ topic: 'app_access', orgId, entityId: patientId, accountId }])
  }

  private hash(code: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `patient-link:${code}`)
  }
}
