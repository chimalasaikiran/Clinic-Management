import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { PgChannel } from './pg-channel'

// "Something changed" events for the admin panel and the apps. They carry ids only, never names or clinical
// details: whoever hears one reloads through the normal API, which applies its own permission checks. A client
// also reloads whenever it (re)connects, so an event missed while offline costs nothing.
export type LiveEvent =
  | {
      topic: 'appointments'
      orgId: string
      entityId: string
      branchId: string
      patientId: string
      practitionerId: string
      // Set when a booking moved to another therapist, so the one who lost it hears too.
      previousPractitionerId?: string
    }
  // For one recipient: a staff membership or a patient account.
  | { topic: 'notifications'; orgId: string; entityId: string; membershipId?: string; accountId?: string }
  // A clinical record of this patient was released or changed (consultation, prescription, order, care plan).
  // A clinical record changed: the patient's own screens and clinicians' open charts at that branch reload.
  | { topic: 'records'; orgId: string; entityId: string; patientId: string; branchId: string }
  // A refill or help request changed: the clinic's queues and the patient's screens reload.
  | { topic: 'requests'; orgId: string; entityId: string; branchId: string; patientId: string; kind: 'refill' | 'support' }
  // Which clinic records an account may read has changed.
  | { topic: 'app_access'; orgId: string; entityId: string; accountId: string }

@Injectable()
export class LiveService implements OnModuleInit, OnModuleDestroy {
  private readonly channel: PgChannel<LiveEvent>

  constructor(prisma: PrismaService, @Inject(ENV) env: Env) {
    this.channel = new PgChannel('clinicos_live', prisma, env.REALTIME_DATABASE_URL, new Logger('LiveUpdates'))
  }

  onModuleInit() {
    return this.channel.start()
  }

  onModuleDestroy() {
    return this.channel.stop()
  }

  // Call after the transaction that made the change has committed.
  async publish(events: readonly LiveEvent[]) {
    for (const event of events) await this.channel.publish(event)
  }

  stream() {
    return this.channel.stream()
  }
}
