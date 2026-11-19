import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { Db, PrismaService } from '../../database/prisma.service'
import type { ConsentStatus, MessageChannel } from '../../generated/prisma/client'
import { normaliseAddress } from './messaging.logic'
import type { ConsentInput } from './messaging.schemas'

// Permission to send marketing, per contact address and channel. Entries are never edited: the latest one wins,
// and the history shows who recorded each change, how, and when.
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async current(orgId: string, channel: MessageChannel, address: string, db: Db = this.prisma): Promise<ConsentStatus | null> {
    const latest = await db.contactConsent.findFirst({ where: { orgId, channel, address }, orderBy: { createdAt: 'desc' }, select: { status: true } })
    return latest?.status ?? null
  }

  async history(orgId: string, channel: MessageChannel, rawAddress: string) {
    const address = this.address(channel, rawAddress)
    const rows = await this.prisma.contactConsent.findMany({
      where: { orgId, channel, address },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, status: true, source: true, note: true, createdAt: true, recordedBy: { select: { fullName: true } } },
    })
    return { channel, address, current: rows[0]?.status ?? null, entries: rows.map(({ recordedBy, ...row }) => ({ ...row, recordedBy: recordedBy?.fullName ?? null })) }
  }

  async record(access: AccessContext, input: ConsentInput, actorUserId: string, client: ClientInfo) {
    const address = this.address(input.channel, input.address)
    const created = await this.prisma.contactConsent.create({
      data: { orgId: access.orgId, channel: input.channel, address, status: input.status, source: input.source, note: input.note, leadId: input.leadId, patientId: input.patientId, recordedById: actorUserId },
      select: { id: true },
    })
    await this.audit.record({ action: `messaging.consent_${input.status}`, entityType: 'contact_consent', entityId: created.id, orgId: access.orgId, actorUserId, details: { channel: input.channel, source: input.source } }, client)
    return this.history(access.orgId, input.channel, address)
  }

  // A STOP or START reply from the contact.
  async recordReply(db: Db, orgId: string, channel: MessageChannel, address: string, status: ConsentStatus, text: string) {
    await db.contactConsent.create({ data: { orgId, channel, address, status, source: status === 'withdrawn' ? 'stop_reply' : 'start_reply', note: `Replied “${text.trim().slice(0, 40)}”` } })
  }

  private address(channel: MessageChannel, raw: string) {
    const address = normaliseAddress(channel, raw)
    if (!address) throw unprocessable('ADDRESS_INVALID', channel === 'email' ? 'Enter a valid email address.' : 'Enter a valid 10-digit mobile number.')
    return address
  }
}
