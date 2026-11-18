import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import type { ReferralStatus } from '../../generated/prisma/client'
import { ClinicalService } from './clinical.service'
import { ClinicianRepository } from './clinician.repository'
import { ReferralRow, ReferralsRepository } from './referrals.repository'
import { FOLLOW_UP_METHODS, FOLLOW_UP_OUTCOMES, REFERRAL_PRIORITIES, type CreateReferralInput, type FollowUpInput } from './referrals.schemas'

// Outgoing referrals still waiting on the receiving side.
const AWAITING_RESPONSE: ReferralStatus[] = ['pending_acceptance', 'info_requested']

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsRepository,
    private readonly clinical: ClinicalService,
    private readonly clinician: ClinicianRepository,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
  ) {}

  view = (row: ReferralRow, now = new Date()) => ({
    ...row,
    encounter: undefined,
    encounterReference: row.encounter?.reference ?? null,
    createdBy: row.createdBy.fullName,
    created: this.clinical.stamp(row.createdAt),
    createdAt: undefined,
    // Hours since the referral was sent, against its response window.
    elapsedHours: Math.max(0, Math.floor((now.getTime() - row.createdAt.getTime()) / 3_600_000)),
    events: row.events.map((event) => ({ id: event.id, title: event.title, text: event.text, actor: event.actor.fullName, at: this.clinical.stamp(event.createdAt) })),
  })

  async forPatient(orgId: string, patientId: string) {
    const now = new Date()
    return (await this.referrals.forPatient(orgId, patientId)).map((row) => this.view(row, now))
  }

  async create(access: AccessContext, patientId: string, actorUserId: string, input: CreateReferralInput, client: ClientInfo) {
    const scope = await this.clinical.visiblePatient(access, patientId)
    const encounter = input.encounterId ? await this.clinical.openEncounterOf(access.orgId, scope, input.encounterId, patientId) : null
    const me = await this.clinician.of(access.membershipId, actorUserId)

    let route: { facility: string; facilityNote: string; clinician: string; clinicianNote: string; targetPractitionerId: string | null }
    if (input.direction === 'outgoing') {
      const target = input.targetPractitionerId ? await this.referrals.activePractitioner(access.orgId, input.targetPractitionerId) : null
      if (input.targetPractitionerId && !target) throw unprocessable('PRACTITIONER_INVALID', 'Choose an active therapist of this organisation.')
      route = target
        ? { facility: [target.department, target.room].filter(Boolean).join(' · '), facilityNote: `${target.displayName} (${target.specialty})`, clinician: me.name, clinicianNote: me.department ?? '', targetPractitionerId: target.id }
        : { facility: input.facility, facilityNote: input.facilityNote, clinician: me.name, clinicianNote: me.department ?? '', targetPractitionerId: null }
    } else {
      route = { facility: input.facility, facilityNote: input.facilityNote, clinician: input.clinician, clinicianNote: input.clinicianNote, targetPractitionerId: null }
    }

    const id = await this.prisma.transaction(async (tx) => {
      const reference = formatNumber('REF-', await this.counters.next(tx, access.orgId, 'referral_reference'))
      const created = await this.referrals.create(tx, {
        orgId: access.orgId,
        reference,
        patientId,
        encounterId: encounter?.id ?? null,
        direction: input.direction,
        status: input.direction === 'outgoing' ? 'pending_acceptance' : 'awaiting_review',
        priority: input.priority,
        windowHours: REFERRAL_PRIORITIES[input.priority],
        model: input.model,
        specialty: input.specialty,
        indication: input.indication,
        narrative: input.narrative,
        questions: input.questions,
        attachedRecords: input.attachedRecords,
        outcome: input.direction === 'outgoing' ? 'No appointment scheduled yet' : 'Awaiting triage',
        createdById: actorUserId,
        ...route,
      })
      await this.referrals.addEvent(tx, created.id, input.direction === 'outgoing' ? 'Referral authorized and sent' : 'Referral received and logged for triage', actorUserId, `Recorded by ${me.name}`)
      await this.audit.record({ action: 'referral.created', entityType: 'referral', entityId: created.id, orgId: access.orgId, actorUserId, details: { reference, direction: input.direction } }, client, tx)
      return created.id
    })
    return this.view((await this.referrals.find(access.orgId, id))!)
  }

  // A conversation with the receiving centre about an outgoing referral; its outcome sets the status.
  async followUp(access: AccessContext, id: string, actorUserId: string, input: FollowUpInput, client: ClientInfo) {
    const referral = await this.outgoing(access, id)
    const outcome = FOLLOW_UP_OUTCOMES[input.outcome]
    await this.prisma.transaction(async (tx) => {
      const data = { status: outcome.status, ...(outcome.status === 'accepted' ? { outcome: 'Accepted by the receiving centre' } : outcome.status === 'declined' ? { outcome: 'Declined by the receiving centre' } : {}) }
      if ((await this.referrals.move(tx, id, AWAITING_RESPONSE, data)) === 0) throw conflict('REFERRAL_STATE', 'This referral is no longer waiting for a response.')
      await this.referrals.addEvent(tx, id, `${FOLLOW_UP_METHODS[input.method]} outreach — ${outcome.title}`, actorUserId, `${input.staff} spoke with ${input.representative}. ${input.notes}`)
      await this.audit.record({ action: 'referral.followed_up', entityType: 'referral', entityId: id, orgId: access.orgId, actorUserId, details: { reference: referral.reference, outcome: input.outcome } }, client, tx)
    })
    return this.view((await this.referrals.find(access.orgId, id))!)
  }

  // Closes an outgoing referral that is going nowhere, so a new one can go to a backup specialist.
  async reroute(access: AccessContext, id: string, actorUserId: string, client: ClientInfo) {
    const referral = await this.outgoing(access, id)
    await this.prisma.transaction(async (tx) => {
      if ((await this.referrals.move(tx, id, AWAITING_RESPONSE, { status: 'cancelled', outcome: 'Closed for re-routing' })) === 0) throw conflict('REFERRAL_STATE', 'This referral is no longer waiting for a response.')
      await this.referrals.addEvent(tx, id, 'Re-routed to backup specialist', actorUserId, 'Original referral closed; a new request is required for the backup panelist.')
      await this.audit.record({ action: 'referral.rerouted', entityType: 'referral', entityId: id, orgId: access.orgId, actorUserId, details: { reference: referral.reference } }, client, tx)
    })
    return this.view((await this.referrals.find(access.orgId, id))!)
  }

  // Accept or decline an incoming referral after triage.
  async triage(access: AccessContext, id: string, actorUserId: string, decision: 'accept' | 'decline', note: string, client: ClientInfo) {
    const referral = await this.find(access, id)
    if (referral.direction !== 'incoming') throw unprocessable('REFERRAL_DIRECTION', 'Only received referrals are triaged.')
    const accepted = decision === 'accept'
    await this.prisma.transaction(async (tx) => {
      const data = { status: accepted ? ('accepted' as const) : ('declined' as const), outcome: accepted ? 'Accepted for clinical intake' : 'Declined at triage' }
      if ((await this.referrals.move(tx, id, ['awaiting_review'], data)) === 0) throw conflict('REFERRAL_STATE', 'This referral has already been triaged.')
      await this.referrals.addEvent(tx, id, accepted ? 'Accepted at triage' : 'Declined at triage', actorUserId, note)
      await this.audit.record({ action: `referral.${accepted ? 'accepted' : 'declined'}`, entityType: 'referral', entityId: id, orgId: access.orgId, actorUserId, details: { reference: referral.reference } }, client, tx)
    })
    return this.view((await this.referrals.find(access.orgId, id))!)
  }

  private async outgoing(access: AccessContext, id: string) {
    const referral = await this.find(access, id)
    if (referral.direction !== 'outgoing') throw unprocessable('REFERRAL_DIRECTION', 'Only sent referrals are followed up with the receiving centre.')
    return referral
  }

  private async find(access: AccessContext, id: string) {
    const row = await this.referrals.find(access.orgId, id)
    if (!row) throw notFound('Referral not found.')
    await this.clinical.visiblePatient(access, row.patientId).catch(() => {
      throw notFound('Referral not found.')
    })
    return row
  }
}
