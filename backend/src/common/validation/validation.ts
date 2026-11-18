import { z } from 'zod'
import { badRequest } from '../errors/app-error'

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  // One message per field, the first one found, which is what a form shows under the input.
  const details = new Map<string, string>()
  for (const issue of result.error.issues) {
    const field = issue.path.join('.')
    if (!details.has(field)) details.set(field, issue.message)
  }
  throw badRequest(
    'VALIDATION_FAILED',
    'Some fields are missing or invalid.',
    [...details].map(([field, issue]) => ({ field: field || undefined, issue })),
  )
}

export const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

// Same rule as the web app (admin-panel/src/lib/validators.js), enforced again here because the client can be bypassed.
export const password = z
  .string({ error: 'Enter a password.' })
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters with a letter and a number.`)
  .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters.`)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), `Use at least ${MIN_PASSWORD_LENGTH} characters with a letter and a number.`)

export const email = z
  .string({ error: 'Enter your work email.' })
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'))

export const personName = z.string({ error: 'Enter your full name.' }).trim().min(1, 'Enter your full name.').max(120)

export const otpCode = z.string({ error: 'Enter the 6-digit code.' }).regex(/^\d{6}$/, 'Enter the 6-digit code.')

export const uuid = z.uuid('Invalid identifier.')

// Signing in checks only presence and length: the strength rule applies when a password is set, and older
// passwords must keep working if the rule changes.
export const existingPassword = z
  .string({ error: 'Enter your password.' })
  .min(1, 'Enter your password.')
  .max(MAX_PASSWORD_LENGTH, 'Email or password is incorrect.')

// Indian mobile number: accepts "+91 98452 11029", "098452 11029" or "9845211029" and keeps the 10 digits.
export const indianMobile = z
  .string({ error: 'Enter a mobile number.' })
  .transform((value) => value.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number.'))

// Optional text field: trims, and treats an empty string as "not provided".
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    // null is accepted as "empty" too, so a record the API returned can be sent back unchanged.
    .nullish()
    .transform((value) => (value ? value : null))

export const isoDate = z.string({ error: 'Enter a date.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}, 'Enter a real calendar date.')

export const clockTime = z.string({ error: 'Choose a time.' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM.')

export const pagination = (maxPageSize = 100) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(25),
  })
