import type { AppointmentStatus } from '../../generated/prisma/client'

// Appointments that still hold their time slot. Must match the WHERE clause of the
// appointments_*_no_overlap exclusion constraints in the database.
export const OPEN_STATUSES = ['pending', 'confirmed', 'arrived', 'in_progress'] as const satisfies readonly AppointmentStatus[]

// How far ahead slots can be listed or booked.
export const BOOKING_HORIZON_DAYS = 180
export const MAX_SLOT_RANGE_DAYS = 62
