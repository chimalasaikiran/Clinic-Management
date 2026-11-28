/** Shapes the patient API returns. */
export type ClinicLink = {
  id: string;
  orgId: string;
  clinicName: string;
  patientName: string;
  mrn: string;
  method: 'mobile_dob' | 'clinic_code';
  verifiedAt: string;
  homeBranch: { id: string; name: string };
};

export type DeviceSession = {
  id: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type Address = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  state: string;
  pinCode: string | null;
};

type Place = Address & {
  id: string;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Clinic = Place & {
  orgId: string;
  clinicName: string;
  facilityType: string | null;
  specialties: string[];
  departments: string[];
  onlineBooking: boolean;
  saved: boolean;
  connected: boolean;
};

export type ClinicService = {
  id: string;
  name: string;
  description: string;
  category: string;
  department: string;
  fee: number;
  gstRate: number;
  slotMinutes: number;
};

export type ClinicDetail = Clinic & {
  services: ClinicService[];
  hours: { weekday: number; start: string; end: string }[];
  closures: { date: string; kind: string; reason: string }[];
  /** Whose record a booking at this clinic would go on. */
  booking:
    | { status: 'linked' | 'new_record'; patientName: string }
    | { status: 'profile_incomplete'; missing: string[] }
    | { status: 'code_required' };
};

export type SlotDay = { date: string; closed?: string; slots: { time: string; available: boolean }[] };
export type Slots = { timezone: string; days: SlotDay[] };

export type AppointmentStatus = 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export type AppointmentEvent = {
  id: string;
  action: string;
  status: AppointmentStatus;
  by: 'you' | 'clinic';
  from: { date: string; time: string } | null;
  to: { date: string; time: string } | null;
  at: string;
};

export type Appointment = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  date: string;
  time: string;
  endTime: string;
  clinicName: string;
  branch: Place & { listed: boolean };
  practitioner: { displayName: string; credentials: string | null; specialty: string; department: string; room: string | null };
  serviceName: string | null;
  fee: number | null;
  reason: string;
  patientName: string;
  mrn: string;
  queueToken: string | null;
  cancelReason: string | null;
  bookedInApp: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  /** Sent with a single appointment, not with lists. */
  events?: AppointmentEvent[];
};

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

/** A moment as the clinic sees it. */
export type Stamp = { date: string; time: string; at: string };
export type RecordBranch = { id: string; name: string; bookable: boolean };
export type Clinician = { displayName: string; credentials: string | null; specialty: string; department: string };

type RecordBase = { id: string; reference: string; clinicName: string; patientName: string; mrn: string };

export type Consultation = RecordBase & {
  type: string;
  reason: string;
  started: Stamp;
  signed: Stamp | null;
  branch: RecordBranch;
  practitioner: Clinician | null;
  signedBy: string | null;
  diagnoses: { name: string; icd: string; designation: string }[];
  prescriptions: number;
  orders: number;
};

export type ConsultationDetail = Omit<Consultation, 'diagnoses'> & {
  diagnoses: { name: string; icd: string; designation: string; verification: string; severity: string | null; description: string }[];
  notes: { title: string; sections: { heading: string; body: string }[]; signed: Stamp; addenda: { text: string; at: string }[] }[];
  vitals: {
    systolic: number;
    diastolic: number;
    pulse: number;
    respiration: number;
    temperatureF: number;
    spo2: number;
    weightKg: number;
    heightCm: number;
    bloodSugar: number | null;
    recordedAt: string;
  } | null;
  linkedPrescriptions: { id: string; reference: string; status: PrescriptionStatus; items: { name: string; strength: string }[] }[];
  linkedOrders: { id: string; reference: string; title: string; status: OrderStatus }[];
};

export type PrescriptionStatus = 'active' | 'completed' | 'discontinued';

export type Prescription = RecordBase & {
  status: PrescriptionStatus;
  issued: Stamp;
  courseEnds: string;
  branch: RecordBranch;
  prescriber: { name: string; registration: string | null; department: string | null };
  indication: string;
  consultation: { id: string; reference: string } | null;
  items: {
    name: string;
    strength: string;
    form: string;
    route: string;
    dose: string;
    frequency: string;
    food: string;
    durationDays: number;
    quantity: number;
    refills: number;
    instructions: string;
  }[];
  dispensedAt: string | null;
  /** The latest refill request, if any. */
  refill: RefillRequest | null;
  canRequestRefill: boolean;
};

export type OrderStatus = 'ordered' | 'processing' | 'awaiting_review' | 'reviewed' | 'cancelled';

export type DiagnosticOrder = RecordBase & {
  kind: 'lab' | 'imaging';
  category: string;
  title: string;
  indication: string;
  performing: string;
  urgent: boolean;
  status: OrderStatus;
  ordered: Stamp;
  orderingName: string;
  branch: RecordBranch;
  consultation: { id: string; reference: string } | null;
  items: { name: string; category: string; priority: string }[];
  steps: { action: 'ordered' | 'collected' | 'resulted' | 'reviewed' | 'cancelled'; at: string }[];
  result: { summary: string; flag: 'normal' | 'abnormal' | 'critical' | null; followUp: boolean; reviewedAt: string | null } | null;
};

export type CarePlanStatus = 'on_track' | 'at_risk' | 'achieved' | 'closed';

export type CarePlan = RecordBase & {
  title: string;
  category: string;
  rationale: string;
  status: CarePlanStatus;
  startDate: string;
  nextReview: string;
  targetDate: string;
  diagnoses: { icd: string; name: string }[];
  education: string[];
  started: Stamp;
  updated: Stamp;
  branch: RecordBranch;
  lead: Clinician;
  goals: { title: string; target: string; protocol: string; cadence: string; status: string }[];
  interventions: { type: string; title: string; due: string; state: string }[];
};

export type HistoryKind = 'consultation' | 'prescription' | 'order' | 'result' | 'care_plan';
export type HistoryEntry = { kind: HistoryKind; id: string; at: string; title: string; detail: string; clinicName: string };

export type RecordsOverview = {
  counts: {
    consultations: number;
    prescriptions: number;
    activePrescriptions: number;
    orders: number;
    openOrders: number;
    results: number;
    reportsReady: number;
    carePlans: number;
    activePlans: number;
  };
  latest: Record<HistoryKind, HistoryEntry | null>;
  recent: HistoryEntry[];
};

export type RefillStatus = 'requested' | 'approved' | 'declined' | 'cancelled';
export type RefillRequest = { id: string; status: RefillStatus; note: string | null; decisionNote: string | null; createdAt: string; decidedAt: string | null };

export type TicketStatus = 'open' | 'answered' | 'resolved';
export type SupportTicket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: TicketStatus;
  clinicName: string;
  branchName: string;
  patientName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** Sent with a single request, not with lists. */
  messages?: { id: string; body: string; by: 'you' | 'clinic'; at: string }[];
};
