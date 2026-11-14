import { formatINR } from '../patients/format'

export const SCOPE_TEXT = 'Aura Health · All locations (3)'

// "₹1,500", or "—" when the amount is not known (unavailable is not zero).
export const money = (value) => (value === null || value === undefined ? '—' : formatINR(value))
