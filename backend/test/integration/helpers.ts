import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { inject } from 'vitest'
import { createTestApp } from '../../src/app.factory'
import { MailMessage, MailSender } from '../../src/common/mail/mail.service'
import { loadEnv } from '../../src/config/env'
import { PrismaService } from '../../src/database/prisma.service'

export const WEB_ORIGIN = 'http://localhost:5173'

export const testEnv = () =>
  loadEnv({
    NODE_ENV: 'test',
    // TEST_LOG_LEVEL=error shows server errors behind unexpected 500s.
    LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? 'silent',
    DATABASE_URL: inject('databaseUrl'),
    DATABASE_POOL_MAX: '4',
    // The tests run from wherever the developer is; a far-away Neon region makes each statement slow.
    DATABASE_TX_TIMEOUT_MS: '30000',
    CORS_ORIGINS: WEB_ORIGIN,
    APP_URL: WEB_ORIGIN,
    TOKEN_PEPPER: 'test-pepper-0123456789-0123456789-abcdef',
    MESSAGING_SECRET_KEY: Buffer.alloc(32, 7).toString('base64'),
    // Tests run the sending worker by hand, so each step is deterministic.
    MESSAGING_WORKER: 'false',
    PUBLIC_API_URL: 'https://api.clinic.test',
  })

// Records outgoing email so tests can read the codes and links a person would receive.
export class CaptureMailSender extends MailSender {
  readonly sent: MailMessage[] = []

  async send(message: MailMessage) {
    this.sent.push(message)
  }

  to(address: string) {
    return this.sent.filter((message) => message.to === address)
  }

  lastCode(address: string) {
    const code = this.to(address).at(-1)?.subject.match(/^(\d{6}) /)?.[1]
    if (!code) throw new Error(`No code emailed to ${address}`)
    return code
  }

  lastInvitationToken(address: string) {
    const token = this.to(address).at(-1)?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1]
    if (!token) throw new Error(`No invitation emailed to ${address}`)
    return token
  }
}

// A browser: keeps cookies between requests and sends the admin panel's Origin, as fetch would.
export type Browser = ReturnType<typeof request.agent>

export interface TestContext {
  app: INestApplication
  mail: CaptureMailSender
  prisma: PrismaService
  browser: () => Browser
}

// `overrides` replace further providers, for example the messaging transport with fake WhatsApp / SMS / email.
export async function startApp(overrides: Array<{ provide: unknown; useValue: unknown }> = []): Promise<TestContext> {
  const mail = new CaptureMailSender()
  const app = await createTestApp(testEnv(), [{ provide: MailSender, useValue: mail }, ...overrides])
  return {
    app,
    mail,
    prisma: app.get(PrismaService),
    browser: () => request.agent(app.getHttpServer()).set('Origin', WEB_ORIGIN),
  }
}

export async function stopApp(ctx: TestContext) {
  await ctx.app.close()
}

export async function resetState(ctx: TestContext) {
  await ctx.prisma.$executeRaw`
    truncate table conversation_notes, messages, conversations, contact_consents, message_templates, messaging_channels, lead_activities, leads, advance_recoveries, payroll_advances, payroll_adjustments, payroll_entries, payroll_cycles, pay_profiles, payroll_settings, payroll_events,
      dispense_lines, dispenses, pharmacy_cases, stock_adjustments, receipt_discrepancies, goods_receipt_lines, goods_receipts,
      purchase_order_lines, purchase_orders, stock_reservations, stock_transfer_lines, stock_transfers, stock_request_lines, stock_requests,
      inventory_events, stock_movements, stock_batches, stock_item_suppliers, stock_items, suppliers, stock_locations,
      reconciliation_exceptions, statement_lines, statement_imports, payment_allocations, refunds, payments,
      invoice_lines, charges, invoices, billing_service_prices, billing_services, billing_settings, finance_events,
      incidents, care_plan_reviews, care_plan_interventions, care_plan_goals, care_plans, referral_events, referrals,
      order_events, diagnostic_order_items, diagnostic_orders, prescription_events, prescription_items, prescriptions,
      note_addenda, clinical_notes, clinical_alerts, allergies, diagnoses, vital_signs, encounters,
      attendance_corrections, attendance_records, staff_leaves, staff_branches, staff_members,
      appointment_events, appointments, practitioner_availability, practitioners, patients, org_counters,
      audit_log, rate_limits, sessions, verification_codes, invitations, membership_roles, memberships,
      role_branches, role_permissions, roles, branches, organisations, users restart identity cascade`
  ctx.mail.sent.length = 0
}

export const PASSWORD = 'Clinic2026'

export async function signIn(browser: Browser, email: string, password = PASSWORD) {
  return browser.post('/v1/auth/login').send({ email, password }).expect(200)
}

// Registers, verifies and signs in a new account in a fresh browser.
export async function createVerifiedUser(ctx: TestContext, email: string, password = PASSWORD, fullName = 'Test User') {
  const browser = ctx.browser()
  await browser.post('/v1/auth/register').send({ fullName, email, password }).expect(202)
  await browser.post('/v1/auth/email-verification/confirm').send({ email, code: ctx.mail.lastCode(email) }).expect(200)
  await signIn(browser, email, password)
  return browser
}

export const CLINIC = { clinicName: 'Aura Health', location: 'Kondapur Main Campus', city: 'Hyderabad', state: 'Telangana', facilityType: 'Multi-specialty Clinic' }

export async function createOwner(ctx: TestContext, email = 'owner@aura.test') {
  const browser = await createVerifiedUser(ctx, email, PASSWORD, 'Siddharth Verma')
  const res = await browser.post('/v1/organisations').send(CLINIC).expect(201)
  return { browser, orgId: res.body.data.organisation.id as string, membership: res.body.data }
}

export function sessionCookie(response: { headers: Record<string, unknown> }) {
  const cookies = response.headers['set-cookie'] as string[] | undefined
  return cookies?.find((cookie) => cookie.startsWith('clinicos_session=')) ?? null
}
