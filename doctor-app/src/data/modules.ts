import type { Href } from 'expo-router';

import type { Step } from '@/features/doctor/clinical';

export interface EncounterModule {
  step: Step;
  title: string;
  route: Href;
  /** Signing needs these: a chief complaint and at least one diagnosis. The rest are used when the visit needs them. */
  required?: boolean;
}

export const encounterModules: EncounterModule[] = [
  { step: 'notes', title: 'Consultation Notes', route: '/consultation/notes', required: true },
  { step: 'vitals', title: 'Vitals & Biometrics', route: '/consultation/vitals' },
  { step: 'assessment', title: 'Diagnosis & Assessment', route: '/consultation/assessment', required: true },
  { step: 'prescription', title: 'Prescriptions', route: '/consultation/prescription' },
  { step: 'orders', title: 'Lab & Diagnostic Orders', route: '/consultation/orders' },
  { step: 'referral', title: 'Specialist Referrals', route: '/consultation/referral' },
  { step: 'carePlan', title: 'Care Plan', route: '/consultation/care-plan' },
  { step: 'followUp', title: 'Follow-up', route: '/consultation/follow-up' },
];
