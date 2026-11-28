import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import { notFound } from '../../common/errors/app-error'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { ClientInfo, PatientContext } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { PatientAccountService } from './patient-account.service'
import { consentSchema, otpRequestSchema, otpVerifySchema, redeemLinkCodeSchema, registerPatientSchema, updatePatientProfileSchema } from './patient-auth.schemas'
import { PatientAuthService } from './patient-auth.service'
import { PatientLinksService } from './patient-links.service'
import { PatientSessionsService } from './patient-sessions.service'
import { CurrentPatient, PatientPublic, PatientRealm } from './patient.decorators'
import { PATIENT_LIMITS } from './patient.limits'

@PatientRealm()
@Controller({ path: 'patient/auth', version: '1' })
export class PatientAuthController {
  constructor(
    private readonly auth: PatientAuthService,
    private readonly sessions: PatientSessionsService,
  ) {}

  @PatientPublic()
  @Post('otp/request')
  @HttpCode(202)
  async requestCode(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.requestCode(parse(otpRequestSchema, body).mobile, client) }
  }

  @PatientPublic()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyCode(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.verifyCode(parse(otpVerifySchema, body), client) }
  }

  @PatientPublic()
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Client() client: ClientInfo) {
    return { data: await this.auth.register(parse(registerPatientSchema, body), client) }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentPatient() patient: PatientContext) {
    await this.sessions.end(patient.accountId, patient.sessionId)
  }

  @Get('sessions')
  async list(@CurrentPatient() patient: PatientContext) {
    return { data: await this.sessions.list(patient) }
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async end(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    if (!(await this.sessions.end(patient.accountId, parse(uuid, id)))) throw notFound('Session not found.')
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  async endOthers(@CurrentPatient() patient: PatientContext) {
    return { data: { ended: await this.sessions.endOthers(patient) } }
  }
}

@PatientRealm()
@Controller({ path: 'patient', version: '1' })
export class PatientAccountController {
  constructor(
    private readonly accounts: PatientAccountService,
    private readonly links: PatientLinksService,
    private readonly limits: RateLimitService,
  ) {}

  @Get('me')
  async me(@CurrentPatient() patient: PatientContext) {
    return { data: await this.accounts.view(patient.accountId) }
  }

  @Patch('me')
  async update(@Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    return { data: await this.accounts.update(patient.accountId, parse(updatePatientProfileSchema, body), client) }
  }

  @Get('consents')
  async consents(@CurrentPatient() patient: PatientContext) {
    return { data: await this.accounts.consents(patient.accountId) }
  }

  @Put('consents')
  async recordConsents(@Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    return { data: await this.accounts.recordConsents(patient.accountId, parse(consentSchema, body), client) }
  }

  @Get('links')
  async list(@CurrentPatient() patient: PatientContext) {
    return { data: await this.links.list(patient.accountId) }
  }

  @Post('links/code')
  @HttpCode(200)
  async redeem(@Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    await this.limits.consumeAll([
      [PATIENT_LIMITS.linkCodeIp, client.ip],
      [PATIENT_LIMITS.linkCodeAccount, patient.accountId],
    ])
    return { data: await this.links.redeem(patient.accountId, parse(redeemLinkCodeSchema, body).code, client) }
  }

  @Delete('links/:id')
  @HttpCode(204)
  async unlink(@Param('id') id: string, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    await this.links.unlink(patient.accountId, parse(uuid, id), client)
  }
}
