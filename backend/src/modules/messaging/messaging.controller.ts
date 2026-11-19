import { Body, Controller, Delete, Get, Header, HttpCode, MessageEvent, Param, Patch, Post, Put, Query, Req, Sse } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { filter, interval, map, merge, Observable } from 'rxjs'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth, Public } from '../auth/auth.decorators'
import { CurrentAccess, OrgFromQuery, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { ChannelsService } from './channels.service'
import { ConsentService } from './consent.service'
import { ConversationsService } from './conversations.service'
import {
  CHANNELS, consentQuerySchema, consentSchema, emailChannelSchema, linkConversationSchema, listConversationsSchema, listMessagesSchema, noteSchema, resolveMessageSchema,
  sendMessageSchema, smsChannelSchema, startConversationSchema, templateSchema, updateConversationSchema, updateTemplateSchema, whatsappChannelSchema,
} from './messaging.schemas'
import { RealtimeService } from './realtime.service'
import { TemplatesService } from './templates.service'
import { WebhooksService } from './webhooks.service'

const channelParam = z.enum(CHANNELS)
const CHANNEL_SCHEMAS = { whatsapp: whatsappChannelSchema, sms: smsChannelSchema, email: emailChannelSchema }
const HEARTBEAT_MS = 25_000

// Channels, templates, consent and the sending log.
@Controller({ path: 'messaging', version: '1' })
export class MessagingController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly templates: TemplatesService,
    private readonly consent: ConsentService,
    private readonly conversations: ConversationsService,
    private readonly realtime: RealtimeService,
  ) {}

  // Connecting a clinic's WhatsApp number, SMS sender or mail server is an organisation setting.
  @Get('channels')
  @RequirePermissions('settings.organisation')
  async listChannels(@CurrentAccess() access: AccessContext) {
    return { data: await this.channels.list(access.orgId) }
  }

  @Put('channels/:channel')
  @RequirePermissions('settings.organisation')
  async saveChannel(@Param('channel') channel: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const name = parse(channelParam, channel)
    return { data: await this.channels.save(access, name, parse(CHANNEL_SCHEMAS[name], body), auth.userId, client) }
  }

  @Delete('channels/:channel')
  @RequirePermissions('settings.organisation')
  async disconnect(@Param('channel') channel: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.channels.disconnect(access, parse(channelParam, channel), auth.userId, client) }
  }

  @Get('templates')
  @RequirePermissions('growth.view')
  async listTemplates(@CurrentAccess() access: AccessContext) {
    return { data: await this.templates.list(access.orgId) }
  }

  @Post('templates')
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async createTemplate(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.templates.create(access, parse(templateSchema, body), auth.userId, client) }
  }

  @Patch('templates/:id')
  @RequirePermissions('growth.manage')
  async updateTemplate(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.templates.update(access, parse(uuid, id), parse(updateTemplateSchema, body), auth.userId, client) }
  }

  @Get('consents')
  @RequirePermissions('growth.view')
  async consentHistory(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { channel, address } = parse(consentQuerySchema, query)
    return { data: await this.consent.history(access.orgId, channel, address) }
  }

  @Post('consents')
  @HttpCode(201)
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async recordConsent(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.consent.record(access, parse(consentSchema, body), auth.userId, client) }
  }

  // Delivery problems across conversations: failed and unknown-outcome messages.
  @Get('messages')
  @RequirePermissions('growth.view')
  async messages(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.conversations.listMessages(access, parse(listMessagesSchema, query))
    return { data: items, meta }
  }

  @Post('messages/:id/retry')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async retry(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.retry(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('messages/:id/resolve')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async resolve(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.resolve(access, parse(uuid, id), parse(resolveMessageSchema, body), auth.userId, client) }
  }

  // Server-Sent Events: "this conversation changed", for the conversations this person may see. The browser reloads
  // what it shows; no message content travels on the stream.
  @Sse('stream')
  @OrgFromQuery()
  @RequirePermissions('growth.view')
  stream(@CurrentAccess() access: AccessContext): Observable<MessageEvent> {
    const visible = (branchId: string | null) => access.branchScope === 'all' || (branchId !== null && access.branchScope.includes(branchId))
    const events = this.realtime.stream().pipe(
      filter((event) => event.orgId === access.orgId && visible(event.branchId)),
      map((event) => ({ type: event.type, data: { conversationId: event.conversationId, messageId: event.messageId ?? null } }) satisfies MessageEvent),
    )
    // Keeps proxies from closing an idle connection.
    const heartbeat = interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'heartbeat', data: {} }) satisfies MessageEvent))
    return merge(events, heartbeat)
  }
}

@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.conversations.list(access, parse(listConversationsSchema, query))
    return { data: items, meta }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async start(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.start(access, parse(startConversationSchema, body), auth.userId, client) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.conversations.get(access, parse(uuid, id)) }
  }

  @Patch(':id')
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.update(access, parse(uuid, id), parse(updateConversationSchema, body), auth.userId, client) }
  }

  @Post(':id/link')
  @HttpCode(200)
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async link(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.link(access, parse(uuid, id), parse(linkConversationSchema, body), auth.userId, client) }
  }

  @Post(':id/notes')
  @HttpCode(201)
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async note(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext) {
    return { data: await this.conversations.addNote(access, parse(uuid, id), parse(noteSchema, body).text, auth.userId) }
  }

  @Post(':id/messages')
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async send(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.conversations.send(access, parse(uuid, id), parse(sendMessageSchema, body), auth.userId, client) }
  }
}

// Called by Meta and MSG91, not by people: no session. The token in the path names the channel.
@Controller({ path: 'webhooks', version: '1' })
@Public()
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('whatsapp/:token')
  @Header('Content-Type', 'text/plain')
  challenge(@Param('token') token: string, @Query() query: Record<string, unknown>) {
    return this.webhooks.whatsappChallenge(token, query)
  }

  @Post('whatsapp/:token')
  @HttpCode(200)
  async whatsapp(@Param('token') token: string, @Req() req: RawBodyRequest<Request>, @Body() body: unknown) {
    return { data: await this.webhooks.whatsapp(token, req.rawBody, req.get('x-hub-signature-256'), body) }
  }

  @Post('msg91/:token')
  @HttpCode(200)
  async msg91(@Param('token') token: string, @Body() body: unknown) {
    return { data: await this.webhooks.msg91(token, body) }
  }
}
