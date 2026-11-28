import type { Logger } from '@nestjs/common'
import { Client } from 'pg'
import { Observable, Subject } from 'rxjs'
import type { PrismaService } from '../../database/prisma.service'

// One named stream of events shared by every API instance. With a `listenUrl` (a direct, non-pooled connection)
// events travel through Postgres NOTIFY / LISTEN; without one they stay inside this process.
export class PgChannel<T> {
  private readonly events = new Subject<T>()
  private listener: Client | null = null

  constructor(
    private readonly name: string,
    private readonly prisma: PrismaService,
    private readonly listenUrl: string | undefined,
    private readonly logger: Logger,
  ) {}

  async start() {
    if (!this.listenUrl) return
    const client = new Client({ connectionString: this.listenUrl })
    client.on('notification', (message) => {
      if (message.channel !== this.name || !message.payload) return
      try {
        this.events.next(JSON.parse(message.payload) as T)
      } catch {
        this.logger.warn('Ignored a malformed realtime notification')
      }
    })
    client.on('error', (error) => {
      this.logger.error({ err: error }, 'Realtime listener connection failed; live updates fall back to this instance')
      this.listener = null
    })
    try {
      await client.connect()
      // The channel name is a constant from this codebase, never input.
      await client.query(`LISTEN ${this.name}`)
      this.listener = client
    } catch (error) {
      this.logger.error({ err: error }, 'Could not LISTEN for realtime events; live updates stay within this instance')
      await client.end().catch(() => undefined)
    }
  }

  async stop() {
    await this.listener?.end().catch(() => undefined)
    this.listener = null
  }

  // Call after the change is committed, so listeners never reload before it is visible.
  async publish(event: T) {
    if (!this.listener) {
      this.events.next(event)
      return
    }
    try {
      await this.prisma.$executeRaw`select pg_notify(${this.name}, ${JSON.stringify(event)})`
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not publish a realtime event')
      this.events.next(event)
    }
  }

  stream(): Observable<T> {
    return this.events.asObservable()
  }
}
