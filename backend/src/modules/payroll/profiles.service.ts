import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import type { ProfileInput, SettingsInput, UpdateProfileInput } from './payroll.schemas'
import { PayrollSupport } from './payroll.support'

const SETTING_LABELS: Record<string, string> = {
  epfEnabled: 'EPF', epfRateBp: 'EPF rate', epfCap: 'EPF cap', esicEnabled: 'ESIC', esicRateBp: 'ESIC rate', esicCeiling: 'ESIC ceiling',
  ptEnabled: 'professional tax', ptState: 'professional-tax state', ptSlabs: 'professional-tax slabs', tdsEnabled: 'TDS', tdsRateBp: 'TDS rate', payDay: 'pay day',
}
const PROFILE_LABELS: Record<string, string> = { employment: 'employment', model: 'pay model', rate: 'rate', bankName: 'bank', ifsc: 'IFSC', accountLast4: 'account', active: 'status' }
const BANK_FIELDS = ['bankName', 'ifsc', 'accountLast4'] as const

// The statutory rules and each person's pay profile. Changing either can change what the open run pays, so an
// approved run goes back for approval.
@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: PayrollSupport,
    private readonly audit: AuditService,
  ) {}

  async saveSettings(access: AccessContext, actorUserId: string, input: SettingsInput, client: ClientInfo) {
    const { version, epfRate, esicRate, tdsRate, ...rest } = input
    const columns = { ...rest, epfRateBp: epfRate, esicRateBp: esicRate, tdsRateBp: tdsRate, ptSlabs: [...input.ptSlabs].sort((a, b) => a.above - b.above) as unknown as Prisma.InputJsonValue }
    await this.prisma.transaction(async (tx) => {
      const current = await this.support.rules(access.orgId, tx)
      const changed = Object.keys(SETTING_LABELS).filter((key) => JSON.stringify((current as unknown as Record<string, unknown>)[key]) !== JSON.stringify((columns as Record<string, unknown>)[key]))
      if (version === null) {
        if (current.version !== null) throw conflict('STALE_RECORD', 'Payroll settings were saved by someone else. Reload them and try again.')
        try {
          await tx.payrollSettings.create({ data: { orgId: access.orgId, ...columns, updatedById: actorUserId } })
        } catch (error) {
          if (isUniqueViolation(error)) throw conflict('STALE_RECORD', 'Payroll settings were saved by someone else. Reload them and try again.')
          throw error
        }
      } else {
        const updated = await tx.payrollSettings.updateMany({ where: { orgId: access.orgId, version }, data: { ...columns, updatedById: actorUserId, updatedAt: new Date(), version: { increment: 1 } } })
        if (updated.count === 0) throw conflict('STALE_RECORD', 'Payroll settings were changed by someone else. Reload them and try again.')
      }
      const note = changed.length ? `Changed: ${changed.map((key) => SETTING_LABELS[key]).join(', ')}` : 'No changes'
      await this.support.event(tx, access.orgId, 'settings', access.orgId, 'Payroll settings saved', actorUserId, note)
      if (changed.length) await this.support.reopen(tx, access.orgId, actorUserId, 'Payroll settings changed')
      await this.audit.record({ action: 'payroll.settings.saved', entityType: 'payroll_settings', entityId: access.orgId, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
    })
  }

  async createProfile(access: AccessContext, actorUserId: string, input: ProfileInput, client: ClientInfo) {
    const staff = await this.support.staff(access.orgId, input.staffId)
    try {
      return await this.prisma.transaction(async (tx) => {
        const profile = await tx.payProfile.create({ data: { orgId: access.orgId, ...input }, select: { id: true } })
        await this.support.event(tx, access.orgId, 'profile', profile.id, 'Pay profile created', actorUserId, staff.fullName)
        // A person given a profile while a run is open joins it for review.
        const cycle = await this.support.lockOpenCycle(tx, access.orgId)
        if (cycle && input.active && staff.status === 'active') {
          await tx.payrollEntry.upsert({ where: { cycleId_staffId: { cycleId: cycle.id, staffId: staff.id } }, create: { cycleId: cycle.id, staffId: staff.id, status: 'needs_review', statusNote: 'Pay profile added during the run' }, update: {} })
          await this.support.reopen(tx, access.orgId, actorUserId, `${staff.fullName} added to the run`)
        }
        await this.audit.record({ action: 'payroll.profile.created', entityType: 'pay_profile', entityId: profile.id, orgId: access.orgId, actorUserId, details: { staffId: staff.id } }, client, tx)
        return profile.id
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('PROFILE_EXISTS', `${staff.fullName} already has a pay profile. Edit it instead.`)
      throw error
    }
  }

  async updateProfile(access: AccessContext, id: string, actorUserId: string, input: UpdateProfileInput, client: ClientInfo) {
    const { version, ...columns } = input
    await this.prisma.transaction(async (tx) => {
      const current = await tx.payProfile.findFirst({ where: { id, orgId: access.orgId }, include: { staff: { select: { fullName: true } } } })
      if (!current) throw notFound('Pay profile not found.')
      const changed = Object.keys(PROFILE_LABELS).filter((key) => (current as Record<string, unknown>)[key] !== (columns as Record<string, unknown>)[key])
      // New bank details have to be verified again before anyone is paid to them.
      const bankChanged = BANK_FIELDS.some((key) => changed.includes(key))
      const updated = await tx.payProfile.updateMany({
        where: { id, orgId: access.orgId, version },
        data: { ...columns, ...(bankChanged && { bankVerified: false, bankVerifiedById: null, bankVerifiedAt: null }), version: { increment: 1 } },
      })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This pay profile was changed by someone else. Reload it and try again.')
      const note = changed.length ? `${current.staff.fullName} · changed: ${changed.map((key) => PROFILE_LABELS[key]).join(', ')}${bankChanged ? ' · bank details need verifying again' : ''}` : current.staff.fullName
      await this.support.event(tx, access.orgId, 'profile', id, 'Pay profile updated', actorUserId, note)
      if (changed.length) await this.support.reopen(tx, access.orgId, actorUserId, `${current.staff.fullName}'s pay profile changed`)
      await this.audit.record({ action: 'payroll.profile.updated', entityType: 'pay_profile', entityId: id, orgId: access.orgId, actorUserId, details: { changed } }, client, tx)
    })
  }

  async verifyBank(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    await this.prisma.transaction(async (tx: Tx) => {
      const current = await tx.payProfile.findFirst({ where: { id, orgId: access.orgId }, include: { staff: { select: { fullName: true } } } })
      if (!current) throw notFound('Pay profile not found.')
      if (current.bankVerified) throw conflict('BANK_VERIFIED', 'These bank details are already verified.')
      const updated = await tx.payProfile.updateMany({ where: { id, version, bankVerified: false }, data: { bankVerified: true, bankVerifiedById: actorUserId, bankVerifiedAt: new Date(), version: { increment: 1 } } })
      if (updated.count === 0) throw conflict('STALE_RECORD', 'This pay profile was changed by someone else. Reload it and try again.')
      await this.support.event(tx, access.orgId, 'profile', id, 'Bank details verified', actorUserId, `${current.staff.fullName} · ${current.bankName} ••••${current.accountLast4}`)
      await this.audit.record({ action: 'payroll.profile.bank_verified', entityType: 'pay_profile', entityId: id, orgId: access.orgId, actorUserId }, client, tx)
    })
  }
}
