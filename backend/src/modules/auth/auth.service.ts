import { Injectable, Logger } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { badRequest, forbidden, tooManyRequests, unauthorized } from '../../common/errors/app-error'
import { MailService } from '../../common/mail/mail.service'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { AuthContext, ClientInfo } from '../../common/utils/request'
import { isUniqueViolation } from '../../database/prisma-errors'
import { PrismaService } from '../../database/prisma.service'
import { AccessService } from '../permissions/access.service'
import { UsersRepository } from '../users/users.repository'
import { publicUser } from '../users/users.service'
import { LIMITS, LOGIN_LOCK } from './auth.limits'
import type { ChangePasswordInput, LoginInput, RegisterInput, ResetInput } from './auth.schemas'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'
import { invalidCode, VerificationService } from './verification.service'

const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect.')

// Account flows. Responses never reveal whether an email has an account: registration, resend and reset
// requests always answer with the same body, and a wrong email fails exactly like a wrong password.
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly codes: VerificationService,
    private readonly access: AccessService,
    private readonly mail: MailService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.registerIp, client.ip],
      [LIMITS.registerEmail, input.email],
    ])
    // Hash before looking the email up, so new and existing emails take the same time to answer.
    const passwordHash = await this.passwords.hash(input.password)
    if (await this.users.findByEmail(input.email)) {
      await this.deliver(() => this.mail.accountAlreadyExists(input.email))
      return this.pending(input.email)
    }

    let code: string
    try {
      code = await this.prisma.transaction(async (tx) => {
        const user = await this.users.create({ email: input.email, fullName: input.fullName, passwordHash, verified: false }, tx)
        const issued = await this.codes.issue(user.id, 'email_verification', tx)
        await this.audit.record({ action: 'auth.registered', entityType: 'user', entityId: user.id, actorUserId: user.id }, client, tx)
        return 'code' in issued ? issued.code : ''
      })
    } catch (error) {
      // Two registrations for the same email at once: the loser is told the same thing as any existing account.
      if (!isUniqueViolation(error)) throw error
      await this.deliver(() => this.mail.accountAlreadyExists(input.email))
      return this.pending(input.email)
    }

    await this.deliver(() => this.mail.verificationCode(input.email, input.fullName, code))
    return this.pending(input.email)
  }

  async confirmEmail(input: { email: string; code: string }, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.verifyIp, client.ip],
      [LIMITS.verifyEmail, input.email],
    ])
    const user = await this.users.findByEmail(input.email)
    if (!user || user.emailVerifiedAt) throw invalidCode()

    const verified = await this.prisma.transaction(async (tx) => {
      if (!(await this.codes.consume(user.id, 'email_verification', input.code, tx))) return false
      await this.users.markEmailVerified(user.id, tx)
      await this.audit.record({ action: 'auth.email_verified', entityType: 'user', entityId: user.id, actorUserId: user.id }, client, tx)
      return true
    })
    if (!verified) throw invalidCode()
    return { status: 'verified' }
  }

  async resendVerification(email: string, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.resendIp, client.ip],
      [LIMITS.resendEmail, email],
    ])
    const user = await this.users.findByEmail(email)
    if (user && !user.emailVerifiedAt && user.status === 'active') {
      const issued = await this.codes.issue(user.id, 'email_verification')
      if ('code' in issued) await this.deliver(() => this.mail.verificationCode(user.email, user.fullName, issued.code))
    }
    return this.pending(email)
  }

  async login(input: LoginInput, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.loginIp, client.ip],
      [LIMITS.loginEmail, input.email],
    ])
    const user = await this.users.findByEmail(input.email)
    if (!user) {
      await this.passwords.verifyAgainstDummy(input.password)
      throw invalidCredentials()
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw tooManyRequests((user.lockedUntil.getTime() - Date.now()) / 1000)
    }

    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      const failures = await this.users.recordFailedLogin(user.id)
      if (failures >= LOGIN_LOCK.failures) {
        await this.users.lock(user.id, new Date(Date.now() + LOGIN_LOCK.minutes * 60_000))
        await this.audit.record({ action: 'auth.account_locked', entityType: 'user', entityId: user.id, details: { failures } }, client)
      }
      await this.audit.record({ action: 'auth.sign_in_failed', entityType: 'user', entityId: user.id }, client)
      throw invalidCredentials()
    }
    // Only revealed after the correct password, so it does not help anyone guessing.
    if (user.status !== 'active') throw forbidden('ACCOUNT_DISABLED', 'This account is disabled. Contact your clinic administrator.')

    const session = await this.prisma.transaction(async (tx) => {
      await this.users.recordSuccessfulLogin(user.id, tx)
      if (this.passwords.needsRehash(user.passwordHash)) await this.users.setPassword(user.id, await this.passwords.hash(input.password), tx)
      const started = await this.sessions.start(user.id, client, tx)
      await this.audit.record({ action: 'auth.signed_in', entityType: 'user', entityId: user.id, actorUserId: user.id, details: { sessionId: started.sessionId } }, client, tx)
      return started
    })

    return { ...session, payload: await this.sessionPayload(user.id) }
  }

  async logout(token: string | null, client: ClientInfo) {
    if (!token) return
    const userId = await this.sessions.endByToken(token)
    if (userId) await this.audit.record({ action: 'auth.signed_out', entityType: 'user', entityId: userId, actorUserId: userId }, client)
  }

  async logoutEverywhere(auth: AuthContext, client: ClientInfo) {
    await this.sessions.endAll(auth.userId)
    await this.audit.record({ action: 'auth.sessions_revoked', entityType: 'user', entityId: auth.userId, actorUserId: auth.userId }, client)
  }

  async listSessions(auth: AuthContext) {
    const sessions = await this.sessions.list(auth.userId)
    return sessions.map((session) => ({ ...session, current: session.id === auth.sessionId }))
  }

  async endSession(auth: AuthContext, sessionId: string, client: ClientInfo) {
    const { count } = await this.sessions.endOne(auth.userId, sessionId)
    if (count === 0) return false
    await this.audit.record({ action: 'auth.session_revoked', entityType: 'session', entityId: sessionId, actorUserId: auth.userId }, client)
    return true
  }

  // Who is signed in, whether their email is verified, and their organisations with the permissions each grants.
  async sessionPayload(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw invalidCredentials()
    const profile = publicUser(user)
    return { user: profile, memberships: profile.emailVerified ? await this.access.forUser(userId) : [] }
  }

  async currentSession(auth: AuthContext) {
    await this.limits.consume(LIMITS.session, auth.userId)
    return this.sessionPayload(auth.userId)
  }

  async requestPasswordReset(email: string, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.resetRequestIp, client.ip],
      [LIMITS.resetRequestEmail, email],
    ])
    const user = await this.users.findByEmail(email)
    if (user && user.status === 'active') {
      const issued = await this.codes.issue(user.id, 'password_reset')
      if ('code' in issued) {
        await this.audit.record({ action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id }, client)
        await this.deliver(() => this.mail.passwordResetCode(user.email, user.fullName, issued.code))
      }
    }
    return { status: 'reset_requested', email }
  }

  async confirmPasswordReset(input: ResetInput, client: ClientInfo) {
    await this.limits.consumeAll([
      [LIMITS.resetConfirmIp, client.ip],
      [LIMITS.resetConfirmEmail, input.email],
    ])
    const user = await this.users.findByEmail(input.email)
    if (!user || user.status !== 'active') throw invalidCode()
    const passwordHash = await this.passwords.hash(input.password)

    const reset = await this.prisma.transaction(async (tx) => {
      if (!(await this.codes.consume(user.id, 'password_reset', input.code, tx))) return false
      await this.users.setPassword(user.id, passwordHash, tx)
      // The code proves the person controls the inbox, so an unverified account becomes verified too.
      await this.users.markEmailVerified(user.id, tx)
      await this.sessions.endAll(user.id, {}, tx)
      await this.audit.record({ action: 'auth.password_reset', entityType: 'user', entityId: user.id, actorUserId: user.id }, client, tx)
      return true
    })
    if (!reset) throw invalidCode()

    await this.deliver(() => this.mail.passwordChanged(user.email, user.fullName))
    return { status: 'password_reset' }
  }

  // Keeps the current session and ends every other one.
  async changePassword(auth: AuthContext, input: ChangePasswordInput, client: ClientInfo) {
    await this.limits.consume(LIMITS.passwordChange, auth.userId)
    const user = await this.users.findById(auth.userId)
    if (!user || !(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw badRequest('PASSWORD_INCORRECT', 'Your current password is incorrect.', [{ field: 'currentPassword', issue: 'Your current password is incorrect.' }])
    }
    const passwordHash = await this.passwords.hash(input.newPassword)
    await this.prisma.transaction(async (tx) => {
      await this.users.setPassword(user.id, passwordHash, tx)
      await this.sessions.endAll(user.id, { except: auth.sessionId }, tx)
      await this.audit.record({ action: 'auth.password_changed', entityType: 'user', entityId: user.id, actorUserId: user.id }, client, tx)
    })
    await this.deliver(() => this.mail.passwordChanged(user.email, user.fullName))
    return { status: 'password_changed' }
  }

  private pending(address: string) {
    return { status: 'verification_pending', email: address }
  }

  // Email failures are logged, not returned: the response must not differ between existing and new accounts,
  // and the person can ask for the code again.
  private async deliver(send: () => Promise<void>) {
    try {
      await send()
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to send email')
    }
  }
}
