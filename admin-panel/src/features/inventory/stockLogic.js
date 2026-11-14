import { daysBetween } from '../patients/format'
import { NEAR_EXPIRY_DAYS, NOW } from './constants'

const byExpiry = (a, b) => a.expiry.localeCompare(b.expiry)
const total = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0)

export const isExpired = (batch, today = NOW.date) => batch.expiry < today

// Stock that can be allocated: posted stock net of reservations and quarantine; expired stock is never available.
export const availableOf = (batch, today = NOW.date) => (isExpired(batch, today) ? 0 : Math.max(0, batch.posted - batch.reserved - batch.quarantine))

// Totals for one item, optionally at one location. Batches are returned earliest expiry first.
export function summarise(batches, itemId, loc, today = NOW.date) {
  const rows = batches.filter((batch) => batch.itemId === itemId && (!loc || batch.loc === loc)).sort(byExpiry)
  const live = rows.filter((batch) => !isExpired(batch, today) && batch.posted > 0)
  return {
    rows,
    posted: total(rows, 'posted'),
    reserved: total(rows, 'reserved'),
    quarantine: total(rows, 'quarantine'),
    available: rows.reduce((sum, batch) => sum + availableOf(batch, today), 0),
    earliestExpiry: live[0]?.expiry ?? null,
  }
}

export const nearExpiry = (batch, today = NOW.date) => batch.posted > 0 && !isExpired(batch, today) && daysBetween(today, batch.expiry) <= NEAR_EXPIRY_DAYS

// Out of stock → Low stock (at or below the level) → Near expiry → Available.
export function stockStatus(summary, level, today = NOW.date) {
  if (summary.available <= 0) return 'Out of stock'
  if (summary.available < level) return 'Low stock'
  if (summary.rows.some((batch) => nearExpiry(batch, today))) return 'Near expiry'
  return 'Available'
}

// First-expiry-first-out allocation across the available batches of an item at a location.
export function fefoPlan(batches, itemId, loc, quantity, today = NOW.date) {
  const picks = []
  let remaining = quantity
  batches
    .filter((batch) => batch.itemId === itemId && batch.loc === loc && availableOf(batch, today) > 0)
    .sort(byExpiry)
    .forEach((batch) => {
      if (remaining <= 0) return
      const qty = Math.min(remaining, availableOf(batch, today))
      picks.push({ batchId: batch.id, batchNo: batch.batchNo, expiry: batch.expiry, bin: batch.bin, qty })
      remaining -= qty
    })
  return { picks, short: Math.max(0, remaining) }
}

const patch = (batches, picks, change) =>
  batches.map((batch) => {
    const pick = picks.find((entry) => entry.batchId === batch.id)
    return pick ? { ...batch, ...change(batch, pick.qty) } : batch
  })

export const reservePicks = (batches, picks) => patch(batches, picks, (batch, qty) => ({ reserved: batch.reserved + qty }))
export const releasePicks = (batches, picks) => patch(batches, picks, (batch, qty) => ({ reserved: Math.max(0, batch.reserved - qty) }))
// Issue removes the units from posted stock and from the reservation that held them.
export const issuePicks = (batches, picks) => patch(batches, picks, (batch, qty) => ({ posted: batch.posted - qty, reserved: Math.max(0, batch.reserved - qty) }))
export const consumePicks = (batches, picks) => patch(batches, picks, (batch, qty) => ({ posted: batch.posted - qty }))

// Adds accepted units to a batch, creating the batch when this item/location/batch number is new.
export function postBatch(batches, { itemId, loc, batchNo, expiry, qty, bin }) {
  const existing = batches.find((batch) => batch.itemId === itemId && batch.loc === loc && batch.batchNo === batchNo)
  if (existing) return batches.map((batch) => (batch === existing ? { ...batch, posted: batch.posted + qty, expiry: batch.expiry || expiry } : batch))
  const next = batches.reduce((max, batch) => Math.max(max, Number(batch.id.replace('BAT-', ''))), 0) + 1
  return [...batches, { id: `BAT-${String(next).padStart(3, '0')}`, itemId, loc, batchNo, expiry, posted: qty, reserved: 0, quarantine: 0, bin: bin ?? 'A-01' }]
}

export const stamp = (date = NOW.date) => date.slice(2).replaceAll('-', '')
