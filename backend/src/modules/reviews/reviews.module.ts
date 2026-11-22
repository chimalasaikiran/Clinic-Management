import { Module } from '@nestjs/common'
import { IntegrationsModule } from '../integrations/integrations.module'
import { EscalationsService } from './escalations.service'
import { ProfilesService } from './profiles.service'
import { ProfilesController, ReviewsController } from './reviews.controller'
import { ReviewsService } from './reviews.service'
import { ReviewsWorker } from './reviews.worker'

@Module({
  imports: [IntegrationsModule],
  controllers: [ProfilesController, ReviewsController],
  providers: [ProfilesService, ReviewsService, EscalationsService, ReviewsWorker],
})
export class ReviewsModule {}
