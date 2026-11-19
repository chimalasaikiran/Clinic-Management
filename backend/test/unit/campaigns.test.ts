import { describe, expect, it } from 'vitest'
import {
  attributedRevenue, AudienceRules, birthDateWindow, byAddress, delayLabel, describeRules, eventWindow, isUniqueViolation, Member, unfilledVariables,
} from '../../src/modules/campaigns/campaigns.logic'
import { audienceRulesSchema, campaignSchema, launchBroadcastSchema } from '../../src/modules/campaigns/campaigns.schemas'
import { inQuietHours } from '../../src/modules/messaging/messaging.logic'

const rules = (extra: Partial<AudienceRules> = {}): AudienceRules => ({
  include: 'leads', leadStages: ['new'], leadSources: [], leadInterest: null, leadCreatedWithinDays: null, patientVisitedWithinDays: null, patientNotVisitedForDays: null,
  patientMinAge: null, patientMaxAge: null, patientGender: null, ...extra,
})

const member = (kind: Member['kind'], id: string, mobile: string | null): Member => ({ kind, id, branchId: null, preferredName: id, mobile, email: null, interest: null, notify: null })

describe('audience rules', () => {
  it('describes the rules in words', () => {
    expect(describeRules(rules({ leadStages: ['new', 'qualified'], leadSources: ['website', 'phone'], leadInterest: 'knee', leadCreatedWithinDays: 30 })))
      .toEqual(['Leads at New, Qualified from website or phone interested in “knee” recorded in the last 30 days'])
    expect(describeRules(rules({ include: 'patients', patientNotVisitedForDays: 180, patientMinAge: 40, patientGender: 'female' })))
      .toEqual(['Active patients with no visit for 180 days aged 40–120 (female)'])
  })

  it('turns an age range into a date-of-birth window, including 29 February', () => {
    expect(birthDateWindow('2026-11-19', 18, 64)).toEqual({ lte: '2008-11-19', gt: '1961-11-19' })
    expect(birthDateWindow('2028-02-29', 1, null)).toEqual({ lte: '2027-02-28' })
    expect(birthDateWindow('2026-11-19', null, null)).toEqual({})
  })

  it('reaches each address once, as the patient when a converted lead shares it', () => {
    const { entries, noAddress } = byAddress([member('lead', 'lead-1', '9848022110'), member('patient', 'patient-1', '9848022110'), member('lead', 'lead-2', null)], (entry) => entry.mobile, (entry, address) => [entry.id, address])
    expect(entries).toEqual([['patient-1', '9848022110']])
    expect(noAddress).toBe(1)
  })

  it('rejects rules nobody could match', () => {
    expect(audienceRulesSchema.safeParse({ include: 'leads', leadStages: [] }).success).toBe(false)
    expect(audienceRulesSchema.safeParse({ include: 'patients', patientMinAge: 60, patientMaxAge: 40 }).success).toBe(false)
    expect(audienceRulesSchema.safeParse({ include: 'patients', patientVisitedWithinDays: 30, patientNotVisitedForDays: 60 }).success).toBe(false)
    expect(audienceRulesSchema.parse({ include: 'patients' })).toMatchObject({ leadStages: [], patientMinAge: null })
  })
})

describe('campaigns', () => {
  it('needs a positive budget, ordered dates and an https landing page', () => {
    const base = { name: 'Knee camp', objective: 'Enquiries', channel: 'whatsapp', branchId: '0195d7a0-0000-7000-8000-000000000001', ownerMembershipId: '0195d7a0-0000-7000-8000-000000000002', budget: 1000, startDate: '2026-11-20', endDate: '2026-11-30', cta: 'Book', landingUrl: 'https://aura.example/knee' }
    expect(campaignSchema.safeParse(base).success).toBe(true)
    expect(campaignSchema.safeParse({ ...base, budget: 0 }).success).toBe(false)
    expect(campaignSchema.safeParse({ ...base, endDate: '2026-11-19' }).success).toBe(false)
    expect(campaignSchema.safeParse({ ...base, landingUrl: 'http://aura.example' }).success).toBe(false)
  })

  it('credits revenue only from invoices on or after the day the lead converted', () => {
    const leads = [
      { stage: 'converted' as const, patientId: 'p1', convertedAt: new Date(), convertedOn: '2026-11-10' },
      { stage: 'qualified' as const, patientId: null, convertedAt: null, convertedOn: null },
    ]
    const invoices = [{ patientId: 'p1', invoiceDate: '2026-11-09', total: 500 }, { patientId: 'p1', invoiceDate: '2026-11-10', total: 1200.25 }, { patientId: 'p2', invoiceDate: '2026-11-12', total: 900 }]
    expect(attributedRevenue(leads, invoices)).toBe(1200.25)
  })

  it('accepts a broadcast only once it is confirmed for at least one person', () => {
    const base = { templateId: '0195d7a0-0000-7000-8000-000000000003', expectedRecipients: 3, confirm: true }
    expect(launchBroadcastSchema.parse(base)).toMatchObject({ weeklyCap: 2, variables: {}, sendAt: null })
    expect(launchBroadcastSchema.safeParse({ ...base, confirm: false }).success).toBe(false)
    expect(launchBroadcastSchema.safeParse({ ...base, expectedRecipients: 0 }).success).toBe(false)
  })
})

describe('workflows', () => {
  it('acts on events falling due between switching on and now', () => {
    const activatedAt = new Date('2026-11-19T04:00:00Z')
    const now = new Date('2026-11-19T10:00:00Z')
    expect(eventWindow(activatedAt, 48, now)).toEqual({ gte: new Date('2026-11-17T04:00:00Z'), lte: new Date('2026-11-17T10:00:00Z') })
  })

  it('lists template variables nothing would fill', () => {
    expect(unfilledVariables(['preferred_name', 'clinic_name', 'appointment_date', 'service_name'], { service_name: ' ' }, ['appointment_date'])).toEqual(['service_name'])
    expect(unfilledVariables(['preferred_name', 'service_name'], { service_name: 'knee care' })).toEqual([])
  })

  it('labels delays in days or hours', () => {
    expect(delayLabel(24)).toBe('1 day')
    expect(delayLabel(72)).toBe('3 days')
    expect(delayLabel(1)).toBe('1 hour')
    expect(delayLabel(36)).toBe('36 hours')
  })

  it('holds automated messages between 9 pm and 9 am', () => {
    expect(inQuietHours(8 * 60 + 59)).toBe(true)
    expect(inQuietHours(9 * 60)).toBe(false)
    expect(inQuietHours(20 * 60 + 59)).toBe(false)
    expect(inQuietHours(21 * 60)).toBe(true)
  })

  it('recognises a unique-constraint race', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation(new Error('other'))).toBe(false)
  })
})
