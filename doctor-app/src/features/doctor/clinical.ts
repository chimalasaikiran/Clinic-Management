import { useResource } from '@/hooks/useResource';
import type { Appointment, Day, DayAppointment, Paged, Patient, PatientBrief } from '@/features/reception/desk';
import { useConsultation } from '@/state/ConsultationState';

/** What the doctor workspace reads from the clinical API. Shapes match the server's responses. */

export type Stamp = { date: string; time: string; at: string };

export type Encounter = {
  id: string;
  reference: string;
  patientId: string;
  appointmentId: string | null;
  type: string;
  reason: string;
  chiefComplaint: string;
  soap: { subjective: string; objective: string; assessment: string; plan: string };
  status: 'in_progress' | 'signed';
  started: Stamp;
  signed: (Stamp & { by: string | null }) | null;
  startedBy: string;
  practitioner: { id: string; displayName: string; credentials: string | null; department: string; room: string | null } | null;
  branch: { id: string; name: string; city: string | null };
  version: number;
};

export type Vitals = {
  id: string;
  encounterId: string | null;
  systolic: number;
  diastolic: number;
  pulse: number;
  respiration: number;
  temperatureF: number;
  spo2: number;
  weightKg: number;
  heightCm: number;
  bloodSugar: number | null;
  painScore: number | null;
  recordedBy: string;
  recorded: Stamp;
};

export type Diagnosis = {
  id: string;
  encounterId: string | null;
  icd: string;
  snomed: string | null;
  name: string;
  designation: 'Primary' | 'Secondary';
  verification: 'Confirmed' | 'Provisional' | 'Differential';
  severity: string | null;
  description: string;
  status: 'active' | 'resolved';
  recordedBy: string;
  recorded: Stamp;
};

export type Allergy = {
  id: string;
  substance: string;
  drugClass: string | null;
  classLabel: string | null;
  severity: 'mild' | 'moderate' | 'severe';
  reaction: string;
  verification: string | null;
  active: boolean;
  recorded: Stamp;
};

export type ClinicalAlert = {
  id: string;
  patientId: string;
  kind: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  status: 'active' | 'acknowledged' | 'resolved';
  detail: string;
  statement: string | null;
  orderId: string | null;
  disposition: string | null;
  justification: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdBy: string;
  created: Stamp;
};

export type Note = {
  id: string;
  encounterId: string | null;
  title: string;
  department: string | null;
  sections: { heading: string; body: string }[];
  author: string;
  signed: Stamp;
  addenda: { id: string; text: string; author: string; at: Stamp }[];
};

export type PrescriptionItem = {
  id: string;
  medicineCode: string;
  name: string;
  strength: string;
  form: string;
  route: string;
  drugClass: string | null;
  dose: string;
  frequency: string;
  frequencyPerDay: number;
  food: string;
  durationDays: number;
  quantity: number;
  refills: number;
  instructions: string;
  indication: string;
  dispensed: number;
};

export type Prescription = {
  id: string;
  reference: string;
  encounterId: string | null;
  prescriberName: string;
  registration: string | null;
  department: string | null;
  indication: string;
  status: 'active' | 'discontinued' | 'dispensed' | 'partially_dispensed';
  items: PrescriptionItem[];
  encounterReference: string | null;
  created: Stamp;
};

export type OrderStatus = 'ordered' | 'collected' | 'awaiting_review' | 'reviewed' | 'cancelled';

export type Order = {
  id: string;
  reference: string;
  patientId: string;
  encounterId: string | null;
  orderingName: string;
  kind: 'lab' | 'imaging';
  category: string;
  title: string;
  indication: string;
  performing: string;
  urgent: boolean;
  status: OrderStatus;
  accession: string | null;
  items: { id: string; code: string; name: string; category: string; loinc: string | null; destination: string; priority: string }[];
  events: { id: string; action: string; note: string | null; actor: string; at: Stamp }[];
  encounterReference: string | null;
  result: { summary: string; flag: 'normal' | 'abnormal' | 'critical' } | null;
  review: { outcome: string; note: string; by: string | null } | null;
  created: Stamp;
  version: number;
};

export type Referral = {
  id: string;
  reference: string;
  encounterId: string | null;
  direction: 'outgoing' | 'incoming';
  status: string;
  priority: string;
  model: string;
  specialty: string;
  indication: string;
  narrative: string;
  facility: string;
  clinician: string;
  outcome: string;
  targetPractitioner: { id: string; displayName: string } | null;
  created: Stamp;
};

