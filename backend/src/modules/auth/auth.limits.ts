import type { Limit } from '../../common/security/rate-limit.service'

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Per-IP limits stop one machine hammering many accounts; per-email limits stop many machines
// hammering one account. Both apply.
export const LIMITS = {
  registerIp: { name: 'register:ip', max: 10, windowSeconds: HOUR },
  registerEmail: { name: 'register:email', max: 5, windowSeconds: HOUR },
  loginIp: { name: 'login:ip', max: 30, windowSeconds: 15 * MINUTE },
  loginEmail: { name: 'login:email', max: 10, windowSeconds: 15 * MINUTE },
  verifyIp: { name: 'verify:ip', max: 30, windowSeconds: 15 * MINUTE },
  verifyEmail: { name: 'verify:email', max: 10, windowSeconds: 15 * MINUTE },
  resendIp: { name: 'resend:ip', max: 20, windowSeconds: HOUR },
  resendEmail: { name: 'resend:email', max: 5, windowSeconds: HOUR },
  resetRequestIp: { name: 'reset-request:ip', max: 20, windowSeconds: HOUR },
  resetRequestEmail: { name: 'reset-request:email', max: 5, windowSeconds: HOUR },
  resetConfirmIp: { name: 'reset-confirm:ip', max: 30, windowSeconds: 15 * MINUTE },
  resetConfirmEmail: { name: 'reset-confirm:email', max: 10, windowSeconds: 15 * MINUTE },
  passwordChange: { name: 'password-change:user', max: 10, windowSeconds: 15 * MINUTE },
  session: { name: 'session:user', max: 120, windowSeconds: MINUTE },
  createOrganisation: { name: 'organisation-create:user', max: 5, windowSeconds: DAY },
  invitationCreate: { name: 'invitation-create:user', max: 50, windowSeconds: HOUR },
  invitationAcceptIp: { name: 'invitation-accept:ip', max: 20, windowSeconds: 15 * MINUTE },
} satisfies Record<string, Limit>

// Brute-force protection on the account itself: this many wrong passwords in a row locks sign-in for a while.
// It matches the per-email limit above, so a locked account and an unknown email look the same to a caller.
export const LOGIN_LOCK = { failures: 10, minutes: 15 }
