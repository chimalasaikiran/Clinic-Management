import { minuteToTime } from './clinic-time'

export interface Window {
  startMinute: number
  endMinute: number
}

export interface BusyRange {
  startMinute: number
  endMinute: number
}

export type SlotState = 'available' | 'booked' | 'past' | 'unavailable'

export interface Slot {
  time: string
  minute: number
  state: SlotState
}

// Bookable slots for one practitioner on one day: each consulting window is cut into back-to-back slots of
// `slotMinutes`, starting at the window start. A slot is past when it starts before `notBeforeMinute` (now, on
// today's date), unavailable when it overlaps the practitioner's leave or a block, and booked when any open
// appointment overlaps it.
export function daySlots(windows: readonly Window[], slotMinutes: number, busy: readonly BusyRange[], notBeforeMinute: number | null, blocked: readonly BusyRange[] = []): Slot[] {
  const slots: Slot[] = []
  for (const window of [...windows].sort((a, b) => a.startMinute - b.startMinute)) {
    for (let minute = window.startMinute; minute + slotMinutes <= window.endMinute; minute += slotMinutes) {
      const end = minute + slotMinutes
      const overlaps = (range: BusyRange) => range.startMinute < end && range.endMinute > minute
      const state: SlotState = notBeforeMinute !== null && minute < notBeforeMinute ? 'past' : blocked.some(overlaps) ? 'unavailable' : busy.some(overlaps) ? 'booked' : 'available'
      slots.push({ time: minuteToTime(minute), minute, state })
    }
  }
  return slots
}

// True when a booking starting at `minute` sits exactly on a slot of one of the windows.
export function isSlotStart(windows: readonly Window[], slotMinutes: number, minute: number): boolean {
  return windows.some(
    (window) => minute >= window.startMinute && minute + slotMinutes <= window.endMinute && (minute - window.startMinute) % slotMinutes === 0,
  )
}

// Weekly windows must not overlap each other on the same weekday (the database enforces the same rule).
export function overlappingWindows(windows: ReadonlyArray<Window & { weekday: number }>): boolean {
  const sorted = [...windows].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
  return sorted.some((window, index) => index > 0 && sorted[index - 1]!.weekday === window.weekday && sorted[index - 1]!.endMinute > window.startMinute)
}

export interface LeaveBlock {
  startDate: string
  endDate: string
  startMinute: number | null
  endMinute: number | null
  branchId: string | null
}

// The parts of `date` at `branchId` that a practitioner's leave or blocks take out (whole days are 0–1440).
export function blockedRanges(leaves: readonly LeaveBlock[], date: string, branchId: string): BusyRange[] {
  return leaves
    .filter((leave) => leave.startDate <= date && leave.endDate >= date && (leave.branchId === null || leave.branchId === branchId))
    .map((leave) => (leave.startMinute === null ? { startMinute: 0, endMinute: 1440 } : { startMinute: leave.startMinute, endMinute: leave.endMinute! }))
}
