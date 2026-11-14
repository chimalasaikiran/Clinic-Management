import { formatDate, formatTime } from '../patients/format'

export { formatDate, formatTime }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-10-20" -> "20 Oct"
export const shortDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`

// ("2026-10-20", "10:20") -> "20 Oct · 10:20 AM"
export const shortDateTime = (iso, time) => `${shortDate(iso)} · ${formatTime(time)}`

export const qty = (value) => Number(value).toLocaleString('en-IN')

export const money = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
