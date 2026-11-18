import { z } from 'zod'
import { indianMobile, isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

export const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Master', 'Baby', 'Dr.'] as const
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

const optionalMobile = z
  .union([z.literal(''), indianMobile])
  .nullish()
  .transform((value) => value || null)

// Latest calendar date anywhere on Earth (UTC+14), so a birth registered just after local midnight is accepted.
const latestToday = () => new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)

// ABHA numbers are 14 digits, shown as 14-0000-0000-0000.
const abhaNumber = z
  .string()
  .trim()
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 14) {
      ctx.addIssue({ code: 'custom', message: 'An ABHA number has 14 digits.' })
      return z.NEVER
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`
  })

const patientFields = {
  title: z.enum(TITLES, { error: 'Choose a title.' }),
  fullName: z.string({ error: 'Enter the full legal name.' }).trim().min(1, 'Enter the full legal name.').max(120, 'Use at most 120 characters.'),
  alias: optionalText(120),
  aadhaarLast4: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null)
    .pipe(z.string().regex(/^\d{4}$/, 'Enter the last 4 digits only.').nullable()),
  abhaNumber,
  mobile: indianMobile,
  altMobile: optionalMobile,
  email: z
    .union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'))])
    .nullish()
    .transform((value) => value || null),
  addressLine: optionalText(240),
  area: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  pinCode: z.string({ error: 'Enter the PIN code.' }).trim().regex(/^\d{6}$/, 'PIN code must be 6 digits.'),
  dateOfBirth: isoDate.refine((value) => value <= latestToday(), 'Date of birth cannot be in the future.').refine((value) => value >= '1900-01-01', 'Enter a date of birth after 1900.'),
  gender: z.enum(['male', 'female', 'other'], { error: 'Select a gender.' }),
  bloodGroup: z
    .union([z.literal(''), z.enum(BLOOD_GROUPS)])
    .nullish()
    .transform((value) => value || null),
  language: optionalText(40),
  emergencyName: optionalText(120),
  emergencyRelation: optionalText(40),
  emergencyPhone: optionalMobile,
  notifyWhatsapp: z.boolean().default(true),
  notifySms: z.boolean().default(true),
  homeBranchId: uuid,
  intakeUnit: optionalText(80),
}

export const createPatientSchema = z.object({
  ...patientFields,
  // Set after staff have looked at a possible duplicate (same mobile number) and decided it is a different person.
  confirmedNotDuplicate: z.boolean().default(false),
})

export const updatePatientSchema = z.object({ ...patientFields, version: z.number().int().min(1) })

export const patientStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  note: optionalText(160),
})

export const listPatientsSchema = pagination(100).extend({
  query: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  branchId: uuid.optional(),
  department: z.string().trim().max(120).optional(),
  visitWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
})

export const duplicatesQuerySchema = z.object({ mobile: indianMobile, excludeId: uuid.optional() })

export type PatientFields = Omit<z.infer<typeof createPatientSchema>, 'confirmedNotDuplicate'>
export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
export type ListPatientsQuery = z.infer<typeof listPatientsSchema>
