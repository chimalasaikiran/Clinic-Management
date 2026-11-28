import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { RateLimitService } from '../../common/security/rate-limit.service'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { SessionsRepository } from './sessions.repository'
import { VerificationCodesRepository } from './verification-codes.repository'

const INTERVAL_MS = 60 * 60_000
// Finished rows are kept a week for support questions ("why was I signed out?"), then deleted.
const KEEP_MS = 7 * 24 * 60 * 60_000

// Hourly housekeeping. Every API instance runs it; the deletes are idempotent, so overlap is harmless.
@Injectable()
export class AuthCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AuthCleanupService.name)
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly sessions: SessionsRepository,
    private readonly codes: VerificationCodesRepository,
    private readonly limits: RateLimitService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.NODE_ENV === 'test') return
    this.timer = setInterval(() => void this.run(), INTERVAL_MS)
    this.timer.unref()
  }

  onApplicationShutdown() {
    clearInterval(this.timer)
  }

  async run() {
    try {
      const before = new Date(Date.now() - KEEP_MS)
      await this.sessions.deleteFinished(before)
      await this.codes.deleteFinished(before)
      await this.prisma.staffAppChallenge.deleteMany({ where: { expiresAt: { lt: before } } })
      await this.limits.prune()
    } catch (error) {
      this.logger.warn({ err: error }, 'Auth housekeeping failed; it will run again next hour')
    }
  }
}
