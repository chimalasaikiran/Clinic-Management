import { Module } from '@nestjs/common'
import { AppointmentsModule } from '../appointments/appointments.module'
import { PatientsModule } from '../patients/patients.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  imports: [PatientsModule, AppointmentsModule, SchedulingModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
