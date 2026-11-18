export const GOAL_STATUSES = ['Improving / On Target', 'Unchanged', 'Worsening', 'Achieved', 'Unable to Assess'] as const
export const ADHERENCE_STATES = ['Staged', 'Completed', 'Partially Completed', 'Not Completed'] as const

export type GoalStatus = (typeof GOAL_STATUSES)[number] | 'Pending Baseline'
export type PlanStatus = 'on_track' | 'at_risk' | 'achieved'

export interface ReviewGoal {
  id: string
  title: string
  status: string
}

// Share of rated goals that are on target or achieved; goals that could not be assessed do not count.
export function compliance(statuses: string[]): number {
  const rated = statuses.filter((status) => status !== 'Unable to Assess' && status !== 'Pending Baseline')
  if (rated.length === 0) return 0
  return Math.round((rated.filter((status) => status === 'Improving / On Target' || status === 'Achieved').length / rated.length) * 100)
}

// Any worsening goal puts the plan at risk; every goal achieved means the plan is achieved.
export function planStatus(statuses: string[]): PlanStatus {
  if (statuses.includes('Worsening')) return 'at_risk'
  if (statuses.length > 0 && statuses.every((status) => status === 'Achieved')) return 'achieved'
  return 'on_track'
}

// Why a follow-up cannot be completed yet, or null. Saving progress has no such rules.
export function completionProblem(goals: ReviewGoal[], nextReview: string | undefined, today: string, escalate: boolean): string | null {
  const unrated = goals.filter((goal) => !GOAL_STATUSES.includes(goal.status as (typeof GOAL_STATUSES)[number]))
  if (unrated.length) return 'Choose a status for every goal before completing the follow-up.'
  if (!nextReview || nextReview <= today) return 'Choose a next review date after today.'
  if (goals.some((goal) => goal.status === 'Worsening') && !escalate) return 'A worsening goal must be escalated for attending review before the follow-up can be completed.'
  return null
}

export const reviewSummary = (goals: ReviewGoal[]) => goals.map((goal) => `${goal.title}: ${goal.status}`).join('; ') || 'no goals rated'
