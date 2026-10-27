import { isBlank, isEmail, isIndianMobile } from '../../lib/validators'

export const OTP_LENGTH = 6

export function validateAccount({ fullName, email, mobile }) {
  const errors = {}

  if (isBlank(fullName)) errors.fullName = 'Enter your full name.'

  if (isBlank(email)) errors.email = 'Enter your work email.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'

  if (isBlank(mobile)) errors.mobile = 'Enter your mobile number.'
  else if (!isIndianMobile(mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.'

  return errors
}

export function validateOtp(digits) {
  const code = digits.join('')
  if (code.length < OTP_LENGTH) return { code: `Enter the ${OTP_LENGTH}-digit code.` }
  return {}
}
