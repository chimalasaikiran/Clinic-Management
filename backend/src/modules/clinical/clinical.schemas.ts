import { z } from 'zod'
import { isoDate, optionalText, uuid } from '../../common/validation/validation'

const text = (message: string, max: number) => z.string({ error: message }).trim().min(1, message).max(max, `Use at most ${max} characters.`)
const longText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`).default('')
const justification = (message: string) => z.string({ error: message }).trim().min(10, message).max(2000)

// Start an encounter from an arrived appointment, or (walk-in documentation) for a patient at a branch.
export const startEncounterSchema = z.union([
  z.object({ appointmentId: uuid }),
  z.object({ patientId: uuid, branchId: uuid, type: text('Enter the encounter type.', 120), reason: text('Enter the reason for the encounter.', 500) }),
])

export const updateEncounterSchema = z.object({
  chiefComplaint: longText(2000),
  subjective: longText(4000),
  objective: longText(4000),
  assessment: longText(4000),
  plan: longText(4000),
  version: z.number().int().min(1),
})

const range = (label: string, min: number, max: number) => z.coerce.number({ error: `Enter the ${label}.` }).min(min, `Enter ${label} between ${min} and ${max}.`).max(max, `Enter ${label} between ${min} and ${max}.`)

export const vitalsSchema = z
  .object({
    encounterId: uuid.optional(),
    systolic: range('systolic', 50, 300).int(),
    diastolic: range('diastolic', 30, 200).int(),
    pulse: range('pulse', 20, 250).int(),
    respiration: range('respiration rate', 4, 80).int(),
    temperatureF: range('temperature', 90, 110),
    spo2: range('SpO₂', 50, 100).int(),
    weightKg: range('weight', 1, 400),
    heightCm: range('height', 30, 250),
    bloodSugar: z.coerce.number().int().min(10).max(1000).optional(),
    painScore: z.coerce.number().int().min(0).max(10).optional(),
    site: optionalText(120),
    posture: optionalText(120),
    device: optionalText(120),
  })
  .refine((value) => value.diastolic < value.systolic, { path: ['diastolic'], message: 'Diastolic must be lower than systolic.' })

export const diagnosisSchema = z.object({
  encounterId: uuid.optional(),
  icd: text('Search and select a diagnosis from the catalogue.', 20),
  snomed: optionalText(20),
  name: text('Name the diagnosis.', 240),
  designation: z.enum(['Primary', 'Secondary']).default('Primary'),
  verification: z.enum(['Confirmed', 'Provisional', 'Differential']).default('Confirmed'),
  severity: optionalText(60),
  description: text('Add the clinical description.', 2000),
})

export const allergySchema = z.object({
  substance: text('Name the substance.', 160),
  drugClass: optionalText(60),
  classLabel: optionalText(120),
  severity: z.enum(['mild', 'moderate', 'severe'], { error: 'Choose the severity.' }),
  reaction: text('Describe the reaction.', 500),
  verification: optionalText(60),
})

export const alertSchema = z.object({
  kind: text('Choose the alert kind.', 80),
  title: text('Give the alert a title.', 240),
  severity: z.enum(['critical', 'high', 'moderate', 'low']),
  detail: text('Describe the safety concern.', 2000),
  statement: optionalText(2000),
})

export const acknowledgeAlertSchema = z.object({
  disposition: text('Select a clinical disposition.', 60),
  justification: justification('Add a clinical justification (at least 10 characters).'),
})

export const addendumSchema = z.object({ text: justification('Write the addendum (at least 10 characters).') })

export const worklistSchema = z.object({ date: isoDate })

export type StartEncounterInput = z.infer<typeof startEncounterSchema>
export type UpdateEncounterInput = z.infer<typeof updateEncounterSchema>
export type VitalsInput = z.infer<typeof vitalsSchema>
export type DiagnosisInput = z.infer<typeof diagnosisSchema>
export type AllergyInput = z.infer<typeof allergySchema>
export type AlertInput = z.infer<typeof alertSchema>
