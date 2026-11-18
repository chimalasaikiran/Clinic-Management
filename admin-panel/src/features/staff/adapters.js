import { formatMobile } from '../patients/adapters'
import { formatDate, initialsOf } from '../patients/format'
import { to12Hour } from './time'

export const STATUS_LABELS = { active: 'Active', draft: 'Draft', inactive: 'Inactive' }
export const STATUS_VALUES = { Active: 'active', Draft: 'draft', Inactive: 'inactive', 'On Leave': 'on_leave' }
export const TYPE_LABELS = { doctor: 'Doctor', staff: 'Staff' }
export const ENGAGEMENT_LABELS = { full_time: 'Full-Time', visiting: 'Visiting Specialist', honorary: 'Honorary / On-Call' }
export const ATTENDANCE_LABELS = { present: 'Present', late: 'Late', absent: 'Absent', leave: 'Leave', unavailable: 'Unavailable' }
export const ATTENDANCE_VALUES = Object.fromEntries(Object.entries(ATTENDANCE_LABELS).map(([value, label]) => [label, value]))
export const LEAVE_KIND_LABELS = { leave: 'Planned Leave', block: 'Temporary Block', relief: 'Emergency Relief' }

// A staff record from the API in the shape the directory, banners and profile display.
export function toPersonView(person) {
  return {
    id: person.id,
    initials: initialsOf(person.fullName),
    tone: person.type === 'doctor' ? 'teal' : 'slate',
    name: person.fullName,
    shortName: person.fullName,
    staffCode: person.staffCode,
    registry: person.councilNumber ?? (person.type === 'doctor' ? 'Registration pending' : '—'),
    type: TYPE_LABELS[person.type],
    role: person.designation,
    department: person.department,
    branches: person.branches.map((branch) => branch.name),
    primaryBranch: person.branches.find((branch) => branch.isPrimary)?.name ?? null,
    status: person.onLeave ? 'On Leave' : STATUS_LABELS[person.status],
    leaveNote: person.onLeave ? `Until ${formatDate(person.onLeave.until)}` : undefined,
    email: person.email ?? '',
    mobile: formatMobile(person.mobile),
    record: person,
  }
}

// "18 Oct 2026" or "18 Oct 2026 – 20 Oct 2026", plus the blocked hours for a partial day.
export function leavePeriod(leave) {
  const days = leave.startDate === leave.endDate ? formatDate(leave.startDate) : `${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`
  return leave.startTime ? `${days} · ${leave.startTime}–${leave.endTime}` : days
}

export function leaveLength(leave) {
  const [sy, sm, sd] = leave.startDate.split('-').map(Number)
  const [ey, em, ed] = leave.endDate.split('-').map(Number)
  const days = Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1
  if (leave.startTime) return `${leave.startTime} – ${leave.endTime}${days > 1 ? ` on ${days} days` : ''}`
  return `${days} Full Day${days === 1 ? '' : 's'}`
}

// API attendance record → ledger row.
export function toLedgerRow(record) {
  return {
    id: record.id,
    isoDate: record.date,
    facility: record.branch.name,
    status: ATTENDANCE_LABELS[record.status],
    time: record.time ? to12Hour(record.time) : '—',
    rawTime: record.time ?? '',
    source: 'Manual entry',
    by: record.recordedBy,
    note: record.note,
    corrections: record.corrections,
    version: record.version,
  }
}
