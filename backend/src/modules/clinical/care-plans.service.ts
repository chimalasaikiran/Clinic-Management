import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import { localDate } from '../scheduling/clinic-time'
import { compliance, completionProblem, planStatus, reviewSummary } from './care-plans.logic'
import { CarePlanRow, CarePlansRepository } from './care-plans.repository'
import type { CarePlanReviewInput, CreateCarePlanInput } from './care-plans.schemas'
import { ClinicalRepository } from './clinical.repository'
import { ClinicalService } from './clinical.service'

const day = (date: Date) => date.toISOString().slice(0, 10)
const asDate = (value: string) => new Date(`${value}T00:00:00Z`)

@Injectable()
export class CarePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: CarePlansRepository,
    private readonly clinical: ClinicalService,
    private readonly clinicalRecords: ClinicalRepository,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  view = (row: CarePlanRow) => ({
    ...row,
    startDate: day(row.startDate),
    nextReview: day(row.nextReview),
    targetDate: day(row.targetDate),
    diagnoses: row.diagnoses as Array<{ icd: string; name: string }>,
    lead: row.leadPractitioner,
    leadPractitioner: undefined,
    createdBy: row.createdBy.fullName,
    created: this.clinical.stamp(row.createdAt),
    createdAt: undefined,
    // Who last touched the plan: the latest review's author, or whoever activated it.
    updated: { date: localDate(row.updatedAt, this.env.CLINIC_TIMEZONE), by: row.reviews[0]?.author.fullName ?? row.createdBy.fullName },
    updatedAt: undefined,
    reviews: row.reviews.map((review) => ({ id: review.id, kind: review.kind, observation: review.observation, summary: review.summary, barriers: review.barriers, author: review.author.fullName, at: this.clinical.stamp(review.createdAt) })),
  })

  async forPatient(orgId: string, patientId: string) {
    return (await this.plans.forPatient(orgId, patientId)).map(this.view)
  }

  async create(access: AccessContext, patientId: string, actorUserId: string, input: CreateCarePlanInput, client: ClientInfo) {
    await this.clinical.visiblePatient(access, patientId)
    if (!(await this.plans.activePractitioner(access.orgId, input.leadPractitionerId))) throw unprocessable('PRACTITIONER_INVALID', 'Choose an active therapist as the responsible clinician.')

    const id = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('CP-', await this.counters.next(tx, access.orgId, 'care_plan_reference'))
      const created = await this.plans.create(tx, {
        orgId: access.orgId,
        reference,
        patientId,
        leadPractitionerId: input.leadPractitionerId,
        title: input.title,
        category: input.category,
        rationale: input.rationale,
        startDate: asDate(input.startDate),
        nextReview: asDate(input.nextReview),
        targetDate: asDate(input.targetDate),
        diagnoses: input.diagnoses,
        education: input.education,
        whatsapp: input.whatsapp,
        createdById: actorUserId,
        goals: { create: input.goals.map((goal, position) => ({ ...goal, position })) },
        interventions: { create: input.interventions.map((entry, position) => ({ ...entry, position })) },
      })
      await this.audit.record({ action: 'care_plan.activated', entityType: 'care_plan', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference, goals: input.goals.length } }, client, tx)
      return created.id
    })
    return this.view((await this.plans.find(access.orgId, id))!)
  }

  // Records a progress review. The server works out compliance and status; completing a follow-up has stricter
  // rules, and escalating raises a high-severity alert on the chart in the same transaction.
  async review(access: AccessContext, id: string, actorUserId: string, input: CarePlanReviewInput, client: ClientInfo) {
    const plan = await this.find(access, id)
    if (input.adherence.length && input.adherence.length !== plan.interventions.length) throw unprocessable('ADHERENCE_MISMATCH', 'Give an adherence state for each intervention.')
    const goals = plan.goals.map((goal) => ({ ...goal, status: input.goalStatus[goal.id] || goal.status, observation: input.goalNote[goal.id] ?? goal.observation }))
    const statuses = goals.map((goal) => goal.status)
    const escalate = input.mode === 'escalate' || input.escalate
    if (input.mode === 'complete') {
      const problem = completionProblem(goals, input.nextReview, localDate(new Date(), this.env.CLINIC_TIMEZONE), escalate)
      if (problem) throw unprocessable('REVIEW_INCOMPLETE', problem)
    }
    const summary = reviewSummary(goals)
    const detail = `${input.observation} (${summary})${input.barriers.length ? ` Barriers: ${input.barriers.join(', ')}.` : ''}`

    await this.prisma.transaction(async (tx) => {
      const changed = await this.plans.updateIfVersion(tx, id, input.version, {
        compliance: compliance(statuses),
        status: planStatus(statuses),
        ...(input.mode === 'complete' && input.nextReview ? { nextReview: asDate(input.nextReview) } : {}),
      })
      if (changed === 0) throw conflict('CARE_PLAN_CHANGED', 'Someone else reviewed this care plan first. Reload to see their changes.')
      for (const goal of goals) await this.plans.updateGoal(tx, goal.id, { status: goal.status, observation: goal.observation })
      for (const [index, entry] of plan.interventions.entries()) {
        const state = input.adherence[index]
        if (state && state !== entry.state) await this.plans.updateIntervention(tx, entry.id, state)
      }
      await this.plans.addReview(tx, { carePlanId: id, kind: input.mode === 'complete' ? 'completed' : escalate ? 'escalated' : 'progress', observation: input.observation, summary, barriers: input.barriers, authorId: actorUserId })
      if (escalate) {
        await this.clinicalRecords.createAlert(tx, {
          orgId: access.orgId, patientId: plan.patientId, kind: 'CLINICAL FLAG: CARE PLAN ESCALATION', title: `Care plan escalated for attending review — ${plan.title}`,
          severity: 'high', detail, statement: `The ${plan.reference} review was escalated to ${plan.leadPractitioner.displayName}.`, createdById: actorUserId,
        })
      }
      await this.audit.record({ action: 'care_plan.reviewed', entityType: 'care_plan', entityId: id, orgId: access.orgId, actorUserId, details: { mode: input.mode, escalated: escalate } }, client, tx)
    })
    return this.view((await this.plans.find(access.orgId, id))!)
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.plans.find(access.orgId, id)
    if (!row) throw notFound('Care plan not found.')
    await this.clinical.visiblePatient(access, row.patientId).catch(() => {
      throw notFound('Care plan not found.')
    })
    return row
  }
}
