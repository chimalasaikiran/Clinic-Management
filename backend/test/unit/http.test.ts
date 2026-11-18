import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from '../../src/app.factory'
import { loadEnv } from '../../src/config/env'
import { PrismaService } from '../../src/database/prisma.service'

// The whole HTTP stack (middleware, guards, validation, error envelope) with the database replaced by a stub
// that answers nothing. Everything checked here is decided before any query runs. Database-backed flows are
// covered by the integration tests against a Neon test branch.
const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
  CORS_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TOKEN_PEPPER: 'h'.repeat(40),
})

const unreachableDatabase = {
  isReachable: async () => false,
  $queryRaw: async () => {
    throw new Error('no database in unit tests')
  },
  $disconnect: async () => undefined,
  onApplicationShutdown: async () => undefined,
}

let app: INestApplication
const http = () => request(app.getHttpServer())

beforeAll(async () => {
  app = await createTestApp(env, [{ provide: PrismaService, useValue: unreachableDatabase }])
})

afterAll(async () => {
  await app?.close()
})

describe('HTTP hardening', () => {
  it('answers liveness with security headers, a request id and no caching', async () => {
    const response = await http().get('/health/live').expect(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['strict-transport-security']).toContain('max-age=')
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(response.headers['x-powered-by']).toBeUndefined()
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reports not ready when the database cannot be reached', async () => {
    await http().get('/health/ready').expect(503)
  })

  it('allows credentialed CORS only for the admin panel origin', async () => {
    const allowed = await http().options('/v1/auth/login').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')

    const other = await http().options('/v1/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST')
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects state-changing requests from other sites', async () => {
    const response = await http().post('/v1/auth/login').set('Origin', 'https://evil.example').set('Cookie', 'clinicos_session=abc').send({})
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED')
  })
})

describe('authentication guard', () => {
  it('requires a session on protected routes', async () => {
    const response = await http().get('/v1/roles').expect(401)
    expect(response.body.error).toMatchObject({ code: 'SESSION_MISSING', message: 'Sign in to continue.', traceId: expect.any(String) })
  })

  it('ignores malformed session cookies without touching the database', async () => {
    const response = await http().get('/v1/auth/session').set('Cookie', 'clinicos_session=not-a-token').expect(401)
    expect(response.body.error.code).toBe('SESSION_MISSING')
  })

  it('signs out without a cookie and clears it anyway', async () => {
    const response = await http().post('/v1/auth/logout').set('Origin', 'http://localhost:5173').expect(204)
    const cookie = String(response.headers['set-cookie'])
    expect(cookie).toContain('clinicos_session=;')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
  })
})

describe('validation and errors', () => {
  it('returns one message per invalid field', async () => {
    const response = await http().post('/v1/auth/register').send({ fullName: '', email: 'not-an-email', password: 'short' }).expect(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(response.body.error.details).toEqual([
      { field: 'fullName', issue: 'Enter your full name.' },
      { field: 'email', issue: 'Enter a valid email address.' },
      { field: 'password', issue: 'Use at least 8 characters with a letter and a number.' },
    ])
  })

  it('wraps malformed JSON, oversized bodies and unknown routes in the same envelope', async () => {
    const malformed = await http().post('/v1/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400)
    expect(malformed.body.error.code).toBe('BAD_REQUEST')

    const huge = await http().post('/v1/auth/login').send({ email: 'a@b.test', password: 'x'.repeat(200_000) }).expect(413)
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE')

    const missing = await http().get('/v1/nothing-here').expect(404)
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', traceId: expect.any(String) })
  })

  it('hides internal errors behind a generic 500', async () => {
    const response = await http().post('/v1/auth/login').send({ email: 'owner@clinic.test', password: 'Clinic2026' }).expect(500)
    expect(response.body.error).toMatchObject({ code: 'INTERNAL', message: 'Something went wrong. Please try again.' })
    expect(JSON.stringify(response.body)).not.toContain('no database')
  })
})
