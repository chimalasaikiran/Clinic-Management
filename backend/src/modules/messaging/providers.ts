import { Injectable } from '@nestjs/common'
import nodemailer from 'nodemailer'
import type { MessageChannel } from '../../generated/prisma/client'

export interface OutgoingMessage {
  // Provider form: 91XXXXXXXXXX for WhatsApp and SMS, the email address otherwise.
  to: string
  body: string
  subject: string | null
  // An approved provider template and its variable values in order; null for a free-text message.
  template: { ref: string; locale: string; parameters: string[] } | null
}

export interface SendResult {
  providerMessageId: string | null
}

export interface ChannelProvider {
  // Checks the credentials with the provider; resolves to a short description of what was found.
  verify(config: Record<string, string>, secrets: Record<string, string>): Promise<string>
  send(config: Record<string, string>, secrets: Record<string, string>, message: OutgoingMessage): Promise<SendResult>
}

// How a send failed decides what happens next: `retryable` is tried again later, `unknown` (the request may have
// reached the provider) is never resent automatically, `rejected` and `auth` fail the message.
export class ProviderError extends Error {
  constructor(
    readonly kind: 'rejected' | 'retryable' | 'unknown' | 'auth',
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export type Transport = Record<MessageChannel, ChannelProvider>
export const MESSAGING_TRANSPORT = Symbol('MESSAGING_TRANSPORT')

const TIMEOUT_MS = 15_000

async function call(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    // A timeout may come after the provider accepted the request; a failed connection never reached it.
    if (error instanceof Error && error.name === 'TimeoutError') throw new ProviderError('unknown', 'TIMEOUT', 'The provider did not answer in time; the message may or may not have been accepted.')
    throw new ProviderError('retryable', 'NETWORK', 'Could not reach the provider.')
  }
  const text = await response.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Some error pages are not JSON; keep the text.
  }
  return { status: response.status, body }
}

function httpError(status: number, code: string, message: string) {
  if (status === 401 || status === 403) return new ProviderError('auth', code, message)
  if (status === 429 || status >= 500) return new ProviderError('retryable', code, message)
  return new ProviderError('rejected', code, message)
}

const clip = (text: string) => text.slice(0, 400)

// Meta WhatsApp Cloud API: config { phoneNumberId, graphVersion? }, secrets { accessToken, appSecret }.
export class WhatsAppCloudProvider implements ChannelProvider {
  private base(config: Record<string, string>) {
    return `https://graph.facebook.com/${config.graphVersion || 'v21.0'}/${encodeURIComponent(config.phoneNumberId ?? '')}`
  }

  private fail(status: number, body: unknown): ProviderError {
    const error = (body as { error?: { code?: number; message?: string } } | null)?.error
    // 190 is an expired or revoked access token.
    if (error?.code === 190) return new ProviderError('auth', 'WHATSAPP_190', clip(error.message ?? 'Access token rejected.'))
    return httpError(status, `WHATSAPP_${error?.code ?? status}`, clip(error?.message ?? `WhatsApp returned HTTP ${status}.`))
  }

