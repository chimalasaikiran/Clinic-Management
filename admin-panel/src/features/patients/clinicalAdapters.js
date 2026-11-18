import { INTERVENTION_TYPES } from '../clinical/constants'
import { formatDate, formatTime } from './format'

// Translations from the chart API (/v1/patients/:id/chart) to the shapes the clinical screens display.

const SEVERITY_LABELS = { critical: 'Critical', high: 'High', moderate: 'Moderate', low: 'Low', mild: 'Mild', severe: 'Severe' }
const ALERT_STATUS = { active: 'Active', acknowledged: 'Acknowledged', resolved: 'Resolved' }

const minutesBetween = (from, to) => Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
const stampLabel = (stamp) => `${formatDate(stamp.date)}, ${formatTime(stamp.time)}`

export function toEncounterView(encounter, diagnoses = []) {
  const codes = diagnoses.filter((entry) => entry.encounterId === encounter.id && entry.status === 'active').map((entry) => entry.icd)
  return {
    id: encounter.id,
    reference: encounter.reference,
    patientId: encounter.patientId,
    appointmentId: encounter.appointmentId,
    date: encounter.started.date,
    time: encounter.started.time,
    minutes: encounter.signed ? minutesBetween(encounter.started.at, encounter.signed.at) : 0,
    mode: 'OPD',
    type: encounter.type,
    reason: encounter.reason,
    icd: codes.length ? `ICD-10: ${codes.join(', ')}` : '',
    doctor: encounter.practitioner?.displayName ?? encounter.startedBy,
    credentials: encounter.practitioner?.credentials ?? '',
    department: encounter.practitioner?.department ?? '',
    chamber: encounter.practitioner?.room ?? '',
    branch: encounter.branch.name,
    campus: encounter.branch.city,
    artifacts: encounter.signed ? ['EHR Signed'] : [],
    status: encounter.status === 'signed' ? 'Signed & Locked' : 'In Progress',
    complaint: encounter.chiefComplaint,
    soap: encounter.soap,
    signedBy: encounter.signed?.by ?? null,
    version: encounter.version,
  }
}

export function toVitalsView(vitals) {
  return {
    id: vitals.id,
    encounterId: vitals.encounterId,
    date: vitals.recorded.date,
    time: vitals.recorded.time,
    by: vitals.recordedBy,
    bp: { sys: vitals.systolic, dia: vitals.diastolic },
    pulse: vitals.pulse,
    resp: vitals.respiration,
    temp: vitals.temperatureF,
    spo2: vitals.spo2,
    weight: vitals.weightKg,
    height: vitals.heightCm,
    rbs: vitals.bloodSugar,
    pain: vitals.painScore,
    site: vitals.site ?? '—',
    posture: vitals.posture ?? '—',
    device: vitals.device ?? '—',
  }
}

export function toDiagnosisView(diagnosis) {
  return {
    id: diagnosis.id,
    encounterId: diagnosis.encounterId,
    name: diagnosis.name,
    icd: diagnosis.icd,
    snomed: diagnosis.snomed ?? '',
    designation: diagnosis.designation,
    verification: diagnosis.verification,
    status: diagnosis.status === 'active' ? 'Active' : 'Resolved',
    recorded: diagnosis.recorded.date,
    recordedBy: diagnosis.recordedBy,
    severity: diagnosis.severity ?? '',
    description: diagnosis.description,
  }
}

export function toAllergyView(allergy) {
  return {
    id: allergy.id,
    name: allergy.substance,
    substance: allergy.substance,
    drugClass: allergy.drugClass ?? '',
    classLabel: allergy.classLabel ?? '',
    severity: SEVERITY_LABELS[allergy.severity],
    status: allergy.active ? 'Clinical: Active' : 'Inactive',
    reaction: allergy.reaction,
    recorded: formatDate(allergy.recorded.date),
    verification: allergy.verification ?? 'Unverified',
    exposure: null,
    reactions: [],
    crossReactivity: null,
    provenance: [{ label: 'Documented by', value: allergy.recordedBy }],
    evidence: null,
    audit: [{ time: stampLabel(allergy.recorded), text: 'Allergy documented', by: allergy.recordedBy }],
  }
}

