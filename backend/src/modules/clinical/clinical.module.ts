import { Module } from '@nestjs/common'
import { AppointmentsModule } from '../appointments/appointments.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { CarePlansRepository } from './care-plans.repository'
import { CarePlansService } from './care-plans.service'
import { ChartService } from './chart.service'
import { ClinicalRecordsController } from './clinical-records.controller'
import { ClinicalController } from './clinical.controller'
import { ClinicalRepository } from './clinical.repository'
import { ClinicalService } from './clinical.service'
import { ClinicianRepository } from './clinician.repository'
import { IncidentsController } from './incidents.controller'
import { IncidentsService } from './incidents.service'
import { OrdersRepository } from './orders.repository'
import { OrdersService } from './orders.service'
import { PrescriptionsRepository } from './prescriptions.repository'
import { PrescriptionsService } from './prescriptions.service'
import { ReferralsRepository } from './referrals.repository'
import { ReferralsService } from './referrals.service'

@Module({
  imports: [SchedulingModule, AppointmentsModule],
  controllers: [ClinicalController, ClinicalRecordsController, IncidentsController],
  providers: [
    ClinicalRepository,
    ClinicalService,
    ClinicianRepository,
    ChartService,
    PrescriptionsRepository,
    PrescriptionsService,
    OrdersRepository,
    OrdersService,
    ReferralsRepository,
    ReferralsService,
    CarePlansRepository,
    CarePlansService,
    IncidentsService,
  ],
})
export class ClinicalModule {}
