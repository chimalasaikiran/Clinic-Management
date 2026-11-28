import { Module } from '@nestjs/common'
import { PatientAuthModule } from '../patient-auth/patient-auth.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { RefillsService } from './refills.service'
import { PatientRequestsController, RefillQueueController, SupportInboxController } from './requests.controller'
import { SupportService } from './support.service'

@Module({
  imports: [PatientAuthModule, SchedulingModule],
  controllers: [PatientRequestsController, RefillQueueController, SupportInboxController],
  providers: [RefillsService, SupportService],
})
export class PatientRequestsModule {}
