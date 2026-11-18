import { Inject, Injectable } from '@nestjs/common'
import { forbidden, unauthorized } from '../../common/errors/app-error'
import { generateToken, keyedHash } from '../../common/utils/crypto'
import type { AuthContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { Db } from '../../database/prisma.service'
import { SessionsRepository } from './sessions.repository'

// A person signed in on more browsers than this loses the oldest sessions first.
export const MAX_SESSIONS_PER_USER = 20
// lastSeenAt is written at most this often, so busy pages do not cause a write per request.
const TOUCH_INTERVAL_MS = 60_000

export const sessionEnded = {
  missing: () => unauthorized('SESSION_MISSING', 'Sign in to continue.'),
  invalid: () => unauthorized('SESSION_INVALID', 'Your session is no longer valid. Sign in again.'),
  expired: () => unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.'),
  disabled: () => forbidden('ACCOUNT_DISABLED', 'This account is disabled. Contact your clinic administrator.'),
}

// Server-side sessions: the browser holds a random 256-bit token in an HttpOnly cookie and the database
// holds its keyed hash, so a stolen database cannot be replayed and any session can be ended instantly.
@Injectable()
export class SessionService {
  constructor(
    private readonly sessions: SessionsRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async start(userId: string, client: ClientInfo, db?: Db) {
    const token = generateToken()
    const expiresAt = new Date(Date.now() + this.env.SESSION_MAX_AGE_HOURS * 3_600_000)
    const session = await this.sessions.create({ userId, tokenHash: this.hash(token), expiresAt, ip: client.ip, userAgent: client.userAgent }, db)
    await this.sessions.revokeOldest(userId, MAX_SESSIONS_PER_USER, db)
    return { token, expiresAt, sessionId: session.id }
  }

  async authenticate(token: string): Promise<AuthContext> {
    const session = await this.sessions.findByTokenHash(this.hash(token))
    if (!session || session.revokedAt) throw sessionEnded.invalid()

    const now = Date.now()
    const idleLimit = this.env.SESSION_IDLE_MINUTES * 60_000
    if (session.expiresAt.getTime() <= now || now - session.lastSeenAt.getTime() > idleLimit) {
      await this.sessions.revoke(session.id)
      throw sessionEnded.expired()
    }
    if (session.user.status !== 'active') {
      await this.sessions.revoke(session.id)
      throw sessionEnded.disabled()
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) await this.sessions.touch(session.id)

    return {
      userId: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      emailVerified: session.user.emailVerifiedAt !== null,
    }
  }

  // Signing out with a cookie that is already invalid still succeeds; there is nothing left to end.
  async endByToken(token: string) {
    const session = await this.sessions.findByTokenHash(this.hash(token))
    if (session && !session.revokedAt) await this.sessions.revoke(session.id)
    return session?.userId ?? null
  }

  list(userId: string) {
    return this.sessions.listActive(userId, new Date())
  }

  endOne(userId: string, sessionId: string) {
    return this.sessions.revokeForUser(userId, sessionId)
  }

  endAll(userId: string, options: { except?: string } = {}, db?: Db) {
    return this.sessions.revokeAll(userId, options, db)
  }

  private hash(token: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `session:${token}`)
  }
}
