import { z } from 'zod'
import { clockTime, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

const reasonText = z.string({ error: 'Enter the reason for the visit.' }).trim().min(1, 'Enter the reason for the visit.').max(500, 'Use at most 500 characters.')
// Cancel, no-show and reschedule need a reason class and a short audit note.
const auditNote = z.string({ error: 'Add an operational note.' }).trim().min(10, 'Add an operational note (at least 10 characters) for the audit ledger.').max(1000, 'Use at most 1000 characters.')
const reasonClass = z.string({ error: 'Select a reason.' }).trim().min(1, 'Select a reason.').max(120)

export const createAppointmentSchema = z
  .object({
    patientId: uuid,
    practitionerId: uuid,
    branchId: uuid,
    date: isoDate,
    // Not used for the walk-in waiting queue, which has no slot of its own.
    time: clockTime.optional(),
    type: z.enum(['consultation', 'follow_up', 'procedure', 'diagnostic_review']).default('consultation'),
    channel: z.enum(['reception', 'phone', 'portal', 'referral', 'walk_in']).default('reception'),
    // A tentative booking stays pending until reception confirms it.
    status: z.enum(['pending', 'confirmed']).default('confirmed'),
    reason: reasonText,
    internalNote: optionalText(1000),
    notifyWhatsapp: z.boolean().default(true),
    notifySms: z.boolean().default(true),
    // Walk-ins: the patient is at the desk now (checked in on creation), optionally into the waiting queue.
    arrivedNow: z.boolean().default(false),
    waitingQueue: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.waitingQueue && !value.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Select an available time slot.' })
    if (value.waitingQueue && value.channel !== 'walk_in') ctx.addIssue({ code: 'custom', path: ['waitingQueue'], message: 'Only walk-ins can join the waiting queue.' })
  })

export const listAppointmentsSchema = pagination(200).extend({
  patientId: uuid.optional(),
  practitionerId: uuid.optional(),
  branchId: uuid.optional(),
  date: isoDate.optional(),
  status: z.enum(['pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
})

export const rescheduleSchema = z.object({ date: isoDate, time: clockTime, reason: reasonClass, note: auditNote })
export const closeSchema = z.object({ reason: reasonClass, note: auditNote })
export const checkInSchema = z.object({ note: optionalText(500) })

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>
export type RescheduleInput = z.infer<typeof rescheduleSchema>
export type CloseInput = z.infer<typeof closeSchema>
