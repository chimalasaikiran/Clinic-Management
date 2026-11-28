import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { badRequest, conflict } from '../../common/errors/app-error'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import { PasswordService } from '../auth/password.service'
import { PatientAccountService } from './patient-account.service'
import type { OtpVerifyInput, RegisterPatientInput } from './patient-auth.schemas'
import { PatientLinksService } from './patient-links.service'
import { PatientOtpService } from './patient-otp.service'
import { PatientSessionsService, patientSessionEnded } from './patient-sessions.service'
import { PATIENT_LIMITS } from './patient.limits'

const wrongCode = () => badRequest('CODE_INVALID', 'That code is incorrect or has expired. Request a new code.')

// Sign-in by mobile number and one-time code, and account creation for a number seen for the first time.
@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: PatientOtpService,
    private readonly sessions: PatientSessionsService,
    private readonly accounts: PatientAccountService,
    private readonly links: PatientLinksService,
    private readonly passwords: PasswordService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  async requestCode(mobile: string, client: ClientInfo) {
    await this.limits.consumeAll([
      [PATIENT_LIMITS.codeIp, client.ip],
      [PATIENT_LIMITS.codeMobile, mobile],
    ])
    return this.otp.send(mobile)
  }

  async verifyCode(input: OtpVerifyInput, client: ClientInfo) {
    await this.limits.consumeAll([
      [PATIENT_LIMITS.verifyIp, client.ip],
      [PATIENT_LIMITS.verifyMobile, input.mobile],
    ])
    const proof = await this.otp.consume(input.mobile, input.code)
    if (!proof) throw wrongCode()

    const account = await this.prisma.patientAccount.findUnique({ where: { mobile: input.mobile }, select: { id: true, status: true } })
    if (!account) return { status: 'registration_required' as const, registrationToken: await this.otp.issueTicket(proof.id) }
    if (account.status !== 'active') throw patientSessionEnded.disabled()

    const session = await this.sessions.start(account.id, input, client)
    await this.audit.record({ action: 'patient_app.signed_in', entityType: 'patient_account', entityId: account.id }, client)
    // A clinic may have registered this person since they last signed in.
    await this.links.autoLink(account.id, client)
    return { status: 'signed_in' as const, ...session, account: await this.accounts.view(account.id) }
  }

  async register(input: RegisterPatientInput, client: ClientInfo) {
    await this.limits.consumeAll([[PATIENT_LIMITS.registerIp, client.ip]])
    const passwordHash = await this.passwords.hash(input.password)
    try {
      const { accountId, session } = await this.prisma.transaction(async (tx) => {
        const mobile = await this.otp.claimTicket(input.registrationToken, tx)
        if (!mobile) throw badRequest('REGISTRATION_EXPIRED', 'Your verification has expired. Verify your mobile number again.')
        const created = await tx.patientAccount.create({ data: { mobile, fullName: input.fullName, email: input.email, passwordHash }, select: { id: true } })
        await this.audit.record({ action: 'patient_app.registered', entityType: 'patient_account', entityId: created.id }, client, tx)
        return { accountId: created.id, session: await this.sessions.start(created.id, input, client, tx) }
      })
      return { status: 'signed_in' as const, ...session, account: await this.accounts.view(accountId) }
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('ACCOUNT_EXISTS', 'This mobile number already has an account. Sign in instead.')
      throw error
    }
  }
}
