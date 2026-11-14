import { formatDate } from '../patients/format'

// { date: '2026-10-21', time: '16:00' } -> "21 Oct 2026 · 16:00 IST"
export const when = (stamp) => (stamp ? `${formatDate(stamp.date)}${stamp.time ? ` · ${stamp.time} IST` : ''}` : '—')

export const day = (iso) => (iso ? formatDate(iso) : '—')

export const TONES = { Overdue: 'warning', 'Due today': 'info', Upcoming: 'neutral', None: 'neutral' }
