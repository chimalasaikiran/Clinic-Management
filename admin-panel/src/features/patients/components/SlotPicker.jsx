import { cn } from '../../../lib/cn'
import { SESSIONS } from '../data/catalog'
import { formatTime } from '../format'

// Session tabs plus a grid of 30-minute slots. `slots` come from selectors.slotsFor.
export default function SlotPicker({ slots, session, onSessionChange, value, onChange, error }) {
  const visible = slots.filter((slot) => slot.session === session)
  const available = slots.filter((slot) => slot.state === 'available').length

  return (
    <div>
      <div role="tablist" aria-label="Session" className="mb-3 grid grid-cols-3 border-b border-slate-200 text-center text-[13px]">
        {SESSIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={session === entry.id}
            onClick={() => onSessionChange(entry.id)}
            className={cn('border-b-2 px-2 py-2', session === entry.id ? 'border-brand font-semibold text-brand' : 'border-transparent text-on-surface-variant')}
          >
            {entry.label}
            <span className="block text-[10px] font-normal">({entry.range})</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-outline">{available} slots available across the day</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((slot) => {
          const selected = value === slot.time
          return (
            <button
              key={slot.time}
              type="button"
              disabled={slot.state !== 'available'}
              aria-pressed={selected}
              aria-label={`${formatTime(slot.time)} ${slot.state}`}
              onClick={() => onChange(slot.time)}
              className={cn(
                'rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed',
                selected ? 'border-black bg-black text-white' : slot.state === 'available' ? 'border-slate-200 bg-white hover:border-brand' : slot.state === 'rounds' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-100 bg-surface-lowest text-outline',
              )}
            >
              <span className="block text-sm font-semibold">{formatTime(slot.time)}</span>
              <span className="block text-[10px]">{selected ? 'Selected' : slot.state === 'available' ? 'Available' : slot.state === 'rounds' ? 'Clinician rounds' : 'Booked'}</span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
