import { Inject, Injectable } from '@nestjs/common'
import { notFound } from '../../common/errors/app-error'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { localDate, localMinute, minuteToTime } from '../scheduling/clinic-time'
import type { OrderListQuery, RecordListQuery } from './records.schemas'
import { courseEnd, HistoryEntry, newestFirst, orderSteps, releasedResult } from './records.logic'

// Only what a patient may read is ever selected: no internal notes, no lab staff notes, no reviewer notes and no
// staff names on history entries. Every query is limited to the records linked to the signed-in account.

const clinic = { organisation: { select: { displayName: true } } } as const
const place = { select: { id: true, name: true, listedInPatientApp: true, status: true } } as const
const clinician = { select: { displayName: true, credentials: true, specialty: true, department: true } } as const
const patient = { select: { fullName: true, mrn: true } } as const

const encounterSelect = {
  id: true,
  reference: true,
  type: true,
  reason: true,
  startedAt: true,
  signedAt: true,
  appointmentId: true,
  ...clinic,
  branch: place,
  practitioner: clinician,
  // The doctor who signed: the clinician to name when the visit had no therapist assigned.
  signedBy: { select: { fullName: true } },
  patient,
  diagnoses: { where: { status: 'active' }, orderBy: { recordedAt: 'asc' }, select: { name: true, icd: true, designation: true } },
  _count: { select: { prescriptions: true, orders: true } },
} as const satisfies Prisma.EncounterSelect

const prescriptionSelect = {
  id: true,
  reference: true,
  status: true,
  createdAt: true,
  prescriberName: true,
  registration: true,
  department: true,
  indication: true,
  ...clinic,
  branch: place,
  patient,
  encounter: { select: { id: true, reference: true, status: true } },
  items: {
    orderBy: { position: 'asc' },
    select: { name: true, strength: true, form: true, route: true, dose: true, frequency: true, food: true, durationDays: true, quantity: true, refills: true, instructions: true },
  },
  dispenses: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
  refillRequests: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, note: true, decisionNote: true, createdAt: true, decidedAt: true } },
} as const satisfies Prisma.PrescriptionSelect

const orderSelect = {
  id: true,
  reference: true,
  kind: true,
  category: true,
  title: true,
  indication: true,
  performing: true,
  urgent: true,
  status: true,
  createdAt: true,
  orderingName: true,
  resultSummary: true,
  resultFlag: true,
  reviewOutcome: true,
  ...clinic,
  branch: place,
  patient,
  encounter: { select: { id: true, reference: true, status: true } },
  items: { orderBy: { position: 'asc' }, select: { name: true, category: true, priority: true } },
  events: { select: { action: true, createdAt: true } },
} as const satisfies Prisma.DiagnosticOrderSelect

const carePlanSelect = {
  id: true,
  reference: true,
  title: true,
  category: true,
  rationale: true,
  status: true,
  startDate: true,
  nextReview: true,
  targetDate: true,
  diagnoses: true,
  education: true,
  createdAt: true,
  updatedAt: true,
  ...clinic,
  leadPractitioner: clinician,
  patient: { select: { fullName: true, mrn: true, homeBranch: place } },
  goals: { orderBy: { position: 'asc' }, select: { title: true, target: true, protocol: true, cadence: true, status: true } },
  interventions: { orderBy: { position: 'asc' }, select: { type: true, title: true, due: true, state: true } },
} as const satisfies Prisma.CarePlanSelect

type EncounterRow = Prisma.EncounterGetPayload<{ select: typeof encounterSelect }>
type PrescriptionRow = Prisma.PrescriptionGetPayload<{ select: typeof prescriptionSelect }>
type OrderRow = Prisma.DiagnosticOrderGetPayload<{ select: typeof orderSelect }>
type CarePlanRow = Prisma.CarePlanGetPayload<{ select: typeof carePlanSelect }>
type Place = { id: string; name: string; listedInPatientApp: boolean; status: string }

const RESULT_STATUSES = ['processing', 'awaiting_review', 'reviewed'] as const
const OPEN_ORDER_STATUSES = ['ordered', 'processing', 'awaiting_review'] as const
// Enough to fill the timeline; older entries stay in each record list.
const HISTORY_PER_KIND = 100

const day = (date: Date) => date.toISOString().slice(0, 10)

