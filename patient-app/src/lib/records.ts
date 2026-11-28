import type { PillTone } from '@/components/ui/Pill';
import { dayMonth, parseDay } from '@/lib/dates';
import { clinicToday, clock } from '@/lib/visit';
import type { CarePlanStatus, Clinician, DiagnosticOrder, OrderStatus, Prescription, Stamp } from '@/types';

/** "24 Oct 2026" */
export const shortDate = (iso: string) => `${dayMonth(iso)} ${parseDay(iso).getFullYear()}`;
/** "24 Oct 2026, 10:15 AM" */
export const stampText = (stamp: Stamp) => `${shortDate(stamp.date)}, ${clock(stamp.time)}`;

export const clinicianLine = (person: Clinician | null, signedBy?: string | null) =>
  person ? [person.displayName, person.credentials].filter(Boolean).join(', ') : (signedBy ?? 'Clinic team');

/** A prescription the clinic has not closed but whose course has run out reads as finished. */
export function prescriptionState(rx: Prescription): { key: 'active' | 'finished' | 'discontinued'; label: string; tone: PillTone } {
  if (rx.status === 'discontinued') return { key: 'discontinued', label: 'Stopped by the clinic', tone: 'red' };
  if (rx.status === 'completed' || rx.courseEnds < clinicToday()) return { key: 'finished', label: 'Course finished', tone: 'sky' };
  return { key: 'active', label: `Active · until ${shortDate(rx.courseEnds)}`, tone: 'mint' };
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: PillTone }> = {
  ordered: { label: 'Ordered', tone: 'sky' },
  processing: { label: 'Sample collected', tone: 'amber' },
  awaiting_review: { label: 'Awaiting doctor review', tone: 'amber' },
  reviewed: { label: 'Result ready', tone: 'mint' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export const STEP_LABEL: Record<DiagnosticOrder['steps'][number]['action'], string> = {
  ordered: 'Ordered by your doctor',
  collected: 'Sample collected',
  resulted: 'Result recorded, waiting for doctor review',
  reviewed: 'Reviewed by your doctor and released',
  cancelled: 'Cancelled',
};

export const FLAG: Record<'normal' | 'abnormal' | 'critical', { label: string; tone: PillTone }> = {
  normal: { label: 'Within normal range', tone: 'mint' },
  abnormal: { label: 'Outside normal range', tone: 'amber' },
  critical: { label: 'Needs prompt attention', tone: 'red' },
};

export const PLAN_STATUS: Record<CarePlanStatus, { label: string; tone: PillTone }> = {
  on_track: { label: 'Active · on track', tone: 'mint' },
  at_risk: { label: 'Active · needs attention', tone: 'amber' },
  achieved: { label: 'Goals achieved', tone: 'sky' },
  closed: { label: 'Closed', tone: 'sky' },
};

export const planActive = (status: CarePlanStatus) => status === 'on_track' || status === 'at_risk';