export type CarePlan = {
  id: string;
  reference: string;
  title: string;
  category: string;
  rationale: string;
  startDate: string;
  nextReview: string;
  targetDate: string;
  diagnoses: { icd: string; name: string }[];
  status: 'on_track' | 'at_risk' | 'achieved' | 'closed';
  compliance: number;
  goals: { id: string; title: string; target: string; cadence: string; status: string }[];
  interventions: { id: string; type: string; title: string; due: string; state: string }[];
  lead: { id: string; displayName: string } | null;
  created: Stamp;
};

export type Chart = {
  encounters: Encounter[];
  vitals: Vitals[];
  diagnoses: Diagnosis[];
  allergies: Allergy[];
  alerts: ClinicalAlert[];
  notes: Note[];
  prescriptions: Prescription[];
  orders: Order[];
  referrals: Referral[];
  carePlans: CarePlan[];
};

type Listed<T> = { total: number; items: T[] };

/** The day view as a clinician sees it: each visit carries its encounter, vitals and allergies. */
export type ClinicalDay = Omit<Day, 'appointments'> & {
  me: { practitionerId: string | null };
  appointments: (DayAppointment & {
    encounter?: { id: string; status: 'in_progress' | 'signed' } | null;
    vitals?: { systolic: number; diastolic: number; pulse: number; temperatureF: number; spo2: number } | null;
    allergies?: { substance: string; severity: string }[];
  })[];
  clinical: {
    alerts: Listed<{ id: string; title: string; detail: string; severity: ClinicalAlert['severity']; patient: PatientBrief }>;
    results: Listed<{ id: string; title: string; urgent: boolean; resultFlag: 'normal' | 'abnormal' | 'critical' | null; resultSummary: string | null; patient: PatientBrief }>;
    specimens: Listed<{ id: string; title: string; urgent: boolean; patient: PatientBrief }>;
    unsigned: Listed<{ id: string; reference: string; appointment: { status: string } | null; patient: PatientBrief }>;
    carePlans: Listed<{ id: string; title: string; nextReview: string; patient: PatientBrief }>;
  } | null;
};

export const useClinicalDay = (date?: string) =>
  useResource<ClinicalDay>(`/v1/dashboard/day${date ? `?date=${date}` : ''}`, ['appointments', 'records']);

export const useChart = (patientId: string | null | undefined) =>
  useResource<Chart>(patientId ? `/v1/patients/${patientId}/chart` : null, ['records', 'appointments']);

export const usePatient = (patientId: string | null | undefined) => useResource<Patient>(patientId ? `/v1/patients/${patientId}` : null);

/** The plan line that carries the follow-up instruction for reception. */
export const FOLLOW_UP_PREFIX = 'Follow-up:';

/** The follow-up line in a plan: its text, 'none' when the doctor said none is needed, or null if not recorded. */
export function followUpLine(plan: string) {
  const line = plan.split('\n').find((entry) => entry.startsWith(FOLLOW_UP_PREFIX));
  if (!line) return null;
  return line.includes('not needed') ? 'none' : line;
}

export type Step ='vitals' | 'notes' | 'assessment' | 'prescription' | 'orders' | 'referral' | 'carePlan' | 'followUp';
export const STEPS: Step[] = ['vitals', 'notes', 'assessment', 'prescription', 'orders', 'referral', 'carePlan', 'followUp'];

/**
 * Whether a set of vitals belongs to a visit: recorded into its encounter, or taken that day without one, which is
 * how a nurse's readings arrive when they are taken before the doctor starts.
 */
export const vitalsOfVisit = (rows: Vitals[] | undefined, visit: Pick<Encounter, 'id' | 'started'> | null | undefined) =>
  visit ? (rows ?? []).filter((row) => row.encounterId === visit.id || (row.encounterId === null && row.recorded.date === visit.started.date)) : [];

/**
 * The encounter the doctor has open, with the patient's chart and record. Which steps are done comes from what is
 * saved on the server, so it is the same on every device.
 */
