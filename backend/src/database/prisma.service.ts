import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { ENV, Env } from '../config/env'
import { Prisma, PrismaClient } from '../generated/prisma/client'

// A transaction client has the same model API as the main client, minus connection management.
export type Tx = Prisma.TransactionClient
export type Db = PrismaClient | Tx

// One Prisma client (and one pg connection pool) per API process. Neon's pooler sits behind it,
// so many API instances can share the database without exhausting connections.
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Database')

  constructor(@Inject(ENV) env: Env) {
    super({
      adapter: new PrismaPg({
        connectionString: env.DATABASE_URL,
        max: env.DATABASE_POOL_MAX,
        // Neon may need a moment to wake a suspended compute.
        connectionTimeoutMillis: 15_000,
        // Opening a TLS connection to Neon takes over a second from far away, so idle connections are kept
        // for ten minutes rather than reopened on the next request; keep-alive stops networks dropping them.
        idleTimeoutMillis: 600_000,
        keepAlive: true,
      }),
      transactionOptions: { maxWait: 5_000, timeout: env.DATABASE_TX_TIMEOUT_MS },
    })
  }

  // Runs work in one transaction. Callers pass the `tx` client to every repository call inside it.
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(work)
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.$queryRaw`select 1`
      return true
    } catch (error) {
      this.logger.warn({ err: error }, 'Database check failed')
      return false
    }
  }

  // Opens the first connection (and wakes a suspended Neon compute) at start-up, not on the first request.
  async onApplicationBootstrap() {
    if (await this.isReachable()) this.logger.log('Database connection ready')
  }

  async onApplicationShutdown() {
    await this.$disconnect()
  }
}
