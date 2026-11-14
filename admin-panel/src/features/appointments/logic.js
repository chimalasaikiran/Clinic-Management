import { DOCTORS, SERVICES } from '../patients/data/catalog'
import { daysBetween, formatTime, nextId, TODAY } from '../patients/format'
import { nextToken } from '../patients/selectors'
import { CHAMBERS, GRID_SESSIONS, OFF_GRID_STATUSES, OPEN_STATUSES, ROSTER_BLOCKS, SCHEDULE_NOW } from './constants'

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// The 30-minute slot an appointment time falls in ("10:15" → "10:00").
export const slotOf = (time) => toTime(Math.floor(toMinutes(time) / 30) * 30)

export function sessionSlots(sessionId) {
  const session = GRID_SESSIONS.find((entry) => entry.id === sessionId) ?? GRID_SESSIONS[0]
  const slots = []
  for (let minutes = toMinutes(session.start); minutes < toMinutes(session.end); minutes += 30) slots.push(toTime(minutes))
  return slots
}

export function addDays(iso, count) {
  const [year, month, day] = iso.split('-').map(Number)
  const moved = new Date(year, month - 1, day + count)
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}-${String(moved.getDate()).padStart(2, '0')}`
}

export const doctorOf = (doctorId) => DOCTORS.find((doctor) => doctor.id === doctorId)

export const blockAt = (doctorId, slot) => (ROSTER_BLOCKS[doctorId] ?? []).find((block) => slot >= block.from && slot < block.to)

export const isOpen = (appointment) => OPEN_STATUSES.includes(appointment.status)

// Everything the grid needs for one day: a column per chamber, each slot holding its appointments or a block.
export function dayGrid(appointments, date, sessionId) {
  const slots = sessionSlots(sessionId)
  const onDay = appointments.filter((appointment) => appointment.date === date && !appointment.waitingQueue)
  const columns = CHAMBERS.map((entry) => {
    const doctor = doctorOf(entry.doctorId)
    const mine = onDay.filter((appointment) => appointment.doctorId === entry.doctorId)
    return {
      ...entry,
      doctor,
      booked: mine.filter((appointment) => !OFF_GRID_STATUSES.includes(appointment.status)).length,
      cells: slots.map((slot) => ({ slot, appointments: mine.filter((appointment) => slotOf(appointment.time) === slot), block: blockAt(entry.doctorId, slot) })),
    }
  })
  return { slots, columns }
}

export function dayStats(appointments, date, sessionId) {
  const { slots, columns } = dayGrid(appointments, date, sessionId)
  const mine = appointments.filter((appointment) => appointment.date === date && CHAMBERS.some((entry) => entry.doctorId === appointment.doctorId))
  const count = (...statuses) => mine.filter((appointment) => statuses.includes(appointment.status)).length
  const capacity = columns.reduce((sum, column) => sum + column.cells.filter((cell) => !cell.block).length, 0)
  const inRoom = mine.filter((appointment) => appointment.status === 'In Progress')
  const nextConfirmed = mine.filter((appointment) => appointment.status === 'Confirmed' && appointment.time >= SCHEDULE_NOW).sort((a, b) => a.time.localeCompare(b.time))[0]
  return {
    slots: slots.length,
    capacity,
    booked: mine.filter((appointment) => !OFF_GRID_STATUSES.includes(appointment.status) && !appointment.waitingQueue).length,
    waiting: count('Arrived'),
    inConsultation: inRoom.length,
    chambers: [...new Set(inRoom.map((appointment) => appointment.room.replace('Chamber ', '')))].join(', '),
    confirmed: count('Confirmed'),
    nextConfirmed,
    pending: count('Pending Confirmation'),
    cancelled: count('Cancelled', 'No-show'),
    cancelledDetail: `${count('Cancelled')} can / ${count('No-show')} abs`,
  }
}

// First slot a doctor can still take: not blocked, not already held by an open appointment, not earlier than `from`.
export function firstFreeSlot(appointments, date, doctorId, sessionId, from = SCHEDULE_NOW) {
  return sessionSlots(sessionId).find((slot) => {
    if (date === TODAY && toMinutes(slot) + 30 <= toMinutes(from)) return false
    if (blockAt(doctorId, slot)) return false
    return !appointments.some((appointment) => appointment.date === date && appointment.doctorId === doctorId && isOpen(appointment) && !appointment.waitingQueue && slotOf(appointment.time) === slot)
  })
}

export function slotIsFree(appointments, date, doctorId, slot) {
  return !blockAt(doctorId, slot) && !appointments.some((appointment) => appointment.date === date && appointment.doctorId === doctorId && isOpen(appointment) && !appointment.waitingQueue && slotOf(appointment.time) === slot)
}

export function waitingToken(appointments, date) {
  const used = appointments.filter((appointment) => appointment.date === date && appointment.queueToken?.startsWith('W-')).map((appointment) => Number(appointment.queueToken.slice(2)))
  return `W-${String(Math.max(0, ...used) + 1).padStart(2, '0')}`
}

export function validateWalkIn(values, appointments, date) {
  const errors = {}
  if (!values.patientId) errors.patientId = 'Search and select the patient, or register a new one first.'
  if (!values.doctorId) errors.doctorId = 'Choose the consulting chamber.'
  if (!values.serviceCode) errors.serviceCode = 'Choose the service package.'
  if (values.complaint.trim().length < 5) errors.complaint = 'Describe the presenting complaint (at least 5 characters).'
  if (values.patientId && values.doctorId) {
    const existing = appointments.find((appointment) => appointment.patientId === values.patientId && appointment.doctorId === values.doctorId && appointment.date === date && isOpen(appointment))
    if (existing) errors.patientId = `This patient already has an open appointment with ${existing.doctorShort} at ${formatTime(existing.time)} today.`
  }
  if (values.doctorId && values.option === 'slot' && !values.slot) errors.slot = 'No free slot is left for this doctor today. Place the patient in the waiting queue instead.'
  return errors
}

// The appointment record a walk-in becomes: an allocated slot, or an entry in the live waiting queue.
export function buildWalkIn(values, { appointments, patient, date, time = SCHEDULE_NOW }) {
  const doctor = doctorOf(values.doctorId)
  const service = SERVICES.find((entry) => entry.code === values.serviceCode)
  const queue = values.option === 'queue'
  const present = values.present || queue
  const slot = queue ? slotOf(time) : values.slot
  return {
    id: nextId('APT-2026-', appointments.map((entry) => entry.id), 4),
    patientId: patient.id, date, time: slot, minutes: service.minutes, type: 'Consultation', mode: 'In-Person Clinical Consultation', walkIn: true, waitingQueue: queue,
    service: service.name, serviceCode: service.code, tariff: service.price, doctorId: doctor.id, doctor: doctor.name, doctorShort: doctor.short, specialty: doctor.specialty,
    department: doctor.department, room: `Chamber ${CHAMBERS.find((entry) => entry.doctorId === doctor.id)?.chamber ?? ''}`.trim(), branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus',
    status: present ? 'Arrived' : 'Confirmed', reason: values.complaint.trim(), bookedBy: 'Priya Nair (Desk 01)', channel: 'Walk-in · Reception / In-Person Intake',
    queueToken: present ? (queue ? waitingToken(appointments, date) : nextToken(appointments, date)) : undefined, arrivedAt: present ? time : undefined,
    audit: [{ time: formatTime(time), text: queue ? 'Walk-in added to the live waiting queue' : `Walk-in assigned the ${formatTime(slot)} slot`, by: 'Priya Nair (Desk 01)' }],
  }
}

// Confirming a pending booking takes the slot; it fails when another confirmed booking already holds it.
export function canConfirm(appointment, appointments) {
  if (appointment.status !== 'Pending Confirmation') return { ok: false, error: `Only a pending booking can be confirmed; this one is ${appointment.status}.` }
  const clash = appointments.find((entry) => entry.id !== appointment.id && entry.date === appointment.date && entry.doctorId === appointment.doctorId && isOpen(entry) && entry.status !== 'Pending Confirmation' && slotOf(entry.time) === slotOf(appointment.time))
  return clash ? { ok: false, error: `The ${formatTime(appointment.time)} slot is already held by another confirmed appointment (${clash.id}).` } : { ok: true }
}

export const dayLabel = (date) => (daysBetween(TODAY, date) === 0 ? 'Today' : '')
