import { MeController } from './me.controller'
import { Module } from '@nestjs/common'
import { InvitationsModule } from '../invitations/invitations.module'
import { AttendanceRepository } from './attendance.repository'
import { AttendanceService } from './attendance.service'
import { StaffController } from './staff.controller'
import { StaffRepository } from './staff.repository'
import { StaffService } from './staff.service'

@Module({
  imports: [InvitationsModule],
  controllers: [StaffController, MeController],
  providers: [StaffRepository, StaffService, AttendanceRepository, AttendanceService],
})
export class StaffModule {}