export function toAlertView(alert) {
  const audit = [{ time: stampLabel(alert.created), text: 'Alert raised', by: alert.createdBy }]
  if (alert.acknowledgedAt) audit.unshift({ time: formatDate(alert.acknowledgedAt.slice(0, 10)), text: `Acknowledged — ${alert.disposition}`, by: [alert.acknowledgedBy, alert.justification].filter(Boolean).join(' · ') })
  return {
    id: alert.id,
    patientId: alert.patientId,
    kind: alert.kind,
    title: alert.title,
    severity: SEVERITY_LABELS[alert.severity],
    status: ALERT_STATUS[alert.status],
    detail: alert.detail,
    statement: alert.statement ?? '',
    orderId: alert.orderId ?? null,
    disposition: alert.disposition,
    justification: alert.justification,
    evidence: [],
    audit,
  }
}

export function toNoteView(note) {
  return {
    id: note.id,
    encounterId: note.encounterId,
    title: note.title,
    author: note.author,
    department: note.department ?? '',
    date: note.signed.date,
    status: 'Signed',
    quote: note.sections.find((section) => section.heading === 'Assessment')?.body ?? note.sections[0]?.body ?? '',
    hash: null,
    sections: note.sections,
    addenda: note.addenda.map((entry) => ({ id: entry.id, time: `Addendum · ${stampLabel(entry.at)} · ${entry.author}`, text: entry.text })),
  }
}

const RX_STATUS = { active: 'Active', completed: 'Completed', discontinued: 'Discontinued' }
const RX_EVENTS = { signed: 'Prescription authorized & signed', discontinued: 'Prescription discontinued' }

// There is no pharmacy module yet, so every line waits for the pharmacy to acknowledge it.
const AWAITING_PHARMACY = { state: 'Awaiting', note: 'Pending pharmacy acknowledgement' }

export function toPrescriptionView(rx) {
  const discontinued = rx.events.find((event) => event.action === 'discontinued')
  return {
    id: rx.id,
    reference: rx.reference,
    patientId: rx.patientId,
    encounterId: rx.encounterId,
    encounterReference: rx.encounterReference,
    date: rx.created.date,
    time: rx.created.time,
    indication: rx.indication,
    prescriber: rx.prescriberName,
    department: rx.department ?? '',
    registration: rx.registration ?? 'No council registration on file',
    branch: rx.branch.name,
    status: RX_STATUS[rx.status],
    dispensing: rx.status === 'active' ? 'Awaiting pharmacy acknowledgement' : '—',
    hash: `sha256:${rx.contentHash}`,
    replacedNote: discontinued ? `Discontinued by ${discontinued.actor}: ${discontinued.note}` : null,
    items: rx.items.map((item) => ({
      id: item.id,
      name: item.name,
      strength: item.strength,
      form: item.form,
      route: item.route,
      drugClass: item.drugClass,
      dose: item.dose,
      frequency: item.frequency,
      frequencyNote: item.food,
      durationDays: item.durationDays,
      quantity: item.quantity,
      refills: item.refills,
      instructions: item.instructions,
      indication: item.indication,
      dispensing: AWAITING_PHARMACY,
    })),
    events: rx.events.map((event) => ({ time: stampLabel(event.at), title: RX_EVENTS[event.action] ?? event.action, actor: event.actor, note: event.note })),
  }
}

const ORDER_STATUS = { ordered: 'Ordered', processing: 'Processing', awaiting_review: 'Awaiting Review', reviewed: 'Completed & Reviewed', cancelled: 'Cancelled' }
// Position on the order's progress stepper (see ORDER_STEPS).
const ORDER_STAGE = { ordered: 0, processing: 1, awaiting_review: 3, reviewed: 4, cancelled: 0 }
const ORDER_EVENTS = { ordered: 'Order placed', collected: 'Specimen collected', resulted: 'Result recorded', reviewed: 'Result reviewed & signed', cancelled: 'Order cancelled' }
const FLAG_LABELS = { normal: 'Normal', abnormal: 'Abnormal', critical: 'Critical' }

