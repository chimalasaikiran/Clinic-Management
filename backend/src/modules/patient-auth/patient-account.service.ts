import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import { PrismaService } from '../../database/prisma.service'
import { CONSENT_PURPOSES, ConsentInput, POLICY_VERSION, UpdatePatientProfileInput } from './patient-auth.schemas'
import { PatientLinksService } from './patient-links.service'

const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null

@Injectable()
export class PatientAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: PatientLinksService,
    private readonly audit: AuditService,
  ) {}

  // The password hash and internal columns are never selected.
  async view(accountId: string) {
    const row = await this.prisma.patientAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true, mobile: true, fullName: true, email: true, dateOfBirth: true, gender: true, bloodGroup: true,
        addressLine: true, city: true, state: true, pinCode: true,
        emergencyName: true, emergencyRelation: true, emergencyPhone: true, language: true, createdAt: true,
      },
    })
    if (!row) throw notFound('Account not found.')
    return { ...row, dateOfBirth: day(row.dateOfBirth) }
  }

  async update(accountId: string, input: UpdatePatientProfileInput, client: ClientInfo) {
    const { dateOfBirth, ...rest } = input
    // Only the fields the caller sent: an absent field must not clear a saved value.
    const data = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined))

    let setsBirthDate = false
    if (dateOfBirth) {
      // Records are matched on the date of birth, so it can be set once and never changed from the app.
      // Otherwise someone holding a shared family phone could try dates until a relative's record appeared.
      const { count } = await this.prisma.patientAccount.updateMany({
        where: { id: accountId, dateOfBirth: null },
        data: { dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`) },
      })
      setsBirthDate = count === 1
      if (!setsBirthDate && (await this.view(accountId)).dateOfBirth !== dateOfBirth) {
        throw conflict('DATE_OF_BIRTH_LOCKED', 'Your date of birth cannot be changed in the app. Ask your clinic desk to correct it.')
      }
    }
    if (Object.keys(data).length) {
      await this.prisma.patientAccount.update({ where: { id: accountId }, data: { ...data, version: { increment: 1 } }, select: { id: true } })
    }
    await this.audit.record({ action: 'patient_app.profile_updated', entityType: 'patient_account', entityId: accountId, details: { fields: [...Object.keys(data), ...(setsBirthDate ? ['dateOfBirth'] : [])] } }, client)
    if (setsBirthDate) await this.links.autoLink(accountId, client)
    return this.view(accountId)
  }

  // The latest answer for each purpose; a purpose never answered counts as not granted.
  async consents(accountId: string) {
    const rows = await this.prisma.patientConsent.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      distinct: ['purpose'],
      select: { purpose: true, granted: true, createdAt: true },
    })
    return CONSENT_PURPOSES.map((purpose) => {
      const row = rows.find((entry) => entry.purpose === purpose)
      return { purpose, granted: row?.granted ?? false, answeredAt: row?.createdAt ?? null }
    })
  }

  async recordConsents(accountId: string, input: ConsentInput, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      await tx.patientConsent.createMany({ data: input.consents.map((entry) => ({ accountId, ...entry, policyVersion: POLICY_VERSION })) })
      await this.audit.record({ action: 'patient_app.consent_recorded', entityType: 'patient_account', entityId: accountId, details: { policyVersion: POLICY_VERSION } }, client, tx)
    })
    return this.consents(accountId)
  }
}
