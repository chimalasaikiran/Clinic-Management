import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { acknowledgeAlertSchema, addendumSchema, alertSchema, allergySchema, diagnosisSchema, startEncounterSchema, updateEncounterSchema, vitalsSchema, worklistSchema } from './clinical.schemas'
import { ChartService } from './chart.service'
import { ClinicalService } from './clinical.service'

// Clinical records. Reading needs clinical.read, writing clinical.write; both are limited to the patients the
// member may see (therapists without booking rights: only patients booked with them).
@Controller({ version: '1' })
export class ClinicalController {
  constructor(
    private readonly clinical: ClinicalService,
    private readonly charts: ChartService,
  ) {}

  @Get('patients/:id/chart')
  @RequirePermissions('clinical.read')
  async chart(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.charts.chart(access, parse(uuid, id)) }
  }

  @Get('clinical/worklist')
  @RequirePermissions('clinical.read')
  async worklist(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.clinical.worklist(access, parse(worklistSchema, query).date) }
  }

  @Get('encounters/:id')
  @RequirePermissions('clinical.read')
  async encounter(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.clinical.encounter(access, parse(uuid, id)) }
  }

  @Post('encounters')
  @HttpCode(201)
  @RequirePermissions('clinical.write')
  async start(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.startEncounter(access, auth.userId, parse(startEncounterSchema, body), client) }
  }

  @Patch('encounters/:id')
  @RequirePermissions('clinical.write')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.updateEncounter(access, parse(uuid, id), auth.userId, parse(updateEncounterSchema, body), client) }
  }

  @Post('encounters/:id/sign')
  @HttpCode(200)
  @RequirePermissions('clinical.write')
  async sign(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.signEncounter(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('patients/:id/vitals')
  @HttpCode(201)
  @RequireAnyPermission('clinical.write', 'clinical.vitals')
  async vitals(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.recordVitals(access, parse(uuid, id), auth.userId, parse(vitalsSchema, body), client) }
  }

  @Post('patients/:id/diagnoses')
  @HttpCode(201)
  @RequirePermissions('clinical.write')
  async diagnosis(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.addDiagnosis(access, parse(uuid, id), auth.userId, parse(diagnosisSchema, body), client) }
  }

  @Post('diagnoses/:id/resolve')
  @HttpCode(204)
  @RequirePermissions('clinical.write')
  async resolveDiagnosis(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.clinical.resolveDiagnosis(access, parse(uuid, id), auth.userId, client)
  }

  @Post('patients/:id/allergies')
  @HttpCode(201)
  @RequirePermissions('clinical.write')
  async allergy(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.addAllergy(access, parse(uuid, id), auth.userId, parse(allergySchema, body), client) }
  }

  @Post('patients/:id/alerts')
  @HttpCode(201)
  @RequirePermissions('clinical.write')
  async alert(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.raiseAlert(access, parse(uuid, id), auth.userId, parse(alertSchema, body), client) }
  }

  @Get('alerts/:id')
  @RequirePermissions('clinical.read')
  async getAlert(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.clinical.alert(access, parse(uuid, id)) }
  }

  @Post('alerts/:id/acknowledge')
  @HttpCode(200)
  @RequirePermissions('clinical.write')
  async acknowledge(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.acknowledgeAlert(access, parse(uuid, id), auth.userId, parse(acknowledgeAlertSchema, body), client) }
  }

  @Post('alerts/:id/resolve')
  @HttpCode(200)
  @RequirePermissions('clinical.write')
  async resolveAlert(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.resolveAlert(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('notes/:id/addenda')
  @HttpCode(201)
  @RequirePermissions('clinical.write')
  async addendum(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.clinical.addAddendum(access, parse(uuid, id), auth.userId, parse(addendumSchema, body).text, client) }
  }
}
