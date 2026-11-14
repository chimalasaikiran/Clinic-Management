// The OPD day grid: one column per consulting chamber, one row per 30-minute slot of the chosen session.
export const SCHEDULE_NOW = '10:15'

export const CHAMBERS = [
  { doctorId: 'rahul-mehta', chamber: '101', specialty: 'Cardiology' },
  { doctorId: 'ananya-rao', chamber: '102', specialty: 'Cardiology' },
  { doctorId: 'sarita-nambiar', chamber: '103', specialty: 'General Medicine' },
  { doctorId: 'rajesh-nair', chamber: '104', specialty: 'Internal Medicine' },
]

export const GRID_SESSIONS = [
  { id: 'morning', label: 'Morning OPD (09:00 - 13:00)', start: '09:00', end: '13:00' },
  { id: 'afternoon', label: 'Afternoon OPD (13:00 - 17:00)', start: '13:00', end: '17:00' },
  { id: 'evening', label: 'Evening OPD (17:00 - 20:00)', start: '17:00', end: '20:00' },
]

// Slots a doctor is not available for consultations (rounds, procedures). Shown as blocked cells.
export const ROSTER_BLOCKS = {
  'rajesh-nair': [{ from: '11:00', to: '12:00', label: 'Ward round', note: 'Clinician rounds · consultations resume at 12:00' }],
}

export const OPEN_STATUSES = ['Pending Confirmation', 'Scheduled', 'Confirmed', 'Arrived', 'In Progress']
export const OFF_GRID_STATUSES = ['Cancelled', 'No-show']

export const STATUS_FILTERS = ['Pending Confirmation', 'Scheduled', 'Confirmed', 'Arrived', 'In Progress', 'Completed', 'Cancelled', 'No-show']
