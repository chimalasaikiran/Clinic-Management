import { ApiError } from '../../lib/api'
import { localToday } from '../../features/patients/format'
import { PATIENT_RECORDS } from './patients'

// The in-memory clinical fixtures (test/fixtures/patients) in the chart API's shape, plus a fake of the clinical
// endpoints that keeps a chart per patient. Used by page tests through createPatientsApi().

const stamp = (date, time = '09:00') => ({ date, time, at: `${date}T${time}:00.000Z` })
const lower = (value) => String(value ?? '').toLowerCase()
const clone = (value) => JSON.parse(JSON.stringify(value))

const encounterFrom = (encounter) => ({
  id: encounter.id,
  reference: encounter.id,
  patientId: encounter.patientId,
  appointmentId: encounter.appointmentId,
  type: encounter.type,
  reason: encounter.reason,
  chiefComplaint: encounter.complaint ?? '',
  soap: encounter.soap ?? { subjective: '', objective: '', assessment: '', plan: '' },
  status: encounter.status === 'In Progress' ? 'in_progress' : 'signed',
  started: stamp(encounter.date, encounter.time),
  signed: encounter.status === 'In Progress' ? null : { ...stamp(encounter.date, encounter.time), by: encounter.doctor },
  startedBy: encounter.doctor,
  practitioner: { id: 'dr-1', displayName: encounter.doctor, credentials: encounter.credentials, department: encounter.department, room: encounter.chamber },
  branch: { id: 'b-main', name: encounter.branch, city: encounter.campus },
  version: 1,
})

const vitalsFrom = (vitals) => ({
  id: vitals.id, encounterId: vitals.encounterId, systolic: vitals.bp.sys, diastolic: vitals.bp.dia, pulse: vitals.pulse, respiration: vitals.resp, temperatureF: vitals.temp, spo2: vitals.spo2,
  weightKg: vitals.weight, heightCm: vitals.height, bloodSugar: vitals.rbs ?? null, painScore: vitals.pain ?? null, site: vitals.site, posture: vitals.posture, device: vitals.device,
  recorded: stamp(vitals.date, vitals.time), recordedBy: vitals.by,
})

const diagnosisFrom = (diagnosis) => ({
  id: diagnosis.id, encounterId: diagnosis.encounterId, icd: diagnosis.icd, snomed: diagnosis.snomed, name: diagnosis.name, designation: diagnosis.designation, verification: diagnosis.verification,
  severity: diagnosis.severity, description: diagnosis.description, status: lower(diagnosis.status), recorded: stamp(diagnosis.recorded), resolvedAt: null, recordedBy: diagnosis.recordedBy,
})

const allergyFrom = (allergy) => ({
  id: allergy.id, substance: allergy.name, drugClass: allergy.drugClass, classLabel: allergy.classLabel, severity: lower(allergy.severity), reaction: allergy.reaction,
  verification: allergy.verification, active: true, recorded: stamp('2026-10-14'), recordedBy: 'Dr. Julian Vance',
})

const alertFrom = (alert) => ({
  id: alert.id, patientId: alert.patientId, kind: alert.kind, title: alert.title, severity: lower(alert.severity), status: lower(alert.status), detail: alert.detail, statement: alert.statement,
  allergyId: null, orderId: alert.orderId ?? null, disposition: null, justification: null, acknowledgedBy: null, acknowledgedAt: null, created: stamp('2026-10-14'), createdBy: 'Dr. Julian Vance',
})

const noteFrom = (note) => ({ id: note.id, encounterId: note.encounterId, title: note.title, department: note.department, sections: note.sections, author: note.author, signed: stamp(note.date), addenda: [] })

// ── prescriptions, orders, referrals and care plans ───────────────────────────────────────────────

const RX_STATUS = (status) => (status.startsWith('Discontinued') ? 'discontinued' : lower(status))
const HASH = '7f3b09c0201a4e12a3f890c918a2b4c6d8e0f1a2b3c4d5e6f708192a3b4c5d6e'

