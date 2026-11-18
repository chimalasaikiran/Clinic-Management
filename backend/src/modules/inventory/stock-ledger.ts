import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { conflict, forbidden, notFound } from '../../common/errors/app-error'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import type { Tx } from '../../database/prisma.service'
import { localDate, localMinute, minuteToTime } from '../scheduling/clinic-time'
import { BatchStock, Pick, totalAvailable } from './fefo'

const isoDay = (value: Date) => value.toISOString().slice(0, 10)

export type InventoryEntity = 'item' | 'location' | 'supplier' | 'request' | 'transfer' | 'order' | 'receipt' | 'adjustment' | 'case'

// The only way stock changes. Every helper runs inside the caller's transaction, after `lock`, and each
// change is a guarded UPDATE: if another transaction took the stock first, the guard fails and so does the change.
@Injectable()
export class StockLedger {
  constructor(
    private readonly counters: CountersRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  today() {
    return localDate(new Date(), this.env.CLINIC_TIMEZONE)
  }

  stamp(instant: Date) {
    return { date: localDate(instant, this.env.CLINIC_TIMEZONE), time: minuteToTime(localMinute(instant, this.env.CLINIC_TIMEZONE)), at: instant.toISOString() }
  }

  async reference(tx: Tx, orgId: string, counter: string, prefix: string) {
    return formatNumber(prefix, await this.counters.next(tx, orgId, counter))
  }

  async event(tx: Tx, orgId: string, entityType: InventoryEntity, entityId: string, action: string, actorId: string | null, note = '') {
    await tx.inventoryEvent.create({ data: { orgId, entityType, entityId, action, note, actorId } })
  }

  // A location of the organisation, which the caller may act on: their branch scope must include its branch.
  async location(tx: Tx, access: AccessContext, locationId: string) {
    const location = await tx.stockLocation.findFirst({ where: { id: locationId, orgId: access.orgId, active: true } })
    if (!location) throw notFound('Stock location not found.')
    if (access.branchScope !== 'all' && !access.branchScope.includes(location.branchId)) throw forbidden('LOCATION_OUT_OF_SCOPE', 'That location belongs to a branch outside your role.')
    return location
  }

  // Locks every batch of an item at a location, in a fixed order, so concurrent changes queue up.
  async lock(tx: Tx, itemId: string, locationId: string) {
    await tx.$queryRaw`select id from stock_batches where item_id = ${itemId}::uuid and location_id = ${locationId}::uuid order by id for update`
  }

  async batches(tx: Tx, itemId: string, locationId: string): Promise<BatchStock[]> {
    const rows = await tx.stockBatch.findMany({ where: { itemId, locationId } })
    return rows.map((row) => ({ id: row.id, batchNo: row.batchNo, expiry: isoDay(row.expiry), posted: row.posted, reserved: row.reserved, quarantine: row.quarantine, bin: row.bin }))
  }

  async reserve(tx: Tx, picks: Pick[]) {
    for (const pick of picks) {
      const done = await tx.$executeRaw`update stock_batches set reserved = reserved + ${pick.qty} where id = ${pick.batchId}::uuid and posted - reserved - quarantine >= ${pick.qty}`
      if (done !== 1) throw conflict('STOCK_CHANGED', `Batch ${pick.batchNo} no longer has ${pick.qty} available. Reload and try again.`)
    }
  }

  async release(tx: Tx, picks: Array<{ batchId: string; qty: number }>) {
    for (const pick of picks) await tx.$executeRaw`update stock_batches set reserved = greatest(reserved - ${pick.qty}, 0) where id = ${pick.batchId}::uuid`
  }

  // Removes reserved units (a dispatched transfer).
  async issueReserved(tx: Tx, picks: Array<{ batchId: string; batchNo: string; qty: number }>) {
    for (const pick of picks) {
      const done = await tx.$executeRaw`update stock_batches set posted = posted - ${pick.qty}, reserved = reserved - ${pick.qty} where id = ${pick.batchId}::uuid and reserved >= ${pick.qty} and posted >= ${pick.qty}`
      if (done !== 1) throw conflict('STOCK_CHANGED', `The reservation on batch ${pick.batchNo} has changed. Reload and try again.`)
    }
  }

  // Removes free (unreserved) units: dispensing.
  async consume(tx: Tx, picks: Pick[]) {
    for (const pick of picks) {
      const done = await tx.$executeRaw`update stock_batches set posted = posted - ${pick.qty} where id = ${pick.batchId}::uuid and posted - reserved - quarantine >= ${pick.qty}`
      if (done !== 1) throw conflict('STOCK_CHANGED', `Batch ${pick.batchNo} no longer has ${pick.qty} available. Reload and try again.`)
    }
  }

  // Adds units to a batch, creating it when this item, location and batch number are new.
  async post(tx: Tx, orgId: string, entry: { itemId: string; locationId: string; batchNo: string; expiry: string; qty: number; bin: string }) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into stock_batches (id, org_id, item_id, location_id, batch_no, expiry, posted, reserved, quarantine, bin)
      values (${randomUUID()}::uuid, ${orgId}::uuid, ${entry.itemId}::uuid, ${entry.locationId}::uuid, ${entry.batchNo}, ${entry.expiry}::date, ${entry.qty}, 0, 0, ${entry.bin})
      on conflict (item_id, location_id, batch_no) do update set posted = stock_batches.posted + excluded.posted
      returning id`
    return rows[0]!.id
  }

  // A counted correction to posted stock; never below what is reserved or quarantined.
  async adjust(tx: Tx, batchId: string, batchNo: string, delta: number) {
    const done = await tx.$executeRaw`update stock_batches set posted = posted + ${delta} where id = ${batchId}::uuid and posted + ${delta} >= reserved + quarantine`
    if (done !== 1) throw conflict('STOCK_CHANGED', `Batch ${batchNo} cannot go below the units it has reserved or quarantined.`)
  }

  async movement(tx: Tx, orgId: string, entry: { itemId: string; locationId: string; batchId?: string | null; kind: string; reference: string; batchLabel: string; delta: number; reason: string; actorId: string | null }) {
    const availableAfter = totalAvailable(await this.batches(tx, entry.itemId, entry.locationId), this.today())
    await tx.stockMovement.create({ data: { orgId, ...entry, batchId: entry.batchId ?? null, reason: entry.reason.slice(0, 500), batchLabel: entry.batchLabel.slice(0, 200), availableAfter } })
  }
}
