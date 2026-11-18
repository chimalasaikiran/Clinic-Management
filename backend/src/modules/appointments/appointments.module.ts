import { Module } from '@nestjs/common'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsRepository } from './appointments.repository'
import { AppointmentsService } from './appointments.service'

@Module({
  imports: [SchedulingModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsRepository, AppointmentsService],
  exports: [AppointmentsRepository],
})
export class AppointmentsModule {}
