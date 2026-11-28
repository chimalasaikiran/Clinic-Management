import { Global, Module } from '@nestjs/common'
import { PatientAuthModule } from '../patient-auth/patient-auth.module'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { EventsController, NotificationsController, PatientNotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

// Global, so any module that changes something a person should hear about can write the notification.
@Global()
@Module({
  imports: [PatientAuthModule, SchedulingModule],
  controllers: [NotificationsController, EventsController, PatientNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
