import { Module } from '@nestjs/common'
import { IntegrationsModule } from '../integrations/integrations.module'
import { ContentController, MediaController } from './content.controller'
import { ContentService } from './content.service'
import { ContentWorker } from './content.worker'
import { MediaService } from './media.service'

@Module({
  imports: [IntegrationsModule],
  controllers: [MediaController, ContentController],
  providers: [ContentService, MediaService, ContentWorker],
})
export class ContentModule {}
