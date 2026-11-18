import { Module } from '@nestjs/common'
import { PermissionsModule } from '../permissions/permissions.module'
import { OrganisationsController } from './organisations.controller'
import { OrganisationsRepository } from './organisations.repository'
import { OrganisationsService } from './organisations.service'

@Module({
  imports: [PermissionsModule],
  controllers: [OrganisationsController],
  providers: [OrganisationsRepository, OrganisationsService],
  exports: [OrganisationsRepository],
})
export class OrganisationsModule {}
