import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { ReviewsService } from './reviews.service'

const POLL_MS = 60_000

// Posts approved review replies and fetches new Google reviews every 30 minutes per linked branch. Runs with the
// messaging worker (MESSAGING_WORKER); tests call runOnce.
@Injectable()
export class ReviewsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('ReviewsWorker')
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly reviews: ReviewsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    if (!this.env.MESSAGING_WORKER) return
    this.timer = setInterval(() => void this.tick(), POLL_MS)
    this.timer.unref()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.logger.error({ err: error }, 'Review replies or sync failed')
    } finally {
      this.running = false
    }
  }

  async runOnce() {
    const replies = await this.reviews.postApproved()
    const fetched = await this.reviews.syncDue()
    return { replies, fetched }
  }
}
