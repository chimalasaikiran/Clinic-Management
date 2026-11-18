import { z } from 'zod'
import { clockTime, isoDate, pagination, uuid } from '../../common/validation/validation'

export const INCIDENT_CATEGORIES = ['medication', 'procedure', 'diagnostic', 'fall', 'device', 'documentation'] as const

export const createIncidentSchema = z
  .object({
    category: z.enum(INCIDENT_CATEGORIES, { error: 'Choose the incident category.' }),
    severity: z.number({ error: 'Choose the harm severity.' }).int().min(1).max(5),
    date: isoDate,
    time: clockTime,
    branchId: uuid,
    zone: z.string({ error: 'Choose the clinical zone.' }).trim().min(1, 'Choose the clinical zone.').max(160),
    patientId: uuid.optional(),
    headline: z.string({ error: 'Write a one-line summary.' }).trim().min(10, 'Write a one-line summary (at least 10 characters).').max(240),
    chronology: z.string({ error: 'Describe what happened.' }).trim().min(30, 'Describe what happened in order (at least 30 characters).').max(4000),
    factors: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    actions: z.string().trim().max(2000).default(''),
    witnesses: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
    anonymous: z.boolean().default(false),
    notifyQuality: z.boolean().default(true),
    logRegister: z.boolean().default(true),
  })
  .refine((value) => value.severity < 4 || value.actions.length > 0, { message: 'Record the immediate corrective actions taken for a moderate-or-worse harm event.', path: ['actions'] })

export const listIncidentsSchema = pagination(100)

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
