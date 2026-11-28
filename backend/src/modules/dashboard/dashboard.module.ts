import { Module } from '@nestjs/common'
import { AppointmentsModule } from '../appointments/appointments.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { AlertsController, DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { DayService } from './day.service'

@Module({
  imports: [SchedulingModule, AppointmentsModule],
  controllers: [DashboardController, AlertsController],
  providers: [DashboardService, DayService],
})
export class DashboardModule {}