const prescriptionFrom = (rx) => ({
  id: rx.id,
  reference: rx.id,
  patientId: rx.patientId,
  encounterId: rx.encounterId,
  encounterReference: rx.encounterId,
  prescriberName: rx.prescriber,
  registration: rx.registration,
  department: rx.department,
  indication: rx.indication,
  precautionAcknowledged: false,
  status: RX_STATUS(rx.status),
  contentHash: HASH,
  created: stamp(rx.date, rx.time),
  version: 1,
  branch: { id: 'b-main', name: rx.branch },
  items: rx.items.map((item, position) => ({
    id: item.id, position, medicineCode: lower(item.name), name: item.name, strength: item.strength, form: item.form, route: item.route, drugClass: item.drugClass ?? null,
    dose: item.dose ?? `1 ${item.form}`, frequency: item.frequency, frequencyPerDay: 1, food: item.frequencyNote, durationDays: item.durationDays, quantity: item.quantity, refills: item.refills,
    instructions: item.instructions ?? '', indication: item.indication,
  })),
  events: [
    ...(rx.replacedNote ? [{ id: `${rx.id}-e2`, action: 'discontinued', note: rx.replacedNote, actor: rx.prescriber, at: stamp(rx.date, rx.time) }] : []),
    { id: `${rx.id}-e1`, action: 'signed', note: '', actor: rx.prescriber, at: stamp(rx.date, rx.time) },
  ],
})

const ORDER_STATUS = (status) => ({ Ordered: 'ordered', Processing: 'processing', 'Awaiting Review': 'awaiting_review', Cancelled: 'cancelled' })[status] ?? 'reviewed'

const orderFrom = (order) => {
  const status = ORDER_STATUS(order.status)
  const result = order.findings ? { summary: order.findings.text, flag: 'abnormal' } : order.summary ? { summary: order.summary, flag: 'normal' } : null
  const events = [
    ...(order.reviewedBy ? [{ id: `${order.id}-rev`, action: 'reviewed', note: 'Reviewed.', actor: order.reviewedBy, at: stamp(order.date, '14:40') }] : []),
    ...(order.specimen ? [{ id: `${order.id}-col`, action: 'collected', note: '', actor: order.specimen.phlebotomist, at: stamp(order.date, order.time) }] : []),
    { id: `${order.id}-ord`, action: 'ordered', note: '', actor: order.ordering, at: stamp(order.date, order.time) },
  ]
  return {
    id: order.id, reference: order.id, patientId: order.patientId, encounterId: order.encounterId, encounterReference: order.encounterId, orderingName: order.ordering, kind: order.kind,
    category: order.category, title: order.title, indication: 'Clinical review', performing: order.performing, urgent: false, status, accession: order.specimen?.accession ?? null,
    specimenNote: order.specimen?.note ?? null, result, review: order.reviewedBy ? { outcome: 'normal', note: 'Reviewed.', by: order.reviewedBy, at: stamp(order.date, '14:40') } : null,
    created: stamp(order.date, order.time), version: 1, branch: { id: 'b-main', name: 'Main Clinic' },
    items: [{ id: `${order.id}-i1`, position: 0, code: order.id, name: order.title, category: order.kind === 'lab' ? 'Laboratory' : 'Imaging', loinc: null, destination: order.performing, priority: 'Routine (Outpatient OPD)' }],
    events,
  }
}

const REFERRAL_STATUS = (status) => ({ 'Pending Acceptance': 'pending_acceptance', 'Awaiting Review': 'awaiting_review', 'Info Requested': 'info_requested', Closed: 'completed' })[status] ?? lower(status)

