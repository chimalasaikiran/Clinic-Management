import { GRID_SESSIONS, GRID_STEP_MINUTES, OFF_GRID_STATUSES, OPEN_STATUSES } from './constants'

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// The grid band an appointment time falls in ("10:15" → "10:00").
export const slotOf = (time) => toTime(Math.floor(toMinutes(time) / GRID_STEP_MINUTES) * GRID_STEP_MINUTES)

export function sessionSlots(sessionId) {
  const session = GRID_SESSIONS.find((entry) => entry.id === sessionId) ?? GRID_SESSIONS[0]
  const slots = []
  for (let minutes = toMinutes(session.start); minutes < toMinutes(session.end); minutes += GRID_STEP_MINUTES) slots.push(toTime(minutes))
  return slots
}

export function addDays(iso, count) {
  const [year, month, day] = iso.split('-').map(Number)
  const moved = new Date(year, month - 1, day + count)
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`
}

const weekdayOf = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

// The practitioner's consulting windows at a branch on a date.
export const windowsOn = (practitioner, branchId, date) => practitioner.availability.filter((window) => window.branchId === branchId && window.weekday === weekdayOf(date))

export const isOpen = (appointment) => OPEN_STATUSES.includes(appointment.status)

// Everything the grid needs for one day: a column per therapist consulting at the branch, each band holding
// its appointments, or marked "not consulting" outside the therapist's hours.
export function dayGrid(practitioners, appointments, date, branchId, sessionId) {
  const slots = sessionSlots(sessionId)
  const onGrid = appointments.filter((appointment) => !appointment.waitingQueue)
  const columns = practitioners
    .map((practitioner) => ({ practitioner, windows: windowsOn(practitioner, branchId, date) }))
    .filter(({ windows }) => windows.length > 0)
    .map(({ practitioner, windows }) => {
      const mine = onGrid.filter((appointment) => appointment.doctorId === practitioner.id)
      const consulting = (slot) => windows.some((window) => slot >= slotOf(window.start) && slot < window.end)
      return {
        doctorId: practitioner.id,
        chamber: practitioner.room ?? '—',
        specialty: practitioner.specialty,
        doctor: { name: practitioner.displayName, short: practitioner.displayName },
        slotMinutes: practitioner.slotMinutes,
        booked: mine.filter((appointment) => !OFF_GRID_STATUSES.includes(appointment.status)).length,
        cells: slots.map((slot) => ({
          slot,
          appointments: mine.filter((appointment) => slotOf(appointment.time) === slot),
          block: consulting(slot) ? null : { label: 'Not consulting', note: 'Outside this therapist’s hours' },
        })),
      }
    })
  return { slots, columns }
}

export function dayStats(columns, appointments, now) {
  const count = (...statuses) => appointments.filter((appointment) => statuses.includes(appointment.status)).length
  const capacity = columns.reduce((sum, column) => sum + column.cells.filter((cell) => !cell.block).length, 0)
  const inRoom = appointments.filter((appointment) => appointment.status === 'In Progress')
  const nextConfirmed = appointments.filter((appointment) => appointment.status === 'Confirmed' && (!now || appointment.time >= now)).sort((a, b) => a.time.localeCompare(b.time))[0]
  return {
    capacity,
    booked: appointments.filter((appointment) => !OFF_GRID_STATUSES.includes(appointment.status) && !appointment.waitingQueue).length,
    waiting: count('Arrived'),
    inConsultation: inRoom.length,
    chambers: [...new Set(inRoom.map((appointment) => appointment.room))].join(', '),
    confirmed: count('Confirmed'),
    nextConfirmed,
    pending: count('Pending Confirmation'),
    cancelled: count('Cancelled', 'No-show'),
    cancelledDetail: `${count('Cancelled')} can / ${count('No-show')} abs`,
  }
}

export function validateWalkIn(values, { hasSlot }) {
  const errors = {}
  if (!values.patientId) errors.patientId = 'Search and select the patient, or register a new one first.'
  if (!values.doctorId) errors.doctorId = 'Choose the consulting therapist.'
  if (values.complaint.trim().length < 5) errors.complaint = 'Describe the presenting complaint (at least 5 characters).'
  if (values.doctorId && values.option === 'slot' && !hasSlot) errors.slot = 'No free slot is left for this therapist today. Place the patient in the waiting queue instead.'
  return errors
}
