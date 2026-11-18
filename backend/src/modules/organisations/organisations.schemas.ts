import { z } from 'zod'

// Matches FACILITY_TYPES in admin-panel/src/features/onboarding/data/clinicOptions.js.
export const FACILITY_TYPES = ['Multi-specialty Clinic', 'Outpatient Practice', 'Daycare Surgical Center'] as const

const text = (message: string, max = 160) => z.string({ error: message }).trim().min(1, message).max(max)

export const createOrganisationSchema = z.object({
  clinicName: text('Enter the clinic or organization name.'),
  location: text('Enter the primary location.', 240),
  city: text('Enter the city.', 80),
  state: text('Select a state or territory.', 80),
  facilityType: z.enum(FACILITY_TYPES, { error: 'Choose a facility classification.' }),
})

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>