const referralFrom = (referral) => ({
  id: referral.id, reference: referral.id, patientId: referral.patientId, encounterId: null, encounterReference: null, direction: lower(referral.direction), status: REFERRAL_STATUS(referral.status),
  priority: referral.priority ?? 'Routine (within 2 weeks)', windowHours: referral.sla?.windowHours ?? 336, elapsedHours: referral.sla?.elapsedHours ?? 0, model: 'Specialist Consultation & Opinion',
  specialty: referral.specialty, indication: referral.indication, narrative: referral.clinicalIndication ?? referral.indication, questions: [], attachedRecords: Array.from({ length: referral.attachments ?? 0 }, (_, index) => `Attached record ${index + 1}`),
  targetPractitioner: null, facility: referral.facility, facilityNote: referral.facilityNote, clinician: referral.clinician, clinicianNote: referral.clinicianNote, outcome: referral.outcome,
  createdBy: referral.clinician, created: stamp(referral.date, referral.time), version: 1,
  events: [
    ...(referral.log ?? []).map((entry, index) => ({ id: `${referral.id}-l${index}`, title: entry.title, text: entry.text, actor: 'Liaison desk', at: stamp(referral.date, referral.time) })),
    { id: `${referral.id}-created`, title: 'Referral authorized and sent', text: '', actor: referral.clinician, at: stamp(referral.date, referral.time) },
  ],
})

const PLAN_STATUS = (status) => ({ 'On Track': 'on_track', 'At Risk': 'at_risk', Achieved: 'achieved' })[status] ?? 'on_track'

const carePlanFrom = (plan) => ({
  id: plan.id, reference: plan.id, patientId: plan.patientId, title: plan.title, category: plan.category, rationale: 'Secondary prevention after revascularisation.', startDate: '2026-10-05',
  nextReview: plan.nextReview, targetDate: '2027-01-05', diagnoses: [], education: [], whatsapp: false, status: PLAN_STATUS(plan.status), compliance: plan.compliance, version: 1,
  lead: { id: 'dr-1', displayName: plan.lead, room: null }, createdBy: plan.updatedBy, created: stamp('2026-10-05'), updated: { date: plan.updated, by: plan.updatedBy },
  goals: plan.milestones.map((milestone, position) => ({ id: `${plan.id}-g${position + 1}`, position, title: milestone.title, target: milestone.detail, protocol: '', cadence: 'Every 30 Days', status: 'Pending Baseline', observation: null })),
  interventions: plan.interventions.map((entry, position) => ({ id: `${plan.id}-i${position + 1}`, position, type: 'follow-up', title: entry.title, due: '', state: entry.state })),
  reviews: [],
})

export function fixtureChart(patientId, records = PATIENT_RECORDS) {
  const mine = (collection) => (records[collection] ?? []).filter((item) => item.patientId === patientId)
  return {
    encounters: mine('encounters').map(encounterFrom),
    vitals: mine('vitals').map(vitalsFrom),
    diagnoses: mine('diagnoses').map(diagnosisFrom),
    allergies: mine('allergies').map(allergyFrom),
    alerts: mine('alerts').map(alertFrom),
    notes: mine('notes').map(noteFrom),
    prescriptions: mine('prescriptions').map(prescriptionFrom),
    orders: mine('orders').map(orderFrom),
    referrals: mine('referrals').map(referralFrom),
    carePlans: mine('carePlans').map(carePlanFrom),
  }
}

