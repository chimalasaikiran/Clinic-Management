import { z } from 'zod'
import { clockTime, isoDate, optionalText, uuid } from '../../common/validation/validation'

const version = z.number().int().min(1)
const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`)
// A 10-digit mobile or a landline with its STD code (0 + 9–10 digits), digits only.
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, '').replace(/^\+91/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$|^0\d{9,10}$/, 'Enter a 10-digit mobile or a landline with its STD code.'))
const optionalPhone = z.union([z.literal(''), phone]).nullish().transform((value) => value || null)
const optionalEmail = z.union([z.literal(''), z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'))]).nullish().transform((value) => value || null)

// The options on the onboarding "What type of clinic" screen.
export const CLASSIFICATIONS = ['general', 'specialty', 'multi-specialty', 'diagnostic', 'network-hub'] as const
export const STRUCTURES = ['solo', 'collaborative', 'operations-led', 'network'] as const
export const BILLING_METHODS = ['cashless', 'reimbursement'] as const
export const COVERAGE = ['opd', 'diagnostics', 'daycare'] as const
export const DEPARTMENT_TYPES = ['Clinical', 'Diagnostic', 'Therapy', 'Support', 'Administrative'] as const

// Onboarding step 2: how patients and staff reach the clinic.
export const contactSchema = z.object({ phone, email: optionalEmail })

// Onboarding step 3: the operating model.
export const operationsSchema = z.object({
  classification: z.enum(CLASSIFICATIONS, { error: 'Choose the clinic classification.' }),
  structure: z.enum(STRUCTURES).nullish().transform((value) => value ?? null),
})

// Onboarding step 4: specialties and the departments to create from them.
export const specialtiesSchema = z.object({
  specialties: z.array(z.string().trim().min(1).max(80)).min(1, 'Choose at least one specialty.').max(40).transform((list) => [...new Set(list)]),
  departments: z.array(z.string().trim().min(1, 'Name the department.').max(120)).max(40).default([]),
})

export const organisationSchema = z.object({
  displayName: text('the organisation name', 160),
  phone: optionalPhone,
  email: optionalEmail,
  classification: z.enum(CLASSIFICATIONS).nullish().transform((value) => value ?? null),
  structure: z.enum(STRUCTURES).nullish().transform((value) => value ?? null),
  version,
})

const branchFields = {
  name: text('the branch name', 240),
  addressLine1: text('the address', 240),
  addressLine2: optionalText(240),
  city: text('the city', 80),
  state: text('the state', 80),
  pinCode: z.string({ error: 'Enter the PIN code.' }).trim().regex(/^[1-9]\d{5}$/, 'Enter the 6-digit PIN code.'),
  country: z.string().trim().min(1).max(60).default('India'),
  phone: optionalPhone,
  email: optionalEmail,
  facilityType: text('the facility type', 80),
}

export const createBranchSchema = z.object({
  ...branchFields,
  code: z.string({ error: 'Enter a branch code.' }).trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, 'Use 2–20 letters, numbers or hyphens, e.g. KDP-01.'),
  status: z.enum(['planned', 'active']).default('active'),
  // Org-wide roles see every branch; these branch-limited roles are given the new branch too.
  roleIds: z.array(uuid).max(50).default([]),
})

export const updateBranchSchema = z.object({ ...branchFields, status: z.enum(['planned', 'active', 'paused', 'inactive']), version })

export const hoursSchema = z.object({
  sessions: z
    .array(
      z.object({ weekday: z.number().int().min(0).max(6), start: clockTime, end: z.union([clockTime, z.literal('24:00')]), label: z.string().trim().max(60).default('') })
        .refine((session) => session.start < session.end, { path: ['end'], message: 'A session must end after it starts.' }),
    )
    .max(28, 'Use at most 4 sessions a day.'),
})

export const closureSchema = z
  .object({
    date: isoDate,
    kind: z.enum(['closed', 'special'], { error: 'Choose closed or special hours.' }),
    opensAt: clockTime.nullish().transform((value) => value ?? null),
    closesAt: clockTime.nullish().transform((value) => value ?? null),
    reason: text('the reason', 240),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'special') return
    if (!value.opensAt || !value.closesAt) ctx.addIssue({ code: 'custom', path: ['opensAt'], message: 'Enter the opening and closing times for special hours.' })
    else if (value.closesAt <= value.opensAt) ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'Closing time must be after opening.' })
  })

const departmentFields = {
  name: text('the department name', 120),
  type: z.enum(DEPARTMENT_TYPES, { error: 'Choose the department type.' }),
  description: z.string().trim().max(1000).default(''),
  branchIds: z.array(uuid).min(1, 'Choose at least one branch where it operates.').max(100),
}

export const createDepartmentSchema = z.object({
  ...departmentFields,
  code: z.string({ error: 'Enter a department code.' }).trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, 'Use 2–20 letters, numbers or hyphens, e.g. ORTHO.'),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const updateDepartmentSchema = z.object({ ...departmentFields, status: z.enum(['active', 'inactive']), version })

// Moves staff and doctors into a department; everyone needs one, so there is no removing without moving.
export const departmentMembersSchema = z
  .object({ staffIds: z.array(uuid).max(200).default([]), practitionerIds: z.array(uuid).max(200).default([]) })
  .refine((value) => value.staffIds.length + value.practitionerIds.length > 0, { message: 'Choose at least one person.', path: ['staffIds'] })

export const acceptanceSchema = z.object({ accepts: z.boolean() })
export const partnerSchema = z.object({ name: text('the partner name', 160), type: z.enum(['insurer', 'tpa'], { error: 'Choose insurer or TPA.' }), listed: z.boolean().default(false) })
export const partnerActiveSchema = z.object({ active: z.boolean() })

const agreementFields = {
  insurerId: uuid,
  tpaId: uuid.nullish().transform((value) => value ?? null),
  reference: z.string({ error: 'Enter the agreement reference.' }).trim().min(3, 'Enter the agreement reference.').max(80),
  startDate: isoDate,
  endDate: isoDate,
  documentId: uuid.nullish().transform((value) => value ?? null),
  branchIds: z.array(uuid).min(1, 'Choose at least one branch the agreement covers.').max(100),
  methods: z.array(z.enum(BILLING_METHODS)).min(1, 'Choose cashless, reimbursement or both.').max(2).transform((list) => [...new Set(list)]),
  coverage: z.array(z.enum(COVERAGE)).min(1, 'Choose the kinds of care covered.').max(3).transform((list) => [...new Set(list)]),
  notes: z.string().trim().max(1000).default(''),
}
const datesInOrder = (value: { startDate: string; endDate: string }) => value.endDate >= value.startDate

export const agreementSchema = z.object(agreementFields).refine(datesInOrder, { path: ['endDate'], message: 'The end date must not be before the start date.' })
export const updateAgreementSchema = z.object({ ...agreementFields, version }).refine(datesInOrder, { path: ['endDate'], message: 'The end date must not be before the start date.' })
export const agreementStateSchema = z.object({ confirm: z.literal(true, { error: 'Confirm before changing the agreement.' }), version })

export type ContactInput = z.infer<typeof contactSchema>
export type OperationsInput = z.infer<typeof operationsSchema>
export type SpecialtiesInput = z.infer<typeof specialtiesSchema>
export type OrganisationInput = z.infer<typeof organisationSchema>
export type CreateBranchInput = z.infer<typeof createBranchSchema>
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
export type HoursInput = z.infer<typeof hoursSchema>
export type ClosureInput = z.infer<typeof closureSchema>
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type DepartmentMembersInput = z.infer<typeof departmentMembersSchema>
export type AgreementInput = z.infer<typeof agreementSchema>
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>
