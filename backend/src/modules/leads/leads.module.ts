import { Module } from '@nestjs/common'
import { PatientsModule } from '../patients/patients.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'

@Module({
  imports: [PatientsModule, SchedulingModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
