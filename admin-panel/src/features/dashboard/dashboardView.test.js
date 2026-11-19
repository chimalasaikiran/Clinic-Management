import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../config/routes'
import { dashboardFixture } from '../../test/fixtures/dashboardApi'
import {
  activity, attentionItems, clinicHour, clock, dayOptions, finance, greeting, keyMetrics, locations, operations, pendingApprovals,
  relativeTime, setupChecklist, teamStatus,
} from './dashboardView'

const view = dashboardFixture()
const NOW = Date.parse('2026-11-18T09:30:00.000Z')

describe('dashboard view', () => {
  it('greets by the clinic clock and lists the last seven days', () => {
    expect(greeting('Siddharth Verma', 9)).toBe('Good morning, Siddharth Verma')
    expect(greeting('Siddharth Verma', 15)).toBe('Good afternoon, Siddharth Verma')
    expect(greeting(null, 19)).toBe('Good evening')
    // 09:30 UTC is 15:00 in India.
    expect(clinicHour(NOW, 'Asia/Kolkata')).toBe(15)
    expect(dayOptions('2026-11-18').map((option) => option.label)).toEqual([
      'Today, Nov 18', 'Yesterday, Nov 17', 'Mon, Nov 16', 'Sun, Nov 15', 'Sat, Nov 14', 'Fri, Nov 13', 'Thu, Nov 12',
    ])
    expect(clock(540)).toBe('09:00 AM')
    expect(clock(1140)).toBe('07:00 PM')
    expect(relativeTime('2026-11-18T09:20:00.000Z', NOW)).toBe('10 min ago')
    expect(relativeTime('2026-11-18T07:00:00.000Z', NOW)).toBe('2 hr ago')
  })

  it('builds the key numbers from the sections the role can see', () => {
    const metrics = keyMetrics(view)
    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Appointments', '22 scheduled'], ['Patients', '15 seen'], ['Collections', '₹35,000'], ['Outstanding', '₹18,200'], ['No-shows', '2'],
    ])
    expect(metrics[0].detail).toBe('15 completed · 3 waiting · 4 upcoming')
    expect(metrics[4].queue).toEqual({ label: 'Not yet rebooked', pending: '1 patient' })
    expect(keyMetrics({ ...view, collections: null, outstanding: null }).map((metric) => metric.id)).toEqual(['appointments', 'patients', 'no-shows'])
  })

  it('lists only what needs attention, each with somewhere to act on it', () => {
    expect(attentionItems(view).map((item) => [item.title, item.badge, item.to])).toEqual([
      ['Payment reconciliation', '3 pending', ROUTES.billingReconciliation],
      ['Results awaiting review', '4 results', ROUTES.clinical],
      ['Inventory', 'Low stock', ROUTES.inventory],
      ['Pending approvals', '4 pending', ROUTES.staffDirectory],
    ])
    expect(pendingApprovals(view).parts.map((part) => part.text)).toEqual([
      '2 staff members without attendance today', '1 refund awaiting approval', '1 payroll adjustment to decide',
    ])
    const quiet = { ...view, reconciliation: { candidates: 0, exceptions: 0 }, orders: null, lowStock: { count: 0, items: [] }, refunds: null, approvals: { attendanceUnmarked: 0, payrollAdjustments: null, advances: null } }
    expect(attentionItems(quiet)).toEqual([])
  })

  it('describes each session and the money for the day', () => {
    const [morning, afternoon] = operations(view.appointments).sessions
    expect(morning).toMatchObject({ window: '(09:00 AM – 01:30 PM)', status: { label: 'Finished' }, highlighted: false })
    expect(afternoon).toMatchObject({ window: '(02:30 PM – 07:00 PM)', status: { label: 'In progress' }, highlighted: true })
    expect(afternoon.stats.map((stat) => stat.label)).toEqual(['10 appointments', '5 completed', '3 waiting', '4 upcoming', '0 no-show'])

    const tiles = finance(view).tiles
    expect(tiles.map((tile) => tile.value)).toEqual(['₹35,000', '₹18,200', '₹2,400', '3 items'])
    expect(tiles[0].note).toBe('+16.7% vs last Wednesday (₹30,000)')
    expect(finance({ ...view, collections: null, outstanding: null, refunds: null, reconciliation: null })).toBeNull()
  })

  it('shows the team, branches, activity and remaining setup steps', () => {
    const team = teamStatus(view, '03:00 PM')
    expect(team.alert).toBe('2 staff members without attendance marked · 1 arrived late')
    expect(team.nextSync).toBe('Attendance marked for 16 of 18 staff members')
    expect(teamStatus({ ...view, team: null })).toBeNull()

    expect(locations(view).map((row) => [row.code, row.name, row.focus, row.collections, row.exceptions.label])).toEqual([
      ['HQ', 'Main Clinic', 'Hyderabad, Telangana', '₹21,400', '2 items'],
      ['KP', 'Kondapur Clinic', 'Hyderabad, Telangana', '₹13,600', '1 item'],
    ])

    const events = activity(view, NOW)
    expect(events.map((event) => [event.title, event.time])).toEqual([['Payment received', '10 min ago'], ['Appointment booked', '24 min ago'], ['Staff attendance', '1 hr ago']])
    expect(events[0].body).toEqual(['₹2,500 payment received from ', { strong: 'Rohit Mehta' }, ' (UPI / QR)', ' · by Kavya Menon'])
    expect(activity({ ...view, activity: null }, NOW)).toBeNull()

    const checklist = setupChecklist(view)
    expect(checklist).toMatchObject({ completed: 5, total: 8, next: { title: 'Consulting hours', to: ROUTES.staffDirectory } })
    expect(checklist.remaining.map((step) => [step.step, step.label])).toEqual([[7, 'Pharmacy & inventory'], [8, 'Payroll rules']])
    expect(setupChecklist({ ...view, setup: view.setup.map((step) => ({ ...step, done: true })) })).toBeNull()
  })
})
