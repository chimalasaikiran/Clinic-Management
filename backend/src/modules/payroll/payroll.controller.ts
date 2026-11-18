import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { AdjustmentsService } from './adjustments.service'
import { CyclesService } from './cycles.service'
import {
  adjustmentDecisionSchema, adjustmentSchema, advanceActionSchema, advanceSchema, cycleSchema, cycleVersionSchema, entrySchema, includeSchema, paymentSchema, profileSchema,
  scopeSchema, settingsSchema, updateProfileSchema, verifyBankSchema,
} from './payroll.schemas'
import { PayrollStateService } from './payroll-state.service'
import { ProfilesService } from './profiles.service'

// Payroll needs staff.payroll, a permission only organisation-wide system roles hold.
@Controller({ path: 'payroll', version: '1' })
@RequirePermissions('staff.payroll')
export class PayrollController {
  constructor(
    private readonly state: PayrollStateService,
    private readonly profiles: ProfilesService,
    private readonly cycles: CyclesService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  @Get('state')
  async read(@CurrentAccess() access: AccessContext) {
    return { data: await this.state.state(access) }
  }

  @Put('settings')
  async saveSettings(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.profiles.saveSettings(access, auth.userId, parse(settingsSchema, body), client)
    return { data: { saved: true } }
  }

  @Post('profiles')
  @HttpCode(201)
  async createProfile(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.profiles.createProfile(access, auth.userId, parse(profileSchema, body), client) } }
  }

  @Patch('profiles/:id')
  async updateProfile(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.profiles.updateProfile(access, parse(uuid, id), auth.userId, parse(updateProfileSchema, body), client)
    return { data: { id } }
  }

  @Post('profiles/:id/verify-bank')
  @HttpCode(200)
  async verifyBank(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.profiles.verifyBank(access, parse(uuid, id), auth.userId, parse(verifyBankSchema, body).version, client)
    return { data: { id } }
  }

  @Post('cycles')
  @HttpCode(201)
  async start(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.cycles.start(access, auth.userId, parse(cycleSchema, body).month, client) } }
  }

  @Put('cycles/:id/scope')
  async scope(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.cycles.setScope(access, parse(uuid, id), auth.userId, parse(scopeSchema, body), client)
    return { data: { id } }
  }

  @Post('cycles/:id/include')
  @HttpCode(200)
  async include(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const input = parse(includeSchema, body)
    await this.cycles.include(access, parse(uuid, id), auth.userId, input.entryIds, input.included, client)
    return { data: { id } }
  }

  @Post('cycles/:id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.cycles.approve(access, parse(uuid, id), auth.userId, parse(cycleVersionSchema, body).version, client)
    return { data: { id } }
  }

  @Post('cycles/:id/process')
  @HttpCode(200)
  async process(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.cycles.process(access, parse(uuid, id), auth.userId, parse(cycleVersionSchema, body).version, client) }
  }

  @Patch('entries/:id')
  async updateEntry(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.cycles.updateEntry(access, parse(uuid, id), auth.userId, parse(entrySchema, body), client)
    return { data: { id } }
  }

  @Post('entries/:id/payment')
  @HttpCode(200)
  async payment(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.cycles.recordPayment(access, parse(uuid, id), auth.userId, parse(paymentSchema, body), client)
    return { data: { id } }
  }

  @Post('adjustments')
  @HttpCode(201)
  async createAdjustment(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.adjustments.createAdjustment(access, auth.userId, parse(adjustmentSchema, body), client) }
  }

  @Post('adjustments/decide')
  @HttpCode(200)
  async decide(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.adjustments.decideAdjustments(access, auth.userId, parse(adjustmentDecisionSchema, body), client)
    return { data: { decided: true } }
  }

  @Post('advances')
  @HttpCode(201)
  async createAdvance(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.adjustments.createAdvance(access, auth.userId, parse(advanceSchema, body), client) }
  }

  @Post('advances/:id/action')
  @HttpCode(200)
  async advanceAction(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.adjustments.advanceAction(access, parse(uuid, id), auth.userId, parse(advanceActionSchema, body), client)
    return { data: { id } }
  }
}
