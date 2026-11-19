import { describe, expect, it } from 'vitest'
import { apiLead } from '../../test/fixtures/leadsApi'
import { displayMobile, leadPayload, leadSummary, listQuery, ownerOptions, stampOf, toLeadView, validateInteraction, validateLead } from './leadsView'

describe('lead view', () => {
  it('shows API leads in clinic time with the labels the screens use', () => {
    const lead = toLeadView(apiLead({ nextDueAt: '2026-11-19T10:30:00.000Z', dueState: 'due_today', interest: null }))
    expect(lead).toMatchObject({ number: 'LD-000001', name: 'Nisha Menon', phone: '98480 22110', source: 'Phone inquiry', stage: 'New', owner: 'Meera Shah', branch: 'Main Clinic', summary: 'General enquiry', dueState: 'Due today' })
    expect(lead.due).toEqual({ date: '2026-11-19', time: '16:00' })
    // 20:00 UTC is already the next day in IST.
    expect(stampOf('2026-11-18T20:00:00.000Z')).toEqual({ date: '2026-11-19', time: '01:30' })
    expect(displayMobile('9848022110')).toBe('98480 22110')
  })

  it('turns register filters into API parameters and summarises the counts', () => {
    expect(listQuery({ q: 'nisha', stage: 'Qualified', source: 'Walk-in', owner: 'm-2', due: 'Due today', sort: 'name' }, 'b-main')).toEqual({ q: 'nisha', stage: 'qualified', source: 'walk_in', ownerId: 'm-2', due: 'due_today', sort: 'name', branchId: 'b-main' })
    expect(listQuery({}, '')).toEqual({ q: undefined, stage: undefined, source: undefined, ownerId: undefined, due: undefined, sort: undefined, branchId: undefined })
    const summary = leadSummary({ summary: { byStage: { new: 2, contacted: 1, qualified: 0, converted: 3, closed: 1 }, overdue: 1, dueToday: 2, followUpsDue: 3 } })
    expect(summary).toMatchObject({ new: 2, converted: 3, overdue: 1, followUpsDue: 3 })
    expect(summary.pipeline).toEqual({ New: 2, Contacted: 1, Qualified: 0, Converted: 3, Closed: 1 })
    expect(leadSummary(null).followUpsDue).toBe(0)
  })

  it('offers only owners who cover the branch and builds the save body', () => {
    const owners = [{ membershipId: 'm-1', name: 'Meera Shah', branches: 'all' }, { membershipId: 'm-2', name: 'Priya Nair', branches: ['b-kondapur'] }]
    expect(ownerOptions(owners, 'b-main')).toEqual([{ value: 'm-1', label: 'Meera Shah' }])
    expect(ownerOptions(owners, 'b-kondapur').map((option) => option.label)).toEqual(['Meera Shah', 'Priya Nair'])
    expect(leadPayload({ name: ' Nisha ', phone: '98480 22110', email: '', interest: ' Knee ', branchId: 'b-main', ownerId: 'm-1', reviewed: false })).toEqual({ fullName: 'Nisha', mobile: '9848022110', email: '', interest: 'Knee', branchId: 'b-main', ownerMembershipId: 'm-1', confirmedNotDuplicate: false })
  })

  it('checks a lead and an interaction before sending them', () => {
    expect(Object.keys(validateLead({ name: '', phone: '123', email: 'x', branchId: '', ownerId: '', nextDate: '2026-11-20', nextAction: '' }))).toEqual(['name', 'phone', 'email', 'branch', 'owner', 'nextAction'])
    expect(validateLead({ name: 'Nisha Menon', phone: '+91 98480 22110', email: '', branchId: 'b-main', ownerId: 'm-1', nextDate: '', nextAction: '' })).toEqual({})
    expect(validateInteraction({ outcome: '', notes: '', owner: 'm-1', decision: 'keep' })).toEqual({ outcome: expect.any(String), notes: expect.any(String) })
    expect(Object.keys(validateInteraction({ outcome: 'Connected', notes: 'Spoke', owner: 'm-1', decision: 'reschedule', nextAction: '', nextDate: '', reason: '' }))).toEqual(['nextAction', 'nextDate', 'reason'])
  })
})
