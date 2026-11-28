import { useClinicalDay, type ClinicalDay } from '@/features/doctor/clinical';

/** The nurse's view of the day. Everything here comes from the clinic's own records. */

export type WardRow = ClinicalDay['appointments'][number];

type Reading = { systolic: number; diastolic: number; pulse: number; temperatureF: number; spo2: number };

/**
 * Readings outside usual adult limits, so the nurse can tell the doctor. A screening aid only: ClinicOS does not
 * raise or send anything from these.
 */
export function flagsOf(reading: Reading | null | undefined): string[] {
  if (!reading) return [];
  const flags: string[] = [];
  if (reading.systolic >= 140 || reading.diastolic >= 90) flags.push(`High BP ${reading.systolic}/${reading.diastolic}`);
  else if (reading.systolic < 90 || reading.diastolic < 60) flags.push(`Low BP ${reading.systolic}/${reading.diastolic}`);
  if (reading.spo2 < 95) flags.push(`SpO2 ${reading.spo2}%`);
  if (reading.pulse > 120 || reading.pulse < 50) flags.push(`Pulse ${reading.pulse}`);
  if (reading.temperatureF >= 100.4) flags.push(`Fever ${reading.temperatureF}°F`);
  return flags;
}

export const celsius = (fahrenheit: number) => Math.round((((fahrenheit - 32) * 5) / 9) * 10) / 10;

export type WardGroup = 'attention' | 'vitals' | 'ready' | 'consult' | 'expected' | 'done';

export function groupOf(row: WardRow): WardGroup {
  if (row.status === 'completed') return 'done';
  if (row.status === 'pending' || row.status === 'confirmed') return 'expected';
  if (flagsOf(row.vitals).length) return 'attention';
  if (row.status === 'in_progress') return 'consult';
  return row.vitals ? 'ready' : 'vitals';
}

export const GROUP: Record<WardGroup, { label: string; tone: 'red' | 'amber' | 'mint' | 'green' | 'sky' | 'pale'; edge: string }> = {
  attention: { label: 'Abnormal Vitals', tone: 'red', edge: '#ba1a1a' },
  vitals: { label: 'Vitals Pending', tone: 'amber', edge: '#f59e0b' },
  ready: { label: 'Ready for Doctor', tone: 'mint', edge: '#10b981' },
  consult: { label: 'With the Doctor', tone: 'green', edge: '#059669' },
  expected: { label: 'Not Arrived', tone: 'pale', edge: '#cfe6f1' },
  done: { label: 'Visit Closed', tone: 'sky', edge: '#cfe6f1' },
};

const byArrival = (a: WardRow, b: WardRow) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? '') || a.time.localeCompare(b.time);

/** Today's patients at the nurse's branches, reloaded when visits or charts change. */
export function useWard() {
  const day = useClinicalDay();
  const rows = (day.data?.appointments ?? []).filter((row) => row.status !== 'cancelled' && row.status !== 'no_show');
  const present = rows.filter((row) => row.status === 'arrived' || row.status === 'in_progress').sort(byArrival);
  return {
    day,
    rows,
    present,
    needsVitals: present.filter((row) => row.status === 'arrived' && !row.vitals),
    abnormal: present.filter((row) => flagsOf(row.vitals).length > 0),
    ready: present.filter((row) => row.status === 'arrived' && !!row.vitals),
    specimens: day.data?.clinical?.specimens ?? { total: 0, items: [] },
    alerts: day.data?.clinical?.alerts ?? { total: 0, items: [] },
  };
}
