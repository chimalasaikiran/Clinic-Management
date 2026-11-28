import type { Href } from 'expo-router';

import type { IconName } from '@/theme/icons';
import type { HistoryEntry, HistoryKind } from '@/types';

/** How each kind of timeline entry is labelled and where it opens. */
export const HISTORY: Record<HistoryKind, { label: string; icon: IconName; action: string; href: (id: string) => Href }> = {
  consultation: { label: 'CONSULTATION', icon: 'module-consultations', action: 'View Consultation Note', href: (id) => `/health/consultations/${id}` },
  prescription: { label: 'PRESCRIPTION', icon: 'module-prescriptions', action: 'View Prescription', href: (id) => `/health/prescriptions/${id}` },
  result: { label: 'TEST RESULT', icon: 'module-lab', action: 'View Report', href: (id) => `/health/lab-reports/${id}` },
  order: { label: 'TEST ORDERED', icon: 'module-orders', action: 'View Order', href: (id) => `/health/orders/${id}` },
  care_plan: { label: 'CARE PLAN', icon: 'module-careplans', action: 'View Care Plan', href: (id) => `/health/care-plans/${id}` },
};

export const historyHref = (entry: HistoryEntry) => HISTORY[entry.kind].href(entry.id);
