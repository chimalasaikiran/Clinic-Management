import { describe, expect, it } from 'vitest'
import { outsideBranchHours } from '../../src/modules/configuration/configuration.logic'
import { closureSchema, contactSchema, createBranchSchema, hoursSchema, specialtiesSchema } from '../../src/modules/configuration/configuration.schemas'

describe('branch hours', () => {
  const hours = new Map([['b-1', [{ weekday: 1, start: '09:00', end: '13:00' }, { weekday: 1, start: '17:00', end: '20:00' }]]])
  const window = (start: string, end: string, weekday = 1, branchId = 'b-1') => ({ branchId, branchName: 'Main', weekday, start, end })

  it('accepts a doctor session inside one of the day’s open sessions', () => {
    expect(outsideBranchHours([window('09:30', '12:30'), window('17:00', '20:00')], hours)).toEqual([])
  })

  it('warns about a session spanning the break, on a closed day, or outside the hours', () => {
    expect(outsideBranchHours([window('09:00', '20:00')], hours)).toEqual(['Monday 09:00–20:00 at Main is outside the branch’s hours (09:00–13:00, 17:00–20:00).'])
    expect(outsideBranchHours([window('10:00', '12:00', 0)], hours)).toEqual(['Sunday 10:00–12:00 at Main is outside the branch’s hours (closed).'])
  })

  it('does not check a branch without hours set', () => {
    expect(outsideBranchHours([window('06:00', '23:00', 1, 'b-2')], hours)).toEqual([])
  })

  it('needs each session to end after it starts, and special hours to have both times', () => {
    expect(hoursSchema.safeParse({ sessions: [{ weekday: 1, start: '13:00', end: '09:00' }] }).success).toBe(false)
    expect(hoursSchema.safeParse({ sessions: [{ weekday: 7, start: '09:00', end: '13:00' }] }).success).toBe(false)
    expect(closureSchema.safeParse({ date: '2026-12-25', kind: 'closed', reason: 'Christmas' }).success).toBe(true)
    expect(closureSchema.safeParse({ date: '2026-12-24', kind: 'special', opensAt: '10:00', reason: 'Eve' }).success).toBe(false)
  })
})

describe('organisation and branch fields', () => {
  it('normalises phone numbers and refuses short ones', () => {
    expect(contactSchema.parse({ phone: '+91 98480 11223' }).phone).toBe('9848011223')
    expect(contactSchema.parse({ phone: '040-2311 4455' }).phone).toBe('04023114455')
    expect(contactSchema.safeParse({ phone: '12345' }).success).toBe(false)
  })

  it('upper-cases branch codes and checks the PIN code', () => {
    const base = { name: 'Kondapur', code: 'kdp-01', addressLine1: 'Road 1', city: 'Hyderabad', state: 'Telangana', pinCode: '500084', facilityType: 'Outpatient Practice' }
    expect(createBranchSchema.parse(base)).toMatchObject({ code: 'KDP-01', status: 'active', country: 'India', roleIds: [] })
    expect(createBranchSchema.safeParse({ ...base, pinCode: '050084' }).success).toBe(false)
    expect(createBranchSchema.safeParse({ ...base, code: 'K' }).success).toBe(false)
  })

  it('keeps each specialty once and needs at least one', () => {
    expect(specialtiesSchema.parse({ specialties: ['Cardiology', 'Cardiology'] }).specialties).toEqual(['Cardiology'])
    expect(specialtiesSchema.safeParse({ specialties: [] }).success).toBe(false)
  })
})
