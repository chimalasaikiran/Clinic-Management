import { z } from 'zod'
import { clockTime, indianMobile, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

const required = (message: string, max: number) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)

const optionalMobile = z
  .union([z.literal(''), indianMobile])
  .optional()
  .transform((value) => value || null)

const optionalEmail = z
  .union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'))])
  .optional()
  .transform((value) => value || null)

const personFields = {
  type: z.enum(['doctor', 'staff'], { error: 'Choose doctor or staff.' }),
  fullName: required('Enter the full name.', 120),
  email: optionalEmail,
  mobile: optionalMobile,
  department: required('Choose a primary department.', 120),
  designation: required('Enter the professional title.', 160),
  council: optionalText(120),
  councilNumber: optionalText(60),
  qualifications: z.array(z.string().trim().min(1).max(60)).max(20, 'Use at most 20 qualifications.').default([]),
  engagement: z.enum(['full_time', 'visiting', 'honorary']).default('full_time'),
  status: z.enum(['active', 'draft', 'inactive']).default('active'),
}

// Doctors carry statutory council registration; a draft can be saved before it is known.
const doctorRules = (value: { type: string; status: string; council: string | null; councilNumber: string | null; qualifications: string[] }, ctx: z.RefinementCtx) => {
  if (value.type !== 'doctor' || value.status === 'draft') return
  if (!value.council) ctx.addIssue({ code: 'custom', path: ['council'], message: 'Choose the medical council.' })
  if (!value.councilNumber) ctx.addIssue({ code: 'custom', path: ['councilNumber'], message: 'Enter the council registration number.' })
  if (value.qualifications.length === 0) ctx.addIssue({ code: 'custom', path: ['qualifications'], message: 'Add at least one qualification.' })
}

export const createStaffSchema = z.object(personFields).superRefine(doctorRules)
export const updateStaffSchema = z.object({ ...personFields, version: z.number().int().min(1) }).superRefine(doctorRules)

export const listStaffSchema = pagination(100).extend({
  query: z.string().trim().max(100).optional(),
  type: z.enum(['doctor', 'staff']).optional(),
  department: z.string().trim().max(120).optional(),
  branchId: uuid.optional(),
  status: z.enum(['active', 'draft', 'inactive', 'on_leave']).optional(),
})

export const branchesSchema = z.object({
  branchIds: z.array(uuid).min(1, 'Select at least one facility to deploy to.').max(50),
  primaryBranchId: uuid,
})

export const inviteSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')), roleIds: z.array(uuid).min(1, 'Choose the role this person will have.').max(10) })

export const recordAttendanceSchema = z
  .object({
    branchId: uuid,
    date: isoDate,
    status: z.enum(['present', 'late', 'absent', 'leave', 'unavailable']),
    time: clockTime.optional(),
    note: optionalText(500),
  })
  .superRefine((value, ctx) => {
    const timed = value.status === 'present' || value.status === 'late'
    if (timed && !value.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Enter the arrival time.' })
  })

export const correctAttendanceSchema = z
  .object({
    status: z.enum(['present', 'late', 'absent', 'leave', 'unavailable']),
    time: clockTime.optional(),
    reason: z.string({ error: 'Explain the correction.' }).trim().min(10, 'Explain the correction (at least 10 characters) for the audit trail.').max(500),
    version: z.number().int().min(1),
  })
  .superRefine((value, ctx) => {
    const timed = value.status === 'present' || value.status === 'late'
    if (timed && !value.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Enter the arrival time.' })
  })

export const attendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM.'),
  branchId: uuid.optional(),
})

export const createLeaveSchema = z
  .object({
    kind: z.enum(['leave', 'block', 'relief']),
    title: required('Name the exception.', 120),
    startDate: isoDate,
    endDate: isoDate,
    startTime: clockTime.optional(),
    endTime: z.union([clockTime, z.literal('24:00')]).optional(),
    branchId: uuid.nullable().default(null),
    reason: required('Add an operational justification.', 500),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before the start date.' })
    if (Boolean(value.startTime) !== Boolean(value.endTime)) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Give both a start and an end time, or neither for whole days.' })
    if (value.startTime && value.endTime && value.startTime >= value.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The block must end after it starts.' })
  })

export type CreateStaffInput = z.infer<typeof createStaffSchema>
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
export type ListStaffQuery = z.infer<typeof listStaffSchema>
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>