export function toOrderView(order) {
  const collected = order.events.find((event) => event.action === 'collected')
  const flagged = order.result && order.result.flag !== 'normal'
  return {
    id: order.id,
    reference: order.reference,
    patientId: order.patientId,
    encounterId: order.encounterId,
    encounterReference: order.encounterReference,
    date: order.created.date,
    time: order.created.time,
    title: order.title,
    category: order.category,
    kind: order.kind,
    status: ORDER_STATUS[order.status],
    stage: ORDER_STAGE[order.status],
    indication: order.indication,
    items: order.items,
    performing: order.performing,
    urgent: order.urgent,
    ordering: order.orderingName,
    specimen: order.accession
      ? {
          accession: order.accession,
          note: order.specimenNote || `Collected by ${collected?.actor ?? 'staff'}; awaiting the result from ${order.performing}.`,
          turnaround: order.status === 'processing' ? 'Pending result' : 'Result recorded',
          tests: order.items.map((item) => item.name),
          collectedBy: collected?.actor ?? '—',
          collectedAt: collected ? stampLabel(collected.at) : '—',
          destination: order.performing,
          events: order.events
            .slice()
            .reverse()
            .map((event) => ({ time: stampLabel(event.at), title: ORDER_EVENTS[event.action] ?? event.action, detail: [event.actor, event.note].filter(Boolean).join(' — ') })),
        }
      : null,
    findings: flagged ? { headline: `${FLAG_LABELS[order.result.flag]} result`, text: order.result.summary } : null,
    summary: order.result?.summary ?? null,
    summaryTone: order.result ? FLAG_LABELS[order.result.flag] : null,
    reviewedBy: order.review?.by ?? null,
    reviewedAt: order.review ? stampLabel(order.review.at) : null,
    reviewOutcome: order.review?.outcome ?? null,
    reviewNote: order.review?.note ?? null,
  }
}

