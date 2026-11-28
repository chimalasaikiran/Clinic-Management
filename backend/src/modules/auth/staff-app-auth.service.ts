import { Inject, Injectable } from '@nestjs/common'
import { z } from 'zod'
import { AuditService } from '../../common/audit/audit.service'
import { badRequest, conflict, forbidden, tooManyRequests, unauthorized } from '../../common/errors/app-error'
import { RateLimitService } from '../../common/security/rate-limit.service'
import { SmsService } from '../../common/sms/sms.service'
import { generateCode, generateToken, hashesMatch, keyedHash } from '../../common/utils/crypto'
import type { ClientInfo } from '../../common/utils/request'
import { indianMobile } from '../../common/validation/validation'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { UsersRepository } from '../users/users.repository'
import { AuthService } from './auth.service'
import { LOGIN_LOCK } from './auth.limits'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'

const CODE_TTL_MS = 5 * 60_000
const MAX_ATTEMPTS = 5

const MINUTE = 60
export const STAFF_APP_LIMITS = {
  loginIp: { name: 'staff-app-login:ip', max: 30, windowSeconds: 15 * MINUTE },
  loginMobile: { name: 'staff-app-login:mobile', max: 10, windowSeconds: 15 * MINUTE },
  verifyIp: { name: 'staff-app-verify:ip', max: 30, windowSeconds: 15 * MINUTE },
}

const deviceName = z.string().trim().min(1).max(120).catch('Phone')
export const staffAppLoginSchema = z.object({ mobile: indianMobile, password: z.string().min(1, 'Enter your password.').max(200), deviceName })
export const staffAppVerifySchema = z.object({ ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Start signing in again.'), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') })

const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'Mobile number or password is incorrect.')
const invalidCode = () => badRequest('CODE_INVALID', 'That code is incorrect or has expired. Sign in again to get a new one.')

export const maskMobile = (mobile: string) => `${mobile.slice(0, 2)}••••••${mobile.slice(-2)}`

// Signing in to the staff app: the mobile on the person's staff record and their password, then a code sent by SMS
// to that mobile. Only then is an app session (a bearer token, never a cookie) issued.
@Injectable()
export class StaffAppAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly sms: SmsService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The account behind a staff mobile. Staff records are per clinic, so one person may appear several times; two
  // different accounts on one number cannot be told apart and are refused.
  private async userForMobile(mobile: string) {
    const rows = await this.prisma.staffMember.findMany({
      where: { mobile, status: 'active', membership: { status: 'active', organisation: { status: { not: 'suspended' } } } },
      select: { membership: { select: { userId: true } } },
    })
    const ids = [...new Set(rows.map((row) => row.membership!.userId))]
    if (ids.length > 1) throw conflict('MOBILE_SHARED', 'This mobile number is on more than one staff account. Ask your clinic administrator to correct the staff records.')
    return ids[0] ? this.users.findById(ids[0]) : null
  }

  async login(input: z.infer<typeof staffAppLoginSchema>, client: ClientInfo) {
    await this.limits.consumeAll([
      [STAFF_APP_LIMITS.loginIp, client.ip],
      [STAFF_APP_LIMITS.loginMobile, input.mobile],
    ])
    const user = await this.userForMobile(input.mobile)
    if (!user) {
      await this.passwords.verifyAgainstDummy(input.password)
      throw invalidCredentials()
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw tooManyRequests((user.lockedUntil.getTime() - Date.now()) / 1000)
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      const failures = await this.users.recordFailedLogin(user.id)
      if (failures >= LOGIN_LOCK.failures) await this.users.lock(user.id, new Date(Date.now() + LOGIN_LOCK.minutes * 60_000))
      await this.audit.record({ action: 'auth.app_sign_in_failed', entityType: 'user', entityId: user.id }, client)
      throw invalidCredentials()
    }
    if (user.status !== 'active') throw forbidden('ACCOUNT_DISABLED', 'This account is disabled. Contact your clinic administrator.')
    if (!user.emailVerifiedAt) throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email address in the ClinicOS admin panel first.')

    const code = generateCode()
    const ticket = generateToken()
    await this.prisma.transaction(async (tx) => {
      // A new code replaces any earlier one for this person.
      await tx.staffAppChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } })
      await tx.staffAppChallenge.create({
        data: { userId: user.id, mobile: input.mobile, ticketHash: this.hash('ticket', ticket), codeHash: this.hash('code', `${ticket}:${code}`), deviceName: input.deviceName, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      })
    })
    await this.sms.sendCode(input.mobile, code)
    return { ticket, sentTo: maskMobile(input.mobile), expiresInSeconds: CODE_TTL_MS / 1000 }
  }

  async verify(input: z.infer<typeof staffAppVerifySchema>, client: ClientInfo) {
    await this.limits.consume(STAFF_APP_LIMITS.verifyIp, client.ip ?? 'unknown')
    const ticketHash = this.hash('ticket', input.ticket)
    const session = await this.prisma.transaction(async (tx) => {
      // Locks the challenge so two guesses at once cannot both count as the last allowed attempt.
      const rows = await tx.$queryRaw<Array<{ id: string }>>`select id from staff_app_challenges where ticket_hash = ${ticketHash} for update`
      const challenge = rows[0] ? await tx.staffAppChallenge.findUnique({ where: { id: rows[0].id } }) : null
      if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= MAX_ATTEMPTS) return null
      if (!hashesMatch(challenge.codeHash, this.hash('code', `${input.ticket}:${input.code}`))) {
        await tx.staffAppChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } })
        return null
      }
      await tx.staffAppChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })
      const user = await tx.user.findUniqueOrThrow({ where: { id: challenge.userId }, select: { id: true, status: true } })
      if (user.status !== 'active') throw forbidden('ACCOUNT_DISABLED', 'This account is disabled. Contact your clinic administrator.')
      await this.users.recordSuccessfulLogin(user.id, tx)
      const started = await this.sessions.start(user.id, client, tx, { deviceName: challenge.deviceName })
      await this.audit.record({ action: 'auth.app_signed_in', entityType: 'user', entityId: user.id, actorUserId: user.id, details: { sessionId: started.sessionId, device: challenge.deviceName } }, client, tx)
      return { ...started, userId: user.id }
    })
    if (!session) throw invalidCode()
    return { token: session.token, expiresAt: session.expiresAt.toISOString(), ...(await this.auth.sessionPayload(session.userId)) }
  }

  private hash(kind: 'ticket' | 'code', value: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `staff-app-${kind}:${value}`)
  }
}
