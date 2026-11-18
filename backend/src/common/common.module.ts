import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit/audit.service'
import { MailService, mailSenderProvider } from './mail/mail.service'
import { RateLimitService } from './security/rate-limit.service'

// Cross-cutting services every feature module may use.
@Global()
@Module({
  providers: [AuditService, RateLimitService, mailSenderProvider, MailService],
  exports: [AuditService, RateLimitService, MailService],
})
export class CommonModule {}
