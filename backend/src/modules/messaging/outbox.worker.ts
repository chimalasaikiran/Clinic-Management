import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { ChannelsService } from './channels.service'
import { providerAddress, retryAt } from './messaging.logic'
import { MESSAGING_TRANSPORT, ProviderError, Transport } from './providers'
import { RealtimeService } from './realtime.service'

const POLL_MS = 3_000
const BATCH = 20
// A message left "sending" this long belonged to a process that stopped mid-send: its outcome is unknown.
const STUCK_MS = 10 * 60_000

// Sends queued messages. Rows are claimed with FOR UPDATE SKIP LOCKED, so several API instances can run the worker
// without sending the same message twice. Turned off with MESSAGING_WORKER=false (the tests call runOnce).
@Injectable()
export class OutboxWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('MessagingWorker')
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly realtime: RealtimeService,
    @Inject(MESSAGING_TRANSPORT) private readonly transport: Transport,
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
      this.logger.error({ err: error }, 'Sending queued messages failed')
    } finally {
      this.running = false
    }
  }

  // Sends what is due now; resolves to the number of messages attempted.
  async runOnce(): Promise<number> {
    await this.prisma.$executeRaw`
      update messages set status = 'unknown', error_code = 'INTERRUPTED', error_message = 'Sending was interrupted; check with the provider before retrying.'
      where status = 'sending' and next_attempt_at < ${new Date(Date.now() - STUCK_MS)}`
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      update messages set status = 'sending', attempts = attempts + 1, next_attempt_at = now()
      where id in (
        select id from messages where status = 'queued' and next_attempt_at <= now() order by next_attempt_at limit ${BATCH} for update skip locked
      )
      returning id`
    for (const { id } of claimed) await this.deliver(id)
    return claimed.length
  }

  private async deliver(id: string) {
    const message = await this.prisma.message.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, orgId: true, body: true, subject: true, attempts: true, parameters: true,
        template: { select: { providerRef: true, locale: true } },
        conversation: { select: { id: true, channel: true, address: true, branchId: true } },
      },
    })
    const { channel, address } = message.conversation
    const now = new Date()
    const credentials = await this.channels.credentials(message.orgId, channel)

    let data
    if (!credentials) {
      data = { status: 'failed' as const, failedAt: now, errorCode: 'CHANNEL_NOT_CONNECTED', errorMessage: 'The channel was disconnected before this message was sent.' }
    } else {
      try {
        const template = message.template?.providerRef ? { ref: message.template.providerRef, locale: message.template.locale, parameters: (message.parameters as string[] | null) ?? [] } : null
        const result = await this.transport[channel].send(credentials.config, credentials.secrets, { to: providerAddress(channel, address), body: message.body, subject: message.subject, template })
        data = { status: 'sent' as const, sentAt: now, providerMessageId: result.providerMessageId, errorCode: null, errorMessage: null }
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error
        const retry = error.kind === 'retryable' ? retryAt(message.attempts, now) : null
        if (retry) data = { status: 'queued' as const, nextAttemptAt: retry, errorCode: error.code, errorMessage: error.message }
        else if (error.kind === 'unknown') data = { status: 'unknown' as const, errorCode: error.code, errorMessage: error.message }
        else data = { status: 'failed' as const, failedAt: now, errorCode: error.code, errorMessage: error.message }
        if (error.kind === 'auth') await this.channels.markFailed(credentials.id, error.message)
      }
    }
    // A webhook may already have moved it past "sent"; only replace "sending".
    await this.prisma.message.updateMany({ where: { id, status: 'sending' }, data })
    await this.realtime.publish({ orgId: message.orgId, branchId: message.conversation.branchId, type: 'message', conversationId: message.conversation.id, messageId: id })
  }
}
