import { SEED_CHARGES, SEED_CONSENTS, SEED_FAMILY, SEED_INVOICES, SEED_MESSAGES, SEED_PAYMENTS, SEED_REFUNDS } from './admin'
import { SEED_ALERTS, SEED_ALLERGIES, SEED_CARE_PLANS, SEED_NOTES, SEED_ORDERS, SEED_PRESCRIPTIONS, SEED_REFERRALS } from './clinical'
import { SEED_DAY_APPOINTMENTS } from './day'
import { PATIENTS } from './patients'
import { SEED_APPOINTMENTS, SEED_DIAGNOSES, SEED_ENCOUNTERS, SEED_VITALS } from './visits'

export * from './admin'
export * from './clinical'
export * from './day'
export * from './patients'
export * from './visits'

// In-memory records the billing, clinical and reports screens are tested against (see RecordsSeedContext).
export const PATIENT_RECORDS = {
  patients: PATIENTS,
  appointments: [...SEED_APPOINTMENTS, ...SEED_DAY_APPOINTMENTS],
  encounters: SEED_ENCOUNTERS,
  vitals: SEED_VITALS,
  diagnoses: SEED_DIAGNOSES,
  alerts: SEED_ALERTS,
  allergies: SEED_ALLERGIES,
  notes: SEED_NOTES,
  carePlans: SEED_CARE_PLANS,
  prescriptions: SEED_PRESCRIPTIONS,
  orders: SEED_ORDERS,
  referrals: SEED_REFERRALS,
  invoices: SEED_INVOICES,
  payments: SEED_PAYMENTS,
  refunds: SEED_REFUNDS,
  charges: SEED_CHARGES,
  family: SEED_FAMILY,
  messages: SEED_MESSAGES,
  consents: SEED_CONSENTS,
  incidents: [],
}
