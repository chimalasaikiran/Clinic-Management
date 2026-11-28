import { z } from 'zod'
import { clockTime, isoDate, optionalText, uuid } from '../../common/validation/validation'
import { MAX_SLOT_RANGE_DAYS } from './scheduling.constants'

const required = (label: string, max: number) => z.string({ error: `Enter the ${label}.` }).trim().min(1, `Enter the ${label}.`).max(max, `Use at most ${max} characters.`)

const profile = {
  displayName: required('display name', 120),
  credentials: optionalText(120),
  specialty: required('specialty', 120),
  department: required('department', 120),
  room: optionalText(60),
  slotMinutes: z.coerce.number({ error: 'Choose a slot length.' }).int().min(5, 'Slots must be at least 5 minutes.').max(240, 'Slots can be at most 240 minutes.'),
}

// Left out of a request, the setting keeps its current value (off for a new profile).
const onlineBooking = z.boolean().optional()

export const createPractitionerSchema = z.object({ membershipId: uuid, ...profile, onlineBooking })
export const updatePractitionerSchema = z.object({ ...profile, onlineBooking, status: z.enum(['active', 'inactive']) })

export const availabilitySchema = z.object({
  windows: z
    .array(
      z
        .object({ branchId: uuid, weekday: z.coerce.number().int().min(0).max(6), start: clockTime, end: z.union([clockTime, z.literal('24:00')]) })
        .refine((window) => window.start < window.end, { message: 'The session must end after it starts.', path: ['end'] }),
    )
    .max(50, 'Use at most 50 weekly sessions.'),
})

export const listPractitionersSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  branchId: uuid.optional(),
})

export const slotsQuerySchema = z.object({
  branchId: uuid,
  from: isoDate,
  days: z.coerce.number().int().min(1).max(MAX_SLOT_RANGE_DAYS).default(7),
  excludeAppointmentId: uuid.optional(),
})

export type CreatePractitionerInput = z.infer<typeof createPractitionerSchema>
export type UpdatePractitionerInput = z.infer<typeof updatePractitionerSchema>
export type AvailabilityInput = z.infer<typeof availabilitySchema>
export type SlotsQuery = z.infer<typeof slotsQuerySchema>
