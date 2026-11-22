import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { EscalationsService } from './escalations.service'
import { ProfilesService } from './profiles.service'
import {
  decideResponseSchema, escalationSchema, listEscalationsSchema, listReviewsSchema, noteSchema, profileSchema, reportSchema, responseSchema, submitResponseSchema, syncProfileSchema, updateEscalationSchema,
} from './reviews.schemas'
import { ReviewsService } from './reviews.service'

@Controller({ path: 'branch-profiles', version: '1' })
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':branchId')
  @RequirePermissions('growth.view')
  async get(@Param('branchId') branchId: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.profiles.get(access, parse(uuid, branchId)) }
  }

  @Put(':branchId')
  @RequirePermissions('growth.manage')
  async save(@Param('branchId') branchId: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.profiles.save(access, parse(uuid, branchId), parse(profileSchema, body), auth.userId, client) }
  }

  @Post(':branchId/sync')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async sync(@Param('branchId') branchId: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.profiles.sync(access, parse(uuid, branchId), parse(syncProfileSchema, body).version, auth.userId, client) }
  }
}

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly escalations: EscalationsService,
  ) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.reviews.list(access, parse(listReviewsSchema, query))
    return { data: items, meta }
  }

  // The fixed paths are declared before ':id' so they are not read as review ids.
  @Get('report')
  @RequirePermissions('growth.view')
  async report(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.reviews.report(access, parse(reportSchema, query)) }
  }

  @Get('escalations')
  @RequirePermissions('growth.view')
  async listEscalations(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.escalations.list(access, parse(listEscalationsSchema, query))
    return { data: items, meta }
  }

  @Get('escalations/owners')
  @RequirePermissions('growth.view')
  async escalationOwners(@CurrentAccess() access: AccessContext) {
    return { data: await this.escalations.owners(access.orgId) }
  }

  @Post('escalations')
  @HttpCode(201)
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async createEscalation(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.escalations.create(access, parse(escalationSchema, body), auth.userId, client) }
  }

  @Patch('escalations/:id')
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async updateEscalation(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.escalations.update(access, parse(uuid, id), parse(updateEscalationSchema, body), auth.userId, client) }
  }

  @Post('sync/:branchId')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async sync(@Param('branchId') branchId: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.reviews.syncBranch(access, parse(uuid, branchId)) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.reviews.get(access, parse(uuid, id)) }
  }

  @Put(':id/response')
  @RequirePermissions('growth.manage')
  async saveResponse(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.reviews.saveResponse(access, parse(uuid, id), parse(responseSchema, body), auth.userId, client) }
  }

  @Post(':id/response/submit')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async submitResponse(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.reviews.submitResponse(access, parse(uuid, id), parse(submitResponseSchema, body).version, auth.userId, client) }
  }

  @Post(':id/response/decision')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async decideResponse(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.reviews.decideResponse(access, parse(uuid, id), parse(decideResponseSchema, body), auth.userId, client) }
  }

  @Post(':id/notes')
  @HttpCode(201)
  @RequireAnyPermission('growth.leads', 'growth.manage')
  async addNote(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext) {
    return { data: await this.reviews.addNote(access, parse(uuid, id), parse(noteSchema, body).text, auth.userId) }
  }
}