@Injectable()
export class PatientRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: PatientLinksService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private stamp(instant: Date) {
    const zone = this.env.CLINIC_TIMEZONE
    return { date: localDate(instant, zone), time: minuteToTime(localMinute(instant, zone)), at: instant.toISOString() }
  }

  private async patientIds(accountId: string) {
    return (await this.links.active(accountId)).map((link) => link.patientId)
  }

  // A branch the app can open for booking, or just its name when it is not listed.
  private branch(row: Place) {
    return { id: row.id, name: row.name, bookable: row.listedInPatientApp && row.status === 'active' }
  }

  // ── Consultations: signed encounters only ──

  private signed(ids: string[]): Prisma.EncounterWhereInput {
    return { patientId: { in: ids }, status: 'signed' }
  }

  private consultationView(row: EncounterRow) {
    return {
      id: row.id,
      reference: row.reference,
      type: row.type,
      reason: row.reason,
      started: this.stamp(row.startedAt),
      signed: row.signedAt ? this.stamp(row.signedAt) : null,
      clinicName: row.organisation.displayName,
      branch: this.branch(row.branch),
      practitioner: row.practitioner,
      signedBy: row.signedBy?.fullName ?? null,
      patientName: row.patient.fullName,
      mrn: row.patient.mrn,
      diagnoses: row.diagnoses,
      prescriptions: row._count.prescriptions,
      orders: row._count.orders,
    }
  }

  async consultations(accountId: string, query: RecordListQuery) {
    const where = this.signed(await this.patientIds(accountId))
    const [total, rows] = await Promise.all([
      this.prisma.encounter.count({ where }),
      this.prisma.encounter.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: encounterSelect }),
    ])
    return { items: rows.map((row) => this.consultationView(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async consultation(accountId: string, id: string) {
    const row = await this.prisma.encounter.findFirst({
      where: { AND: [this.signed(await this.patientIds(accountId)), { id }] },
      select: {
        ...encounterSelect,
        diagnoses: { where: { status: 'active' }, orderBy: { recordedAt: 'asc' }, select: { name: true, icd: true, designation: true, verification: true, severity: true, description: true } },
        notes: { orderBy: { signedAt: 'asc' }, select: { title: true, sections: true, signedAt: true, addenda: { orderBy: { createdAt: 'asc' }, select: { text: true, createdAt: true } } } },
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { systolic: true, diastolic: true, pulse: true, respiration: true, temperatureF: true, spo2: true, weightKg: true, heightCm: true, bloodSugar: true, recordedAt: true },
        },
        prescriptions: { orderBy: { createdAt: 'asc' }, select: { id: true, reference: true, status: true, items: { orderBy: { position: 'asc' }, select: { name: true, strength: true } } } },
        orders: { orderBy: { createdAt: 'asc' }, select: { id: true, reference: true, title: true, status: true } },
      },
    })
    if (!row) throw notFound('Consultation not found.')
    const [vitals] = row.vitals
    return {
      ...this.consultationView(row),
      diagnoses: row.diagnoses,
      notes: row.notes.map((note) => ({
        title: note.title,
        sections: note.sections as Array<{ heading: string; body: string }>,
        signed: this.stamp(note.signedAt),
        addenda: note.addenda.map((entry) => ({ text: entry.text, at: entry.createdAt.toISOString() })),
      })),
      vitals: vitals ? { ...vitals, recordedAt: vitals.recordedAt.toISOString() } : null,
      linkedPrescriptions: row.prescriptions,
      linkedOrders: row.orders,
    }
  }

  // ── Prescriptions: signed when issued ──

  private prescription(row: PrescriptionRow) {
    const issued = this.stamp(row.createdAt)
    const dispensed = row.dispenses[0]
    const [refill] = row.refillRequests
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      issued,
      courseEnds: courseEnd(issued.date, row.items.map((item) => item.durationDays)),
      clinicName: row.organisation.displayName,
      branch: this.branch(row.branch),
      prescriber: { name: row.prescriberName, registration: row.registration, department: row.department },
      indication: row.indication,
      patientName: row.patient.fullName,
      mrn: row.patient.mrn,
      // Only a signed consultation can be opened by the patient.
      consultation: row.encounter?.status === 'signed' ? { id: row.encounter.id, reference: row.encounter.reference } : null,
      items: row.items,
      dispensedAt: dispensed ? dispensed.createdAt.toISOString() : null,
      refill: refill ? { ...refill, createdAt: refill.createdAt.toISOString(), decidedAt: refill.decidedAt?.toISOString() ?? null } : null,
      canRequestRefill: row.status === 'active' && refill?.status !== 'requested',
    }
  }

  async prescriptions(accountId: string, query: RecordListQuery) {
    const where: Prisma.PrescriptionWhereInput = { patientId: { in: await this.patientIds(accountId) } }
    const [total, rows] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: prescriptionSelect }),
    ])
    return { items: rows.map((row) => this.prescription(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async prescriptionDetail(accountId: string, id: string) {
    const row = await this.prisma.prescription.findFirst({ where: { id, patientId: { in: await this.patientIds(accountId) } }, select: prescriptionSelect })
    if (!row) throw notFound('Prescription not found.')
    return this.prescription(row)
  }

  // ── Diagnostic orders and their reviewed results ──

  private order(row: OrderRow) {
    const reviewed = row.events.find((event) => event.action === 'reviewed')
    return {
      id: row.id,
      reference: row.reference,
      kind: row.kind,
      category: row.category,
      title: row.title,
      indication: row.indication,
      performing: row.performing,
      urgent: row.urgent,
      status: row.status,
      ordered: this.stamp(row.createdAt),
      orderingName: row.orderingName,
      clinicName: row.organisation.displayName,
      branch: this.branch(row.branch),
      patientName: row.patient.fullName,
      mrn: row.patient.mrn,
      consultation: row.encounter?.status === 'signed' ? { id: row.encounter.id, reference: row.encounter.reference } : null,
      items: row.items,
      steps: orderSteps(row.events),
      result: releasedResult(row, reviewed?.createdAt ?? null),
    }
  }

  async orders(accountId: string, query: OrderListQuery) {
    const where: Prisma.DiagnosticOrderWhereInput = {
      patientId: { in: await this.patientIds(accountId) },
      ...(query.scope === 'results' ? { status: { in: [...RESULT_STATUSES] } } : {}),
    }
    const [total, rows] = await Promise.all([
      this.prisma.diagnosticOrder.count({ where }),
      this.prisma.diagnosticOrder.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: orderSelect }),
    ])
    return { items: rows.map((row) => this.order(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async orderDetail(accountId: string, id: string) {
    const row = await this.prisma.diagnosticOrder.findFirst({ where: { id, patientId: { in: await this.patientIds(accountId) } }, select: orderSelect })
    if (!row) throw notFound('Order not found.')
    return this.order(row)
  }

  // ── Care plans, without the care team's internal reviews ──

  private carePlan(row: CarePlanRow) {
    return {
      id: row.id,
      reference: row.reference,
      title: row.title,
      category: row.category,
      rationale: row.rationale,
      status: row.status,
      startDate: day(row.startDate),
      nextReview: day(row.nextReview),
      targetDate: day(row.targetDate),
      diagnoses: row.diagnoses as Array<{ icd: string; name: string }>,
      education: row.education,
      started: this.stamp(row.createdAt),
      updated: this.stamp(row.updatedAt),
      clinicName: row.organisation.displayName,
      branch: this.branch(row.patient.homeBranch),
      lead: row.leadPractitioner,
      patientName: row.patient.fullName,
      mrn: row.patient.mrn,
      goals: row.goals,
      interventions: row.interventions,
    }
  }

  async carePlans(accountId: string, query: RecordListQuery) {
    const where: Prisma.CarePlanWhereInput = { patientId: { in: await this.patientIds(accountId) } }
    const [total, rows] = await Promise.all([
      this.prisma.carePlan.count({ where }),
      this.prisma.carePlan.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: carePlanSelect }),
    ])
    return { items: rows.map((row) => this.carePlan(row)), page: query.page, pageSize: query.pageSize, total }
  }

  async carePlanDetail(accountId: string, id: string) {
    const row = await this.prisma.carePlan.findFirst({ where: { id, patientId: { in: await this.patientIds(accountId) } }, select: carePlanSelect })
    if (!row) throw notFound('Care plan not found.')
    return this.carePlan(row)
  }

  // ── The health hub and the combined timeline ──

  async history(accountId: string) {
    return (await this.timeline(accountId, HISTORY_PER_KIND)).slice(0, HISTORY_PER_KIND)
  }

  // The newest `take` records of each kind, merged and sorted newest first.
  private async timeline(accountId: string, take: number): Promise<HistoryEntry[]> {
    const ids = await this.patientIds(accountId)
    const mine = { patientId: { in: ids } }
    const [encounters, prescriptions, orders, plans] = await Promise.all([
      this.prisma.encounter.findMany({ where: this.signed(ids), orderBy: { signedAt: 'desc' }, take, select: { id: true, signedAt: true, type: true, reason: true, practitioner: { select: { displayName: true } }, signedBy: { select: { fullName: true } }, ...clinic } }),
      this.prisma.prescription.findMany({ where: mine, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, prescriberName: true, items: { orderBy: { position: 'asc' }, select: { name: true, strength: true } }, ...clinic } }),
      this.prisma.diagnosticOrder.findMany({
        where: mine,
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, createdAt: true, title: true, status: true, orderingName: true, events: { where: { action: 'reviewed' }, select: { createdAt: true } }, ...clinic },
      }),
      this.prisma.carePlan.findMany({ where: mine, orderBy: { createdAt: 'desc' }, take, select: { id: true, createdAt: true, title: true, leadPractitioner: { select: { displayName: true } }, ...clinic } }),
    ])
    const entries: HistoryEntry[] = [
      ...encounters.map((row) => ({ kind: 'consultation' as const, id: row.id, at: row.signedAt!.toISOString(), title: row.type, detail: [row.practitioner?.displayName ?? row.signedBy?.fullName, row.reason].filter(Boolean).join(' · '), clinicName: row.organisation.displayName })),
      ...prescriptions.map((row) => ({ kind: 'prescription' as const, id: row.id, at: row.createdAt.toISOString(), title: row.items.map((item) => `${item.name} ${item.strength}`).join(', '), detail: row.prescriberName, clinicName: row.organisation.displayName })),
      ...orders.map((row) => {
        const reviewed = row.events[0]?.createdAt
        return reviewed
          ? { kind: 'result' as const, id: row.id, at: reviewed.toISOString(), title: row.title, detail: 'Result reviewed by your doctor', clinicName: row.organisation.displayName }
          : { kind: 'order' as const, id: row.id, at: row.createdAt.toISOString(), title: row.title, detail: `Ordered by ${row.orderingName}`, clinicName: row.organisation.displayName }
      }),
      ...plans.map((row) => ({ kind: 'care_plan' as const, id: row.id, at: row.createdAt.toISOString(), title: row.title, detail: row.leadPractitioner.displayName, clinicName: row.organisation.displayName })),
    ]
    return entries.sort(newestFirst)
  }

  async overview(accountId: string) {
    const ids = await this.patientIds(accountId)
    const mine = { patientId: { in: ids } }
    const [consultations, prescriptions, activePrescriptions, orders, openOrders, results, reportsReady, carePlans, activePlans, recent] = await Promise.all([
      this.prisma.encounter.count({ where: this.signed(ids) }),
      this.prisma.prescription.count({ where: mine }),
      this.prisma.prescription.count({ where: { ...mine, status: 'active' } }),
      this.prisma.diagnosticOrder.count({ where: mine }),
      this.prisma.diagnosticOrder.count({ where: { ...mine, status: { in: [...OPEN_ORDER_STATUSES] } } }),
      this.prisma.diagnosticOrder.count({ where: { ...mine, status: { in: [...RESULT_STATUSES] } } }),
      this.prisma.diagnosticOrder.count({ where: { ...mine, status: 'reviewed' } }),
      this.prisma.carePlan.count({ where: mine }),
      this.prisma.carePlan.count({ where: { ...mine, status: { in: ['on_track', 'at_risk'] } } }),
      this.timeline(accountId, 5),
    ])
    return {
      counts: { consultations, prescriptions, activePrescriptions, orders, openOrders, results, reportsReady, carePlans, activePlans },
      latest: Object.fromEntries((['consultation', 'prescription', 'result', 'order', 'care_plan'] as const).map((kind) => [kind, recent.find((entry) => entry.kind === kind) ?? null])),
      recent: recent.slice(0, 5),
    }
  }
}
