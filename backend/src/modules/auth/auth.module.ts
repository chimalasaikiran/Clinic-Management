import { Module } from '@nestjs/common'
import { PermissionsModule } from '../permissions/permissions.module'
import { UsersModule } from '../users/users.module'
import { AuthCleanupService } from './auth-cleanup.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { SessionGuard } from './session.guard'
import { SessionService } from './session.service'
import { SessionsRepository } from './sessions.repository'
import { StaffAppAuthController } from './staff-app-auth.controller'
import { StaffAppAuthService } from './staff-app-auth.service'
import { VerificationCodesRepository } from './verification-codes.repository'
import { VerificationService } from './verification.service'

@Module({
  imports: [UsersModule, PermissionsModule],
  controllers: [AuthController, StaffAppAuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionsRepository,
    SessionGuard,
    VerificationService,
    VerificationCodesRepository,
    AuthCleanupService,
    StaffAppAuthService,
  ],
  exports: [PasswordService, SessionService, SessionGuard],
})
export class AuthModule {}
