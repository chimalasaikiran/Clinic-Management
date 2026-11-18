import { Injectable } from '@nestjs/common'
import type { Tx } from './prisma.service'

// Gap-free, per-organisation numbering (PT-000001, APT-000001, daily queue tokens). The upsert takes a row lock
// on the counter, so concurrent transactions get consecutive numbers instead of the same one.
@Injectable()
export class CountersRepository {
  async next(tx: Tx, orgId: string, name: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ value: number }>>`
      insert into org_counters (org_id, name, value) values (${orgId}::uuid, ${name}, 1)
      on conflict (org_id, name) do update set value = org_counters.value + 1
      returning value`
    return rows[0]!.value
  }

  // Reserves `count` consecutive numbers in one round trip and returns the first of them.
  async reserve(tx: Tx, orgId: string, name: string, count: number): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ value: number }>>`
      insert into org_counters (org_id, name, value) values (${orgId}::uuid, ${name}, ${count})
      on conflict (org_id, name) do update set value = org_counters.value + ${count}
      returning value`
    return rows[0]!.value - count + 1
  }
}

export const formatNumber = (prefix: string, value: number, width = 6) => `${prefix}${String(value).padStart(width, '0')}`
