// Conversions between instants (stored as timestamptz) and the clinic's wall-clock date and time.
// Uses the platform's time zone database through Intl, so zones with daylight saving work too.

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, format)
  }
  return format
}

function parts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((part) => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) }
}

// Local calendar date (YYYY-MM-DD) of an instant.
export function localDate(instant: Date, timeZone: string): string {
  const { year, month, day } = parts(instant, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Minutes after local midnight of an instant.
export function localMinute(instant: Date, timeZone: string): number {
  const { hour, minute } = parts(instant, timeZone)
  return hour * 60 + minute
}

// The instant at which the local clock in `timeZone` shows `date` and `minute` (minutes after midnight).
export function zonedInstant(date: string, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const wallClock = Date.UTC(year, month - 1, day, 0, minute)
  // The zone offset is the gap between the wall clock and UTC; check it again at the result for DST edges.
  let instant = wallClock - offsetAt(wallClock, timeZone)
  instant = wallClock - offsetAt(instant, timeZone)
  return new Date(instant)
}

function offsetAt(epochMs: number, timeZone: string) {
  const { year, month, day, hour, minute } = parts(new Date(epochMs), timeZone)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  return asUtc - Math.floor(epochMs / 60_000) * 60_000
}

// 0 = Sunday … 6 = Saturday, for a calendar date.
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

export const minuteToTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

export const timeToMinute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
