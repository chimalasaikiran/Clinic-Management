import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { ContentService } from './content.service'

const POLL_MS = 30_000

// Publishes approved posts when their time comes. Runs with the messaging worker (MESSAGING_WORKER); tests call
// runOnce. Unlike broadcasts, posts are public and go out at the time that was approved, day or night.
@Injectable()
export class ContentWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('ContentWorker')
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly content: ContentService,
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
      this.logger.error({ err: error }, 'Publishing scheduled posts failed')
    } finally {
      this.running = false
    }
  }

  async runOnce() {
    const ids = await this.content.claimDue()
    for (const id of ids) await this.content.publish(id)
    return ids.length
  }
}
