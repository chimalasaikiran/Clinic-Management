const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const longDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortMonths = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Parses "2026-10-26" as a local date, so the day never shifts with the time zone. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseDay(iso);
  date.setDate(date.getDate() + days);
  return toIsoDay(date);
}

export const weekday = (iso: string) => shortDays[parseDay(iso).getDay()];
export const longWeekday = (iso: string) => longDays[parseDay(iso).getDay()];

/** "26 Oct" */
export function dayMonth(iso: string): string {
  const date = parseDay(iso);
  return `${date.getDate()} ${shortMonths[date.getMonth()]}`;
}

/** "Mon, 26 Oct 2026" */
export const fullDay = (iso: string) =>
  `${weekday(iso)}, ${dayMonth(iso)} ${parseDay(iso).getFullYear()}`;

/** Weeks of a month, Monday first. Cells outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length }, (_, i) => toIsoDay(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** Adds minutes to a "10:00 AM" style time. */
export function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!match) return time;
  const [, hours, mins, half] = match;
  const total =
    (((Number(hours) % 12) + (half === 'PM' ? 12 : 0)) * 60 + Number(mins) + minutes + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const label = String(hour % 12 || 12).padStart(2, '0');
  return `${label}:${String(total % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

const longMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "14 August 1984" */
export function longDate(iso: string): string {
  const date = parseDay(iso);
  return `${date.getDate()} ${longMonths[date.getMonth()]} ${date.getFullYear()}`;
}

/** Age in whole years today. */
export function ageOn(iso: string, now = new Date()): number {
  const birth = parseDay(iso);
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  return now.getFullYear() - birth.getFullYear() - (hadBirthday ? 0 : 1);
}

/** A server timestamp as "26 Oct 2026, 09:14" in the phone's time zone. */
export function dateTime(timestamp: string): string {
  const date = new Date(timestamp);
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.getDate()} ${shortMonths[date.getMonth()]} ${date.getFullYear()}, ${clock}`;
}
