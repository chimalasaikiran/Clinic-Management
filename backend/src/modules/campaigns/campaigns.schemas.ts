import { z } from 'zod'
import { isoDate, optionalText, pagination, uuid } from '../../common/validation/validation'

const version = z.number().int().min(1)
const text = (label: string, max: number) => z.string({ error: `Enter ${label}.` }).trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`)
const days = z.number().int().min(1, 'Use 1 day or more.').max(3650, 'Use at most 3650 days.').nullish().transform((value) => value ?? null)
const age = z.number().int().min(0).max(120).nullish().transform((value) => value ?? null)
// Values for template variables that are the same for everyone, such as {{service_name}}.
const variables = z.record(z.string().regex(/^\w{1,40}$/), z.string().trim().max(200)).default({})

export const AUDIENCE_LEAD_STAGES = ['new', 'contacted', 'qualified', 'converted'] as const
const LEAD_SOURCES = ['website', 'phone', 'front_desk', 'walk_in'] as const

export const audienceRulesSchema = z
  .object({
    include: z.enum(['leads', 'patients', 'both'], { error: 'Choose who the audience includes.' }),
    leadStages: z.array(z.enum(AUDIENCE_LEAD_STAGES)).max(4).default([]),
    leadSources: z.array(z.enum(LEAD_SOURCES)).max(4).default([]),
    leadInterest: optionalText(120),
    leadCreatedWithinDays: days,
    patientVisitedWithinDays: days,
    patientNotVisitedForDays: days,
    patientMinAge: age,
    patientMaxAge: age,
    patientGender: z.enum(['male', 'female', 'other']).nullish().transform((value) => value ?? null),
  })
  .superRefine((rules, ctx) => {
    if (rules.include !== 'patients' && !rules.leadStages.length) ctx.addIssue({ code: 'custom', path: ['leadStages'], message: 'Choose at least one lead stage.' })
    if (rules.patientMinAge !== null && rules.patientMaxAge !== null && rules.patientMinAge > rules.patientMaxAge) ctx.addIssue({ code: 'custom', path: ['patientMaxAge'], message: 'The maximum age must not be below the minimum.' })
    if (rules.patientVisitedWithinDays && rules.patientNotVisitedForDays && rules.patientNotVisitedForDays >= rules.patientVisitedWithinDays) {
      ctx.addIssue({ code: 'custom', path: ['patientNotVisitedForDays'], message: 'Must be fewer days than “visited within”, or nobody can match.' })
    }
  })

const audienceFields = {
  name: text('a name', 120),
  purpose: text('the purpose', 500),
  branchId: uuid.nullish().transform((value) => value ?? null),
  rules: audienceRulesSchema,
}

export const createAudienceSchema = z.object({ ...audienceFields, status: z.enum(['draft', 'ready']).default('draft') })
export const updateAudienceSchema = z.object({ ...audienceFields, status: z.enum(['draft', 'ready', 'archived']), changeNote: optionalText(500), version })
export const countAudienceSchema = z.object({ branchId: uuid.nullish().transform((value) => value ?? null), rules: audienceRulesSchema })
export const listAudiencesSchema = pagination(100).extend({ q: z.string().trim().max(100).optional(), status: z.enum(['draft', 'ready', 'archived']).optional() })

const CAMPAIGN_CHANNELS = ['paid_search', 'meta_ads', 'whatsapp', 'sms', 'email', 'phone'] as const
const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'completed'] as const
const money = z.number({ error: 'Enter an amount.' }).finite().max(100_000_000, 'That amount is too large.')

export const campaignSchema = z
  .object({
    name: text('a campaign name', 120),
    objective: text('the objective', 300),
    channel: z.enum(CAMPAIGN_CHANNELS, { error: 'Choose a channel.' }),
    status: z.enum(CAMPAIGN_STATUSES).default('draft'),
    branchId: uuid,
    ownerMembershipId: uuid,
    audienceId: uuid.nullish().transform((value) => value ?? null),
    budget: money.positive('Enter a positive planned budget.'),
    startDate: isoDate,
    endDate: isoDate,
    cta: text('the call to action', 120),
    landingUrl: z.string().trim().max(500).regex(/^https:\/\/\S+\.\S+$/, 'Enter an https:// landing page URL.'),
    // Required when the budget or status changes.
    changeNote: optionalText(500),
  })
  .refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'The end date must not be before the start date.' })

export const updateCampaignSchema = campaignSchema.and(z.object({ version }))

export const spendSchema = z.object({
  spentOn: isoDate,
  amount: money.refine((value) => value !== 0, 'Enter a non-zero amount; use a negative amount to correct an entry.'),
  note: text('where this figure comes from', 300),
})

export const listCampaignsSchema = pagination(100).extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  channel: z.enum(CAMPAIGN_CHANNELS).optional(),
  ownerId: uuid.optional(),
  branchId: uuid.optional(),
})

export const broadcastPreviewSchema = z.object({ templateId: uuid, variables })

export const launchBroadcastSchema = z.object({
  templateId: uuid,
  variables,
  // Empty means as soon as possible (after 9 am if it is quiet hours).
  sendAt: z.iso.datetime({ offset: true }).nullish().transform((value) => (value ? new Date(value) : null)),
  weeklyCap: z.number().int().min(1).max(14).default(2),
  // The reachable count the person confirmed; launching fails if the audience has changed since.
  expectedRecipients: z.number().int().min(1, 'Nobody in this audience can be reached.'),
  confirm: z.literal(true, { error: 'Confirm the broadcast before sending.' }),
})

const TRIGGERS = ['no_show', 'lead_not_booked', 'revisit_due', 'review_request'] as const

export const workflowSchema = z.object({
  name: text('a workflow name', 120),
  trigger: z.enum(TRIGGERS, { error: 'Choose what starts the workflow.' }),
  delayHours: z.number({ error: 'Enter how long after the event to send.' }).int().min(1, 'Use at least 1 hour.').max(8760, 'Use at most a year.'),
  branchId: uuid.nullish().transform((value) => value ?? null),
  templateId: uuid.nullish().transform((value) => value ?? null),
  variables,
  weeklyCap: z.number().int().min(1, 'Allow at least 1 message a week.').max(14, 'Use at most 14 a week.').default(2),
  ownerMembershipId: uuid,
  changeNote: optionalText(500),
})

export const updateWorkflowSchema = workflowSchema.extend({ version })
export const workflowStateSchema = z.object({ version, confirm: z.literal(true, { error: 'Confirm before switching the workflow on.' }) })
export const pauseWorkflowSchema = z.object({ version })
export const listRunsSchema = pagination(100).extend({ workflowId: uuid.optional(), outcome: z.enum(['queued', 'skipped']).optional(), problem: z.enum(['true']).optional() })

export type AudienceRulesInput = z.infer<typeof audienceRulesSchema>
export type CreateAudienceInput = z.infer<typeof createAudienceSchema>
export type UpdateAudienceInput = z.infer<typeof updateAudienceSchema>
export type ListAudiencesQuery = z.infer<typeof listAudiencesSchema>
export type CampaignInput = z.infer<typeof campaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
export type SpendInput = z.infer<typeof spendSchema>
export type ListCampaignsQuery = z.infer<typeof listCampaignsSchema>
export type BroadcastPreviewInput = z.infer<typeof broadcastPreviewSchema>
export type LaunchBroadcastInput = z.infer<typeof launchBroadcastSchema>
export type WorkflowInput = z.infer<typeof workflowSchema>
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>
export type ListRunsQuery = z.infer<typeof listRunsSchema>
