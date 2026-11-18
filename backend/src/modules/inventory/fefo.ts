// Stock arithmetic shared by every inventory operation. Pure, so it is unit tested.

export interface BatchStock {
  id: string
  batchNo: string
  expiry: string // YYYY-MM-DD
  posted: number
  reserved: number
  quarantine: number
  bin: string
}

export interface Pick {
  batchId: string
  batchNo: string
  expiry: string
  bin: string
  qty: number
}

export const isExpired = (batch: Pick | BatchStock, today: string) => batch.expiry < today

// What can be allocated: posted stock less reservations and quarantine. Expired stock is never available.
export const availableOf = (batch: BatchStock, today: string) => (isExpired(batch, today) ? 0 : Math.max(0, batch.posted - batch.reserved - batch.quarantine))

export const totalAvailable = (batches: BatchStock[], today: string) => batches.reduce((sum, batch) => sum + availableOf(batch, today), 0)

// First-expiry-first-out: takes `quantity` from the earliest-expiring available batches.
export function fefoPlan(batches: BatchStock[], quantity: number, today: string) {
  const picks: Pick[] = []
  let remaining = quantity
  for (const batch of [...batches].sort((a, b) => a.expiry.localeCompare(b.expiry) || a.batchNo.localeCompare(b.batchNo))) {
    if (remaining <= 0) break
    const free = availableOf(batch, today)
    if (free <= 0) continue
    const qty = Math.min(remaining, free)
    picks.push({ batchId: batch.id, batchNo: batch.batchNo, expiry: batch.expiry, bin: batch.bin, qty })
    remaining -= qty
  }
  return { picks, short: Math.max(0, remaining) }
}

export const batchLabel = (picks: Array<{ batchNo: string }>) => [...new Set(picks.map((pick) => pick.batchNo))].join(' / ')
