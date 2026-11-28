import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import { RateLimitService } from '../../common/security/rate-limit.service'
import type { ClientInfo, PatientContext } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { PATIENT_LIMITS } from '../patient-auth/patient.limits'
import { CurrentPatient, PatientRealm } from '../patient-auth/patient.decorators'
import { appointmentSlotsSchema, appointmentsQuerySchema, bookSchema, cancelSchema, clinicSlotsSchema, clinicsQuerySchema, moveSchema } from './booking.schemas'
import { ClinicDirectoryService } from './clinic-directory.service'
import { PatientAppointmentsService } from './patient-appointments.service'

@Controller({ path: 'patient/clinics', version: '1' })
@PatientRealm()
export class PatientClinicsController {
  constructor(
    private readonly directory: ClinicDirectoryService,
    private readonly appointments: PatientAppointmentsService,
  ) {}

  @Get()
  async list(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.directory.list(patient.accountId, parse(clinicsQuerySchema, query))
    return { data: items, meta }
  }

  @Get(':branchId')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('branchId') branchId: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.directory.detail(patient.accountId, parse(uuid, branchId)) }
  }

  @Get(':branchId/slots')
  @Header('Cache-Control', 'no-store')
  async slots(@Param('branchId') branchId: string, @Query() query: unknown) {
    return { data: await this.appointments.clinicSlots(parse(uuid, branchId), parse(clinicSlotsSchema, query)) }
  }

  @Put(':branchId/saved')
  async save(@Param('branchId') branchId: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.directory.setSaved(patient.accountId, parse(uuid, branchId), true) }
  }

  @Delete(':branchId/saved')
  async unsave(@Param('branchId') branchId: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.directory.setSaved(patient.accountId, parse(uuid, branchId), false) }
  }
}

@Controller({ path: 'patient/appointments', version: '1' })
@PatientRealm()
export class PatientAppointmentsController {
  constructor(
    private readonly appointments: PatientAppointmentsService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.appointments.list(patient.accountId, parse(appointmentsQuerySchema, query))
    return { data: items, meta }
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.appointments.get(patient.accountId, parse(uuid, id)) }
  }

  @Get(':id/slots')
  @Header('Cache-Control', 'no-store')
  async slots(@Param('id') id: string, @Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    return { data: await this.appointments.moveSlots(patient.accountId, parse(uuid, id), parse(appointmentSlotsSchema, query)) }
  }

  @Post()
  @HttpCode(201)
  async book(@Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    const input = parse(bookSchema, body)
    await this.rateLimit.consume(PATIENT_LIMITS.bookingAccount, patient.accountId)
    return { data: await this.appointments.book(patient.accountId, input, client) }
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  async reschedule(@Param('id') id: string, @Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    const input = parse(moveSchema, body)
    await this.rateLimit.consume(PATIENT_LIMITS.bookingAccount, patient.accountId)
    return { data: await this.appointments.move(patient.accountId, parse(uuid, id), input, client) }
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @Body() body: unknown, @CurrentPatient() patient: PatientContext, @Client() client: ClientInfo) {
    return { data: await this.appointments.cancel(patient.accountId, parse(uuid, id), parse(cancelSchema, body).reason, client) }
  }
}
