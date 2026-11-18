import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { createTransport, Transporter } from 'nodemailer'
import { ENV, Env } from '../../config/env'

export interface MailMessage {
  to: string
  subject: string
  text: string
}

export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>
}

@Injectable()
export class SmtpMailSender extends MailSender implements OnApplicationBootstrap {
  private readonly transport: Transporter
  private readonly logger = new Logger('Mail')

  constructor(private readonly from: string, smtpUrl: string) {
    super()
    this.transport = createTransport(smtpUrl)
  }

  // Checks the SMTP login once at startup so a wrong host or password shows up immediately instead of as
  // silently missing emails. It does not stop the server: the mail provider may only be briefly unavailable.
  async onApplicationBootstrap() {
    try {
      await this.transport.verify()
      this.logger.log('SMTP connection verified; emails will be sent.')
    } catch (error) {
      this.logger.error(`SMTP check failed, emails will not be delivered: ${(error as Error).message}`)
    }
  }

  async send(message: MailMessage) {
    await this.transport.sendMail({ from: this.from, ...message })
  }
}

export interface EmailJsSettings {
  serviceId: string
  templateId: string
  publicKey: string
  privateKey: string
}

// Sends through the EmailJS REST API from the server, so codes never pass through the browser. One generic
// template serves every message: it must use {{to_email}} as the recipient, {{subject}} and {{message}}.
export class EmailJsMailSender extends MailSender implements OnApplicationBootstrap {
  static readonly endpoint = 'https://api.emailjs.com/api/v1.0/email/send'
  private readonly logger = new Logger('Mail')

  constructor(private readonly settings: EmailJsSettings) {
    super()
  }

  // EmailJS has no "check login" call that does not send an email, so this only confirms which sender is active.
  onApplicationBootstrap() {
    this.logger.log(`Emails will be sent through EmailJS (service ${this.settings.serviceId}).`)
  }

  async send(message: MailMessage) {
    const response = await fetch(EmailJsMailSender.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: this.settings.serviceId,
        template_id: this.settings.templateId,
        user_id: this.settings.publicKey,
        accessToken: this.settings.privateKey,
        template_params: { to_email: message.to, subject: message.subject, message: message.text },
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const reason = (await response.text()).slice(0, 300)
      throw new Error(`EmailJS rejected the email (HTTP ${response.status}): ${reason}`)
    }
  }
}

// Local development only (startup refuses production without SMTP_URL): prints the email so the
// verification code can be read from the backend console.
export class ConsoleMailSender extends MailSender {
  private readonly logger = new Logger('Mail')

  async send(message: MailMessage) {
    this.logger.warn(`No email delivery configured (EMAILJS_ or SMTP_URL); email not sent.\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`)
  }
}

export const mailSenderProvider = {
  provide: MailSender,
  inject: [ENV],
  useFactory: (env: Env): MailSender => {
    // Configuration validation guarantees the EmailJS settings are all present or all absent.
    if (env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY && env.EMAILJS_PRIVATE_KEY) {
      return new EmailJsMailSender({
        serviceId: env.EMAILJS_SERVICE_ID,
        templateId: env.EMAILJS_TEMPLATE_ID,
        publicKey: env.EMAILJS_PUBLIC_KEY,
        privateKey: env.EMAILJS_PRIVATE_KEY,
      })
    }
    if (env.SMTP_URL) return new SmtpMailSender(env.MAIL_FROM ?? 'ClinicOS <no-reply@localhost>', env.SMTP_URL)
    return new ConsoleMailSender()
  },
}

// Message wording lives here so every flow sends consistent, plain-text email.
@Injectable()
export class MailService {
  constructor(
    private readonly sender: MailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  verificationCode(to: string, name: string, code: string) {
    return this.sender.send({
      to,
      subject: `${code} is your ClinicOS verification code`,
      text: `Hello ${name},\n\nYour ClinicOS verification code is ${code}. It expires in 10 minutes.\n\nIf you did not create a ClinicOS account, you can ignore this email.`,
    })
  }

  passwordResetCode(to: string, name: string, code: string) {
    return this.sender.send({
      to,
      subject: `${code} is your ClinicOS password reset code`,
      text: `Hello ${name},\n\nUse ${code} to reset your ClinicOS password. It expires in 10 minutes.\n\nIf you did not ask to reset your password, ignore this email; your password stays the same.`,
    })
  }

  accountAlreadyExists(to: string) {
    return this.sender.send({
      to,
      subject: 'You already have a ClinicOS account',
      text: `A ClinicOS account already exists for this email address.\n\nSign in: ${this.env.APP_URL}/auth/signin\nForgot your password? ${this.env.APP_URL}/auth/forgot-password\n\nIf this was not you, no action is needed.`,
    })
  }

  // Sent after a reset or change, so the owner notices if someone else changed it.
  passwordChanged(to: string, name: string) {
    return this.sender.send({
      to,
      subject: 'Your ClinicOS password was changed',
      text: `Hello ${name},

The password for your ClinicOS account was just changed and other devices were signed out.

If this was not you, reset your password now: ${this.env.APP_URL}/auth/forgot-password`,
    })
  }

  invitation(to: string, organisation: string, inviter: string, link: string, expiresAt: Date) {
    return this.sender.send({
      to,
      subject: `${inviter} invited you to ${organisation} on ClinicOS`,
      text: `${inviter} invited you to join ${organisation} on ClinicOS.\n\nAccept the invitation: ${link}\n\nThe link expires on ${expiresAt.toUTCString()} and can be used once.`,
    })
  }
}
