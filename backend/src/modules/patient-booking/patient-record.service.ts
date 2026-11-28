import { Inject, Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, unprocessable } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService, Tx } from '../../database/prisma.service'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { localDate } from '../scheduling/clinic-time'
import { ageInYears, titleFor } from './booking.logic'

export type BookingRecord =
  // The booking goes on this record, which the account can already read (or is about to be matched to).
  | { status: 'linked'; patientName: string; patientId: string | null }
  // The clinic has no record of this person: booking registers one.
  | { status: 'new_record'; patientName: string }
  | { status: 'profile_incomplete'; missing: string[] }
  // A record might be theirs, but only the clinic can say so.
  | { status: 'code_required' }

const codeRequired = () =>
  conflict('CLINIC_CODE_REQUIRED', 'This clinic may already have a record for you. Ask the reception desk for a connection code, then enter it under Profile › Security.')

const PROFILE_FIELDS = { dateOfBirth: 'date of birth', gender: 'gender', pinCode: 'PIN code' } as const

// Decides which clinic record an app booking belongs to. Getting this wrong would put one person's visit on
// another's file, so anything uncertain is sent to the clinic rather than guessed.
@Injectable()
export class PatientRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: PatientLinksService,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // What would happen if the account booked at this organisation now. Reads only.
  async preview(accountId: string, orgId: string): Promise<BookingRecord> {
    const account = await this.account(this.prisma, accountId)
    const linked = await this.linkedRecord(this.prisma, accountId, orgId, account.dateOfBirth)
    if (linked === 'ambiguous') return { status: 'code_required' }
    if (linked) return { status: 'linked', patientId: linked.id, patientName: linked.fullName }

    const missing = this.missing(account)
    if (missing.length) return { status: 'profile_incomplete', missing }
    const [matches, earlierLinks] = await Promise.all([
      this.sameIdentity(this.prisma, orgId, account.mobile!, account.dateOfBirth!),
      this.prisma.patientLink.count({ where: { accountId, orgId } }),
    ])
    if (!matches.length && !earlierLinks) return { status: 'new_record', patientName: account.fullName }
    const [only, ...others] = matches
    // The same rule that links records automatically (PatientLinksService.autoLink).
    if (only && !others.length && !earlierLinks && only.status === 'active' && only.appLinks.length === 0) return { status: 'linked', patientId: null, patientName: only.fullName }
    return { status: 'code_required' }
  }

  // Links a matching record first, so the transaction that books only has to look for the link.
  async matchExisting(accountId: string, client: ClientInfo) {
    await this.links.autoLink(accountId, client)
  }

  // The record to book on, inside the booking transaction: if the booking fails, a new record is rolled back too.
  async forBooking(tx: Tx, accountId: string, orgId: string, branchId: string, client: ClientInfo): Promise<{ patientId: string; created: boolean }> {
    // One booking at a time per account, so two quick taps cannot register the same person twice.
    await tx.$queryRaw`select id from patient_accounts where id = ${accountId}::uuid for update`
    const account = await this.account(tx, accountId)
    const linked = await this.linkedRecord(tx, accountId, orgId, account.dateOfBirth)
    if (linked === 'ambiguous') throw codeRequired()
    if (linked) return { patientId: linked.id, created: false }

    const missing = this.missing(account)
    if (missing.length) {
      throw unprocessable('PROFILE_INCOMPLETE', `Add your ${missing.join(', ')} in your profile before booking. The clinic needs them to register you.`)
    }
    const matches = await this.sameIdentity(tx, orgId, account.mobile!, account.dateOfBirth!)
    if (matches.length || (await tx.patientLink.count({ where: { accountId, orgId } }))) throw codeRequired()

    const today = localDate(new Date(), this.env.CLINIC_TIMEZONE)
    const mrn = formatNumber('PT-', await this.counters.next(tx, orgId, 'patient_mrn'))
    const alerts = account.consents[0]?.granted ?? false
    const patient = await tx.patient.create({
      data: {
        orgId,
        mrn,
        title: titleFor(account.gender!, ageInYears(account.dateOfBirth!.toISOString().slice(0, 10), today)),
        fullName: account.fullName,
        mobile: account.mobile!,
        email: account.email,
        addressLine: account.addressLine,
        city: account.city,
        state: account.state,
        pinCode: account.pinCode!,
        dateOfBirth: account.dateOfBirth!,
        gender: account.gender!,
        bloodGroup: account.bloodGroup,
        emergencyName: account.emergencyName,
        emergencyRelation: account.emergencyRelation,
        emergencyPhone: account.emergencyPhone,
        notifyWhatsapp: alerts,
        notifySms: alerts,
        homeBranchId: branchId,
      },
      select: { id: true },
    })
    await tx.patientLink.create({ data: { accountId, orgId, patientId: patient.id, method: 'self_registered' } })
    await this.audit.record({ action: 'patient.registered', entityType: 'patient', entityId: patient.id, orgId, details: { mrn, accountId, source: 'patient_app' } }, client, tx)
    return { patientId: patient.id, created: true }
  }

  private async account(db: Tx | PrismaService, accountId: string) {
    return db.patientAccount.findUniqueOrThrow({
      where: { id: accountId },
      include: { consents: { where: { purpose: 'visit_alerts' }, orderBy: { createdAt: 'desc' }, take: 1, select: { granted: true } } },
    })
  }

  private missing(account: { dateOfBirth: Date | null; gender: string | null; pinCode: string | null }) {
    return (Object.keys(PROFILE_FIELDS) as Array<keyof typeof PROFILE_FIELDS>).filter((field) => !account[field]).map((field) => PROFILE_FIELDS[field])
  }

  // An account may hold more than one record at a clinic (a relative's, opened with a desk code). With one link,
  // that is the record; with several, only a single match on the account holder's date of birth is safe.
  private async linkedRecord(db: Tx | PrismaService, accountId: string, orgId: string, dateOfBirth: Date | null) {
    const links = await db.patientLink.findMany({
      where: { accountId, orgId, revokedAt: null },
      select: { patient: { select: { id: true, fullName: true, dateOfBirth: true } } },
    })
    if (links.length === 0) return null
    if (links.length === 1) return links[0]!.patient
    const own = links.filter((link) => link.patient.dateOfBirth.getTime() === dateOfBirth?.getTime())
    return own.length === 1 ? own[0]!.patient : 'ambiguous'
  }

  private sameIdentity(db: Tx | PrismaService, orgId: string, mobile: string, dateOfBirth: Date) {
    return db.patient.findMany({
      where: { orgId, mobile, dateOfBirth },
      select: { id: true, fullName: true, status: true, appLinks: { where: { revokedAt: null }, select: { id: true } } },
    })
  }
}
