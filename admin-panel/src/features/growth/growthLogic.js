import { GROWTH_TODAY } from './constants'

const stamp = ({ date, time }) => `${date} ${time ?? '00:00'}`
const matches = (text, query) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase())

// ---- Campaigns, segments, content, workflows ----------------------------------------------------------------

export function validateCampaign(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter a campaign name.'
  if (!values.objective.trim()) errors.objective = 'Enter the objective.'
  if (!(Number(values.budget) > 0)) errors.budget = 'Enter a positive planned budget.'
  if (!values.start) errors.start = 'Choose a start date.'
  if (!values.end) errors.end = 'Choose an end date.'
  else if (values.start && values.end < values.start) errors.end = 'The end date must not be before the start date.'
  if (!values.cta.trim()) errors.cta = 'Enter the call to action.'
  if (!/^https:\/\/\S+\.\S+/.test(values.landing.trim())) errors.landing = 'Enter an https:// landing page URL.'
  return errors
}

export function validateSegment(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter a segment name.'
  if (!values.purpose.trim()) errors.purpose = 'Enter the purpose.'
  if (!values.lifecycle.length) errors.lifecycle = 'Choose at least one permitted lifecycle stage before saving.'
  return errors
}

export function validateContent(values) {
  const errors = {}
  if (!values.title.trim()) errors.title = 'Enter a title.'
  if (!values.caption.trim()) errors.caption = 'Enter the caption.'
  if (!values.cta.trim()) errors.cta = 'Enter the call to action.'
  if (!/^https:\/\/\S+\.\S+/.test(values.url.trim())) errors.url = 'Enter an https:// destination URL.'
  if (!values.alt.trim()) errors.alt = 'Add alt text for the media.'
  if (!values.date) errors.date = 'Choose the intended date.'
  else if (values.date < GROWTH_TODAY) errors.date = 'The intended date must not be in the past.'
  if (!values.time) errors.time = 'Choose the intended time.'
  return errors
}

export function validateWorkflow(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Enter a workflow name.'
  if (!values.trigger.trim()) errors.trigger = 'Describe the trigger.'
  return errors
}

// ---- Message templates and privacy ---------------------------------------------------------------------------

export const TEMPLATE_VARIABLES = ['preferred_name', 'appointment_date', 'appointment_time', 'service_name']

export function templateVariables(body) {
  return [...new Set([...body.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]))]
}

export const unknownVariables = (body) => templateVariables(body).filter((name) => !TEMPLATE_VARIABLES.includes(name))

export function renderTemplate(body, values) {
  return body.replace(/{{\s*(\w+)\s*}}/g, (token, name) => values[name] ?? token)
}

// Public replies must not carry personal or clinical detail.
const SENSITIVE = [/\b\d{10}\b/, /\b[\w.+-]+@[\w-]+\.\w+/, /\b(diagnos\w*|prescri\w*|treatment|surgery|medicine|appointment on|your visit on)\b/i]

export function privacyFindings(text) {
  return SENSITIVE.filter((pattern) => pattern.test(text)).length
}

// ---- Reviews ----------------------------------------------------------------------------------------------

export function reviewRows(reviews, { rating = '', response = '', escalated = '', escalations = [], query = '' }) {
  const hasEscalation = (review) => escalations.some((entry) => entry.reviewId === review.id)
  return reviews
    .filter((review) => (!rating || String(review.rating) === rating) && (!response || review.responseState === response) && (!escalated || (escalated === 'Escalated') === hasEscalation(review)))
    .filter((review) => matches(`${review.id} ${review.text} ${review.alias}`, query))
    .sort((a, b) => stamp(b).localeCompare(stamp(a)))
}

export function reviewMetrics(reviews) {
  const total = reviews.length
  const average = total ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / total) * 10) / 10 : null
  return { total, average, distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((review) => review.rating === star).length })), confirmedResponses: reviews.filter((review) => review.responseState === 'Response approved').length }
}

// ---- Content calendar -------------------------------------------------------------------------------------

// Monday-first grid of ISO dates covering `year`/`month` (0-based).
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const start = new Date(first)
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7))
  const weeks = []
  const cursor = new Date(start)
  do {
    weeks.push(Array.from({ length: 7 }, () => { const iso = cursor.toISOString().slice(0, 10); cursor.setUTCDate(cursor.getUTCDate() + 1); return iso }))
  } while (cursor.getUTCMonth() === month || weeks.length < 4)
  return weeks
}

export const shiftMonth = ({ year, month }, delta) => { const date = new Date(Date.UTC(year, month + delta, 1)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() } }

export function contentRows(content, { query = '', channel = '', status = '' }) {
  return content
    .filter((item) => (!channel || item.channels.includes(channel)) && (!status || item.status === status) && matches(`${item.title} ${item.id} ${item.owner}`, query))
    .sort((a, b) => stamp(a).localeCompare(stamp(b)))
}
