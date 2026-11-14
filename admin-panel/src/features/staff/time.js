// Attendance times are stored as "08:52 AM"; <input type="time"> works in "08:52".
export function to24Hour(label) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label ?? '')
  if (!match) return ''
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

export function to12Hour(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!match) return ''
  const hours = Number(match[1])
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${String(hours % 12 || 12).padStart(2, '0')}:${match[2]} ${suffix}`
}

export function formatLedgerDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
