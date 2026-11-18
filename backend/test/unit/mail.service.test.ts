import { Logger } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({ verify: vi.fn(), sendMail: vi.fn() }))
vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => transport) }))

import { createTransport } from 'nodemailer'
import { loadEnv } from '../../src/config/env'
import { ConsoleMailSender, EmailJsMailSender, mailSenderProvider, SmtpMailSender } from '../../src/common/mail/mail.service'

const emailJs = { serviceId: 'service_clinic', templateId: 'template_generic', publicKey: 'pub-key', privateKey: 'priv-key' }
const message = { to: 'owner@clinic.test', subject: '123456 is your ClinicOS verification code', text: 'Your code is 123456.' }

describe('EmailJsMailSender', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the message through the EmailJS REST API with the private key', async () => {
    const fetch = vi.fn(async () => new Response('OK', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await new EmailJsMailSender(emailJs).send(message)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      service_id: 'service_clinic',
      template_id: 'template_generic',
      user_id: 'pub-key',
      accessToken: 'priv-key',
      template_params: { to_email: 'owner@clinic.test', subject: message.subject, message: message.text },
    })
  })

  it('fails with the EmailJS reason when the email is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('The Public Key is invalid', { status: 400 })))
    await expect(new EmailJsMailSender(emailJs).send(message)).rejects.toThrow('HTTP 400): The Public Key is invalid')
  })
})

describe('mail sender selection', () => {
  const base = {
    DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
    CORS_ORIGINS: 'http://localhost:5173',
    APP_URL: 'http://localhost:5173',
    TOKEN_PEPPER: 'a'.repeat(40),
  }
  const emailJsEnv = { EMAILJS_SERVICE_ID: 's', EMAILJS_TEMPLATE_ID: 't', EMAILJS_PUBLIC_KEY: 'p', EMAILJS_PRIVATE_KEY: 'k' }

  it('prefers EmailJS, then SMTP, then the console', () => {
    expect(mailSenderProvider.useFactory(loadEnv({ ...base, ...emailJsEnv, SMTP_URL: 'smtps://x' }))).toBeInstanceOf(EmailJsMailSender)
    expect(mailSenderProvider.useFactory(loadEnv({ ...base, SMTP_URL: 'smtps://x' }))).toBeInstanceOf(SmtpMailSender)
    expect(mailSenderProvider.useFactory(loadEnv(base))).toBeInstanceOf(ConsoleMailSender)
  })
})

describe('SmtpMailSender', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends from the configured address', async () => {
    const sender = new SmtpMailSender('ClinicOS <no-reply@clinic.test>', 'smtps://user:secret@smtp.clinic.test:465')
    await sender.send({ to: 'owner@clinic.test', subject: '123456 is your code', text: 'Hello' })
    expect(createTransport).toHaveBeenCalledWith('smtps://user:secret@smtp.clinic.test:465')
    expect(transport.sendMail).toHaveBeenCalledWith({ from: 'ClinicOS <no-reply@clinic.test>', to: 'owner@clinic.test', subject: '123456 is your code', text: 'Hello' })
  })

  it('reports a working SMTP login at startup', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    transport.verify.mockResolvedValueOnce(true)
    await new SmtpMailSender('ClinicOS <no-reply@clinic.test>', 'smtps://x').onApplicationBootstrap()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SMTP connection verified'))
  })

  it('reports a failed SMTP login at startup without stopping the server', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    transport.verify.mockRejectedValueOnce(new Error('Invalid login: 535 Authentication failed'))
    await expect(new SmtpMailSender('ClinicOS <no-reply@clinic.test>', 'smtps://x').onApplicationBootstrap()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('535 Authentication failed'))
  })
})
