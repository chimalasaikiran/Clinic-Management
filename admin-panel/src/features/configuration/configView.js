// Labels and helpers shared by the Configuration screens.

export const BRANCH_STATUS = { planned: ['Planned', 'info'], active: ['Active', 'success'], paused: ['Paused', 'warning'], inactive: ['Inactive', 'neutral'] }

export const BRANCH_FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'active', label: 'Active', match: (branch) => branch.status === 'active' },
  { id: 'other', label: 'Planned / paused', match: (branch) => branch.status !== 'active' },
]

export const FACILITY_TYPES = ['Multi-specialty Clinic', 'Outpatient Practice', 'Daycare Surgical Center', 'Diagnostic Centre', 'Physiotherapy Centre']
export const DEPARTMENT_TYPES = ['Clinical', 'Diagnostic', 'Therapy', 'Support', 'Administrative']
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Monday first, as the schedule screens show the week.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const branchAddress = (branch) => [branch.addressLine1, branch.addressLine2, branch.city, branch.state].filter(Boolean).join(', ') + (branch.pinCode ? ` · ${branch.pinCode}` : '')

export const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('')

// "09:00" → "09:00 AM"
export function clock12(time) {
  if (!time) return ''
  if (time === '24:00') return '12:00 AM'
  const [hours, minutes] = time.split(':').map(Number)
  return `${String(((hours + 11) % 12) + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

// The full body PATCH /v1/departments/:id expects, with some fields changed.
export const departmentPayload = (department, patch = {}) => ({
  name: department.name,
  type: department.type,
  description: department.description,
  status: department.status,
  branchIds: department.branches.map((branch) => branch.id),
  version: department.version,
  ...patch,
})
