// Labels and conversions for the audience, campaign and workflow screens.

export const CAMPAIGN_CHANNELS = { paid_search: 'Paid search', meta_ads: 'Meta Ads', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', phone: 'Phone' }
export const CAMPAIGN_STATUSES = { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', completed: 'Completed' }
export const CAMPAIGN_TONE = { draft: 'neutral', scheduled: 'info', active: 'success', paused: 'warning', completed: 'neutral' }
// Campaigns on these channels can send broadcasts through the connected messaging channel.
export const BROADCAST_CHANNELS = ['whatsapp', 'sms', 'email']

export const AUDIENCE_STATUSES = { draft: 'Draft', ready: 'Ready', archived: 'Archived' }
export const AUDIENCE_TONE = { draft: 'neutral', ready: 'success', archived: 'warning' }
export const AUDIENCE_INCLUDE = { leads: 'Leads', patients: 'Patients', both: 'Leads and patients' }
export const AUDIENCE_STAGES = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted' }
export const LEAD_SOURCES = { website: 'Website', phone: 'Phone', front_desk: 'Front desk', walk_in: 'Walk-in' }
export const GENDERS = { female: 'Female', male: 'Male', other: 'Other' }

export const BROADCAST_STATUSES = { scheduled: 'Scheduled', sending: 'Sending', completed: 'Completed', cancelled: 'Cancelled' }
export const BROADCAST_TONE = { scheduled: 'info', sending: 'brand', completed: 'success', cancelled: 'warning' }

export const TRIGGERS = { no_show: 'Appointment marked no-show', lead_not_booked: 'Lead not yet converted', revisit_due: 'Visit completed' }
// Whether each trigger's delay reads best in hours or days.
export const TRIGGER_UNIT = { no_show: 'hours', lead_not_booked: 'days', revisit_due: 'days' }
export const WORKFLOW_STATUSES = { draft: 'Draft', active: 'Active', paused: 'Paused' }
export const WORKFLOW_TONE = { draft: 'neutral', active: 'success', paused: 'warning' }

export const MESSAGE_STATUSES = { queued: 'Queued', sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Outcome unknown' }

// Empty form values for an audience's rules.
export const blankRules = () => ({ include: 'leads', leadStages: [], leadSources: [], leadInterest: '', leadCreatedWithinDays: '', patientVisitedWithinDays: '', patientNotVisitedForDays: '', patientMinAge: '', patientMaxAge: '', patientGender: '' })

export const rulesToForm = (rules) => ({
  ...blankRules(),
  ...rules,
  leadInterest: rules.leadInterest ?? '',
  ...Object.fromEntries(['leadCreatedWithinDays', 'patientVisitedWithinDays', 'patientNotVisitedForDays', 'patientMinAge', 'patientMaxAge'].map((key) => [key, rules[key] === null || rules[key] === undefined ? '' : String(rules[key])])),
  patientGender: rules.patientGender ?? '',
})

const number = (value) => (value === '' || value === null || value === undefined ? null : Number(value))

// Form values as the API's rules: only the parts for the people included.
export function formToRules(form) {
  const leads = form.include !== 'patients'
  const patients = form.include !== 'leads'
  return {
    include: form.include,
    leadStages: leads ? form.leadStages : [],
    leadSources: leads ? form.leadSources : [],
    leadInterest: leads ? form.leadInterest.trim() || null : null,
    leadCreatedWithinDays: leads ? number(form.leadCreatedWithinDays) : null,
    patientVisitedWithinDays: patients ? number(form.patientVisitedWithinDays) : null,
    patientNotVisitedForDays: patients ? number(form.patientNotVisitedForDays) : null,
    patientMinAge: patients ? number(form.patientMinAge) : null,
    patientMaxAge: patients ? number(form.patientMaxAge) : null,
    patientGender: patients ? form.patientGender || null : null,
  }
}

// "18 hours" / "2 days" for a workflow delay.
export const delayText = (hours) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`)

export const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
