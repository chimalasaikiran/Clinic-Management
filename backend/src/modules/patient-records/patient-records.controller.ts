import { Controller, Get, Header, Param, Query } from '@nestjs/common'
import type { PatientContext } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentPatient, PatientRealm } from '../patient-auth/patient.decorators'
import { PatientRecordsService } from './patient-records.service'
import { orderListSchema, recordListSchema } from './records.schemas'

// The patient's own clinical records, read-only. Responses hold health information, so nothing is cached.
@Controller({ path: 'patient', version: '1' })
@PatientRealm()
export class PatientRecordsController {
  constructor(private readonly records: PatientRecordsService) {}

  @Get('records/overview')
  @Header('Cache-Control', 'no-store')
  async overview(@CurrentPatient() patient: PatientContext) {
    return { data: await this.records.overview(patient.accountId) }
  }

  @Get('records/history')
  @Header('Cache-Control', 'no-store')
  async history(@CurrentPatient() patient: PatientContext) {
    return { data: await this.records.history(patient.accountId) }
  }

  @Get('consultations')
  @Header('Cache-Control', 'no-store')
  async consultations(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.records.consultations(patient.accountId, parse(recordListSchema, query))
    return { data: items, meta }
  }

  @Get('consultations/:id')
  @Header('Cache-Control', 'no-store')
  async consultation(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.records.consultation(patient.accountId, parse(uuid, id)) }
  }

  @Get('prescriptions')
  @Header('Cache-Control', 'no-store')
  async prescriptions(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.records.prescriptions(patient.accountId, parse(recordListSchema, query))
    return { data: items, meta }
  }

  @Get('prescriptions/:id')
  @Header('Cache-Control', 'no-store')
  async prescription(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.records.prescriptionDetail(patient.accountId, parse(uuid, id)) }
  }

  @Get('orders')
  @Header('Cache-Control', 'no-store')
  async orders(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.records.orders(patient.accountId, parse(orderListSchema, query))
    return { data: items, meta }
  }

  @Get('orders/:id')
  @Header('Cache-Control', 'no-store')
  async order(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.records.orderDetail(patient.accountId, parse(uuid, id)) }
  }

  @Get('care-plans')
  @Header('Cache-Control', 'no-store')
  async carePlans(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.records.carePlans(patient.accountId, parse(recordListSchema, query))
    return { data: items, meta }
  }

  @Get('care-plans/:id')
  @Header('Cache-Control', 'no-store')
  async carePlan(@Param('id') id: string, @CurrentPatient() patient: PatientContext) {
    return { data: await this.records.carePlanDetail(patient.accountId, parse(uuid, id)) }
  }
}
