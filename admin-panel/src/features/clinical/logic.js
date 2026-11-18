import { isBlank } from '../../lib/validators'
import { addDays } from '../appointments/logic'
import { daysBetween, TODAY } from '../patients/format'

// ── care plans ────────────────────────────────────────────────────────────────
export function validateCarePlan(values) {
  const errors = {}
  if (isBlank(values.title)) errors.title = 'Enter the care plan title.'
  if (!values.leadId) errors.leadId = 'Choose the responsible clinician.'
  if (!values.category) errors.category = 'Choose the clinical category.'
  if (values.diagnoses.length === 0) errors.diagnoses = 'Link at least one diagnosis or health concern.'
  if (isBlank(values.rationale) || values.rationale.trim().length < 20) errors.rationale = 'Describe the clinical rationale and therapeutic objectives (at least 20 characters).'
  if (!values.start) errors.start = 'Choose the start date.'
  if (!values.interim || values.interim <= values.start) errors.interim = 'The interim review must fall after the start date.'
  if (!values.target || values.target <= values.interim) errors.target = 'The target completion must fall after the interim review.'
  if (values.goals.length === 0) errors.goals = 'Add at least one measurable clinical goal.'
  if (values.interventions.length === 0) errors.interventions = 'Add at least one planned intervention.'
  return errors
}

export function validateGoal(goal) {
  const errors = {}
  if (isBlank(goal.title)) errors.title = 'Name the goal.'
  if (isBlank(goal.target)) errors.target = 'State the measurable target.'
  return errors
}

export function validateIntervention(entry) {
  return isBlank(entry.title) ? { title: 'Describe the intervention.' } : {}
}

export const defaultDates = (start = TODAY) => ({ start, interim: addDays(start, 30), target: addDays(start, 183) })

// A plan that covers the same category as an active one is flagged as a possible duplicate; it does not block activation.
export const duplicatePlans = (plans, values) => plans.filter((plan) => plan.status !== 'Draft' && (plan.category === values.category || plan.title.trim().toLowerCase() === values.title.trim().toLowerCase()))

// ── progress reviews ──────────────────────────────────────────────────────────
export function goalsOf(plan) {
  return plan.goals ?? plan.milestones.map((milestone) => ({ id: milestone.no, title: milestone.title, target: milestone.detail, status: 'Pending Baseline' }))
}

export function validateReview(values, { complete }) {
  const errors = {}
  if (isBlank(values.observation) || values.observation.trim().length < 10) errors.observation = 'Record the general clinical progress observation (at least 10 characters).'
  if (complete) {
    const unrated = Object.entries(values.goalStatus).filter(([, status]) => !status)
    if (unrated.length) errors.goals = 'Choose a status for every goal before completing the follow-up.'
    if (!values.nextReview || values.nextReview <= TODAY) errors.nextReview = 'Choose a next review date after today.'
    if (Object.values(values.goalStatus).includes('Worsening') && !values.escalate) errors.escalate = 'A worsening goal must be escalated for attending review before the follow-up can be completed.'
  }
  return errors
}

export const overdueDays = (nextReview) => Math.max(0, daysBetween(nextReview, TODAY))

// ── incidents ─────────────────────────────────────────────────────────────────
export function validateIncident(values, { today = TODAY } = {}) {
  const errors = {}
  if (!values.category) errors.category = 'Choose the incident category.'
  if (!values.severity) errors.severity = 'Choose the harm severity.'
  if (!values.date) errors.date = 'Enter the date of occurrence.'
  else if (values.date > today) errors.date = 'The incident cannot have occurred in the future.'
  if (!values.time) errors.time = 'Enter the time of occurrence.'
  if (!values.zone) errors.zone = 'Choose the clinical zone.'
  if (values.associate && !values.patientId) errors.patientId = 'Choose the patient, or switch to a general incident.'
  if (isBlank(values.headline) || values.headline.trim().length < 10) errors.headline = 'Write a one-line summary (at least 10 characters).'
  if (isBlank(values.chronology) || values.chronology.trim().length < 30) errors.chronology = 'Describe what happened in order (at least 30 characters).'
  if (Number(values.severity) >= 4 && isBlank(values.actions)) errors.actions = 'Record the immediate corrective actions taken for a moderate-or-worse harm event.'
  return errors
}
