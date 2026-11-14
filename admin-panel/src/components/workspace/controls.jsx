import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-slate-300')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  )
}

// Pill filter, e.g. "All Types (7)". `options` are { id, label, count? }.
export function FilterTabs({ options, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              selected ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-on-surface-variant hover:bg-surface-lowest',
            )}
          >
            {option.label}
            {option.count !== undefined && ` (${option.count})`}
          </button>
        )
      })}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, label = 'Search', className }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-outline" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  )
}

export function FilterSelect({ label, value, onChange, allLabel, options }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-on-surface outline-none focus:border-brand"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

// Selectable card with a radio input, used for tiers, statuses and tariff choices.
export function RadioCard({ name, value, checked, onChange, title, detail, badge }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
        checked ? 'border-brand bg-teal-50/60' : 'border-slate-200 bg-white hover:bg-surface-lowest',
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 accent-[#006a61]" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
          {title}
          {badge}
        </span>
        {detail && <span className="mt-0.5 block text-xs leading-4 text-on-surface-variant">{detail}</span>}
      </span>
    </label>
  )
}

// Checkbox row for pickers. Disabled rows read as "already added".
// `lockedChecked` shows a disabled row as ticked (already added); pass false for rows that are simply unavailable.
export function CheckRow({ checked, disabled, lockedChecked = true, onChange, label, children }) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-3',
        disabled ? 'border-slate-200 bg-surface-lowest opacity-60' : 'cursor-pointer hover:bg-surface-lowest',
        checked && !disabled ? 'border-brand bg-teal-50' : 'border-slate-200',
      )}
    >
      <input
        type="checkbox"
        checked={(disabled && lockedChecked) || checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="mt-1 accent-[#006a61]"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  )
}

export function InfoNote({ tone = 'neutral', icon: Icon, children, className }) {
  const tones = {
    neutral: 'border-slate-200 bg-surface-lowest text-on-surface-variant',
    brand: 'border-teal-200 bg-teal-50/60 text-on-surface-variant',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-800',
  }
  return (
    <div className={cn('flex items-start gap-2 rounded-md border p-3 text-xs leading-5', tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
