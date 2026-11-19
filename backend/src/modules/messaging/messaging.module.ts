import { Module } from '@nestjs/common'
import { SchedulingModule } from '../scheduling/scheduling.module'
import { AutomatedSendService } from './automated-send.service'
import { ChannelsService } from './channels.service'
import { ConsentService } from './consent.service'
import { ConversationsService } from './conversations.service'
import { ConversationsController, MessagingController, WebhooksController } from './messaging.controller'
import { OutboxWorker } from './outbox.worker'
import { DefaultTransport, MESSAGING_TRANSPORT } from './providers'
import { RealtimeService } from './realtime.service'
import { TemplatesService } from './templates.service'
import { WebhooksService } from './webhooks.service'

@Module({
  imports: [SchedulingModule],
  controllers: [MessagingController, ConversationsController, WebhooksController],
  providers: [
    ChannelsService, TemplatesService, ConsentService, ConversationsService, RealtimeService, OutboxWorker, WebhooksService, AutomatedSendService,
    // Integration tests replace this with fake providers.
    { provide: MESSAGING_TRANSPORT, useClass: DefaultTransport },
  ],
  // Campaign broadcasts and workflows send through the same checks and queue.
  exports: [AutomatedSendService, ChannelsService, ConsentService, RealtimeService],
})
export class MessagingModule {}
