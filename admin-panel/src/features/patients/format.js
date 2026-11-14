// "Today" for the sample data. Real builds read the clock; the seeded records are dated around this day.
export const TODAY = '2026-10-12'

const parts = (iso) => iso.split('-').map(Number)

export function formatDate(iso) {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatLongDate(iso) {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatWeekday(iso) {
  const [year, month, day] = parts(iso)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { weekday: 'long' })
}

// "10:30" -> "10:30 AM"
export function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

export function formatINR(value, fractionDigits = 0) {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`
}

export function ageFrom(dob, today = TODAY) {
  const [birthYear, birthMonth, birthDay] = parts(dob)
  const [year, month, day] = parts(today)
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0)
}

export function daysBetween(fromIso, toIso) {
  const [fy, fm, fd] = parts(fromIso)
  const [ty, tm, td] = parts(toIso)
  return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 86400000)
}

export function initialsOf(name) {
  return name
    .replace(/^(dr|mr|mrs|ms|master|baby)\.?\s+/i, '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export const digitsOf = (text) => String(text ?? '').replace(/\D/g, '')

// Next sequential id for a prefix, e.g. nextId('INV-2026-', ['INV-2026-084'], 3) -> 'INV-2026-085'.
export function nextId(prefix, existingIds, width = 3) {
  const highest = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0)
  return `${prefix}${String(highest + 1).padStart(width, '0')}`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function wordsBelowThousand(value) {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const tail = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', tail].filter(Boolean).join(' ')
}

// Whole-rupee amount in words using the lakh / crore system, e.g. 7000 -> "Indian Rupees Seven Thousand Only".
export function amountInWords(amount) {
  let remaining = Math.round(amount)
  if (remaining === 0) return 'Indian Rupees Zero Only'
  const units = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]
  const words = []
  units.forEach(([size, label]) => {
    const count = Math.floor(remaining / size)
    if (count) words.push(`${wordsBelowThousand(count)} ${label}`)
    remaining %= size
  })
  if (remaining) words.push(wordsBelowThousand(remaining))
  return `Indian Rupees ${words.join(' ')} Only`
}
