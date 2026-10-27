const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/

export const isBlank = (value) => !value || value.trim() === ''

export const isEmail = (value) => EMAIL_PATTERN.test(value.trim())

// Accepts the number as typed: spaces and dashes are ignored.
export const isIndianMobile = (value) => INDIAN_MOBILE_PATTERN.test(value.replace(/[\s-]/g, ''))
