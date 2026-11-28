import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { AccessContext, AuthContext, ClientInfo, PatientContext } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { PATIENT_LIMITS } from '../patient-auth/patient.limits'
import { CurrentPatient, PatientRealm } from '../patient-auth/patient.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { RefillsService } from './refills.service'
import {
  openTicketSchema,
  patientListSchema,
  patientMessageSchema,
  refillDecisionSchema,
  refillQueueSchema,
  refillRequestSchema,
  staffReplySchema,
  ticketQueueSchema,
  ticketStatusSchema,
} from './requests.schemas'
import { SupportService } from './support.service'

@Controller({ path: 'patient', version: '1' })
@PatientRealm()
export class PatientRequestsController {
  constructor(
    private readonly refills: RefillsService,
    private readonly support: SupportService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post('prescriptions/:id/refill-requests')
  @HttpCode(201)
  async requestRefill(@Param('id') id: string, @Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    const input = parse(refillRequestSchema, body ?? {})
    await this.rateLimit.consume(PATIENT_LIMITS.requestsAccount, patient.accountId)
    return { data: await this.refills.request(patient.accountId, parse(uuid, id), input.note, client) }
  }

  @Post('refill-requests/:id/cancel')
  @HttpCode(200)
  async cancelRefill(@Param('id') id: string, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    return { data: await this.refills.cancel(patient.accountId, parse(uuid, id), client) }
  }

  @Get('support-tickets')
  @Header('Cache-Control', 'no-store')
  async tickets(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.support.patientTickets(patient.accountId, parse(patientListSchema, query))
    return { data: items, meta }
  }

  @Post('support-tickets')
  @HttpCode(201)
  async openTicket(@Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    const input = parse(openTicketSchema, body)
    await this.rateLimit.consume(PATIENT_LIMITS.requestsAccount, patient.accountId)
    return { data: await this.support.open(patient.accountId, input, client) }
  }

  @Get('support-tickets/:id')
  @Header('Cache-Control', 'no-store')
  async ticket(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.support.patientTicket(patient.accountId, parse(uuid, id)) }
  }

  @Post('support-tickets/:id/messages')
  @HttpCode(201)
  async message(@Param('id') id: string, @Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    const input = parse(patientMessageSchema, body)
    await this.rateLimit.consume(PATIENT_LIMITS.requestsAccount, patient.accountId)
    return { data: await this.support.patientMessage(patient.accountId, parse(uuid, id), input.body, client) }
  }
}

// The pharmacy and clinicians work refill requests; deciding needs dispensing or prescribing rights.
@Controller({ path: 'refill-requests', version: '1' })
export class RefillQueueController {
  constructor(private readonly refills: RefillsService) {}

  @Get()
  @RequireAnyPermission('pharmacy.view', 'clinical.read')
  async queue(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.refills.queue(access, parse(refillQueueSchema, query))
    return { data: items, meta }
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequireAnyPermission('pharmacy.dispense', 'clinical.write')
  async decide(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.refills.decide(access, parse(uuid, id), auth.userId, parse(refillDecisionSchema, body), client) }
  }
}

// The front desk answers help requests: anyone who can see patients reads them; replying needs patients.edit.
@Controller({ path: 'support-tickets', version: '1' })
export class SupportInboxController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequirePermissions('patients.view')
  async queue(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.support.queue(access, parse(ticketQueueSchema, query))
    return { data: items, meta }
  }

  @Get(':id')
  @RequirePermissions('patients.view')
  async ticket(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.support.ticket(access, parse(uuid, id)) }
  }

  @Post(':id/replies')
  @HttpCode(201)
  @RequirePermissions('patients.edit')
  async reply(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.support.reply(access, parse(uuid, id), auth.userId, parse(staffReplySchema, body), client) }
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions('patients.edit')
  async status(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.support.setStatus(access, parse(uuid, id), auth.userId, parse(ticketStatusSchema, body).status, client) }
  }
}