  async verify(config: Record<string, string>, secrets: Record<string, string>) {
    const { status, body } = await call(`${this.base(config)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${secrets.accessToken}` } })
    if (status !== 200) throw this.fail(status, body)
    const phone = body as { display_phone_number?: string; verified_name?: string }
    return `${phone.verified_name ?? 'WhatsApp Business'} · ${phone.display_phone_number ?? config.phoneNumberId}`
  }

  async send(config: Record<string, string>, secrets: Record<string, string>, message: OutgoingMessage) {
    const content = message.template
      ? {
          type: 'template',
          template: {
            name: message.template.ref,
            language: { code: message.template.locale },
            components: message.template.parameters.length ? [{ type: 'body', parameters: message.template.parameters.map((text) => ({ type: 'text', text })) }] : [],
          },
        }
      : { type: 'text', text: { preview_url: false, body: message.body } }
    const { status, body } = await call(`${this.base(config)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: message.to, ...content }),
    })
    if (status !== 200) throw this.fail(status, body)
    return { providerMessageId: (body as { messages?: Array<{ id: string }> }).messages?.[0]?.id ?? null }
  }
}

// MSG91 Flow API (DLT-registered templates): config { senderId?, entityId? }, secrets { authKey }.
export class Msg91Provider implements ChannelProvider {
  // MSG91 has no read-only credential check, so the first send is what confirms the auth key.
  async verify(_config: Record<string, string>, secrets: Record<string, string>) {
    if (!secrets.authKey?.trim()) throw new ProviderError('auth', 'MSG91_KEY', 'Enter the MSG91 auth key.')
    return 'MSG91 auth key saved · confirmed by the first send'
  }

  async send(config: Record<string, string>, secrets: Record<string, string>, message: OutgoingMessage) {
    if (!message.template) throw new ProviderError('rejected', 'TEMPLATE_REQUIRED', 'SMS can only be sent with a DLT-registered template.')
    const recipient: Record<string, string> = { mobiles: message.to }
    message.template.parameters.forEach((value, index) => (recipient[`var${index + 1}`] = value))
    const { status, body } = await call('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: secrets.authKey ?? '', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ template_id: message.template.ref, short_url: '0', ...(config.senderId ? { sender: config.senderId } : {}), recipients: [recipient] }),
    })
    const result = body as { type?: string; message?: string } | null
    if (status !== 200 || result?.type !== 'success') {
      const text = clip(result?.message ?? `MSG91 returned HTTP ${status}.`)
      if (/auth\s*key|authkey|authenticat/i.test(text)) throw new ProviderError('auth', 'MSG91_AUTH', text)
      throw status === 200 ? new ProviderError('rejected', 'MSG91_REJECTED', text) : httpError(status, `MSG91_${status}`, text)
    }
    return { providerMessageId: result.message ?? null }
  }
}

// Any SMTP server: config { host, port, secure, user, fromAddress, fromName }, secrets { password }.
export class SmtpProvider implements ChannelProvider {
  private transport(config: Record<string, string>, secrets: Record<string, string>) {
    return nodemailer.createTransport({
      host: config.host, port: Number(config.port), secure: config.secure === 'true',
      auth: { user: config.user, pass: secrets.password },
      connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
    })
  }

  private fail(error: unknown): ProviderError {
    const failure = error as { code?: string; responseCode?: number; message?: string }
    const text = clip(failure.message ?? 'The mail server refused the message.')
    if (failure.code === 'EAUTH') return new ProviderError('auth', 'SMTP_AUTH', text)
    if (failure.responseCode && failure.responseCode >= 500) return new ProviderError('rejected', `SMTP_${failure.responseCode}`, text)
    if (failure.responseCode && failure.responseCode >= 400) return new ProviderError('retryable', `SMTP_${failure.responseCode}`, text)
    if (failure.code === 'ETIMEDOUT') return new ProviderError('unknown', 'SMTP_TIMEOUT', text)
    return new ProviderError('retryable', failure.code ?? 'SMTP', text)
  }

  async verify(config: Record<string, string>, secrets: Record<string, string>) {
    try {
      await this.transport(config, secrets).verify()
    } catch (error) {
      throw this.fail(error)
    }
    return `${config.fromAddress} via ${config.host}:${config.port}`
  }

  async send(config: Record<string, string>, secrets: Record<string, string>, message: OutgoingMessage) {
    try {
      const info = await this.transport(config, secrets).sendMail({
        from: config.fromName ? { name: config.fromName, address: config.fromAddress! } : config.fromAddress,
        to: message.to,
        subject: message.subject ?? 'Message from the clinic',
        text: message.body,
      })
      return { providerMessageId: info.messageId ?? null }
    } catch (error) {
      throw this.fail(error)
    }
  }
}

@Injectable()
export class DefaultTransport implements Transport {
  readonly whatsapp = new WhatsAppCloudProvider()
  readonly sms = new Msg91Provider()
  readonly email = new SmtpProvider()
}
