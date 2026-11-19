import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { inQuietHours } from '../messaging/messaging.logic'
import { localMinute } from '../scheduling/clinic-time'
import { CampaignsService } from './campaigns.service'
import { WorkflowsService } from './workflows.service'

const POLL_MS = 30_000
// Broadcasts started per run; a long one carries on in the next run if it is not finished.
const BROADCASTS_PER_RUN = 3

// Starts due broadcasts and runs active workflows. Both only queue messages (the messaging worker sends them), and
// both hold off between 9 pm and 9 am clinic time. Runs with the messaging worker (MESSAGING_WORKER); tests call runOnce.
@Injectable()
export class GrowthWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('GrowthWorker')
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly workflows: WorkflowsService,
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

  isQuiet(now = new Date()) {
    return inQuietHours(localMinute(now, this.env.CLINIC_TIMEZONE))
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.logger.error({ err: error }, 'Running broadcasts and workflows failed')
    } finally {
      this.running = false
    }
  }

  async runOnce() {
    if (this.isQuiet()) return { broadcasts: 0, workflowEvents: 0 }
    let broadcasts = 0
    for (let index = 0; index < BROADCASTS_PER_RUN; index += 1) {
      const id = await this.campaigns.claimBroadcast()
      if (!id) break
      await this.campaigns.processBroadcast(id, () => this.isQuiet())
      broadcasts += 1
    }
    let workflowEvents = 0
    for (const id of await this.workflows.activeIds()) {
      try {
        workflowEvents += await this.workflows.process(id)
      } catch (error) {
        // One failing workflow must not hold up the others.
        this.logger.error({ err: error, workflowId: id }, 'Workflow run failed')
      }
    }
    return { broadcasts, workflowEvents }
  }
}
