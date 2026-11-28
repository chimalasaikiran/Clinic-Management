import type { Slot } from '../scheduling/slots'

export interface PooledSlot {
  time: string
  // Therapists who are free then. Empty means every one who works that time is already booked.
  free: string[]
}

// Patients choose a time, not a therapist, so one day's slots are pooled across everyone who can take the
// service. A time appears if anyone works it; times that have passed or fall in leave do not count.
export function poolSlots(days: ReadonlyArray<{ practitionerId: string; slots: readonly Slot[] }>): PooledSlot[] {
  const pool = new Map<string, string[]>()
  for (const { practitionerId, slots } of days) {
    for (const slot of slots) {
      if (slot.state === 'past' || slot.state === 'unavailable') continue
      const free = pool.get(slot.time) ?? []
      if (slot.state === 'available') free.push(practitionerId)
      pool.set(slot.time, free)
    }
  }
  return [...pool].sort(([a], [b]) => a.localeCompare(b)).map(([time, free]) => ({ time, free }))
}

// Free therapists in the order to try them: whoever should keep the booking first, then the least busy that day.
export function assignmentOrder(free: readonly string[], bookedThatDay: ReadonlyMap<string, number>, preferred?: string): string[] {
  const rank = (id: string) => (id === preferred ? -1 : (bookedThatDay.get(id) ?? 0))
  return [...free].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export function ageInYears(dateOfBirth: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4))
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years
}

// The title on a record a patient creates by booking. Left empty where it cannot be known; the desk can set it.
export function titleFor(gender: 'male' | 'female' | 'other', age: number): string {
  if (gender === 'male') return age < 13 ? 'Master' : 'Mr.'
  if (gender === 'female') return 'Ms.'
  return ''
}
