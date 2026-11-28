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

export type SessionKind = 'browser' | 'app'

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

  // How long a session of each kind may last in total, and without being used.
  private limits(kind: SessionKind) {
    return kind === 'app'
      ? { maxMs: this.env.STAFF_APP_SESSION_MAX_DAYS * 86_400_000, idleMs: this.env.STAFF_APP_SESSION_IDLE_HOURS * 3_600_000 }
      : { maxMs: this.env.SESSION_MAX_AGE_HOURS * 3_600_000, idleMs: this.env.SESSION_IDLE_MINUTES * 60_000 }
  }

  async start(userId: string, client: ClientInfo, db?: Db, app?: { deviceName: string }) {
    const token = generateToken()
    const kind: SessionKind = app ? 'app' : 'browser'
    const expiresAt = new Date(Date.now() + this.limits(kind).maxMs)
    const session = await this.sessions.create({ userId, tokenHash: this.hash(token), expiresAt, ip: client.ip, userAgent: client.userAgent, kind, deviceName: app?.deviceName ?? null }, db)
    await this.sessions.revokeOldest(userId, MAX_SESSIONS_PER_USER, db)
    return { token, expiresAt, sessionId: session.id }
  }

  // `transport` is how the token arrived. A cookie token sent as a bearer token, or the reverse, is refused, so a
  // browser session cannot be lifted into the app's longer limits.
  async authenticate(token: string, transport: SessionKind = 'browser'): Promise<AuthContext> {
    const session = await this.sessions.findByTokenHash(this.hash(token))
    if (!session || session.revokedAt || session.kind !== transport) throw sessionEnded.invalid()

    const now = Date.now()
    const idleLimit = this.limits(transport).idleMs
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
