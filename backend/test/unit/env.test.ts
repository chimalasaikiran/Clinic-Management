import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env'

const base = {
  DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  CORS_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TOKEN_PEPPER: 'a'.repeat(40),
}

const production = {
  ...base,
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://app.example.com',
  APP_URL: 'https://app.example.com',
  COOKIE_SECURE: 'true',
  SMTP_URL: 'smtps://user:pass@smtp.example.com:465',
  MAIL_FROM: 'ClinicOS <no-reply@example.com>',
}

describe('backend configuration', () => {
  it('applies defaults for local development', () => {
    const env = loadEnv(base)
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 4000, SESSION_IDLE_MINUTES: 30, SESSION_MAX_AGE_HOURS: 12, COOKIE_SECURE: false, COOKIE_SAMESITE: 'lax' })
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173'])
  })

  it('treats empty values as unset', () => {
    expect(loadEnv({ ...base, SMTP_URL: '', PORT: '' }).SMTP_URL).toBeUndefined()
  })

  it('rejects a missing or placeholder database URL and a short pepper', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/)
    expect(() => loadEnv({ ...base, DATABASE_URL: 'postgresql://USER:PASSWORD@ep-XXXX-pooler.REGION.aws.neon.tech/neondb' })).toThrow(/placeholder/)
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/postgresql/)
    expect(() => loadEnv({ ...base, TOKEN_PEPPER: 'short' })).toThrow(/TOKEN_PEPPER/)
  })

  it('accepts a complete production configuration', () => {
    expect(loadEnv(production).COOKIE_SECURE).toBe(true)
  })

  it('refuses insecure production settings', () => {
    expect(() => loadEnv({ ...production, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/)
    expect(() => loadEnv({ ...production, SMTP_URL: undefined })).toThrow(/SMTP_URL/)
    expect(() => loadEnv({ ...production, APP_URL: 'http://app.example.com' })).toThrow(/APP_URL/)
    expect(() => loadEnv({ ...production, CORS_ORIGINS: 'http://app.example.com' })).toThrow(/CORS_ORIGINS/)
  })

  it('needs all four EmailJS settings together, and accepts EmailJS instead of SMTP in production', () => {
    const emailJs = { EMAILJS_SERVICE_ID: 'service_x', EMAILJS_TEMPLATE_ID: 'template_x', EMAILJS_PUBLIC_KEY: 'pub', EMAILJS_PRIVATE_KEY: 'priv' }
    expect(() => loadEnv({ ...base, EMAILJS_SERVICE_ID: 'service_x' })).toThrow(/EMAILJS_PRIVATE_KEY/)
    expect(loadEnv({ ...base, ...emailJs }).EMAILJS_TEMPLATE_ID).toBe('template_x')
    expect(loadEnv({ ...production, SMTP_URL: undefined, MAIL_FROM: undefined, ...emailJs }).NODE_ENV).toBe('production')
  })

  it('requires Secure cookies for SameSite=None', () => {
    expect(() => loadEnv({ ...base, COOKIE_SAMESITE: 'none' })).toThrow(/COOKIE_SAMESITE/)
    expect(loadEnv({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }).COOKIE_SAMESITE).toBe('none')
  })
})
