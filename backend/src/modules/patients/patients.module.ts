import { Module } from '@nestjs/common'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { PatientsController } from './patients.controller'
import { PatientsRepository } from './patients.repository'
import { PatientsService } from './patients.service'

@Module({
  imports: [SchedulingModule],
  controllers: [PatientsController],
  providers: [PatientsRepository, PatientsService],
  exports: [PatientsRepository, PatientsService],
})
export class PatientsModule {}
