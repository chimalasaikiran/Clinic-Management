import type { INestApplication } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { ModulesContainer } from '@nestjs/core'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from '../../src/app.factory'
import { loadEnv } from '../../src/config/env'
import { PrismaService } from '../../src/database/prisma.service'
import { PATIENT_REALM_KEY } from '../../src/modules/patient-auth/patient.decorators'
import { registerPatientSchema, updatePatientProfileSchema } from '../../src/modules/patient-auth/patient-auth.schemas'
import { bearerToken } from '../../src/modules/patient-auth/patient.guard'

// Patients and staff are separate sign-in realms. These checks are decided before any query runs.
const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://app:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb',
  CORS_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TOKEN_PEPPER: 'p'.repeat(40),
})

const noDatabase = {
  isReachable: async () => false,
  $queryRaw: async () => {
    throw new Error('no database in unit tests')
  },
  // Staff routes look bearer tokens up as staff app sessions; none exist here.
  session: { findUnique: async () => null },
  $disconnect: async () => undefined,
  onApplicationShutdown: async () => undefined,
}

const TOKEN = 'a'.repeat(43)
let app: INestApplication
const http = () => request(app.getHttpServer())

beforeAll(async () => {
  app = await createTestApp(env, [{ provide: PrismaService, useValue: noDatabase }])
})

afterAll(async () => {
  await app?.close()
})

describe('patient and staff realms', () => {
  it('puts every /patient controller in the patient realm, and nothing else', () => {
    const controllers = [...app.get(ModulesContainer).values()].flatMap((module) => [...module.controllers.values()])
    const patientRoutes: string[] = []
    for (const { metatype } of controllers) {
      if (!metatype) continue
      const path = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '')
      const inRealm = Boolean(Reflect.getMetadata(PATIENT_REALM_KEY, metatype))
      const underPatient = path === 'patient' || path.startsWith('patient/')
      expect({ controller: metatype.name, inRealm }).toEqual({ controller: metatype.name, inRealm: underPatient })
      if (underPatient) patientRoutes.push(metatype.name)
    }
    expect(patientRoutes.length).toBeGreaterThanOrEqual(2)
  })

  it.each([
    ['get', '/v1/patient/me'],
    ['patch', '/v1/patient/me'],
    ['get', '/v1/patient/links'],
    ['post', '/v1/patient/links/code'],
    ['get', '/v1/patient/auth/sessions'],
    ['post', '/v1/patient/auth/logout'],
    ['get', '/v1/patient/consents'],
    ['get', '/v1/patient/records/overview'],
    ['get', '/v1/patient/consultations'],
    ['get', '/v1/patient/prescriptions'],
    ['get', '/v1/patient/orders'],
    ['get', '/v1/patient/care-plans'],
    ['get', '/v1/patient/support-tickets'],
    ['post', '/v1/patient/support-tickets'],
  ] as const)('asks for a patient session on %s %s', async (method, url) => {
    const response = await http()[method](url).expect(401)
    expect(response.body.error.code).toBe('SESSION_MISSING')
  })

  it('does not accept a staff cookie on a patient route', async () => {
    const response = await http().get('/v1/patient/me').set('Cookie', `clinicos_session=${TOKEN}`).expect(401)
    expect(response.body.error.code).toBe('SESSION_MISSING')
  })

  it('does not accept a patient token on a staff route', async () => {
    // Staff routes take bearer tokens only from staff app sessions; a patient session is not one.
    const response = await http().get('/v1/patients').set('Authorization', `Bearer ${TOKEN}`).expect(401)
    expect(response.body.error.code).toBe('SESSION_INVALID')
  })

  it('keeps the clinic-desk link routes behind a staff session', async () => {
    const id = '019a0000-0000-7000-8000-000000000000'
    await http().get(`/v1/patients/${id}/app-access`).set('Authorization', `Bearer ${TOKEN}`).expect(401)
    await http().post(`/v1/patients/${id}/app-link-code`).expect(401)
  })

  it('reads only a well-formed bearer token', () => {
    expect(bearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN)
    for (const header of [undefined, '', TOKEN, 'Bearer short', `Basic ${TOKEN}`, `Bearer ${TOKEN} extra`]) expect(bearerToken(header)).toBeNull()
  })

  it('validates a sign-in number before doing anything else', async () => {
    const response = await http().post('/v1/patient/auth/otp/request').send({ mobile: '12345' }).expect(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('patient input rules', () => {
  it('applies the same password rules the app shows', () => {
    const base = { registrationToken: TOKEN, fullName: 'Asha Rao', email: 'asha@example.com' }
    expect(registerPatientSchema.safeParse({ ...base, password: 'Clinic#2026' }).success).toBe(true)
    for (const password of ['Ab1!', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumberOrSymbol']) {
      expect(registerPatientSchema.safeParse({ ...base, password }).success).toBe(false)
    }
  })

  it('leaves unsent profile fields alone and drops unknown ones', () => {
    const parsed = updatePatientProfileSchema.parse({ city: 'Pune', mobile: '9876543210', status: 'disabled' })
    expect(Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined))).toEqual({ city: 'Pune' })
  })
})