const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found.`)

// `state` is the createPatientsApi state (patients, appointments); charts are added to it per patient.
export function createClinicalApi(state) {
  state.charts = state.charts ?? {}
  const chartOf = (patientId) => {
    if (!state.charts[patientId]) state.charts[patientId] = fixtureChart(patientId)
    return state.charts[patientId]
  }
  const findIn = (collection, id) => {
    for (const [patientId, chart] of Object.entries(state.charts)) {
      const item = chart[collection].find((entry) => entry.id === id)
      if (item) return { item, chart, patientId }
    }
    throw notFound('Record')
  }
  const now = () => stamp(localToday(), '10:00')
  const record = (name, ...args) => state.calls.push([name, ...args])

  return {
    chart: async (patientId) => {
      if (!state.patients.some((patient) => patient.id === patientId)) throw notFound('Patient')
      return clone(chartOf(patientId))
    },
    worklist: async (date) => ({ date, me: { practitionerId: state.practitioners[0]?.id ?? null }, appointments: [], openEncounters: [], alerts: [], ordersAwaitingReview: 0, followUpsDue: 0 }),
    startEncounter: async ({ appointmentId }) => {
      record('clinical.startEncounter', appointmentId)
      const appointment = state.appointments.find((entry) => entry.id === appointmentId)
      if (!appointment) throw notFound('Appointment')
      if (appointment.status !== 'arrived') throw new ApiError(409, 'INVALID_STATUS_CHANGE', 'The patient has not arrived yet.')
      appointment.status = 'in_progress'
      const chart = chartOf(appointment.patient.id)
      const number = Object.values(state.charts).reduce((sum, entry) => sum + entry.encounters.length, 0) + 1
      const encounter = {
        id: `enc-${number}`, reference: `ENC-${String(number).padStart(6, '0')}`, patientId: appointment.patient.id, appointmentId, type: `${appointment.practitioner.department} consultation`,
        reason: appointment.reason, chiefComplaint: appointment.reason, soap: { subjective: '', objective: '', assessment: '', plan: '' }, status: 'in_progress', started: now(), signed: null,
        startedBy: 'Siddharth Verma', practitioner: { ...appointment.practitioner }, branch: { id: appointment.branch.id, name: appointment.branch.name, city: appointment.branch.city }, version: 1,
      }
      chart.encounters.unshift(encounter)
      return clone(encounter)
    },
    updateEncounter: async (id, body) => {
      record('clinical.updateEncounter', id, body)
      const { item } = findIn('encounters', id)
      if (item.status !== 'in_progress') throw new ApiError(409, 'ENCOUNTER_SIGNED', 'This encounter is signed and locked.')
      Object.assign(item, { chiefComplaint: body.chiefComplaint, soap: { subjective: body.subjective, objective: body.objective, assessment: body.assessment, plan: body.plan }, version: item.version + 1 })
      return clone(item)
    },
    signEncounter: async (id) => {
      record('clinical.signEncounter', id)
      const { item, chart } = findIn('encounters', id)
      if (!chart.diagnoses.some((entry) => entry.encounterId === id && entry.status === 'active')) throw new ApiError(422, 'DIAGNOSIS_REQUIRED', 'Attach at least one diagnosis before completing the encounter.')
      Object.assign(item, { status: 'signed', signed: { ...now(), by: 'Siddharth Verma' } })
      chart.notes.unshift({ id: `note-${id}`, encounterId: id, title: `${item.type} — ${item.reference}`, department: item.practitioner?.department ?? null, sections: [{ heading: 'Chief complaint', body: item.chiefComplaint }], author: 'Siddharth Verma', signed: now(), addenda: [] })
      const appointment = state.appointments.find((entry) => entry.id === item.appointmentId)
      if (appointment) appointment.status = 'completed'
      return clone(item)
    },
    recordVitals: async (patientId, body) => {
      record('clinical.recordVitals', patientId, body)
      const vitals = { id: `vit-${Date.now()}`, ...body, recorded: now(), recordedBy: 'Siddharth Verma' }
      chartOf(patientId).vitals.unshift(vitals)
      return clone(vitals)
    },
    addDiagnosis: async (patientId, body) => {
      record('clinical.addDiagnosis', patientId, body)
      const diagnosis = { id: `dx-${Date.now()}`, ...body, snomed: body.snomed ?? null, severity: body.severity ?? null, status: 'active', recorded: now(), resolvedAt: null, recordedBy: 'Dr. Rahul Mehta' }
      chartOf(patientId).diagnoses.unshift(diagnosis)
      return clone(diagnosis)
    },
    resolveDiagnosis: async (id) => {
      findIn('diagnoses', id).item.status = 'resolved'
      return null
    },
    addAllergy: async (patientId, body) => {
      const allergy = { id: `all-${Date.now()}`, ...body, active: true, recorded: now(), recordedBy: 'Siddharth Verma' }
      chartOf(patientId).allergies.unshift(allergy)
      return clone(allergy)
    },
    raiseAlert: async (patientId, body) => {
      record('clinical.raiseAlert', patientId, body)
      const alert = { id: `alt-${Date.now()}`, patientId, ...body, status: 'active', allergyId: null, disposition: null, justification: null, acknowledgedBy: null, acknowledgedAt: null, created: now(), createdBy: 'Siddharth Verma' }
      chartOf(patientId).alerts.unshift(alert)
      return clone(alert)
    },
    acknowledgeAlert: async (id, disposition, justification) => {
      record('clinical.acknowledgeAlert', id, disposition, justification)
      const { item } = findIn('alerts', id)
      Object.assign(item, { status: 'acknowledged', disposition, justification, acknowledgedBy: 'Siddharth Verma', acknowledgedAt: `${localToday()}T10:00:00.000Z` })
      return clone(item)
    },
    resolveAlert: async (id) => {
      const { item } = findIn('alerts', id)
      item.status = 'resolved'
      return clone(item)
    },
    addAddendum: async (noteId, text) => {
      record('clinical.addAddendum', noteId, text)
      const { item } = findIn('notes', noteId)
      item.addenda.push({ id: `${noteId}-a${item.addenda.length + 1}`, text, author: 'Siddharth Verma', at: now() })
      return clone(item)
    },
    prescribe: async (patientId, body) => {
      record('clinical.prescribe', patientId, body)
      const chart = chartOf(patientId)
      for (const item of body.items) {
        const allergy = chart.allergies.find((entry) => item.drugClass && entry.drugClass === item.drugClass)
        if (allergy) throw new ApiError(422, 'ALLERGY_CONFLICT', `${item.name} conflicts with the documented ${allergy.substance} allergy (${allergy.reaction}).`)
      }
      const vitals = chart.vitals[0]
      if (body.items.some((item) => item.drugClass === 'nsaid') && vitals && (vitals.systolic >= 130 || vitals.diastolic >= 80) && !body.precautionAcknowledged) {
        throw new ApiError(422, 'PRECAUTION_REQUIRED', 'Acknowledge the NSAID precaution for this patient’s raised blood pressure before signing.')
      }
      const encounter = body.encounterId ? chart.encounters.find((entry) => entry.id === body.encounterId) : null
      const number = Object.values(state.charts).reduce((sum, entry) => sum + entry.prescriptions.length, 0) + 1
      const rx = {
        id: `rx-${number}`, reference: `RX-${String(number).padStart(6, '0')}`, patientId, encounterId: encounter?.id ?? null, encounterReference: encounter?.reference ?? null, prescriberName: 'Dr. Rahul Mehta',
        registration: 'NMC · NMC-TS-2018-1', department: 'Cardiology', indication: body.indication, precautionAcknowledged: body.precautionAcknowledged, status: 'active', contentHash: HASH, created: now(), version: 1,
        branch: { id: 'b-main', name: 'Main Clinic' },
        items: body.items.map((item, position) => ({ id: `rx-${number}-i${position}`, position, ...item, dose: `${item.dose} ${item.form}`, quantity: item.dose * item.frequencyPerDay * item.durationDays, refills: 0 })),
        events: [{ id: `rx-${number}-e1`, action: 'signed', note: '', actor: 'Dr. Rahul Mehta', at: now() }],
      }
      chart.prescriptions.unshift(rx)
      return clone(rx)
    },
    discontinuePrescription: async (id, reason) => {
      record('clinical.discontinuePrescription', id, reason)
      const { item } = findIn('prescriptions', id)
      if (item.status !== 'active') throw new ApiError(409, 'PRESCRIPTION_CLOSED', 'This prescription is no longer active.')
      item.status = 'discontinued'
      item.events.unshift({ id: `${id}-d`, action: 'discontinued', note: reason, actor: 'Dr. Rahul Mehta', at: now() })
      return clone(item)
    },
    placeOrder: async (patientId, body) => {
      record('clinical.placeOrder', patientId, body)
      const chart = chartOf(patientId)
      const encounter = body.encounterId ? chart.encounters.find((entry) => entry.id === body.encounterId) : null
      const number = Object.values(state.charts).reduce((sum, entry) => sum + entry.orders.length, 0) + 1
      const order = {
        id: `ord-${number}`, reference: `ORD-${String(number).padStart(6, '0')}`, patientId, encounterId: encounter?.id ?? null, encounterReference: encounter?.reference ?? null, orderingName: 'Dr. Rahul Mehta (Cardiology)',
        kind: body.items.every((item) => item.category !== 'Laboratory') ? 'imaging' : 'lab', category: [...new Set(body.items.map((item) => item.category))].join(' · '), title: body.items.map((item) => item.name).join(' + '),
        indication: body.indication, performing: body.items[0].destination, urgent: body.items.some((item) => item.priority !== 'Routine (Outpatient OPD)'), status: 'ordered', accession: null, specimenNote: null,
        result: null, review: null, created: now(), version: 1, branch: { id: 'b-main', name: 'Main Clinic' }, items: body.items.map((item, position) => ({ id: `ord-${number}-i${position}`, position, ...item })),
        events: [{ id: `ord-${number}-e1`, action: 'ordered', note: '', actor: 'Dr. Rahul Mehta', at: now() }],
      }
      chart.orders.unshift(order)
      return clone(order)
    },
    collectSpecimen: async (id, note) => {
      record('clinical.collectSpecimen', id, note)
      const { item } = findIn('orders', id)
      if (item.kind !== 'lab' || item.status !== 'ordered') throw new ApiError(409, 'ORDER_STATE', 'This order is not waiting for a specimen.')
      Object.assign(item, { status: 'processing', accession: `${item.reference}-S1`, specimenNote: note || null })
      item.events.unshift({ id: `${id}-col`, action: 'collected', note, actor: 'Siddharth Verma', at: now() })
      return clone(item)
    },
    recordResult: async (id, body) => {
      record('clinical.recordResult', id, body)
      const { item, chart } = findIn('orders', id)
      if (!(item.status === 'processing' || (item.status === 'ordered' && item.kind === 'imaging'))) throw new ApiError(409, 'ORDER_STATE', 'Collect the specimen before recording a result.')
      Object.assign(item, { status: 'awaiting_review', result: { summary: body.summary, flag: body.flag } })
      if (body.flag !== 'normal') {
        const critical = body.flag === 'critical'
        chart.alerts.unshift({ id: `alt-${id}`, patientId: item.patientId, orderId: id, kind: critical ? 'RESULT: CRITICAL' : 'RESULT: ABNORMAL', title: `${critical ? 'Critical' : 'Abnormal'} result — ${item.title}`, severity: critical ? 'critical' : 'high', status: 'active', detail: body.summary, statement: '', allergyId: null, disposition: null, justification: null, acknowledgedBy: null, acknowledgedAt: null, created: now(), createdBy: 'Siddharth Verma' })
      }
      return clone(item)
    },
    reviewResult: async (id, body) => {
      record('clinical.reviewResult', id, body)
      const { item, chart } = findIn('orders', id)
      if (item.status !== 'awaiting_review') throw new ApiError(409, 'ORDER_STATE', 'This order is not awaiting review.')
      Object.assign(item, { status: 'reviewed', review: { ...body, by: 'Siddharth Verma', at: now() } })
      for (const alert of chart.alerts) if (alert.orderId === id && alert.status === 'active') alert.status = 'resolved'
      return clone(item)
    },
    cancelOrder: async (id, reason) => {
      record('clinical.cancelOrder', id, reason)
      const { item } = findIn('orders', id)
      if (!['ordered', 'processing'].includes(item.status)) throw new ApiError(409, 'ORDER_STATE', 'Only orders without a result can be cancelled.')
      item.status = 'cancelled'
      return clone(item)
    },
    refer: async (patientId, body) => {
      record('clinical.refer', patientId, body)
      const chart = chartOf(patientId)
      const number = Object.values(state.charts).reduce((sum, entry) => sum + entry.referrals.length, 0) + 1
      const target = body.targetPractitionerId ? state.practitioners.find((entry) => entry.id === body.targetPractitionerId) : null
      const referral = {
        id: `ref-${number}`, reference: `REF-${String(number).padStart(6, '0')}`, patientId, encounterId: body.encounterId ?? null, encounterReference: null, direction: body.direction,
        status: body.direction === 'outgoing' ? 'pending_acceptance' : 'awaiting_review', priority: body.priority, windowHours: { 'Routine (within 2 weeks)': 336, 'High / Expedited (48h)': 48, 'Urgent / Emergency (same day)': 8 }[body.priority],
        elapsedHours: 0, model: body.model, specialty: body.specialty, indication: body.indication, narrative: body.narrative, questions: body.questions, attachedRecords: body.attachedRecords,
        targetPractitioner: target ? { id: target.id, displayName: target.displayName, specialty: target.specialty } : null,
        facility: target ? target.department : body.facility, facilityNote: target ? `${target.displayName} (${target.specialty})` : body.facilityNote ?? '', clinician: body.clinician ?? 'Dr. Rahul Mehta',
        clinicianNote: body.clinicianNote ?? 'Cardiology', outcome: 'No appointment scheduled yet', createdBy: 'Dr. Rahul Mehta', created: now(), version: 1,
        events: [{ id: `ref-${number}-e1`, title: 'Referral authorized and sent', text: '', actor: 'Dr. Rahul Mehta', at: now() }],
      }
      chart.referrals.unshift(referral)
      return clone(referral)
    },
    followUpReferral: async (id, body) => {
      record('clinical.followUpReferral', id, body)
      const { item } = findIn('referrals', id)
      const outcomes = { awaiting: ['pending_acceptance', 'Awaiting Clinical Review'], accepted: ['accepted', 'Acceptance Confirmed'], info: ['info_requested', 'Additional Information Requested'], declined: ['declined', 'Referral Declined / Capacity Constraint'], noanswer: ['pending_acceptance', 'No Answer / Line Busy'] }
      const [status, title] = outcomes[body.outcome]
      item.status = status
      item.events.unshift({ id: `${id}-f${item.events.length}`, title: `Phone call outreach — ${title}`, text: `${body.staff} spoke with ${body.representative}. ${body.notes}`, actor: 'Siddharth Verma', at: now() })
      return clone(item)
    },
    rerouteReferral: async (id) => {
      record('clinical.rerouteReferral', id)
      const { item } = findIn('referrals', id)
      item.status = 'cancelled'
      return clone(item)
    },
    triageReferral: async (id, decision) => {
      record('clinical.triageReferral', id, decision)
      const { item } = findIn('referrals', id)
      if (item.direction !== 'incoming' || item.status !== 'awaiting_review') throw new ApiError(409, 'REFERRAL_STATE', 'This referral has already been triaged.')
      Object.assign(item, decision === 'accept' ? { status: 'accepted', outcome: 'Accepted for clinical intake' } : { status: 'declined', outcome: 'Declined at triage' })
      return clone(item)
    },
    createCarePlan: async (patientId, body) => {
      record('clinical.createCarePlan', patientId, body)
      const chart = chartOf(patientId)
      const lead = state.practitioners.find((entry) => entry.id === body.leadPractitionerId)
      if (!lead) throw new ApiError(422, 'PRACTITIONER_INVALID', 'Choose an active therapist as the responsible clinician.')
      const number = Object.values(state.charts).reduce((sum, entry) => sum + entry.carePlans.length, 0) + 1
      const plan = {
        id: `cp-${number}`, reference: `CP-${String(number).padStart(6, '0')}`, patientId, title: body.title, category: body.category, rationale: body.rationale, startDate: body.startDate, nextReview: body.nextReview,
        targetDate: body.targetDate, diagnoses: body.diagnoses, education: body.education, whatsapp: body.whatsapp, status: 'on_track', compliance: 0, version: 1, lead: { id: lead.id, displayName: lead.displayName, room: lead.room ?? null },
        createdBy: 'Siddharth Verma', created: now(), updated: { date: localToday(), by: 'Siddharth Verma' },
        goals: body.goals.map((goal, position) => ({ id: `cp-${number}-g${position + 1}`, position, ...goal, status: 'Pending Baseline', observation: null })),
        interventions: body.interventions.map((entry, position) => ({ id: `cp-${number}-i${position + 1}`, position, ...entry, state: 'Staged' })), reviews: [],
      }
      chart.carePlans.unshift(plan)
      return clone(plan)
    },
    reviewCarePlan: async (id, body) => {
      record('clinical.reviewCarePlan', id, body)
      const { item, chart } = findIn('carePlans', id)
      if (body.version !== item.version) throw new ApiError(409, 'CARE_PLAN_CHANGED', 'Someone else reviewed this care plan first. Reload to see their changes.')
      for (const goal of item.goals) goal.status = body.goalStatus[goal.id] || goal.status
      item.interventions.forEach((entry, index) => (entry.state = body.adherence[index] ?? entry.state))
      const statuses = item.goals.map((goal) => goal.status)
      const rated = statuses.filter((status) => !['Unable to Assess', 'Pending Baseline'].includes(status))
      item.compliance = rated.length ? Math.round((rated.filter((status) => status === 'Improving / On Target' || status === 'Achieved').length / rated.length) * 100) : 0
      item.status = statuses.includes('Worsening') ? 'at_risk' : statuses.length && statuses.every((status) => status === 'Achieved') ? 'achieved' : 'on_track'
      if (body.mode === 'complete') item.nextReview = body.nextReview
      item.version += 1
      const escalate = body.mode === 'escalate' || body.escalate
      item.reviews.unshift({ id: `${id}-r${item.reviews.length + 1}`, kind: body.mode === 'complete' ? 'completed' : escalate ? 'escalated' : 'progress', observation: body.observation, summary: item.goals.map((goal) => `${goal.title}: ${goal.status}`).join('; '), barriers: body.barriers, author: 'Siddharth Verma', at: now() })
      if (escalate) chart.alerts.unshift({ id: `alt-${id}-${item.version}`, patientId: item.patientId, orderId: null, kind: 'CLINICAL FLAG: CARE PLAN ESCALATION', title: `Care plan escalated for attending review — ${item.title}`, severity: 'high', status: 'active', detail: body.observation, statement: '', allergyId: null, disposition: null, justification: null, acknowledgedBy: null, acknowledgedAt: null, created: now(), createdBy: 'Siddharth Verma' })
      return clone(item)
    },
  }
}

// The incident register, for the report page and the clinical hub.
export function createIncidentsApi(state) {
  state.incidents = state.incidents ?? []
  return {
    list: async () => ({ data: clone(state.incidents), meta: { page: 1, pageSize: 10, total: state.incidents.length } }),
    report: async (body) => {
      state.calls.push(['incidents.report', body])
      if (body.date > localToday()) throw new ApiError(422, 'DATE_IN_FUTURE', 'The incident cannot have occurred in the future.')
      const patient = body.patientId ? state.patients.find((entry) => entry.id === body.patientId) : null
      const reference = `INC-${String(state.incidents.length + 1).padStart(6, '0')}`
      const incident = {
        id: `inc-${state.incidents.length + 1}`, reference, category: body.category, severity: body.severity, occurredOn: body.date, occurredTime: body.time, zone: body.zone, headline: body.headline,
        chronology: body.chronology, factors: body.factors, actions: body.actions, witnesses: body.witnesses, notifyQuality: body.notifyQuality, logRegister: body.logRegister,
        patient: patient ? { id: patient.id, fullName: patient.fullName, mrn: patient.mrn } : null, branch: { id: body.branchId, name: 'Main Clinic' }, reporter: body.anonymous ? 'Anonymous (safe harbor)' : 'Siddharth Verma', created: stamp(localToday(), '10:00'),
      }
      state.incidents.unshift(incident)
      return clone(incident)
    },
  }
}
