import { Module } from '@nestjs/common'
import { PatientAuthModule } from '../patient-auth/patient-auth.module'
import { PatientRecordsController } from './patient-records.controller'
import { PatientRecordsService } from './patient-records.service'

@Module({
  imports: [PatientAuthModule],
  controllers: [PatientRecordsController],
  providers: [PatientRecordsService],
})
export class PatientRecordsModule {}
