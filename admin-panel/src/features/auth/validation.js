import { isBlank, isEmail, isStrongPassword, MIN_PASSWORD_LENGTH } from '../../lib/validators'

export const OTP_LENGTH = 6

export function validateAccount({ fullName, email, password }) {
  const errors = {}

  if (isBlank(fullName)) errors.fullName = 'Enter your full name.'

  if (isBlank(email)) errors.email = 'Enter your work email.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Create a password.'
  else if (!isStrongPassword(password)) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters with a letter and a number.`
  }

  return errors
}

export function validateSignIn({ email, password }) {
  const errors = {}

  if (isBlank(email)) errors.email = 'Enter your work email.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Enter your password.'

  return errors
}

export function validateOtp(digits) {
  const code = digits.join('')
  if (code.length < OTP_LENGTH) return { code: `Enter the ${OTP_LENGTH}-digit code.` }
  return {}
}
