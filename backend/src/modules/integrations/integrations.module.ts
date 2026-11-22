import { Module } from '@nestjs/common'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'
import { DefaultPublishingTransport, PUBLISHING_TRANSPORT } from './providers'

@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    // Integration tests replace this with fake Meta and Google clients.
    { provide: PUBLISHING_TRANSPORT, useClass: DefaultPublishingTransport },
  ],
  exports: [IntegrationsService, PUBLISHING_TRANSPORT],
})
export class IntegrationsModule {}
