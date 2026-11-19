import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Client } from 'pg'
import { Observable, Subject } from 'rxjs'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'

export interface RealtimeEvent {
  orgId: string
  // null for a conversation not yet tied to a branch: only organisation-wide roles are told about it.
  branchId: string | null
  type: 'conversation' | 'message'
  conversationId: string
  messageId?: string
}

const CHANNEL = 'clinicos_events'

// Tells open inboxes that a conversation or message changed. With REALTIME_DATABASE_URL set, events go through
// Postgres NOTIFY / LISTEN so every API instance hears them; without it they stay inside this process.
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Realtime')
  private readonly events = new Subject<RealtimeEvent>()
  private listener: Client | null = null

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit() {
    if (!this.env.REALTIME_DATABASE_URL) return
    const client = new Client({ connectionString: this.env.REALTIME_DATABASE_URL })
    client.on('notification', (message) => {
      if (message.channel !== CHANNEL || !message.payload) return
      try {
        this.events.next(JSON.parse(message.payload) as RealtimeEvent)
      } catch {
        this.logger.warn('Ignored a malformed realtime notification')
      }
    })
    client.on('error', (error) => this.logger.error({ err: error }, 'Realtime listener connection failed; live updates fall back to this instance'))
    try {
      await client.connect()
      await client.query(`LISTEN ${CHANNEL}`)
      this.listener = client
    } catch (error) {
      this.logger.error({ err: error }, 'Could not LISTEN for realtime events; live updates stay within this instance')
      await client.end().catch(() => undefined)
    }
  }

  async onModuleDestroy() {
    await this.listener?.end().catch(() => undefined)
  }

  // Call after the change is committed, so listeners never reload before it is visible.
  async publish(event: RealtimeEvent) {
    if (!this.listener) {
      this.events.next(event)
      return
    }
    try {
      await this.prisma.$executeRaw`select pg_notify(${CHANNEL}, ${JSON.stringify(event)})`
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not publish a realtime event')
      this.events.next(event)
    }
  }

  stream(): Observable<RealtimeEvent> {
    return this.events.asObservable()
  }
}
