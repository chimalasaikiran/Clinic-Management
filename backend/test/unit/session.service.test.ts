import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../src/common/errors/app-error'
import { keyedHash } from '../../src/common/utils/crypto'
import { loadEnv } from '../../src/config/env'
import { MAX_SESSIONS_PER_USER, SessionService } from '../../src/modules/auth/session.service'
import type { SessionsRepository } from '../../src/modules/auth/sessions.repository'

const env = loadEnv({
  DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
  CORS_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TOKEN_PEPPER: 'p'.repeat(40),
  SESSION_IDLE_MINUTES: '30',
  SESSION_MAX_AGE_HOURS: '12',
})

const MINUTE = 60_000
const client = { ip: '203.0.113.9', userAgent: 'test', traceId: 'trace-1' }

function storedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    revokedAt: null,
    kind: 'browser',
    expiresAt: new Date(Date.now() + 6 * 60 * MINUTE),
    lastSeenAt: new Date(Date.now() - 5 * MINUTE),
    user: { id: 'user-1', email: 'owner@clinic.test', status: 'active', emailVerifiedAt: new Date() },
    ...overrides,
  }
}

async function failureCode(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof AppError ? error.code : String(error)
  }
  return 'NO_ERROR'
}

describe('SessionService', () => {
  let repo: Record<string, ReturnType<typeof vi.fn>>
  let sessions: SessionService

  beforeEach(() => {
    repo = {
      create: vi.fn(async () => ({ id: 'session-new' })),
      revokeOldest: vi.fn(async () => undefined),
      findByTokenHash: vi.fn(async () => storedSession()),
      touch: vi.fn(async () => ({ id: 'session-1' })),
      revoke: vi.fn(async () => ({ count: 1 })),
    }
    sessions = new SessionService(repo as unknown as SessionsRepository, env)
  })

  it('stores only a keyed hash of the cookie token and caps sessions per user', async () => {
    const started = await sessions.start('user-1', client)
    expect(started.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const saved = repo.create!.mock.calls[0]![0]
    expect(saved.tokenHash).toBe(keyedHash(env.TOKEN_PEPPER, `session:${started.token}`))
    expect(JSON.stringify(saved)).not.toContain(started.token)
    expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(11.9 * 60 * MINUTE)
    expect(repo.revokeOldest).toHaveBeenCalledWith('user-1', MAX_SESSIONS_PER_USER, undefined)
  })

  it('accepts a live session and returns who is signed in', async () => {
    await expect(sessions.authenticate('t'.repeat(43))).resolves.toEqual({ userId: 'user-1', sessionId: 'session-1', email: 'owner@clinic.test', emailVerified: true })
    expect(repo.touch).toHaveBeenCalledWith('session-1')
  })

  it('does not write on every request', async () => {
    repo.findByTokenHash!.mockResolvedValue(storedSession({ lastSeenAt: new Date(Date.now() - 10_000) }))
    await sessions.authenticate('t'.repeat(43))
    expect(repo.touch).not.toHaveBeenCalled()
  })

  it('rejects unknown and revoked sessions', async () => {
    repo.findByTokenHash!.mockResolvedValue(null)
    expect(await failureCode(sessions.authenticate('x'.repeat(43)))).toBe('SESSION_INVALID')
    repo.findByTokenHash!.mockResolvedValue(storedSession({ revokedAt: new Date() }))
    expect(await failureCode(sessions.authenticate('x'.repeat(43)))).toBe('SESSION_INVALID')
  })

  it('ends sessions past the absolute limit or idle for too long', async () => {
    repo.findByTokenHash!.mockResolvedValue(storedSession({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await failureCode(sessions.authenticate('x'.repeat(43)))).toBe('SESSION_EXPIRED')
    repo.findByTokenHash!.mockResolvedValue(storedSession({ lastSeenAt: new Date(Date.now() - 31 * MINUTE) }))
    expect(await failureCode(sessions.authenticate('x'.repeat(43)))).toBe('SESSION_EXPIRED')
    expect(repo.revoke).toHaveBeenCalledTimes(2)
  })

  it('ends the session of a disabled account', async () => {
    repo.findByTokenHash!.mockResolvedValue(storedSession({ user: { id: 'user-1', email: 'a@b.test', status: 'disabled', emailVerifiedAt: null } }))
    expect(await failureCode(sessions.authenticate('x'.repeat(43)))).toBe('ACCOUNT_DISABLED')
    expect(repo.revoke).toHaveBeenCalledWith('session-1')
  })
})

describe('staff app sessions', () => {
  it('accept only the transport they were made for, with the app limits', async () => {
    const appSession = storedSession({ kind: 'app', lastSeenAt: new Date(Date.now() - 6 * 60 * MINUTE), expiresAt: new Date(Date.now() + 3 * 24 * 60 * MINUTE) })
    const repo = { findByTokenHash: vi.fn(async () => appSession), touch: vi.fn(async () => ({ id: 'session-1' })), revoke: vi.fn(async () => ({ count: 1 })) }
    const sessions = new SessionService(repo as unknown as SessionsRepository, env)
    // Six idle hours is too long for the admin panel but fine for the app (12 hours by default).
    await expect(sessions.authenticate('t'.repeat(43), 'app')).resolves.toMatchObject({ userId: 'user-1' })
    expect(await failureCode(sessions.authenticate('t'.repeat(43), 'browser'))).toBe('SESSION_INVALID')
    repo.findByTokenHash.mockResolvedValue(storedSession())
    expect(await failureCode(sessions.authenticate('t'.repeat(43), 'app'))).toBe('SESSION_INVALID')
  })
})
