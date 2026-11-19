import { Module } from '@nestjs/common'
import { AlertsController, DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  controllers: [DashboardController, AlertsController],
  providers: [DashboardService],
})
export class DashboardModule {}
