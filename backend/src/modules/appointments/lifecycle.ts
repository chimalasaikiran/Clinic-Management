import { conflict } from '../../common/errors/app-error'
import type { AppointmentStatus } from '../../generated/prisma/client'

// pending → confirmed → arrived → in_progress → completed, with cancelled and no_show as exits before arrival.
// Rescheduling keeps the same appointment (and its history) and confirms the new time.
export const TRANSITIONS = {
  confirm: { from: ['pending'], to: 'confirmed' },
  reschedule: { from: ['pending', 'confirmed'], to: 'confirmed' },
  checkIn: { from: ['pending', 'confirmed'], to: 'arrived' },
  start: { from: ['arrived'], to: 'in_progress' },
  complete: { from: ['arrived', 'in_progress'], to: 'completed' },
  cancel: { from: ['pending', 'confirmed'], to: 'cancelled' },
  noShow: { from: ['pending', 'confirmed'], to: 'no_show' },
} as const satisfies Record<string, { from: readonly AppointmentStatus[]; to: AppointmentStatus }>

export type AppointmentAction = keyof typeof TRANSITIONS

const LABELS: Record<AppointmentStatus, string> = {
  pending: 'pending confirmation',
  confirmed: 'confirmed',
  arrived: 'checked in',
  in_progress: 'in consultation',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'marked as no-show',
}

const VERBS: Record<AppointmentAction, string> = {
  confirm: 'confirmed',
  reschedule: 'rescheduled',
  checkIn: 'checked in',
  start: 'started',
  complete: 'completed',
  cancel: 'cancelled',
  noShow: 'marked as no-show',
}

export function canTransition(action: AppointmentAction, status: AppointmentStatus): boolean {
  return (TRANSITIONS[action].from as readonly AppointmentStatus[]).includes(status)
}

// Returns the new status, or throws a 409 explaining why the action is not possible right now.
export function transition(action: AppointmentAction, status: AppointmentStatus): AppointmentStatus {
  if (!canTransition(action, status)) {
    throw conflict('INVALID_STATUS_CHANGE', `This appointment is ${LABELS[status]}, so it cannot be ${VERBS[action]}.`)
  }
  return TRANSITIONS[action].to
}
