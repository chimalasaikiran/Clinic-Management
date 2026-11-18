import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { carePlanReviewSchema, createCarePlanSchema } from './care-plans.schemas'
import { CarePlansService } from './care-plans.service'
import { cancelOrderSchema, collectSchema, createOrderSchema, resultSchema, reviewSchema } from './orders.schemas'
import { OrdersService } from './orders.service'
import { createPrescriptionSchema, discontinueSchema } from './prescriptions.schemas'
import { PrescriptionsService } from './prescriptions.service'
import { createReferralSchema, followUpSchema, triageSchema } from './referrals.schemas'
import { ReferralsService } from './referrals.service'

// Prescriptions, diagnostic orders, referrals and care plans. They are read with the patient's chart
// (GET /patients/:id/chart, clinical.read); every change here needs clinical.write and the patient in scope.
@Controller({ version: '1' })
@RequirePermissions('clinical.write')
export class ClinicalRecordsController {
  constructor(
    private readonly prescriptions: PrescriptionsService,
    private readonly orders: OrdersService,
    private readonly referrals: ReferralsService,
    private readonly carePlans: CarePlansService,
  ) {}

  @Post('patients/:id/prescriptions')
  @HttpCode(201)
  async prescribe(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.prescriptions.create(access, parse(uuid, id), auth.userId, parse(createPrescriptionSchema, body), client) }
  }

  @Post('prescriptions/:id/discontinue')
  @HttpCode(200)
  async discontinue(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.prescriptions.discontinue(access, parse(uuid, id), auth.userId, parse(discontinueSchema, body).reason, client) }
  }

  @Post('patients/:id/orders')
  @HttpCode(201)
  async order(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.orders.create(access, parse(uuid, id), auth.userId, parse(createOrderSchema, body), client) }
  }

  @Post('orders/:id/collect')
  @HttpCode(200)
  async collect(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.orders.collect(access, parse(uuid, id), auth.userId, parse(collectSchema, body ?? {}).note, client) }
  }

  @Post('orders/:id/result')
  @HttpCode(200)
  async result(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.orders.recordResult(access, parse(uuid, id), auth.userId, parse(resultSchema, body), client) }
  }

  @Post('orders/:id/review')
  @HttpCode(200)
  async review(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.orders.review(access, parse(uuid, id), auth.userId, parse(reviewSchema, body), client) }
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.orders.cancel(access, parse(uuid, id), auth.userId, parse(cancelOrderSchema, body).reason, client) }
  }

  @Post('patients/:id/referrals')
  @HttpCode(201)
  async refer(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.referrals.create(access, parse(uuid, id), auth.userId, parse(createReferralSchema, body), client) }
  }

  @Post('referrals/:id/follow-up')
  @HttpCode(200)
  async followUp(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.referrals.followUp(access, parse(uuid, id), auth.userId, parse(followUpSchema, body), client) }
  }

  @Post('referrals/:id/reroute')
  @HttpCode(200)
  async reroute(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.referrals.reroute(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('referrals/:id/triage')
  @HttpCode(200)
  async triage(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const { decision, note } = parse(triageSchema, body)
    return { data: await this.referrals.triage(access, parse(uuid, id), auth.userId, decision, note, client) }
  }

  @Post('patients/:id/care-plans')
  @HttpCode(201)
  async plan(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.carePlans.create(access, parse(uuid, id), auth.userId, parse(createCarePlanSchema, body), client) }
  }

  @Post('care-plans/:id/reviews')
  @HttpCode(200)
  async reviewPlan(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.carePlans.review(access, parse(uuid, id), auth.userId, parse(carePlanReviewSchema, body), client) }
  }
}
