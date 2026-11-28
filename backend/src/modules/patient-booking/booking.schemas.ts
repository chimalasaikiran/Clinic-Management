import { z } from 'zod'
import { clockTime, isoDate, pagination, uuid } from '../../common/validation/validation'

// How many days of slots one request may cover.
export const PATIENT_SLOT_RANGE_DAYS = 31

export const clinicsQuerySchema = pagination(50).extend({
  query: z.string().trim().max(100).optional(),
  department: z.string().trim().max(120).optional(),
  saved: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

const slotRange = {
  from: isoDate,
  days: z.coerce.number().int().min(1).max(PATIENT_SLOT_RANGE_DAYS).default(7),
}

export const clinicSlotsSchema = z.object({ serviceId: uuid, ...slotRange })
export const appointmentSlotsSchema = z.object(slotRange)

export const bookSchema = z.object({
  branchId: uuid,
  serviceId: uuid,
  date: isoDate,
  time: clockTime,
  reason: z
    .string()
    .trim()
    .max(500, 'Use at most 500 characters.')
    .nullish()
    .transform((value) => value || null),
})

export const moveSchema = z.object({ date: isoDate, time: clockTime })

export const cancelSchema = z.object({
  reason: z.string({ error: 'Choose a reason.' }).trim().min(1, 'Choose a reason.').max(120, 'Use at most 120 characters.'),
})

export const appointmentsQuerySchema = pagination(50).extend({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
})

export type ClinicsQuery = z.infer<typeof clinicsQuerySchema>
export type ClinicSlotsQuery = z.infer<typeof clinicSlotsSchema>
export type SlotRange = z.infer<typeof appointmentSlotsSchema>
export type BookInput = z.infer<typeof bookSchema>
export type MoveInput = z.infer<typeof moveSchema>
export type PatientAppointmentsQuery = z.infer<typeof appointmentsQuerySchema>
