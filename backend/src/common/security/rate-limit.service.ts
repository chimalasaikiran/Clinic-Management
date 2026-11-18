import { Inject, Injectable } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { tooManyRequests } from '../errors/app-error'
import { keyedHash } from '../utils/crypto'

export interface Limit {
  name: string
  max: number
  windowSeconds: number
}

// Fixed-window counters in Postgres, so limits hold across every API instance without extra infrastructure.
// Keys are hashed because they contain emails and IP addresses.
@Injectable()
export class RateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async consume(limit: Limit, subject: string) {
    const key = keyedHash(this.env.TOKEN_PEPPER, `${limit.name}:${subject}`)
    // Parameterised by Prisma's tagged template: values are sent separately from the SQL text.
    const rows = await this.prisma.$queryRaw<Array<{ hits: number; retry_after: number }>>`
      insert into rate_limits as r (key, window_start, hits) values (${key}, now(), 1)
      on conflict (key) do update set
        hits = case when r.window_start <= now() - make_interval(secs => ${limit.windowSeconds}::double precision) then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= now() - make_interval(secs => ${limit.windowSeconds}::double precision) then now() else r.window_start end
      returning hits, ceil(extract(epoch from (window_start + make_interval(secs => ${limit.windowSeconds}::double precision) - now())))::int as retry_after`
    const row = rows[0]
    if (row && row.hits > limit.max) throw tooManyRequests(row.retry_after)
  }

  async consumeAll(entries: Array<[Limit, string | null | undefined]>) {
    for (const [limit, subject] of entries) if (subject) await this.consume(limit, subject)
  }

  // Housekeeping: windows that ended more than a day ago can go.
  async prune() {
    await this.prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } })
  }
}
