import { Module } from '@nestjs/common'
import { AccessGuard } from './access.guard'
import { AccessRepository } from './access.repository'
import { AccessService } from './access.service'
import { PermissionsController } from './permissions.controller'

@Module({
  controllers: [PermissionsController],
  providers: [AccessRepository, AccessService, AccessGuard],
  exports: [AccessService, AccessGuard],
})
export class PermissionsModule {}
