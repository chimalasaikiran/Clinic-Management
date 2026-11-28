import type { OrderStatus, ResultFlag } from '../../generated/prisma/client'

// What a patient may see of an order's progress. Event notes are left out: the "resulted" note holds the result
// itself, which the patient must not read before a clinician has reviewed it.
const PATIENT_STEPS = ['ordered', 'collected', 'resulted', 'reviewed', 'cancelled'] as const

export function orderSteps(events: ReadonlyArray<{ action: string; createdAt: Date }>) {
  return events
    .filter((event) => (PATIENT_STEPS as readonly string[]).includes(event.action))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((event) => ({ action: event.action as (typeof PATIENT_STEPS)[number], at: event.createdAt.toISOString() }))
}

// The result is shown only once reviewed. Outcomes that need action tell the patient to talk to the clinic,
// without passing on the reviewer's own note.
export function releasedResult(order: { status: OrderStatus; resultSummary: string | null; resultFlag: ResultFlag | null; reviewOutcome: string | null }, reviewedAt: Date | null) {
  if (order.status !== 'reviewed' || !order.resultSummary) return null
  return {
    summary: order.resultSummary,
    flag: order.resultFlag,
    followUp: order.reviewOutcome === 'action' || order.reviewOutcome === 'escalate',
    reviewedAt: reviewedAt?.toISOString() ?? null,
  }
}

// The last day of a prescription's longest course, counting the day it was issued as day one.
export function courseEnd(issued: string, durations: readonly number[]) {
  const days = Math.max(1, ...durations)
  const end = new Date(`${issued}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days - 1)
  return end.toISOString().slice(0, 10)
}

export type HistoryKind = 'consultation' | 'prescription' | 'order' | 'result' | 'care_plan'

export interface HistoryEntry {
  kind: HistoryKind
  id: string
  at: string
  title: string
  detail: string
  clinicName: string
}

export const newestFirst = (a: HistoryEntry, b: HistoryEntry) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)
