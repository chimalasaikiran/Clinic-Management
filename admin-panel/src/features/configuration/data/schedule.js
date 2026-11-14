// Sample opening hours until the configuration API exists.
export const SCHEDULE_PIPELINE = [
  'Branch Master (#KDP-01)',
  'Branch Operating Hours (Facility Envelope)',
  'Doctor Roster & Availability (Within Envelope)',
  'Slot Dispatcher',
]

const MORNING = { id: 's1', from: '09:00 AM', to: '01:00 PM', label: 'Morning OPD' }
const EVENING = { id: 's2', from: '04:00 PM', to: '08:00 PM', label: 'Evening Specialty' }
const CONTINUOUS = { id: 's1', from: '09:00 AM', to: '08:00 PM', label: 'Continuous OPD' }

export const WEEKLY_SCHEDULE = [
  { day: 'Monday', sessions: [MORNING, EVENING] },
  { day: 'Tuesday', sessions: [CONTINUOUS] },
  { day: 'Wednesday', sessions: [MORNING, EVENING] },
  { day: 'Thursday', sessions: [CONTINUOUS] },
  { day: 'Friday', sessions: [MORNING, EVENING] },
  { day: 'Saturday', sessions: [{ id: 's1', from: '09:00 AM', to: '04:00 PM', label: 'Half-day OPD' }] },
  { day: 'Sunday', sessions: [] },
]

export const SCHEDULE_EXCEPTIONS = [
  { id: 'e1', date: '15 Aug 2026', kind: 'closed', badge: 'Closed (Full Day)', title: 'Independence Day (Gazetted National Holiday)', note: 'Full-day facility closure · Status: Scheduled' },
  { id: 'e2', date: '02 Oct 2026', kind: 'closed', badge: 'Closed (Full Day)', title: 'Gandhi Jayanti (National Holiday)', note: 'Full-day facility closure · Status: Scheduled' },
  { id: 'e3', date: '24 Oct 2026', kind: 'special', badge: 'Special Hours: 09:00 AM – 01:00 PM', title: 'Diwali Eve Special Hours', note: 'Morning session only, evening OPD suspended for festival · Status: Scheduled' },
  { id: 'e4', date: '01 Nov 2026', kind: 'special', badge: 'Special Hours: 10:00 AM – 02:00 PM', title: 'Facility Maintenance & Clinical Audit', note: 'Facility maintenance & clinical audit window · Status: Scheduled' },
]
