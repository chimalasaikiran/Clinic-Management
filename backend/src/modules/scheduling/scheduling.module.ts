import { Module } from '@nestjs/common'
import { CareScopeService } from './care-scope.service'
import { PractitionersController } from './practitioners.controller'
import { PractitionersRepository } from './practitioners.repository'
import { PractitionersService } from './practitioners.service'

@Module({
  controllers: [PractitionersController],
  providers: [PractitionersRepository, PractitionersService, CareScopeService],
  exports: [PractitionersRepository, CareScopeService],
})
export class SchedulingModule {}
