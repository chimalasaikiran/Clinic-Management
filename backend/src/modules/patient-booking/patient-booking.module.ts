import { Module } from '@nestjs/common'
import { AppointmentsModule } from '../appointments/appointments.module'
import { PatientAuthModule } from '../patient-auth/patient-auth.module'
import { AvailabilityService } from './availability.service'
import { ClinicDirectoryService } from './clinic-directory.service'
import { PatientAppointmentsService } from './patient-appointments.service'
import { PatientAppointmentsController, PatientClinicsController } from './patient-booking.controller'
import { PatientRecordService } from './patient-record.service'

@Module({
  imports: [AppointmentsModule, PatientAuthModule],
  controllers: [PatientClinicsController, PatientAppointmentsController],
  providers: [AvailabilityService, ClinicDirectoryService, PatientRecordService, PatientAppointmentsService],
})
export class PatientBookingModule {}
