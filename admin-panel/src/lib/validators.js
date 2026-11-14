const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/

export const isBlank = (value) => !value || value.trim() === ''

export const isEmail = (value) => EMAIL_PATTERN.test(value.trim())

export const MIN_PASSWORD_LENGTH = 8

export const isStrongPassword = (value) =>
  value.length >= MIN_PASSWORD_LENGTH && /[A-Za-z]/.test(value) && /\d/.test(value)

// Accepts the number as typed: spaces and dashes are ignored.
export const isIndianMobile = (value) => INDIAN_MOBILE_PATTERN.test(value.replace(/[\s-]/g, ''))
