import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { AudiencesService } from './audiences.service'
import {
  broadcastPreviewSchema, campaignSchema, countAudienceSchema, createAudienceSchema, launchBroadcastSchema, listAudiencesSchema, listCampaignsSchema, listRunsSchema, pauseWorkflowSchema,
  spendSchema, updateAudienceSchema, updateCampaignSchema, updateWorkflowSchema, workflowSchema, workflowStateSchema,
} from './campaigns.schemas'
import { CampaignsService } from './campaigns.service'
import { WorkflowsService } from './workflows.service'

// Rule-based audiences over leads and patients.
@Controller({ path: 'audiences', version: '1' })
export class AudiencesController {
  constructor(private readonly audiences: AudiencesService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.audiences.list(access, parse(listAudiencesSchema, query))
    return { data: items, meta }
  }

  // Counts unsaved rules too, so the form can show the size before saving.
  @Post('count')
  @HttpCode(200)
  @RequirePermissions('growth.view')
  async count(@Body() body: unknown, @CurrentAccess() access: AccessContext) {
    const { rules, branchId } = parse(countAudienceSchema, body)
    return { data: await this.audiences.count(access, rules, branchId) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.audiences.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.audiences.create(access, parse(createAudienceSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('growth.manage')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.audiences.update(access, parse(uuid, id), parse(updateAudienceSchema, body), auth.userId, client) }
  }
}

@Controller({ path: 'campaigns', version: '1' })
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.campaigns.list(access, parse(listCampaignsSchema, query))
    return { data: items, meta }
  }

  // The fixed paths are declared before ':id' so they are not read as campaign ids.
  @Get('options')
  @RequirePermissions('growth.view')
  async options(@CurrentAccess() access: AccessContext) {
    return { data: await this.campaigns.options(access) }
  }

  @Get('owners')
  @RequirePermissions('growth.view')
  async owners(@CurrentAccess() access: AccessContext) {
    return { data: await this.campaigns.owners(access) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.campaigns.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.campaigns.create(access, parse(campaignSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('growth.manage')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.campaigns.update(access, parse(uuid, id), parse(updateCampaignSchema, body), auth.userId, client) }
  }

  @Post(':id/spend')
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async spend(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.campaigns.addSpend(access, parse(uuid, id), parse(spendSchema, body), auth.userId, client) }
  }

  @Post(':id/broadcasts/preview')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async preview(@Param('id') id: string, @Body() body: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.campaigns.previewBroadcast(access, parse(uuid, id), parse(broadcastPreviewSchema, body)) }
  }

  @Post(':id/broadcasts')
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async launch(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.campaigns.launchBroadcast(access, parse(uuid, id), parse(launchBroadcastSchema, body), auth.userId, client) }
  }

  @Post(':id/broadcasts/:broadcastId/cancel')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async cancel(@Param('id') id: string, @Param('broadcastId') broadcastId: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.campaigns.cancelBroadcast(access, parse(uuid, id), parse(uuid, broadcastId), auth.userId, client) }
  }
}

@Controller({ path: 'workflows', version: '1' })
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.workflows.list(access) }
  }

  @Get('runs')
  @RequirePermissions('growth.view')
  async runs(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.workflows.runs(access, parse(listRunsSchema, query))
    return { data: items, meta }
  }

  @Get('owners')
  @RequirePermissions('growth.view')
  async owners(@CurrentAccess() access: AccessContext) {
    return { data: await this.workflows.owners(access) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.workflows.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.workflows.create(access, parse(workflowSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('growth.manage')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.workflows.update(access, parse(uuid, id), parse(updateWorkflowSchema, body), auth.userId, client) }
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async activate(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.workflows.activate(access, parse(uuid, id), parse(workflowStateSchema, body).version, auth.userId, client) }
  }

  @Post(':id/pause')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async pause(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.workflows.pause(access, parse(uuid, id), parse(pauseWorkflowSchema, body).version, auth.userId, client) }
  }
}
