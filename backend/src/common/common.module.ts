import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit/audit.service'
import { MailService, mailSenderProvider } from './mail/mail.service'
import { LiveService } from './realtime/live.service'
import { RateLimitService } from './security/rate-limit.service'
import { SmsService, smsSenderProvider } from './sms/sms.service'

// Cross-cutting services every feature module may use.
@Global()
@Module({
  providers: [AuditService, LiveService, RateLimitService, mailSenderProvider, MailService, smsSenderProvider, SmsService],
  exports: [AuditService, LiveService, RateLimitService, MailService, SmsService],
})
export class CommonModule {}
