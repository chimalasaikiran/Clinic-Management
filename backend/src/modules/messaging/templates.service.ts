import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { CountersRepository, formatNumber } from '../../database/counters.repository'
import { PrismaService } from '../../database/prisma.service'
import { templateVariables, unknownVariables } from './messaging.logic'
import type { TemplateInput, UpdateTemplateInput } from './messaging.schemas'

const templateSelect = {
  id: true, code: true, name: true, category: true, channel: true, locale: true, subject: true, body: true, status: true, providerRef: true, version: true, changeNote: true, updatedAt: true,
  updatedBy: { select: { fullName: true } },
} as const

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: CountersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string) {
    const rows = await this.prisma.messageTemplate.findMany({ where: { orgId }, orderBy: [{ status: 'asc' }, { name: 'asc' }], select: templateSelect })
    return rows.map(({ updatedBy, ...row }) => ({ ...row, variables: templateVariables(row.body), updatedBy: updatedBy?.fullName ?? null }))
  }

  async create(access: AccessContext, input: TemplateInput, actorUserId: string, client: ClientInfo) {
    this.check(input)
    const id = await this.prisma.transaction(async (tx) => {
      const code = formatNumber('MT-', await this.counters.next(tx, access.orgId, 'message_template'), 4)
      const created = await tx.messageTemplate.create({ data: { ...input, orgId: access.orgId, code, status: 'draft', updatedById: actorUserId }, select: { id: true } })
      await this.audit.record({ action: 'messaging.template_created', entityType: 'message_template', entityId: created.id, orgId: access.orgId, actorUserId, details: { code } }, client, tx)
      return created.id
    })
    return (await this.list(access.orgId)).find((entry) => entry.id === id)!
  }

  // Every save is a new version; messages already sent keep the version and wording they went out with.
  async update(access: AccessContext, id: string, input: UpdateTemplateInput, actorUserId: string, client: ClientInfo) {
    const current = await this.prisma.messageTemplate.findFirst({ where: { id, orgId: access.orgId }, select: { id: true } })
    if (!current) throw notFound('Template not found.')
    const { version, ...fields } = input
    this.check(fields)
    if (fields.status === 'approved' && fields.channel !== 'email' && !fields.providerRef) {
      throw unprocessable('PROVIDER_REF_REQUIRED', fields.channel === 'whatsapp' ? 'Enter the template name Meta approved before marking it approved.' : 'Enter the MSG91 / DLT template ID before marking it approved.')
    }
    const { count } = await this.prisma.messageTemplate.updateMany({ where: { id, orgId: access.orgId, version }, data: { ...fields, updatedById: actorUserId, version: { increment: 1 } } })
    if (count === 0) throw conflict('TEMPLATE_CHANGED', 'Someone else changed this template. Reload it and make your change again.')
    await this.audit.record({ action: 'messaging.template_updated', entityType: 'message_template', entityId: id, orgId: access.orgId, actorUserId, details: { version: version + 1, status: fields.status } }, client)
    return (await this.list(access.orgId)).find((entry) => entry.id === id)!
  }

  private check(input: TemplateInput) {
    const unknown = unknownVariables(input.body)
    if (unknown.length) throw unprocessable('TEMPLATE_VARIABLE_UNKNOWN', `Unknown variable${unknown.length === 1 ? '' : 's'}: ${unknown.map((name) => `{{${name}}}`).join(', ')}.`)
  }
}