const REFERRAL_STATUS = { pending_acceptance: 'Pending Acceptance', awaiting_review: 'Awaiting Review', info_requested: 'Info Requested', accepted: 'Accepted', scheduled: 'Scheduled', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' }

// What the receiving clinician confirms before accepting a received referral.
export const INBOUND_CHECKLIST = [
  'The referral reason and clinical question are clear',
  'Supporting records have been reviewed',
  'This service and specialist are right for the referral',
  'The urgency matches the stated priority',
]

export function toReferralView(referral) {
  // The oldest event is the referral being sent or logged; the detail screen shows that from the referral itself.
  const log = referral.events.slice(0, -1).map((event) => ({ time: stampLabel(event.at), title: event.title, text: event.text }))
  return {
    id: referral.id,
    reference: referral.reference,
    patientId: referral.patientId,
    encounterId: referral.encounterId,
    date: referral.created.date,
    time: referral.created.time,
    direction: referral.direction === 'outgoing' ? 'Outgoing' : 'Incoming',
    status: REFERRAL_STATUS[referral.status],
    priority: referral.priority,
    model: referral.model,
    specialty: referral.specialty,
    indication: referral.indication,
    clinicalIndication: referral.narrative,
    questions: referral.questions,
    attachedRecords: referral.attachedRecords,
    attachments: referral.attachedRecords.length,
    clinician: referral.clinician,
    clinicianNote: referral.clinicianNote,
    facility: referral.facility,
    facilityNote: referral.facilityNote,
    outcome: referral.outcome,
    sla: { windowHours: referral.windowHours, elapsedHours: referral.elapsedHours },
    checklist: referral.direction === 'incoming' ? INBOUND_CHECKLIST : [],
    log,
  }
}

const PLAN_STATUS = { on_track: 'On Track', at_risk: 'At Risk', achieved: 'Achieved', closed: 'Closed' }
const REVIEW_TITLES = { progress: 'Progress saved', completed: 'Follow-up completed', escalated: 'Escalated for attending review' }

export function toCarePlanView(plan) {
  const typeLabel = (type) => INTERVENTION_TYPES.find((entry) => entry.id === type)?.label
  const barriers = (review) => (review.barriers.length ? ` Barriers: ${review.barriers.join(', ')}.` : '')
  return {
    id: plan.id,
    reference: plan.reference,
    patientId: plan.patientId,
    title: plan.title,
    category: plan.category,
    status: PLAN_STATUS[plan.status],
    compliance: plan.compliance,
    lead: plan.lead.displayName,
    leadId: plan.lead.id,
    updated: plan.updated.date,
    updatedBy: plan.updated.by,
    timeline: `${plan.startDate} – ${plan.targetDate}`,
    start: plan.startDate,
    nextReview: plan.nextReview,
    targetDate: plan.targetDate,
    rationale: plan.rationale,
    diagnoses: plan.diagnoses,
    goals: plan.goals.map((goal) => ({ id: goal.id, title: goal.title, target: goal.target, protocol: goal.protocol, cadence: goal.cadence, status: goal.status, observation: goal.observation })),
    milestones: plan.goals.map((goal, index) => ({ no: String(index + 1).padStart(2, '0'), title: goal.title, detail: goal.target })),
    interventions: plan.interventions.map((entry) => ({ id: entry.id, title: entry.title, detail: [typeLabel(entry.type), entry.due && `Due ${entry.due}`].filter(Boolean).join(' · '), state: entry.state, type: entry.type })),
    education: plan.education,
    whatsapp: plan.whatsapp,
    progress: [
      ...plan.reviews.map((review) => ({ time: stampLabel(review.at), title: REVIEW_TITLES[review.kind], detail: `${review.observation} (${review.summary})${barriers(review)} — ${review.author}` })),
      { time: stampLabel(plan.created), title: 'Care plan activated', detail: `${plan.goals.length} goals and ${plan.interventions.length} interventions staged by ${plan.createdBy}.` },
    ],
    version: plan.version,
  }
}

// The prescription drawer's draft as the API expects it.
export function toPrescriptionRequest({ items, indication, precautionAcknowledged }, { encounterId, branchId }) {
  return {
    ...(encounterId ? { encounterId } : { branchId }),
    indication,
    precautionAcknowledged,
    items: items.map((item) => ({
      medicineCode: item.medicineCode,
      name: item.name,
      strength: item.strength,
      form: item.form,
      route: item.route,
      drugClass: item.drugClass ?? null,
      dose: item.doseCount,
      frequency: item.frequency,
      frequencyPerDay: item.frequencyPerDay,
      food: item.frequencyNote,
      durationDays: item.durationDays,
      instructions: item.instructions,
      indication: item.indication,
    })),
  }
}

// The order drawer's selection as the API expects it.
export function toOrderRequest({ indication, items }, { encounterId, branchId }) {
  return {
    ...(encounterId ? { encounterId } : { branchId }),
    indication,
    items: items.map(({ code, name, category, loinc, destination, priority }) => ({ code, name, category, loinc, destination, priority })),
  }
}

// The whole chart, keyed by the collection names the screens read through usePatient().mine().
export function toChartView(chart) {
  return {
    encounters: chart.encounters.map((encounter) => toEncounterView(encounter, chart.diagnoses)),
    vitals: chart.vitals.map(toVitalsView),
    diagnoses: chart.diagnoses.map(toDiagnosisView),
    allergies: chart.allergies.map(toAllergyView),
    alerts: chart.alerts.map(toAlertView),
    notes: chart.notes.map(toNoteView),
    prescriptions: chart.prescriptions.map(toPrescriptionView),
    orders: chart.orders.map(toOrderView),
    referrals: chart.referrals.map(toReferralView),
    carePlans: chart.carePlans.map(toCarePlanView),
  }
}

export const CHART_COLLECTIONS = ['encounters', 'vitals', 'diagnoses', 'allergies', 'alerts', 'notes', 'prescriptions', 'orders', 'referrals', 'carePlans']
