import { z } from 'zod'
import { email, indianMobile, isoDate, optionalText, otpCode, personName } from '../../common/validation/validation'
import { BLOOD_GROUPS } from '../patients/patients.schemas'

const device = {
  deviceName: z.string().trim().min(1).max(120).default('Unknown device'),
  platform: z.enum(['ios', 'android', 'web']).default('android'),
}

export const otpRequestSchema = z.object({ mobile: indianMobile })
export const otpVerifySchema = z.object({ mobile: indianMobile, code: otpCode, ...device })

// The same rules the app's "Create Password" checklist shows.
const patientPassword = z
  .string({ error: 'Create a password.' })
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((value) => /[\d\W_]/.test(value), 'Include a number or symbol.')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), 'Mix uppercase and lowercase letters.')

export const registerPatientSchema = z.object({
  registrationToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Verify your mobile number again.'),
  fullName: personName,
  email,
  password: patientPassword,
  ...device,
})

const optionalMobile = z
  .union([z.literal(''), indianMobile])
  .nullish()
  .transform((value) => value || null)

const latestToday = () => new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10)
const birthDate = isoDate
  .refine((value) => value <= latestToday(), 'Date of birth cannot be in the future.')
  .refine((value) => value >= '1900-01-01', 'Enter a date of birth after 1900.')

// Every field is optional: a screen sends only what it edits, and an absent field is left as it is.
export const updatePatientProfileSchema = z
  .object({
    fullName: personName,
    email,
    dateOfBirth: birthDate,
    gender: z.enum(['male', 'female', 'other'], { error: 'Select a gender.' }),
    bloodGroup: z.union([z.literal(''), z.enum(BLOOD_GROUPS)]).nullable().transform((value) => value || null),
    addressLine: optionalText(240),
    city: optionalText(80),
    state: optionalText(80),
    pinCode: z
      .union([z.literal(''), z.string().trim().regex(/^\d{6}$/, 'PIN code must be 6 digits.')])
      .nullable()
      .transform((value) => value || null),
    emergencyName: optionalText(120),
    emergencyRelation: optionalText(40),
    emergencyPhone: optionalMobile,
    language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'bn', 'mr']),
  })
  .partial()

// Device-only choices such as the biometric lock are not stored on the server.
export const CONSENT_PURPOSES = ['visit_alerts', 'abha_sync', 'location_checkin'] as const
export const POLICY_VERSION = '2026-11'

export const consentSchema = z.object({
  consents: z.array(z.object({ purpose: z.enum(CONSENT_PURPOSES), granted: z.boolean() })).min(1).max(CONSENT_PURPOSES.length),
})

export const redeemLinkCodeSchema = z.object({
  code: z
    .string({ error: 'Enter the code from your clinic.' })
    .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/, 'Enter the 8-character code from your clinic.')),
})

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>
export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>
export type ConsentInput = z.infer<typeof consentSchema>