export function useActiveEncounter() {
  const { encounterId } = useConsultation();
  const encounter = useResource<Encounter>(encounterId ? `/v1/encounters/${encounterId}` : null, ['records']);
  const patientId = encounter.data?.patientId;
  const chart = useChart(patientId);
  const patient = usePatient(patientId);
  const visits = useResource<Paged<Appointment>>(patientId ? `/v1/appointments?patientId=${patientId}&pageSize=20` : null, ['appointments']);

  const id = encounter.data?.id;
  const data = chart.data;
  const mine = <T extends { encounterId: string | null }>(rows: T[] | undefined) => (rows ?? []).filter((row) => row.encounterId === id);
  const started = encounter.data?.started.date ?? '';
  const followUp = (visits.data?.items ?? []).find((visit) => visit.id !== encounter.data?.appointmentId && visit.date > started && (visit.status === 'confirmed' || visit.status === 'pending'));
  const done: Record<Step, boolean> = {
    vitals: vitalsOfVisit(data?.vitals, encounter.data).length > 0,
    notes: !!(encounter.data?.soap.subjective.trim() || encounter.data?.soap.objective.trim()),
    assessment: mine(data?.diagnoses).length > 0,
    prescription: mine(data?.prescriptions).length > 0,
    orders: mine(data?.orders).length > 0,
    referral: mine(data?.referrals).length > 0,
    carePlan: (data?.carePlans ?? []).some((plan) => plan.created.date >= started),
    followUp: !!followUp || followUpLine(encounter.data?.soap.plan ?? '') !== null,
  };

  return {
    encounterId,
    encounter,
    chart,
    patient,
    followUp: followUp ?? null,
    done,
    completed: STEPS.filter((step) => done[step]),
    sealed: encounter.data?.status === 'signed',
    /** Records attached to this encounter. */
    vitals: vitalsOfVisit(data?.vitals, encounter.data),
    diagnoses: mine(data?.diagnoses),
    prescriptions: mine(data?.prescriptions),
    orders: mine(data?.orders),
    referrals: mine(data?.referrals),
    reload: () => {
      encounter.reload();
      chart.reload();
      visits.reload();
    },
  };
}

type Call = <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown }) => Promise<T>;

/**
 * Saves part of the encounter's note. The server replaces every field it is sent and empties any it is not, so the
 * current text of the other fields always goes with the change.
 */
export function saveEncounter(call: Call, encounter: Encounter, patch: Partial<Pick<Encounter, 'chiefComplaint'> & Encounter['soap']>) {
  return call<Encounter>(`/v1/encounters/${encounter.id}`, {
    method: 'PATCH',
    body: {
      chiefComplaint: encounter.chiefComplaint,
      subjective: encounter.soap.subjective,
      objective: encounter.soap.objective,
      assessment: encounter.soap.assessment,
      plan: encounter.soap.plan,
      ...patch,
      version: encounter.version,
    },
  });
}

// ---- Reference catalogues ----
// The same lists the admin panel offers, so codes and wording match whichever screen recorded them.

export const CONDITIONS = [
  { icd: 'I10', snomed: '38341003', name: 'Essential (primary) hypertension' },
  { icd: 'E78.5', snomed: '370992007', name: 'Dyslipidemia, unspecified' },
  { icd: 'I25.10', snomed: '53741008', name: 'Atherosclerotic heart disease of native coronary artery' },
  { icd: 'E11.9', snomed: '44054006', name: 'Type 2 diabetes mellitus without complications' },
  { icd: 'J45.909', snomed: '195967001', name: 'Unspecified asthma, uncomplicated' },
  { icd: 'R03.0', snomed: '24184005', name: 'Elevated blood pressure reading without diagnosis of hypertension' },
  { icd: 'M51.1', snomed: '279039007', name: 'Lumbar disc disorder with radiculopathy' },
  { icd: 'M54.5', snomed: '279039007', name: 'Acute mechanical low back pain with left L5 lumbar radicular irritation' },
];

