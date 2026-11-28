import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

const BANNER_TONES = {
  neutral: ['border-slate-200 bg-surface-low', Info, 'text-brand'],
  brand: ['border-teal-200 bg-teal-50', CheckCircle2, 'text-brand'],
  warning: ['border-amber-200 bg-amber-50', AlertTriangle, 'text-amber-700'],
  danger: ['border-red-200 bg-red-50', AlertTriangle, 'text-danger'],
}

// Full-width notice with an optional action on the right.
export function Banner({ tone = 'neutral', title, children, action, className }) {
  const [box, Icon, iconTone] = BANNER_TONES[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'note'} className={cn('flex items-center gap-3 rounded-md border p-4', box, className)}>
      <Icon className={cn('size-4 shrink-0 self-start', iconTone)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-xs leading-5 text-on-surface-variant">
        {title && <p className="text-[13px] font-semibold text-on-surface">{title}</p>}
        {children}
      </div>
      {action}
    </div>
  )
}

// A row of figures divided by hairlines; `value` of null renders "—" because unavailable is not zero.
export function MetricStrip({ items, footer }) {
  return (
    <div className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
        {items.map((item) => (
          <div key={item.label} className="p-5">
            <dt className="text-xs text-on-surface-variant">{item.label}</dt>
            <dd className="mt-2 text-[28px] leading-8 font-semibold">{item.value ?? '—'}</dd>
            {item.hint && <p className="mt-2 text-[11px] text-outline">{item.hint}</p>}
          </div>
        ))}
      </dl>
      {footer && <p className="border-t border-slate-200 bg-surface-lowest px-5 py-3 text-xs text-outline">{footer}</p>}
    </div>
  )
}

export function Section({ title, aside, children, className }) {
  return (
    <section className={cn('rounded-md border border-slate-200 bg-white p-6', className)}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
        </div>
        {aside && <div className="text-xs text-outline">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

export function GovernanceFooter({ children }) {
  return (
    <footer className="mt-8 flex items-start gap-4 border-t border-slate-300 pt-4 text-[11px] text-outline">
      <ShieldCheck className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="flex-1 text-xs text-on-surface-variant">{children}</p>
      <span className="whitespace-nowrap">ClinicOS</span>
    </footer>
  )
}

// "1 Enter payment → 2 Review → 3 Confirm"; steps before `current` show a tick.
export function Steps({ steps, current }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-xs">
      {steps.map((step, index) => (
        <li key={step} aria-current={index === current ? 'step' : undefined} className={cn(index === current ? 'font-semibold text-on-surface' : index < current ? 'font-semibold text-brand' : 'text-outline')}>
          {index < current ? '✓' : index + 1} {step}
        </li>
      ))}
    </ol>
  )
}

const FILTER_SELECT = 'mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand'

// Labelled <select> used by the register filter rows.
export function FilterField({ label, value, onChange, options, className, disabled }) {
  return (
    <label className={cn('block text-xs font-medium text-on-surface-variant', className)}>
      {label}
      <select value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className={cn(FILTER_SELECT, disabled && 'bg-surface-lowest text-on-surface-variant')}>
        {options.map((option) => {
          const [id, text] = Array.isArray(option) ? option : [option, option]
          return <option key={id} value={id}>{text}</option>
        })}
      </select>
    </label>
  )
}

export function TextLink({ to, state, children, className }) {
  return <Link to={to} state={state} className={cn('font-semibold text-brand hover:underline', className)}>{children}</Link>
}

export function KeyValue({ label, children, hint, className }) {
  return (
    <div className={className}>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold">{children}</dd>
      {hint && <p className="mt-0.5 text-[11px] font-normal text-outline">{hint}</p>}
    </div>
  )
}

export function Scope({ left, right = 'Currency: INR (₹) · Time: IST' }) {
  return (
    <p className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-outline">
      <span>{left}</span>
      <span>{right}</span>
    </p>
  )
}
