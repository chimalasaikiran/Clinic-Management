import { Inject, Injectable, Logger, Provider } from '@nestjs/common'
import { ENV, Env } from '../../config/env'
import { AppError } from '../errors/app-error'

// The platform's own SMS sender, for sign-in codes. Clinic-to-patient messages use each organisation's
// channel instead (modules/messaging).
export abstract class SmsSender {
  // `mobile` is a 10-digit Indian number.
  abstract sendCode(mobile: string, code: string): Promise<void>
}

const unavailable = () => new AppError(503, 'SMS_UNAVAILABLE', 'We could not send a code by SMS right now. Please try again shortly.')

// MSG91 Flow API with a DLT-registered template whose single variable (var1) is the code.
export class Msg91CodeSender extends SmsSender {
  private readonly logger = new Logger('Sms')

  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
  ) {
    super()
  }

  async sendCode(mobile: string, code: string) {
    const response = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: this.authKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ template_id: this.templateId, short_url: '0', recipients: [{ mobiles: `91${mobile}`, var1: code }] }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => {
      this.logger.error({ err: error }, 'MSG91 could not be reached')
      throw unavailable()
    })
    const result = (await response.json().catch(() => null)) as { type?: string; message?: string } | null
    if (!response.ok || result?.type !== 'success') {
      // The provider's message may name the account problem; it never contains the code.
      this.logger.error(`MSG91 refused a sign-in code (HTTP ${response.status}): ${result?.message?.slice(0, 200) ?? 'no detail'}`)
      throw unavailable()
    }
  }
}

// Development only: the code is printed to the API console, where the developer can read it.
export class ConsoleCodeSender extends SmsSender {
  async sendCode(mobile: string, code: string) {
    process.stdout.write(`\n[dev sms] to +91 ${mobile}: your ClinicOS code is ${code}\n\n`)
  }
}

export class UnconfiguredCodeSender extends SmsSender {
  async sendCode(): Promise<void> {
    throw new AppError(503, 'SMS_NOT_CONFIGURED', 'Sign-in by SMS is not set up yet. Please contact the clinic.')
  }
}

export const smsSenderProvider: Provider = {
  provide: SmsSender,
  inject: [ENV],
  useFactory: (env: Env): SmsSender => {
    if (env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID) return new Msg91CodeSender(env.MSG91_AUTH_KEY, env.MSG91_OTP_TEMPLATE_ID)
    return env.NODE_ENV === 'production' ? new UnconfiguredCodeSender() : new ConsoleCodeSender()
  },
}

@Injectable()
export class SmsService {
  constructor(@Inject(SmsSender) private readonly sender: SmsSender) {}

  sendCode(mobile: string, code: string) {
    return this.sender.sendCode(mobile, code)
  }
}
