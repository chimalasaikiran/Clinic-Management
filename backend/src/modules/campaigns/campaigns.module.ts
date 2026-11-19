import { Module } from '@nestjs/common'
import { MessagingModule } from '../messaging/messaging.module'
import { AudiencesService } from './audiences.service'
import { AudiencesController, CampaignsController, WorkflowsController } from './campaigns.controller'
import { CampaignsService } from './campaigns.service'
import { GrowthWorker } from './growth.worker'
import { WorkflowsService } from './workflows.service'

@Module({
  imports: [MessagingModule],
  controllers: [AudiencesController, CampaignsController, WorkflowsController],
  providers: [AudiencesService, CampaignsService, WorkflowsService, GrowthWorker],
})
export class CampaignsModule {}
