import type { Limit } from '../../common/security/rate-limit.service'

const MINUTE = 60
const HOUR = 60 * MINUTE

// Per-number limits protect one person from code floods and guessing; per-IP limits stop one machine
// working through many numbers. Both apply.
export const PATIENT_LIMITS = {
  codeIp: { name: 'patient-code:ip', max: 20, windowSeconds: HOUR },
  codeMobile: { name: 'patient-code:mobile', max: 5, windowSeconds: HOUR },
  verifyIp: { name: 'patient-verify:ip', max: 30, windowSeconds: 15 * MINUTE },
  verifyMobile: { name: 'patient-verify:mobile', max: 10, windowSeconds: 15 * MINUTE },
  registerIp: { name: 'patient-register:ip', max: 10, windowSeconds: HOUR },
  linkCodeIp: { name: 'patient-link-code:ip', max: 20, windowSeconds: 15 * MINUTE },
  linkCodeAccount: { name: 'patient-link-code:account', max: 5, windowSeconds: 15 * MINUTE },
  bookingAccount: { name: 'patient-booking:account', max: 30, windowSeconds: HOUR },
  requestsAccount: { name: 'patient-requests:account', max: 30, windowSeconds: HOUR },
} satisfies Record<string, Limit>
