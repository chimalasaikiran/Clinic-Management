import { describe, expect, it } from 'vitest'
import { canTransition, transition } from '../../src/modules/appointments/lifecycle'
import { addDays, localDate, localMinute, minuteToTime, timeToMinute, weekdayOf, zonedInstant } from '../../src/modules/scheduling/clinic-time'
import { blockedRanges, daySlots, isSlotStart, overlappingWindows } from '../../src/modules/scheduling/slots'

const IST = 'Asia/Kolkata'

describe('clinic time', () => {
  it('converts a clinic wall-clock time to the right instant and back', () => {
    const instant = zonedInstant('2026-11-16', timeToMinute('09:30'), IST)
    expect(instant.toISOString()).toBe('2026-11-16T04:00:00.000Z')
    expect(localDate(instant, IST)).toBe('2026-11-16')
    expect(minuteToTime(localMinute(instant, IST))).toBe('09:30')
  })

  it('handles the local date changing before UTC does', () => {
    const justAfterMidnight = new Date('2026-11-15T18:45:00.000Z')
    expect(localDate(justAfterMidnight, IST)).toBe('2026-11-16')
    expect(localMinute(justAfterMidnight, IST)).toBe(15)
  })

  it('respects daylight saving time in zones that use it', () => {
    // London is UTC+1 in July and UTC+0 in January.
    expect(zonedInstant('2026-07-01', timeToMinute('09:00'), 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z')
    expect(zonedInstant('2026-01-15', timeToMinute('09:00'), 'Europe/London').toISOString()).toBe('2026-01-15T09:00:00.000Z')
  })

  it('works out weekdays and adds days across month ends', () => {
    expect(weekdayOf('2026-11-15')).toBe(0)
    expect(weekdayOf('2026-11-16')).toBe(1)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('slot generation', () => {
  const morning = { startMinute: timeToMinute('09:00'), endMinute: timeToMinute('11:00') }

  it('cuts each window into back-to-back slots that fit entirely inside it', () => {
    const slots = daySlots([{ startMinute: timeToMinute('09:00'), endMinute: timeToMinute('10:40') }], 30, [], null)
    expect(slots.map((slot) => slot.time)).toEqual(['09:00', '09:30', '10:00'])
    expect(slots.every((slot) => slot.state === 'available')).toBe(true)
  })

  it('marks slots that overlap an open appointment as booked, including partial overlaps', () => {
    const slots = daySlots([morning], 30, [{ startMinute: timeToMinute('09:45'), endMinute: timeToMinute('10:15') }], null)
    expect(slots.map((slot) => `${slot.time} ${slot.state}`)).toEqual(['09:00 available', '09:30 booked', '10:00 booked', '10:30 available'])
  })

  it('marks slots that already started today as past', () => {
    const slots = daySlots([morning], 30, [], timeToMinute('09:40'))
    expect(slots.map((slot) => slot.state)).toEqual(['past', 'past', 'available', 'available'])
  })

  it('lists several windows in time order', () => {
    const evening = { startMinute: timeToMinute('17:00'), endMinute: timeToMinute('18:00') }
    expect(daySlots([evening, morning], 60, [], null).map((slot) => slot.time)).toEqual(['09:00', '10:00', '17:00'])
  })

  it('accepts only times that sit exactly on a slot boundary', () => {
    expect(isSlotStart([morning], 30, timeToMinute('09:30'))).toBe(true)
    expect(isSlotStart([morning], 30, timeToMinute('09:15'))).toBe(false)
    expect(isSlotStart([morning], 30, timeToMinute('10:45'))).toBe(false)
    expect(isSlotStart([morning], 30, timeToMinute('08:30'))).toBe(false)
  })

  it('detects overlapping weekly windows on the same weekday only', () => {
    expect(overlappingWindows([{ weekday: 1, ...morning }, { weekday: 1, startMinute: timeToMinute('10:30'), endMinute: timeToMinute('12:00') }])).toBe(true)
    expect(overlappingWindows([{ weekday: 1, ...morning }, { weekday: 2, ...morning }])).toBe(false)
    expect(overlappingWindows([{ weekday: 1, ...morning }, { weekday: 1, startMinute: timeToMinute('11:00'), endMinute: timeToMinute('12:00') }])).toBe(false)
  })
})

describe('leave and blocks', () => {
  const leave = (overrides = {}) => ({ startDate: '2026-11-16', endDate: '2026-11-18', startMinute: null, endMinute: null, branchId: null, ...overrides })

  it('takes whole days out at every branch, or one branch only', () => {
    expect(blockedRanges([leave()], '2026-11-17', 'main')).toEqual([{ startMinute: 0, endMinute: 1440 }])
    expect(blockedRanges([leave()], '2026-11-19', 'main')).toEqual([])
    expect(blockedRanges([leave({ branchId: 'other' })], '2026-11-17', 'main')).toEqual([])
  })

  it('marks slots inside a block unavailable, ahead of booked ones', () => {
    const block = blockedRanges([leave({ startMinute: timeToMinute('10:00'), endMinute: timeToMinute('11:00') })], '2026-11-16', 'main')
    const slots = daySlots([{ startMinute: timeToMinute('09:00'), endMinute: timeToMinute('11:30') }], 30, [{ startMinute: timeToMinute('10:30'), endMinute: timeToMinute('11:00') }], null, block)
    expect(slots.map((slot) => `${slot.time} ${slot.state}`)).toEqual(['09:00 available', '09:30 available', '10:00 unavailable', '10:30 unavailable', '11:00 available'])
  })
})

describe('appointment lifecycle', () => {
  it('follows pending → confirmed → arrived → in progress → completed', () => {
    expect(transition('confirm', 'pending')).toBe('confirmed')
    expect(transition('checkIn', 'confirmed')).toBe('arrived')
    expect(transition('start', 'arrived')).toBe('in_progress')
    expect(transition('complete', 'in_progress')).toBe('completed')
  })

  it('allows cancelling, no-shows and rescheduling only before arrival', () => {
    for (const action of ['cancel', 'noShow', 'reschedule'] as const) {
      expect(canTransition(action, 'pending')).toBe(true)
      expect(canTransition(action, 'confirmed')).toBe(true)
      expect(canTransition(action, 'arrived')).toBe(false)
      expect(canTransition(action, 'completed')).toBe(false)
    }
    expect(transition('reschedule', 'pending')).toBe('confirmed')
  })

  it('never reopens a closed appointment', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as const) {
      for (const action of ['confirm', 'reschedule', 'checkIn', 'start', 'complete', 'cancel', 'noShow'] as const) {
        expect(canTransition(action, status)).toBe(false)
      }
    }
    expect(() => transition('cancel', 'completed')).toThrow('This appointment is completed, so it cannot be cancelled.')
  })
})