/** Formulary for the prescription composer. `drugClass` drives the allergy cross-check. */
export const MEDICINES = [
  { id: 'atorvastatin', name: 'Atorvastatin', strengths: ['10 mg', '20 mg', '40 mg'], form: 'Tablet', drugClass: 'statin' },
  { id: 'olmesartan', name: 'Olmesartan Medoxomil', strengths: ['20 mg', '40 mg'], form: 'Tablet', drugClass: 'arb' },
  { id: 'metoprolol', name: 'Metoprolol Tartrate ER', strengths: ['25 mg', '50 mg'], form: 'Tablet', drugClass: 'beta-blocker' },
  { id: 'aspirin', name: 'Aspirin (Ecosprin) EC', strengths: ['75 mg'], form: 'Tablet', drugClass: 'nsaid' },
  { id: 'paracetamol', name: 'Paracetamol', strengths: ['500 mg', '650 mg'], form: 'Tablet', drugClass: 'analgesic' },
  { id: 'naproxen', name: 'Naproxen Sodium', strengths: ['250 mg', '500 mg'], form: 'Tablet', drugClass: 'nsaid' },
  { id: 'pantoprazole', name: 'Pantoprazole Gastro-Resistant', strengths: ['40 mg'], form: 'Tablet', drugClass: 'ppi' },
  { id: 'pregabalin', name: 'Pregabalin', strengths: ['75 mg', '150 mg'], form: 'Capsule', drugClass: 'neuropathic' },
  { id: 'amoxicillin', name: 'Amoxicillin', strengths: ['250 mg', '500 mg'], form: 'Capsule', drugClass: 'penicillin' },
];

export const FREQUENCIES = [
  { id: 'od', label: 'Once daily (1-0-0)', perDay: 1 },
  { id: 'bd', label: 'Twice daily (1-0-1)', perDay: 2 },
  { id: 'tds', label: 'Thrice daily (1-1-1)', perDay: 3 },
  { id: 'hs', label: 'At bedtime (0-0-1)', perDay: 1 },
  { id: 'sos', label: 'SOS (as needed)', perDay: 1 },
];
export const FOOD_RELATIONS = ['Before food', 'After food', 'With food', 'Empty stomach'];
export const ROUTES_OF_ADMIN = ['Oral', 'Sublingual', 'Topical'];
export const DURATIONS = [3, 5, 7, 10, 14, 30, 90];

export type OrderCategory = 'Laboratory' | 'Imaging' | 'Special Diagnostics';
export const ORDER_CATALOG: { code: string; name: string; category: OrderCategory; loinc: string; destination: string }[] = [
  { code: 'LAB-LIPID-01', name: 'Fasting Lipid Profile', category: 'Laboratory', loinc: '24331-1', destination: 'In-house laboratory' },
  { code: 'LAB-RFT-01', name: 'Serum Creatinine & eGFR', category: 'Laboratory', loinc: '2160-0', destination: 'In-house laboratory' },
  { code: 'LAB-HBA1C-01', name: 'Glycated Hemoglobin (HbA1c)', category: 'Laboratory', loinc: '4548-4', destination: 'In-house laboratory' },
  { code: 'LAB-INF-PANEL', name: 'Erythrocyte Sedimentation Rate (ESR) & High-Sensitivity C-Reactive Protein (hs-CRP)', category: 'Laboratory', loinc: '30341-2', destination: 'In-house laboratory' },
  { code: 'CARD-ECG-12', name: '12-Lead ECG at Rest', category: 'Special Diagnostics', loinc: '11524-6', destination: 'Cardiology diagnostics' },
  { code: 'RAD-MRI-LUM-01', name: 'MRI Spine - Lumbar Spine with Screening Whole Spine', category: 'Imaging', loinc: '24725-4', destination: 'In-house radiology' },
];
export const ORDER_PRIORITIES = ['Routine (Outpatient OPD)', 'Urgent', 'STAT'];

export const REFERRAL_PRIORITIES = ['Routine (within 2 weeks)', 'High / Expedited (48h)', 'Urgent / Emergency (same day)'] as const;
export const REFERRAL_MODELS = ['Specialist Consultation & Opinion', 'Second Opinion', 'Diagnostic Procedure / Intervention', 'Shared Long-term Care Management', 'Transfer of Care'];

export const ALERT_DISPOSITIONS = [
  { id: 'acknowledged', title: 'Clinical Risk Acknowledged — Benefit Outweighs Risk' },
  { id: 'modify', title: 'Modify / Substitute Prescribed Therapy' },
  { id: 'defer', title: 'Defer to Attending Consultant Review' },
];

export const REVIEW_OUTCOMES = [
  { id: 'action', title: 'Action needed', detail: 'Change treatment or call the patient back.' },
  { id: 'routine', title: 'Routine follow-up', detail: 'Discuss at the next planned visit.' },
  { id: 'normal', title: 'Normal / no action', detail: 'Nothing further needed.' },
  { id: 'escalate', title: 'Escalate', detail: 'Refer for urgent senior or specialist review.' },
] as const;

/** Body mass index from weight and height, to one decimal place. */
export const bmiOf = (weightKg: number, heightCm: number) => Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
