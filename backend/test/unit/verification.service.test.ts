import { describe, expect, it, vi } from 'vitest'
import { keyedHash } from '../../src/common/utils/crypto'
import { loadEnv } from '../../src/config/env'
import type { Tx } from '../../src/database/prisma.service'
import type { VerificationCodesRepository } from '../../src/modules/auth/verification-codes.repository'
import { MAX_CODE_ATTEMPTS, RESEND_COOLDOWN_SECONDS, VerificationService } from '../../src/modules/auth/verification.service'

const env = loadEnv({
  DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
  CORS_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TOKEN_PEPPER: 'v'.repeat(40),
})
const tx = {} as Tx

function setup(locked?: { attempts?: number; expired?: boolean; code?: string }, latestCreatedAt?: Date) {
  const repo = {
    latestIssuedAt: vi.fn(async () => (latestCreatedAt ? { createdAt: latestCreatedAt } : null)),
    retireActive: vi.fn(async () => ({ count: 1 })),
    create: vi.fn(async () => ({ id: 'code-1' })),
    lockLatestActive: vi.fn(async () =>
      locked
        ? { id: 'code-1', code_hash: keyedHash(env.TOKEN_PEPPER, `email_verification:user-1:${locked.code ?? '123456'}`), attempts: locked.attempts ?? 0, expired: locked.expired ?? false }
        : undefined,
    ),
    recordAttempt: vi.fn(async () => ({})),
  }
  return { repo, codes: new VerificationService(repo as unknown as VerificationCodesRepository, env) }
}

describe('VerificationService', () => {
  it('issues a 6-digit code, stores only its keyed hash and retires older codes', async () => {
    const { repo, codes } = setup()
    const issued = await codes.issue('user-1', 'email_verification')
    expect(issued).toEqual({ code: expect.stringMatching(/^\d{6}$/) })
    const saved = (repo.create.mock.calls as unknown as Array<[{ codeHash: string }]>)[0]![0]
    expect(saved.codeHash).toBe(keyedHash(env.TOKEN_PEPPER, `email_verification:user-1:${(issued as { code: string }).code}`))
    expect(repo.retireActive).toHaveBeenCalled()
  })

  it('refuses to send another code within the cooldown', async () => {
    const { repo, codes } = setup(undefined, new Date(Date.now() - 10_000))
    const issued = await codes.issue('user-1', 'email_verification')
    expect(issued).toEqual({ waitSeconds: expect.any(Number) })
    expect((issued as { waitSeconds: number }).waitSeconds).toBeLessThanOrEqual(RESEND_COOLDOWN_SECONDS)
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('accepts the right code once and consumes it', async () => {
    const { repo, codes } = setup({ code: '123456' })
    expect(await codes.consume('user-1', 'email_verification', '123456', tx)).toBe(true)
    expect(repo.recordAttempt).toHaveBeenCalledWith('code-1', 1, true, tx)
  })

  it('counts wrong guesses and burns the code at the attempt limit', async () => {
    const { repo, codes } = setup({ code: '123456', attempts: MAX_CODE_ATTEMPTS - 1 })
    expect(await codes.consume('user-1', 'email_verification', '000000', tx)).toBe(false)
    expect(repo.recordAttempt).toHaveBeenCalledWith('code-1', MAX_CODE_ATTEMPTS, true, tx)
  })

  it('rejects expired, exhausted or missing codes without checking them', async () => {
    for (const locked of [{ expired: true }, { attempts: MAX_CODE_ATTEMPTS }, undefined]) {
      const { repo, codes } = setup(locked)
      expect(await codes.consume('user-1', 'email_verification', '123456', tx)).toBe(false)
      expect(repo.recordAttempt).not.toHaveBeenCalled()
    }
  })
})
