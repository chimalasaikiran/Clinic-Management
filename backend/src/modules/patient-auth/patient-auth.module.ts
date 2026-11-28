import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PatientsModule } from '../patients/patients.module'
import { PatientAccessController } from './patient-access.controller'
import { PatientAccountService } from './patient-account.service'
import { PatientAccountController, PatientAuthController } from './patient-auth.controller'
import { PatientAuthService } from './patient-auth.service'
import { PatientCleanupService } from './patient-cleanup.service'
import { PatientLinksService } from './patient-links.service'
import { PatientOtpService } from './patient-otp.service'
import { PatientSessionsService } from './patient-sessions.service'
import { PatientGuard } from './patient.guard'

@Module({
  imports: [AuthModule, PatientsModule],
  controllers: [PatientAuthController, PatientAccountController, PatientAccessController],
  providers: [PatientAuthService, PatientAccountService, PatientLinksService, PatientOtpService, PatientSessionsService, PatientGuard, PatientCleanupService],
  exports: [PatientGuard, PatientSessionsService, PatientLinksService],
})
export class PatientAuthModule {}
