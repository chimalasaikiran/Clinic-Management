// The OPD day grid: one column per therapist consulting that day, one row per 30-minute band of the session.
export const GRID_STEP_MINUTES = 30

export const GRID_SESSIONS = [
  { id: 'morning', label: 'Morning OPD (until 13:00)', start: '06:00', end: '13:00' },
  { id: 'afternoon', label: 'Afternoon OPD (13:00 - 17:00)', start: '13:00', end: '17:00' },
  { id: 'evening', label: 'Evening OPD (from 17:00)', start: '17:00', end: '23:00' },
]

export const OPEN_STATUSES = ['Pending Confirmation', 'Confirmed', 'Arrived', 'In Progress']
export const OFF_GRID_STATUSES = ['Cancelled', 'No-show']

export const STATUS_FILTERS = ['Pending Confirmation', 'Confirmed', 'Arrived', 'In Progress', 'Completed', 'Cancelled', 'No-show']
