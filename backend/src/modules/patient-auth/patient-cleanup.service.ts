import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { PatientOtpService } from './patient-otp.service'

const INTERVAL_MS = 60 * 60_000
const KEEP_MS = 7 * 24 * 60 * 60_000
const KEEP_NOTIFICATIONS_MS = 90 * 24 * 60 * 60_000

// Hourly housekeeping for spent codes and finished sessions. The deletes are idempotent across instances.
@Injectable()
export class PatientCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PatientCleanupService.name)
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: PatientOtpService,
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
      await this.otp.prune(before)
      await this.prisma.patientSession.deleteMany({ where: { OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }] } })
      await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_NOTIFICATIONS_MS) } } })
    } catch (error) {
      this.logger.warn({ err: error }, 'Patient housekeeping failed; it will run again next hour')
    }
  }
}
