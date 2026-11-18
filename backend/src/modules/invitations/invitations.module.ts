import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembersModule } from '../members/members.module'
import { OrganisationsModule } from '../organisations/organisations.module'
import { UsersModule } from '../users/users.module'
import { InvitationsController } from './invitations.controller'
import { InvitationsRepository } from './invitations.repository'
import { InvitationsService } from './invitations.service'

@Module({
  imports: [AuthModule, UsersModule, MembersModule, OrganisationsModule],
  controllers: [InvitationsController],
  providers: [InvitationsRepository, InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
