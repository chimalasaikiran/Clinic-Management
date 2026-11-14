import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../../lib/cn'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (value) => String(value).padStart(2, '0')

// Month grid starting on Monday. `status(date)` returns { disabled, label, current } for each ISO date.
export default function MonthCalendar({ year, month, selected, onSelect, onMonthChange, status }) {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const step = (delta) => {
    const next = new Date(year, month - 1 + delta, 1)
    onMonthChange(next.getFullYear(), next.getMonth() + 1)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => step(-1)} className="rounded border border-slate-200 p-1 hover:bg-surface-low"><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Next month" onClick={() => step(1)} className="rounded border border-slate-200 p-1 hover:bg-surface-low"><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 text-center">
        {WEEKDAYS.map((day) => <div key={day} className="bg-surface-low py-1.5 text-[11px] font-semibold text-on-surface-variant">{day}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} className="bg-surface-lowest" />
          const iso = `${year}-${pad(month)}-${pad(day)}`
          const info = status(iso)
          const isSelected = selected === iso
          return (
            <button
              key={iso}
              type="button"
              disabled={info.disabled}
              aria-pressed={isSelected}
              aria-label={`${day} ${title}${info.label ? `, ${info.label}` : ''}`}
              onClick={() => onSelect(iso)}
              className={cn('flex min-h-14 flex-col items-center justify-center bg-white p-1 text-sm disabled:cursor-not-allowed disabled:bg-surface-lowest disabled:text-outline', isSelected && 'ring-2 ring-black ring-inset', info.current && 'bg-amber-50')}
            >
              <span className="font-semibold">{day}</span>
              {info.label && <span className="text-[10px] text-brand">{info.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
