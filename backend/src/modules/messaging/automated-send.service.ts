import { Injectable } from '@nestjs/common'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { Tx } from '../../database/prisma.service'
import type { MessageChannel, MessageOrigin } from '../../generated/prisma/client'
import { ConsentService } from './consent.service'
import { AutomatedSkip, missingVariables, normaliseAddress, preview, renderTemplate, sendBlock, templateVariables } from './messaging.logic'

const WEEK_MS = 7 * 24 * 3_600_000

// The person a broadcast or workflow writes to.
export interface AutomatedContact {
  leadId: string | null
  patientId: string | null
  branchId: string | null
  // First name or alias, for {{preferred_name}}.
  preferredName: string
  mobile: string | null
  email: string | null
  // The patient's WhatsApp / SMS notification settings; null for a lead.
  notify: { whatsapp: boolean; sms: boolean } | null
}

export interface AutomatedTemplate {
  id: string
  category: string
  channel: MessageChannel
  subject: string | null
  body: string
  status: string
  providerRef: string | null
  version: number
}

export interface AutomatedSend {
  orgId: string
  template: AutomatedTemplate
  contact: AutomatedContact
  // Everything except preferred_name: clinic name, fixed values and per-event values (appointment date, …).
  variables: Record<string, string>
  origin: Exclude<MessageOrigin, 'manual'>
  weeklyCap: number
  actorUserId: string | null
  now?: Date
}

export type AutomatedResult =
  | { queued: true; address: string; messageId: string; conversationId: string; branchId: string | null }
  | { queued: false; address: string | null; reason: AutomatedSkip }

export function contactAddress(channel: MessageChannel, contact: Pick<AutomatedContact, 'mobile' | 'email'>) {
  const raw = channel === 'email' ? contact.email : contact.mobile
  return raw ? normaliseAddress(channel, raw) : null
}

export const notificationSetting = (channel: MessageChannel, notify: AutomatedContact['notify']) =>
  notify ? (channel === 'whatsapp' ? notify.whatsapp : channel === 'sms' ? notify.sms : null) : null

// Queues one automated message after the same checks as the inbox (consent, opt-out, approved template, every
// variable filled) plus the weekly limit on automated messages to one person. Runs inside the caller's transaction,
// so the caller's own record (broadcast recipient, workflow run) is written with it or not at all.
@Injectable()
export class AutomatedSendService {
  constructor(
    private readonly counters: CountersRepository,
    private readonly consent: ConsentService,
  ) {}

  async queue(tx: Tx, input: AutomatedSend): Promise<AutomatedResult> {
    const { orgId, template, contact } = input
    const channel = template.channel
    const now = input.now ?? new Date()
    const address = contactAddress(channel, contact)
    if (!address) return { queued: false, address: null, reason: 'NO_ADDRESS' }

    // One automated sender at a time per address, so two workflows cannot both pass the weekly limit.
    const lockKey = `${orgId}:${address}`
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${lockKey}))`

    const consent = await this.consent.current(orgId, channel, address, tx)
    const block = sendBlock({ channel, consent, freeText: false, template, patientNotifications: notificationSetting(channel, contact.notify), windowOpen: false })
    if (block) return { queued: false, address, reason: block }

    const values: Record<string, string> = { ...input.variables, preferred_name: contact.preferredName }
    if (missingVariables(template.body, values).length) return { queued: false, address, reason: 'VARIABLES_MISSING' }

    // WhatsApp and SMS share the mobile number, so the limit is per person rather than per channel.
    const recent = await tx.message.count({
      where: { orgId, origin: { in: ['broadcast', 'workflow'] }, createdAt: { gt: new Date(now.getTime() - WEEK_MS) }, conversation: { address } },
    })
    if (recent >= input.weeklyCap) return { queued: false, address, reason: 'WEEKLY_CAP' }

    const conversation = await this.conversation(tx, orgId, channel, address, contact)
    const body = renderTemplate(template.body, values)
    const message = await tx.message.create({
      data: {
        orgId, conversationId: conversation.id, direction: 'outbound', status: 'queued', body, subject: template.subject, templateId: template.id, templateVersion: template.version,
        parameters: templateVariables(template.body).map((name) => values[name]!), nextAttemptAt: now, sentById: input.actorUserId, origin: input.origin,
      },
      select: { id: true },
    })
    await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now, preview: preview(body) } })
    return { queued: true, address, messageId: message.id, conversationId: conversation.id, branchId: conversation.branchId }
  }

  // The conversation for this address and channel; a new one is linked to the lead or patient.
  private async conversation(tx: Tx, orgId: string, channel: MessageChannel, address: string, contact: AutomatedContact) {
    const existing = await tx.conversation.findUnique({ where: { orgId_channel_address: { orgId, channel, address } }, select: { id: true, branchId: true, leadId: true, patientId: true } })
    const link = contact.patientId ? { patientId: contact.patientId } : { leadId: contact.leadId }
    if (existing) {
      if (existing.leadId || existing.patientId) return existing
      return tx.conversation.update({ where: { id: existing.id }, data: { ...link, branchId: contact.branchId, version: { increment: 1 } }, select: { id: true, branchId: true } })
    }
    const number = formatNumber('CV-', await this.counters.next(tx, orgId, 'conversation'))
    return tx.conversation.create({ data: { orgId, number, channel, address, branchId: contact.branchId, ...link }, select: { id: true, branchId: true } })
  }
}
