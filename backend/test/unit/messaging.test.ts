import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { openSecret, sealSecret } from '../../src/modules/messaging/channel-secrets'
import { advances, missingVariables, normaliseAddress, optKeyword, providerAddress, renderTemplate, retryAt, sendBlock, templateVariables, unknownVariables, whatsappWindowOpen } from '../../src/modules/messaging/messaging.logic'

describe('channel secrets', () => {
  const key = randomBytes(32)

  it('round-trips credentials and never stores them in the clear', () => {
    const sealed = sealSecret(key, { accessToken: 'EAAG-secret-token', appSecret: 'abc' })
    expect(sealed).toMatch(/^v1\./)
    expect(sealed).not.toContain('EAAG')
    expect(openSecret(key, sealed)).toEqual({ accessToken: 'EAAG-secret-token', appSecret: 'abc' })
    // A fresh nonce each time: the same secret never encrypts to the same text.
    expect(sealSecret(key, { a: '1' })).not.toBe(sealSecret(key, { a: '1' }))
  })

  it('refuses a tampered value or a different key', () => {
    const sealed = sealSecret(key, { authKey: 'k' })
    const parts = sealed.split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => openSecret(key, parts.join('.'))).toThrow()
    expect(() => openSecret(randomBytes(32), sealed)).toThrow()
  })
})

describe('addresses and templates', () => {
  it('normalises Indian mobiles and emails', () => {
    expect(normaliseAddress('whatsapp', '+91 98480 22110')).toBe('9848022110')
    expect(normaliseAddress('sms', '919848022110')).toBe('9848022110')
    expect(normaliseAddress('sms', '12345')).toBeNull()
    expect(normaliseAddress('email', ' Nisha@Example.IN ')).toBe('nisha@example.in')
    expect(providerAddress('whatsapp', '9848022110')).toBe('919848022110')
    expect(providerAddress('email', 'a@b.in')).toBe('a@b.in')
  })

  it('reads variables in order and refuses to send with any left blank', () => {
    const body = 'Hello {{preferred_name}}, your visit on {{appointment_date}} at {{appointment_time}}. {{preferred_name}}'
    expect(templateVariables(body)).toEqual(['preferred_name', 'appointment_date', 'appointment_time'])
    expect(unknownVariables('Hi {{nickname}} {{preferred_name}}')).toEqual(['nickname'])
    expect(missingVariables(body, { preferred_name: 'Nisha', appointment_date: ' ' })).toEqual(['appointment_date', 'appointment_time'])
    expect(renderTemplate('Hi {{preferred_name}} {{x}}', { preferred_name: 'Nisha' })).toBe('Hi Nisha {{x}}')
  })
})

describe('send rules', () => {
  const approved = { category: 'Follow-up', status: 'approved', providerRef: 'follow_up_v1' }
  const base = { channel: 'whatsapp' as const, consent: null, freeText: false, template: approved, patientNotifications: null, windowOpen: false }

  it('never sends to someone who opted out', () => {
    expect(sendBlock({ ...base, consent: 'withdrawn' })).toBe('CONSENT_WITHDRAWN')
    expect(sendBlock({ ...base, consent: 'withdrawn', freeText: true, template: null, windowOpen: true })).toBe('CONSENT_WITHDRAWN')
  })

  it('needs an opt-in for marketing, but lets care reminders use the patient’s notification setting', () => {
    expect(sendBlock(base)).toBe('CONSENT_REQUIRED')
    expect(sendBlock({ ...base, consent: 'granted' })).toBeNull()
    expect(sendBlock({ ...base, template: { ...approved, category: 'Reminder' }, patientNotifications: true })).toBeNull()
    expect(sendBlock({ ...base, template: { ...approved, category: 'Reminder' }, patientNotifications: false })).toBe('CONSENT_REQUIRED')
  })

  it('allows free text only as a WhatsApp reply inside the 24-hour window, or by email with consent', () => {
    const freeText = { ...base, freeText: true, template: null }
    expect(sendBlock({ ...freeText, windowOpen: true })).toBeNull()
    expect(sendBlock(freeText)).toBe('TEMPLATE_REQUIRED')
    expect(sendBlock({ ...freeText, channel: 'sms', windowOpen: true, consent: 'granted' })).toBe('TEMPLATE_REQUIRED')
    expect(sendBlock({ ...freeText, channel: 'email' })).toBe('CONSENT_REQUIRED')
    expect(sendBlock({ ...freeText, channel: 'email', consent: 'granted' })).toBeNull()
  })

  it('needs an approved template with the provider’s reference, except for email', () => {
    expect(sendBlock({ ...base, consent: 'granted', template: { ...approved, status: 'draft' } })).toBe('TEMPLATE_NOT_APPROVED')
    expect(sendBlock({ ...base, consent: 'granted', template: { ...approved, providerRef: null } })).toBe('TEMPLATE_NOT_APPROVED')
    expect(sendBlock({ ...base, channel: 'email', consent: 'granted', template: { ...approved, providerRef: null } })).toBeNull()
  })

  it('opens the WhatsApp window for 24 hours after the contact writes', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(whatsappWindowOpen(null, now)).toBe(false)
    expect(whatsappWindowOpen(new Date('2026-11-19T10:30:00Z'), now)).toBe(true)
    expect(whatsappWindowOpen(new Date('2026-11-19T09:59:00Z'), now)).toBe(false)
  })
})

describe('receipts, retries and replies', () => {
  it('ignores receipts that arrive late or out of order', () => {
    expect(advances('sent', 'delivered')).toBe(true)
    expect(advances('read', 'delivered')).toBe(false)
    expect(advances('sending', 'sent')).toBe(true)
    expect(advances('sent', 'failed')).toBe(true)
    expect(advances('delivered', 'failed')).toBe(false)
    expect(advances('failed', 'delivered')).toBe(false)
  })

  it('backs off between attempts and gives up after five', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(retryAt(1, now)).toEqual(new Date('2026-11-20T10:01:00Z'))
    expect(retryAt(3, now)).toEqual(new Date('2026-11-20T10:09:00Z'))
    expect(retryAt(5, now)).toBeNull()
  })

  it('treats STOP and START replies as opting out and back in', () => {
    expect(optKeyword(' STOP ')).toBe('stop')
    expect(optKeyword('Unsubscribe.')).toBe('stop')
    expect(optKeyword('start')).toBe('start')
    expect(optKeyword('Please stop calling me at work')).toBeNull()
  })
})
