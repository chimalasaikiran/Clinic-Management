import { Inject, Injectable } from '@nestjs/common'
import { badRequest } from '../../common/errors/app-error'
import { generateCode, hashesMatch, keyedHash } from '../../common/utils/crypto'
import { ENV, Env } from '../../config/env'
import { Db, Tx } from '../../database/prisma.service'
import { CodePurpose } from '../../generated/prisma/client'
import { VerificationCodesRepository } from './verification-codes.repository'

export const CODE_TTL_MINUTES = 10
export const MAX_CODE_ATTEMPTS = 5
export const RESEND_COOLDOWN_SECONDS = 60

export const invalidCode = () => badRequest('CODE_INVALID', 'That code is incorrect or has expired. Request a new code.')

// Six-digit, single-use codes for email verification and password reset.
@Injectable()
export class VerificationService {
  constructor(
    private readonly codes: VerificationCodesRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Issues a new code and retires any earlier one. Within the resend cooldown it returns the seconds left
  // instead, so callers decide whether to reveal that.
  async issue(userId: string, purpose: CodePurpose, db?: Db): Promise<{ code: string } | { waitSeconds: number }> {
    const latest = await this.codes.latestIssuedAt(userId, purpose, db)
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000
      if (elapsed < RESEND_COOLDOWN_SECONDS) return { waitSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) }
    }
    await this.codes.retireActive(userId, purpose, db)
    const code = generateCode()
    await this.codes.create(
      { userId, purpose, codeHash: this.hash(userId, purpose, code), expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) },
      db,
    )
    return { code }
  }

  // Must run inside a transaction that commits even when the code is wrong, so failed attempts are counted.
  async consume(userId: string, purpose: CodePurpose, code: string, tx: Tx): Promise<boolean> {
    const row = await this.codes.lockLatestActive(userId, purpose, tx)
    if (!row || row.expired || row.attempts >= MAX_CODE_ATTEMPTS) return false

    const matches = hashesMatch(row.code_hash, this.hash(userId, purpose, code))
    const attempts = row.attempts + 1
    await this.codes.recordAttempt(row.id, attempts, matches || attempts >= MAX_CODE_ATTEMPTS, tx)
    return matches
  }

  private hash(userId: string, purpose: CodePurpose, code: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `${purpose}:${userId}:${code}`)
  }
}
