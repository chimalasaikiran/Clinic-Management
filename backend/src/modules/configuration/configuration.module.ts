import { Global, Module } from '@nestjs/common'
import { BranchesController, DepartmentsController, InsuranceController, OrganisationController } from './configuration.controller'
import { DepartmentsService } from './departments.service'
import { InsuranceService } from './insurance.service'
import { OrganisationConfigService } from './organisation-config.service'

// Global so staff, doctors and services can check department names against the master list.
@Global()
@Module({
  controllers: [OrganisationController, BranchesController, DepartmentsController, InsuranceController],
  providers: [OrganisationConfigService, DepartmentsService, InsuranceService],
  exports: [DepartmentsService],
})
export class ConfigurationModule {}
