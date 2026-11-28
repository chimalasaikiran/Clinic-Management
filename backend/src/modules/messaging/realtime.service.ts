import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PgChannel } from '../../common/realtime/pg-channel'
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

// Tells open inboxes that a conversation or message changed.
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly channel: PgChannel<RealtimeEvent>

  constructor(prisma: PrismaService, @Inject(ENV) env: Env) {
    this.channel = new PgChannel('clinicos_events', prisma, env.REALTIME_DATABASE_URL, new Logger('Realtime'))
  }

  onModuleInit() {
    return this.channel.start()
  }

  onModuleDestroy() {
    return this.channel.stop()
  }

  publish(event: RealtimeEvent) {
    return this.channel.publish(event)
  }

  stream() {
    return this.channel.stream()
  }
}
